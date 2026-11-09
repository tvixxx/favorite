import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateUserMovieBodyDto,
  UpdateUserMovieDto,
  RateUserMovieDto,
} from './dto';
import type { UserMovie, Prisma } from '../generated/prisma/client';
import { ContentKind, Genre, WatchStatus } from '../generated/prisma/enums';
import { lockResource } from '../common/utils/transaction-lock';
import { invalidateDataCache } from '../common/utils/data-revision';
import type { CollectionQueryDto } from './dto/collection-query.dto';
import type { CollectionExportQueryDto } from './collection-export.dto';
import { MAX_SNAPSHOT_ROWS, serializeCollectionFile } from './collection-file';
import { movieTitleFilter } from '../common/utils/movie-title-filter';
import { resolveWatchProgress } from './watch-progress';

interface UserMovieFilters {
  contentKind?: ContentKind;
  genres?: Genre[];
  countryCodes?: string[];
  personalRateMin?: number;
  personalRateMax?: number;
  publishDateFrom?: string;
  publishDateTo?: string;
  isFavorite?: boolean;
  seeLater?: boolean;
  watchStatus?: WatchStatus;
  isSerial?: boolean;
}

type UserMovieAnalytics = {
  totalTitles: number;
  totalMovies: number;
  totalSerials: number;
  addedLast7Days: number;
  addedLast30Days: number;
  watchingSerialsCount: number;
  seeLaterCount: number;
  statusBreakdown: {
    notStarted: number;
    watching: number;
    completed: number;
    dropped: number;
  };
  completionRate: number;
  topGenres: Array<{
    genre: Genre;
    count: number;
  }>;
  continueWatching: Array<{
    movieId: string;
    title: string;
    posterUrl: string | null;
    currentSeason: number | null;
    currentEpisode: number | null;
    seasonCount: number | null;
    episodeCount: number | null;
  }>;
};

@Injectable()
export class UserMovieService {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * @param withAverageRating подмешать средний балл по отзывам в movie
   *   (нужно детальной странице; в мутациях не запрашиваем лишний aggregate)
   */
  public async findByUserAndMovie(
    userId: string,
    movieId: string,
    withAverageRating = false,
    prisma: Prisma.TransactionClient = this.prismaService,
  ): Promise<UserMovie | null> {
    const query = prisma.userMovie.findUnique({
      where: {
        userId_movieId: {
          userId,
          movieId,
        },
      },
      include: {
        movie: {
          include: {
            poster: true,
            actors: true,
          },
        },
      },
    });

    if (!withAverageRating) {
      return query;
    }

    // Запросы независимы — считаем параллельно
    const [userMovie, avg] = await Promise.all([
      query,
      prisma.review.aggregate({
        where: { movieId, hiddenAt: null },
        _avg: { rate: true },
      }),
    ]);

    if (!userMovie) {
      return null;
    }

    return {
      ...userMovie,
      movie: {
        ...(userMovie as UserMovie & { movie: object }).movie,
        averageRating: avg._avg.rate ?? null,
      },
    } as UserMovie;
  }

  public async pageByUser(
    userId: string,
    query: CollectionQueryDto,
  ): Promise<{
    items: UserMovie[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const { limit, offset } = query;
    const where = this.collectionWhere(userId, query);
    const [items, total] = await this.prismaService.$transaction(
      [
        this.prismaService.userMovie.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: [{ addedAt: 'desc' }, { id: 'asc' }],
          include: { movie: { include: { poster: true, actors: true } } },
        }),
        this.prismaService.userMovie.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { items, total, limit, offset };
  }

  private collectionWhere(
    userId: string,
    query: CollectionQueryDto,
  ): Prisma.UserMovieWhereInput {
    const { q, countryCode, ...filters } = query;
    const where = this.buildWhereClause(userId, {
      ...filters,
      countryCodes: countryCode,
    });
    if (q) {
      const title = movieTitleFilter(q);
      where.movie = where.movie ? { AND: [where.movie, title] } : title;
    }
    return where;
  }

  public async exportCollection(
    userId: string,
    query: CollectionExportQueryDto,
  ) {
    const where =
      query.scope === 'filtered'
        ? this.collectionWhere(userId, query)
        : {
            userId,
            ...(query.scope === 'completed'
              ? { watchStatus: WatchStatus.COMPLETED }
              : {}),
          };
    const rows = await this.prismaService.userMovie.findMany({
      where,
      take: MAX_SNAPSHOT_ROWS + 1,
      orderBy: [{ addedAt: 'desc' }, { id: 'asc' }],
      select: {
        watchStatus: true,
        isFavorite: true,
        seeLater: true,
        personalRate: true,
        currentSeason: true,
        currentEpisode: true,
        addedAt: true,
        startedAt: true,
        completedAt: true,
        lastWatchedAt: true,
        droppedAt: true,
        movie: {
          select: {
            title: true,
            publishDate: true,
            contentKind: true,
            isSerial: true,
            ...(query.format === 'pdf'
              ? { poster: { select: { url: true, thumbnailUrl: true } } }
              : {}),
          },
        },
      },
    });
    if (rows.length > MAX_SNAPSHOT_ROWS)
      throw new BadRequestException(
        `Выгрузка поддерживает до ${MAX_SNAPSHOT_ROWS} тайтлов. Уточните фильтры.`,
      );
    const exportedAt = new Date().toISOString();
    const movies = rows.map((row) => ({
      title: row.movie.title,
      year: row.movie.publishDate?.getUTCFullYear() ?? null,
      isSerial: row.movie.isSerial,
      contentKind: row.movie.contentKind,
      watchStatus: row.watchStatus,
      isFavorite: row.isFavorite,
      seeLater: row.seeLater,
      personalRate: row.personalRate,
      currentSeason: row.currentSeason,
      currentEpisode: row.currentEpisode,
      addedAt: row.addedAt.toISOString(),
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      lastWatchedAt: row.lastWatchedAt?.toISOString() ?? null,
      droppedAt: row.droppedAt?.toISOString() ?? null,
    }));
    if (query.format === 'pdf')
      return {
        exportedAt,
        movies: movies.map((movie, index) => ({
          title: movie.title,
          year: movie.year,
          isSerial: movie.isSerial,
          contentKind: movie.contentKind,
          watchStatus: movie.watchStatus,
          personalRate: movie.personalRate,
          completedAt: movie.completedAt,
          posterUrl:
            rows[index].movie.poster?.thumbnailUrl ||
            rows[index].movie.poster?.url ||
            null,
        })),
      };
    return {
      exportedAt,
      count: movies.length,
      content: serializeCollectionFile(query.format, movies, exportedAt),
    };
  }

  public async findAllByUser(
    userId: string,
    filters: UserMovieFilters = {},
  ): Promise<UserMovie[]> {
    const where = this.buildWhereClause(userId, filters);

    return this.prismaService.userMovie.findMany({
      where,
      include: {
        movie: {
          include: {
            poster: true,
            actors: true,
          },
        },
      },
      orderBy: {
        addedAt: 'desc',
      },
    });
  }

  public async searchUserMovies(
    userId: string,
    query: string,
    filters: UserMovieFilters = {},
  ): Promise<UserMovie[]> {
    if (!query?.trim()) {
      return this.findAllByUser(userId, filters);
    }

    const where = this.buildWhereClause(userId, filters);

    const titleFilter = movieTitleFilter(query);

    if (!where.movie) {
      where.movie = titleFilter;
    } else {
      where.movie = {
        AND: [where.movie, titleFilter],
      };
    }

    return this.prismaService.userMovie.findMany({
      where,
      include: {
        movie: {
          include: {
            poster: true,
            actors: true,
          },
        },
      },
      orderBy: {
        addedAt: 'desc',
      },
    });
  }

  private buildMovieWhereFromFilters(
    filters: UserMovieFilters,
  ): Prisma.MovieWhereInput | undefined {
    const parts: Prisma.MovieWhereInput[] = [];
    if (filters.contentKind !== undefined)
      parts.push({ contentKind: filters.contentKind });

    if (filters.genres?.length) {
      parts.push({
        genres: { hasSome: filters.genres },
      });
    }

    if (filters.countryCodes?.length) {
      parts.push({
        countryCodes: { hasSome: filters.countryCodes },
      });
    }

    if (filters.publishDateFrom || filters.publishDateTo) {
      const publishDate: Prisma.DateTimeNullableFilter = {};
      if (filters.publishDateFrom) {
        publishDate.gte = new Date(filters.publishDateFrom);
      }
      if (filters.publishDateTo) {
        publishDate.lte = new Date(filters.publishDateTo);
      }
      parts.push({ publishDate });
    }

    if (filters.isSerial !== undefined) {
      parts.push({ isSerial: filters.isSerial });
    }

    if (!parts.length) {
      return undefined;
    }

    return parts.length === 1 ? parts[0] : { AND: parts };
  }

  private buildWhereClause(
    userId: string,
    filters: UserMovieFilters,
  ): Prisma.UserMovieWhereInput {
    const where: Prisma.UserMovieWhereInput = {
      userId,
    };

    if (
      filters.personalRateMin !== undefined ||
      filters.personalRateMax !== undefined
    ) {
      where.personalRate = {};
      if (filters.personalRateMin !== undefined) {
        where.personalRate.gte = filters.personalRateMin;
      }
      if (filters.personalRateMax !== undefined) {
        where.personalRate.lte = filters.personalRateMax;
      }
    }

    if (filters.isFavorite !== undefined) {
      where.isFavorite = filters.isFavorite;
    }

    if (filters.seeLater !== undefined) {
      where.seeLater = filters.seeLater;
    }

    if (filters.watchStatus !== undefined) {
      where.watchStatus = filters.watchStatus;
    }

    const movieWhere = this.buildMovieWhereFromFilters(filters);
    if (movieWhere) {
      where.movie = movieWhere;
    }

    return where;
  }

  public async findFavoritesByUser(userId: string): Promise<UserMovie[]> {
    return this.prismaService.userMovie.findMany({
      where: {
        userId,
        isFavorite: true,
      },
      include: {
        movie: {
          include: {
            poster: true,
            actors: true,
          },
        },
      },
      orderBy: {
        addedAt: 'desc',
      },
    });
  }

  public async findSeeLaterByUser(userId: string): Promise<UserMovie[]> {
    return this.prismaService.userMovie.findMany({
      where: {
        userId,
        seeLater: true,
      },
      include: {
        movie: {
          include: {
            poster: true,
            actors: true,
          },
        },
      },
      orderBy: {
        addedAt: 'desc',
      },
    });
  }

  public async create(
    userId: string,
    dto: CreateUserMovieBodyDto,
    prisma: Prisma.TransactionClient = this.prismaService,
  ): Promise<UserMovie> {
    if (prisma === this.prismaService) {
      const result = await this.prismaService.$transaction((tx) =>
        this.create(userId, dto, tx),
      );
      invalidateDataCache(this.prismaService);
      return result;
    }

    const { movieId, ...data } = dto;

    await lockResource(prisma, `movie:${movieId}`);
    await lockResource(prisma, `collection:${userId}:${movieId}`);

    const existingUserMovie = await prisma.userMovie.findUnique({
      where: { userId_movieId: { userId, movieId } },
    });
    if (existingUserMovie) {
      throw new ConflictException('User already has this movie');
    }

    const movie = await prisma.movie.findUnique({
      where: { id: movieId },
      select: {
        isSerial: true,
        seasonCount: true,
        episodeCount: true,
      },
    });

    if (!movie) {
      throw new NotFoundException('Movie not found');
    }

    if ((data.currentSeason ?? 0) > 0 && !movie.isSerial) {
      throw new BadRequestException(
        'Season progress is available only for serials',
      );
    }

    if ((data.currentEpisode ?? 0) > 0 && !movie.isSerial) {
      throw new BadRequestException(
        'Episode progress is available only for serials',
      );
    }

    const normalizedData = resolveWatchProgress(
      movie,
      data as UpdateUserMovieDto,
    );

    return prisma.userMovie.create({
      data: {
        userId,
        movieId,
        ...normalizedData,
      },
      include: {
        movie: {
          include: {
            poster: true,
            actors: true,
          },
        },
      },
    });
  }

  public async update(
    userId: string,
    movieId: string,
    dto: UpdateUserMovieDto,
    prisma: Prisma.TransactionClient = this.prismaService,
  ): Promise<UserMovie> {
    if (prisma === this.prismaService) {
      const result = await this.prismaService.$transaction((tx) =>
        this.update(userId, movieId, dto, tx),
      );
      invalidateDataCache(this.prismaService);
      return result;
    }

    await lockResource(prisma, `movie:${movieId}`);
    await lockResource(prisma, `collection:${userId}:${movieId}`);
    const userMovie = await this.findByUserAndMovie(
      userId,
      movieId,
      false,
      prisma,
    );

    if (!userMovie) {
      throw new NotFoundException('UserMovie not found');
    }

    const movie = await prisma.movie.findUnique({
      where: { id: movieId },
      select: {
        isSerial: true,
        seasonCount: true,
        episodeCount: true,
      },
    });

    if (!movie) {
      throw new NotFoundException('Movie not found');
    }

    const normalizedDto = resolveWatchProgress(movie, dto, {
      watchStatus: userMovie.watchStatus,
      currentSeason: userMovie.currentSeason,
      currentEpisode: userMovie.currentEpisode,
      completedAt: userMovie.completedAt,
      // Нужен, чтобы «Начал» не перезаписывался при каждой смене статуса
      startedAt: userMovie.startedAt,
    });

    return prisma.userMovie.update({
      where: {
        userId_movieId: {
          userId,
          movieId,
        },
      },
      data: normalizedDto,
      include: {
        movie: {
          include: {
            poster: true,
            actors: true,
          },
        },
      },
    });
  }

  public async rate(
    userId: string,
    movieId: string,
    dto: RateUserMovieDto,
  ): Promise<UserMovie & { movie: { averageRating: number | null } }> {
    const text = dto.reviewText?.trim();

    if (text && text.length < 10) {
      throw new BadRequestException('Минимальная длина отзыва — 10 символов');
    }

    const result = await this.prismaService.$transaction(async (tx) => {
      await lockResource(tx, `collection:${userId}:${movieId}`);
      const where = { userId_movieId: { userId, movieId } };
      const current = await tx.userMovie.findUnique({ where });

      if (!current) {
        throw new NotFoundException('Фильм не найден в коллекции');
      }

      const ownReview = await tx.review.findFirst({
        where: { userId, movieId },
        orderBy: { createdAt: 'desc' },
      });
      const updated = await tx.userMovie.update({
        where,
        data: { personalRate: dto.personalRate },
        include: { movie: { include: { poster: true, actors: true } } },
      });

      if (ownReview) {
        await tx.review.update({
          where: { id: ownReview.id },
          data: {
            rate: dto.personalRate,
            text: text || ownReview.text,
            ...(text && dto.isSpoiler !== undefined
              ? { isSpoiler: dto.isSpoiler }
              : {}),
          },
        });
      } else if (text) {
        await tx.review.create({
          data: {
            userId,
            movieId,
            rate: dto.personalRate,
            text,
            isSpoiler: dto.isSpoiler ?? false,
          },
        });
      }

      const avg = await tx.review.aggregate({
        where: { movieId, hiddenAt: null },
        _avg: { rate: true },
      });

      return {
        ...updated,
        movie: { ...updated.movie, averageRating: avg._avg.rate },
      };
    });
    invalidateDataCache(this.prismaService);
    return result;
  }

  public async delete(userId: string, movieId: string): Promise<string> {
    try {
      await this.prismaService.$transaction(async (tx) => {
        await lockResource(tx, `collection:${userId}:${movieId}`);
        await tx.userMovie.delete({
          where: {
            userId_movieId: {
              userId,
              movieId,
            },
          },
        });
        await tx.userListItem.deleteMany({
          where: { movieId, list: { userId } },
        });
      });

      invalidateDataCache(this.prismaService);
      return movieId;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('UserMovie not found');
      }

      throw error;
    }
  }

  public async getUserStats(userId: string) {
    const [
      totalMovies,
      totalFavorites,
      totalSeeLater,
      totalWatching,
      totalCompleted,
    ] = await Promise.all([
      this.prismaService.userMovie.count({ where: { userId } }),
      this.prismaService.userMovie.count({
        where: { userId, isFavorite: true },
      }),
      this.prismaService.userMovie.count({
        where: { userId, seeLater: true },
      }),
      this.prismaService.userMovie.count({
        where: { userId, watchStatus: 'WATCHING' },
      }),
      this.prismaService.userMovie.count({
        where: { userId, watchStatus: 'COMPLETED' },
      }),
    ]);

    const totalSerials = await this.prismaService.userMovie.count({
      where: {
        userId,
        movie: {
          isSerial: true,
        },
      },
    });

    return {
      totalMovies,
      totalFavorites,
      totalSeeLater,
      totalWatching,
      totalCompleted,
      totalSerials,
    };
  }

  public async getUserAnalytics(userId: string): Promise<UserMovieAnalytics> {
    const since7 = new Date(Date.now() - 7 * 86_400_000);

    const since = new Date(Date.now() - 30 * 86_400_000);

    const [
      totalTitles,
      totalSerials,
      addedLast7Days,
      addedLast30Days,
      watchingSerialsCount,
      seeLaterCount,
      notStarted,
      watching,
      completed,
      dropped,
      genreRows,
      continueRows,
    ] = await Promise.all([
      this.prismaService.userMovie.count({ where: { userId } }),
      this.prismaService.userMovie.count({
        where: { userId, movie: { isSerial: true } },
      }),
      this.prismaService.userMovie.count({
        where: { userId, addedAt: { gte: since7 } },
      }),
      this.prismaService.userMovie.count({
        where: { userId, addedAt: { gte: since } },
      }),
      this.prismaService.userMovie.count({
        where: {
          userId,
          watchStatus: WatchStatus.WATCHING,
          movie: {
            isSerial: true,
          },
        },
      }),
      this.prismaService.userMovie.count({
        where: {
          userId,
          seeLater: true,
        },
      }),
      this.prismaService.userMovie.count({
        where: { userId, watchStatus: WatchStatus.NOT_STARTED },
      }),
      this.prismaService.userMovie.count({
        where: { userId, watchStatus: WatchStatus.WATCHING },
      }),
      this.prismaService.userMovie.count({
        where: { userId, watchStatus: WatchStatus.COMPLETED },
      }),
      this.prismaService.userMovie.count({
        where: { userId, watchStatus: WatchStatus.DROPPED },
      }),
      this.prismaService.userMovie.findMany({
        where: { userId },
        select: {
          movie: {
            select: {
              genres: true,
            },
          },
        },
      }),
      this.prismaService.userMovie.findMany({
        where: {
          userId,
          watchStatus: WatchStatus.WATCHING,
          movie: {
            isSerial: true,
          },
        },
        select: {
          movieId: true,
          currentSeason: true,
          currentEpisode: true,
          movie: {
            select: {
              title: true,
              poster: { select: { url: true, thumbnailUrl: true } },
              seasonCount: true,
              episodeCount: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 4,
      }),
    ]);

    const genreCounters = new Map<Genre, number>();

    for (const row of genreRows) {
      for (const genre of row.movie.genres) {
        const prev = genreCounters.get(genre) ?? 0;
        genreCounters.set(genre, prev + 1);
      }
    }

    const topGenres = Array.from(genreCounters.entries())
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const totalMovies = totalTitles - totalSerials;
    const completionRate =
      totalTitles > 0 ? Math.round((completed / totalTitles) * 100) : 0;

    return {
      totalTitles,
      totalMovies,
      totalSerials,
      addedLast7Days,
      addedLast30Days,
      watchingSerialsCount,
      seeLaterCount,
      statusBreakdown: {
        notStarted,
        watching,
        completed,
        dropped,
      },
      completionRate,
      topGenres,
      continueWatching: continueRows.map((row) => ({
        movieId: row.movieId,
        title: row.movie.title,
        posterUrl:
          row.movie.poster?.thumbnailUrl || row.movie.poster?.url || null,
        currentSeason: row.currentSeason,
        currentEpisode: row.currentEpisode,
        seasonCount: row.movie.seasonCount,
        episodeCount: row.movie.episodeCount,
      })),
    };
  }
}
