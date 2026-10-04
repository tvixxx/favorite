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
import { Genre, WatchStatus } from '../generated/prisma/enums';

interface UserMovieFilters {
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
    currentSeason: number | null;
    currentEpisode: number | null;
    seasonCount: number | null;
    episodeCount: number | null;
  }>;
};

type MovieProgressMeta = {
  isSerial: boolean;
  seasonCount: number | null;
  episodeCount: number | null;
};

@Injectable()
export class UserMovieService {
  constructor(private readonly prismaService: PrismaService) {}

  private clampToRange(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private normalizeProgressPayload(
    movie: MovieProgressMeta,
    dto: UpdateUserMovieDto,
    current?: Pick<
      UserMovie,
      | 'watchStatus'
      | 'currentSeason'
      | 'currentEpisode'
      | 'completedAt'
      | 'startedAt'
    >,
  ): UpdateUserMovieDto {
    const allowed = new Set([
      'isFavorite',
      'seeLater',
      'personalRate',
      'watchStatus',
      'currentSeason',
      'currentEpisode',
      'lastWatchedAt',
      'startedAt',
      'completedAt',
      'droppedAt',
    ]);
    const result = Object.fromEntries(
      Object.entries(dto).filter(([key]) => allowed.has(key)),
    ) as UpdateUserMovieDto;
    const now = new Date();

    const seasonCap = movie.seasonCount ?? null;
    const episodeCap = movie.episodeCount ?? null;

    const hasSeason = seasonCap !== null && seasonCap > 0;
    const hasEpisode = episodeCap !== null && episodeCap > 0;
    const isSerial = movie.isSerial;

    if (!isSerial) {
      if (
        result.currentSeason !== undefined ||
        result.currentEpisode !== undefined
      ) {
        result.currentSeason = null as unknown as number;
        result.currentEpisode = null as unknown as number;
      }

      if (
        result.watchStatus === WatchStatus.COMPLETED &&
        result.completedAt === undefined
      ) {
        result.completedAt = current?.completedAt ?? now;
      }

      if (
        result.watchStatus !== undefined &&
        result.watchStatus !== WatchStatus.COMPLETED
      ) {
        result.completedAt = null as unknown as Date;
      }
      if (result.watchStatus === WatchStatus.NOT_STARTED) {
        result.currentSeason = null as unknown as number;
        result.currentEpisode = null as unknown as number;
        result.lastWatchedAt = null as unknown as Date;
      }
      this.applyStatusDates(result, current, now);

      return result;
    }

    if (result.currentSeason !== undefined && result.currentSeason !== null) {
      const seasonValue = Math.max(result.currentSeason, 0);
      result.currentSeason = hasSeason
        ? this.clampToRange(seasonValue, 0, seasonCap)
        : seasonValue;
    }

    if (result.currentEpisode !== undefined && result.currentEpisode !== null) {
      const episodeValue = Math.max(result.currentEpisode, 0);
      result.currentEpisode = hasEpisode
        ? this.clampToRange(episodeValue, 0, episodeCap)
        : episodeValue;
    }

    const effectiveSeason =
      result.currentSeason !== undefined
        ? result.currentSeason
        : (current?.currentSeason ?? null);
    const effectiveEpisode =
      result.currentEpisode !== undefined
        ? result.currentEpisode
        : (current?.currentEpisode ?? null);
    const hasAnyProgress =
      (effectiveSeason ?? 0) > 0 || (effectiveEpisode ?? 0) > 0;
    const hasExplicitWatchStatus = result.watchStatus !== undefined;
    const hasProgressUpdate =
      result.currentSeason !== undefined || result.currentEpisode !== undefined;

    const reachedSeasonEnd = hasSeason && (effectiveSeason ?? 0) >= seasonCap;
    const reachedEpisodeEnd =
      hasEpisode && (effectiveEpisode ?? 0) >= episodeCap;
    const canBeCompleted = hasSeason || hasEpisode;
    const reachedEnd = canBeCompleted
      ? (hasSeason ? reachedSeasonEnd : true) &&
        (hasEpisode ? reachedEpisodeEnd : true)
      : false;

    if (result.watchStatus === WatchStatus.NOT_STARTED) {
      result.currentSeason = null as unknown as number;
      result.currentEpisode = null as unknown as number;
      result.completedAt = null as unknown as Date;
      result.lastWatchedAt = null as unknown as Date;
      this.applyStatusDates(result, current, now);

      return result;
    }

    if (result.watchStatus === WatchStatus.COMPLETED) {
      result.watchStatus = WatchStatus.COMPLETED;

      if (hasSeason) {
        result.currentSeason = seasonCap;
      }

      if (hasEpisode) {
        result.currentEpisode = episodeCap;
      }

      if (result.completedAt === undefined) {
        result.completedAt = current?.completedAt ?? now;
      }
    } else if (result.watchStatus === WatchStatus.WATCHING) {
      result.watchStatus = WatchStatus.WATCHING;
      result.completedAt = null as unknown as Date;
    } else if (result.watchStatus === WatchStatus.DROPPED) {
      result.watchStatus = WatchStatus.DROPPED;
      result.completedAt = null as unknown as Date;
    } else if (!hasExplicitWatchStatus && hasProgressUpdate && reachedEnd) {
      result.watchStatus = WatchStatus.COMPLETED;

      if (hasSeason && result.currentSeason === undefined) {
        result.currentSeason = seasonCap;
      }

      if (hasEpisode && result.currentEpisode === undefined) {
        result.currentEpisode = episodeCap;
      }

      if (result.completedAt === undefined) {
        result.completedAt = now;
      }
    } else if (!hasExplicitWatchStatus && hasProgressUpdate && hasAnyProgress) {
      result.watchStatus = WatchStatus.WATCHING;
      result.completedAt = null as unknown as Date;
    }

    if (
      (result.currentSeason !== undefined ||
        result.currentEpisode !== undefined) &&
      result.lastWatchedAt === undefined
    ) {
      result.lastWatchedAt = now;
    }

    this.applyStatusDates(result, current, now);

    return result;
  }

  /**
   * Даты смены статуса: их показывают чипы «Начал / Досмотрел / Бросил».
   * `startedAt` выставляется один раз и живёт, пока не сбросят статус в
   * «не начато»; `droppedAt` актуален только для брошенных.
   */
  private applyStatusDates(
    result: UpdateUserMovieDto,
    current: { startedAt?: Date | null } | undefined,
    now: Date,
  ): void {
    if (result.watchStatus === undefined) {
      return;
    }

    const hasStarted = !!(result.startedAt ?? current?.startedAt);

    if (result.watchStatus === WatchStatus.NOT_STARTED) {
      result.startedAt = null as unknown as Date;
      result.droppedAt = null as unknown as Date;

      return;
    }

    // Смотрю / просмотрено / брошено — просмотр начался
    if (!hasStarted && result.startedAt === undefined) {
      result.startedAt = now;
    }

    if (result.watchStatus === WatchStatus.DROPPED) {
      if (result.droppedAt === undefined) {
        result.droppedAt = now;
      }

      return;
    }

    result.droppedAt = null as unknown as Date;
  }

  /**
   * @param withAverageRating подмешать средний балл по отзывам в movie
   *   (нужно детальной странице; в мутациях не запрашиваем лишний aggregate)
   */
  public async findByUserAndMovie(
    userId: string,
    movieId: string,
    withAverageRating = false,
  ): Promise<UserMovie | null> {
    const query = this.prismaService.userMovie.findUnique({
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
      this.prismaService.review.aggregate({
        where: { movieId },
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

    const titleFilter: Prisma.MovieWhereInput = {
      title: {
        contains: query.trim(),
        mode: 'insensitive',
      },
    };

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
    const { movieId, ...data } = dto;

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

    const normalizedData = this.normalizeProgressPayload(
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
  ): Promise<UserMovie> {
    const userMovie = await this.findByUserAndMovie(userId, movieId);

    if (!userMovie) {
      throw new NotFoundException('UserMovie not found');
    }

    const movie = await this.prismaService.movie.findUnique({
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

    const normalizedDto = this.normalizeProgressPayload(movie, dto, {
      watchStatus: userMovie.watchStatus,
      currentSeason: userMovie.currentSeason,
      currentEpisode: userMovie.currentEpisode,
      completedAt: userMovie.completedAt,
      // Нужен, чтобы «Начал» не перезаписывался при каждой смене статуса
      startedAt: userMovie.startedAt,
    });

    return this.prismaService.userMovie.update({
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
    return this.prismaService.$transaction(async (tx) => {
      const where = { userId_movieId: { userId, movieId } };
      const current = await tx.userMovie.findUnique({ where });
      if (!current) throw new NotFoundException('Фильм не найден в коллекции');
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
          data: { rate: dto.personalRate, text: text || ownReview.text },
        });
      } else if (text) {
        await tx.review.create({
          data: { userId, movieId, rate: dto.personalRate, text },
        });
      }
      const avg = await tx.review.aggregate({
        where: { movieId },
        _avg: { rate: true },
      });
      return {
        ...updated,
        movie: { ...updated.movie, averageRating: avg._avg.rate },
      };
    });
  }

  public async delete(userId: string, movieId: string): Promise<string> {
    try {
      await this.prismaService.$transaction(async (tx) => {
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
    const since7 = new Date();
    since7.setDate(since7.getDate() - 7);

    const since = new Date();
    since.setDate(since.getDate() - 30);

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
        currentSeason: row.currentSeason,
        currentEpisode: row.currentEpisode,
        seasonCount: row.movie.seasonCount,
        episodeCount: row.movie.episodeCount,
      })),
    };
  }
}
