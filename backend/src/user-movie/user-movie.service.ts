import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserMovieBodyDto, UpdateUserMovieDto } from './dto';
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
      'watchStatus' | 'currentSeason' | 'currentEpisode' | 'completedAt'
    >,
  ): UpdateUserMovieDto {
    const result: UpdateUserMovieDto = { ...dto };
    const now = new Date();

    const seasonCap = movie.seasonCount ?? null;
    const episodeCap = movie.episodeCount ?? null;

    const hasSeason = seasonCap !== null && seasonCap > 0;
    const hasEpisode = episodeCap !== null && episodeCap > 0;
    const isSerial = movie.isSerial;

    if (!isSerial) {
      if (result.currentSeason !== undefined || result.currentEpisode !== undefined) {
        result.currentSeason = null as unknown as number;
        result.currentEpisode = null as unknown as number;
      }

      if (result.watchStatus === WatchStatus.COMPLETED && result.completedAt === undefined) {
        result.completedAt = now;
      }

      return result;
    }

    if (result.currentSeason !== undefined) {
      const seasonValue = Math.max(result.currentSeason, 0);
      result.currentSeason = hasSeason
        ? this.clampToRange(seasonValue, 0, seasonCap)
        : seasonValue;
    }

    if (result.currentEpisode !== undefined) {
      const episodeValue = Math.max(result.currentEpisode, 0);
      result.currentEpisode = hasEpisode
        ? this.clampToRange(episodeValue, 0, episodeCap)
        : episodeValue;
    }

    const effectiveSeason =
      result.currentSeason ?? current?.currentSeason ?? null;
    const effectiveEpisode =
      result.currentEpisode ?? current?.currentEpisode ?? null;
    const hasAnyProgress = (effectiveSeason ?? 0) > 0 || (effectiveEpisode ?? 0) > 0;
    const hasExplicitWatchStatus = result.watchStatus !== undefined;

    const reachedSeasonEnd = hasSeason && (effectiveSeason ?? 0) >= seasonCap;
    const reachedEpisodeEnd = hasEpisode && (effectiveEpisode ?? 0) >= episodeCap;
    const canBeCompleted = hasSeason || hasEpisode;
    const reachedEnd = canBeCompleted
      ? (hasSeason ? reachedSeasonEnd : true) && (hasEpisode ? reachedEpisodeEnd : true)
      : false;

    if (result.watchStatus === WatchStatus.NOT_STARTED) {
      result.currentSeason = null as unknown as number;
      result.currentEpisode = null as unknown as number;
      result.completedAt = null as unknown as Date;

      return result;
    }

    if (result.watchStatus === WatchStatus.COMPLETED) {
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
    } else if (result.watchStatus === WatchStatus.WATCHING) {
      result.watchStatus = WatchStatus.WATCHING;
      result.completedAt = null as unknown as Date;
    } else if (result.watchStatus === WatchStatus.DROPPED) {
      result.watchStatus = WatchStatus.DROPPED;
      result.completedAt = null as unknown as Date;
    } else if (!hasExplicitWatchStatus && reachedEnd) {
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
    } else if (!hasExplicitWatchStatus && hasAnyProgress) {
      result.watchStatus = WatchStatus.WATCHING;
      result.completedAt = null as unknown as Date;
    }

    if (
      (result.currentSeason !== undefined || result.currentEpisode !== undefined) &&
      result.lastWatchedAt === undefined
    ) {
      result.lastWatchedAt = now;
    }

    return result;
  }

  public async findByUserAndMovie(
    userId: string,
    movieId: string,
  ): Promise<UserMovie | null> {
    return this.prismaService.userMovie.findUnique({
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
  ): Promise<UserMovie> {
    const { movieId, ...data } = dto;

    const existingUserMovie = await this.findByUserAndMovie(userId, movieId);
    if (existingUserMovie) {
      throw new ConflictException('User already has this movie');
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

    if ((data.currentSeason ?? 0) > 0 && !movie.isSerial) {
      throw new BadRequestException('Season progress is available only for serials');
    }

    if ((data.currentEpisode ?? 0) > 0 && !movie.isSerial) {
      throw new BadRequestException('Episode progress is available only for serials');
    }

    const normalizedData = this.normalizeProgressPayload(
      movie,
      data as UpdateUserMovieDto,
    );

    return this.prismaService.userMovie.create({
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

  public async delete(userId: string, movieId: string): Promise<string> {
    try {
      await this.prismaService.userMovie.delete({
        where: {
          userId_movieId: {
            userId,
            movieId,
          },
        },
      });

      return movieId;
    } catch (error) {
      if (error?.code === 'P2025') {
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
