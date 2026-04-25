import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserMovieDto, UpdateUserMovieDto } from './dto';
import type { UserMovie, Prisma } from '../generated/prisma/client';
import { Genre, WatchStatus } from '../generated/prisma/enums';

interface UserMovieFilters {
  genre?: Genre;
  personalRateMin?: number;
  personalRateMax?: number;
  publishDateFrom?: string;
  publishDateTo?: string;
  isFavorite?: boolean;
  seeLater?: boolean;
  watchStatus?: WatchStatus;
}

@Injectable()
export class UserMovieService {
  constructor(private readonly prismaService: PrismaService) {}

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
    const where = this.buildWhereClause(userId, filters);

    // Добавляем поиск по названию фильма
    if (!where.movie) {
      where.movie = {};
    }

    where.movie.title = {
      contains: query,
      mode: 'insensitive',
    };

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

  private buildWhereClause(
    userId: string,
    filters: UserMovieFilters,
  ): Prisma.UserMovieWhereInput {
    const where: Prisma.UserMovieWhereInput = {
      userId,
    };

    // Фильтры по персональным данным UserMovie
    if (filters.personalRateMin !== undefined || filters.personalRateMax !== undefined) {
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

    // Фильтры по данным Movie (через вложенный where)
    if (filters.genre || filters.publishDateFrom || filters.publishDateTo) {
      where.movie = {};

      if (filters.genre) {
        where.movie.genre = filters.genre;
      }

      if (filters.publishDateFrom || filters.publishDateTo) {
        where.movie.publishDate = {};
        if (filters.publishDateFrom) {
          where.movie.publishDate.gte = new Date(filters.publishDateFrom);
        }
        if (filters.publishDateTo) {
          where.movie.publishDate.lte = new Date(filters.publishDateTo);
        }
      }
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

  public async create(dto: CreateUserMovieDto): Promise<UserMovie> {
    const { userId, movieId, ...data } = dto;

    const existingUserMovie = await this.findByUserAndMovie(userId, movieId);
    if (existingUserMovie) {
      throw new Error('User already has this movie');
    }

    return this.prismaService.userMovie.create({
      data: {
        userId,
        movieId,
        ...data,
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

    return this.prismaService.userMovie.update({
      where: {
        userId_movieId: {
          userId,
          movieId,
        },
      },
      data: dto,
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
}
