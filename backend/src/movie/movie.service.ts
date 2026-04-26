import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateMovieRequest } from './dto';
import { PrismaService } from '../prisma/prisma.service';
import type {
  Actor,
  Genre,
  Movie,
  Prisma,
  Review,
} from '../generated/prisma/client';
import { MoviesStatsResponse } from './dto/movies-stats.dto';

interface MovieFilters {
  genre?: Genre;
  publishDateFrom?: string;
  publishDateTo?: string;
}

@Injectable()
class MovieService {
  constructor(private readonly prismaService: PrismaService) {}

  public async findAll(filters: MovieFilters = {}): Promise<Movie[]> {
    const where = this.buildWhereClause(filters);

    const movies = await this.prismaService.movie.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        poster: {
          select: {
            url: true,
          },
        },
        _count: {
          select: {
            reviews: true,
            actors: true,
          },
        },
      },
    });

    return movies;
  }

  public async create(dto: CreateMovieRequest): Promise<Movie> {
    const {
      actorIds,
      imageUrl,
      title,
      publishDate,
      description,
      genre,
      isSerial,
      seasonCount,
      episodeCount,
    } = dto;

    return this.prismaService.$transaction(async (tx) => {
      const actors = await tx.actor.findMany({
        where: {
          id: {
            in: actorIds,
          },
        },
      });

      if (!actors?.length) {
        throw new NotFoundException('Один или несколько актеров не найдены');
      }

      return tx.movie.create({
        data: {
          title,
          publishDate,
          description,
          genre,
          isSerial,
          seasonCount,
          episodeCount,
          poster: imageUrl ? { create: { url: imageUrl } } : undefined,
          actors: {
            connect: actors.map((actor) => ({
              id: actor.id,
            })),
          },
        },
        include: {
          poster: {
            select: {
              url: true,
            },
          },
          _count: {
            select: {
              reviews: true,
              actors: true,
            },
          },
        },
      });
    });
  }

  public async findById(id: string): Promise<Movie> {
    const movie = await this.prismaService.movie.findUnique({
      where: {
        id,
      },
      include: {
        actors: true,
        poster: true,
        reviews: true,
      },
    });

    if (!movie) {
      throw new NotFoundException(`Фильм с айди: ${id} не найден`);
    }

    return movie;
  }

  public async getActorsByMovieId(
    id: string,
    take: string = '10',
  ): Promise<Actor[]> {
    const takeLimit = parseInt(take) ?? 10;
    return this.prismaService.actor.findMany({
      where: {
        movies: {
          some: { id },
        },
      },
      take: takeLimit,
      orderBy: {
        name: 'desc',
      },
    });
  }

  public async getReviewsByMovieId(
    id: string,
    take: string = '10',
  ): Promise<Review[]> {
    const takeLimit = parseInt(take) ?? 10;

    return this.prismaService.review.findMany({
      where: {
        movie: {
          id,
        },
      },
      take: takeLimit,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  public async update(id: string, dto: CreateMovieRequest): Promise<boolean> {
    const {
      actorIds,
      imageUrl,
      title,
      publishDate,
      description,
      genre,
      isSerial,
      seasonCount,
      episodeCount,
    } = dto;

    return this.prismaService.$transaction(async (tx) => {
      const movie = await tx.movie.findUnique({ where: { id } });

      if (!movie) {
        throw new NotFoundException('Фильм не был найден!');
      }

      const actors = await tx.actor.findMany({
        where: {
          id: {
            in: actorIds,
          },
        },
      });

      if (actors.length !== actorIds.length) {
        throw new NotFoundException('Один или несколько актеров не найдены');
      }

      await tx.movie.update({
        where: { id },
        data: {
          title,
          publishDate,
          description,
          genre,
          isSerial,
          seasonCount,
          episodeCount,
          poster: imageUrl ? { create: { url: imageUrl } } : undefined,
          actors: {
            connect: actors.map((actor) => ({ id: actor.id })),
          },
        },
      });

      return true;
    });
  }

  public async patch(
    id: string,
    dto: Partial<CreateMovieRequest>,
  ): Promise<boolean> {
    return this.prismaService.$transaction(async (tx) => {
      const movie = await tx.movie.findUnique({ where: { id } });

      if (!movie) {
        throw new NotFoundException('Фильм не был найден!');
      }

      const {
        actorIds,
        imageUrl,
        title,
        publishDate,
        description,
        genre,
        isSerial,
        seasonCount,
        episodeCount,
      } = dto;

      const updateData: Prisma.MovieUpdateInput = {};

      if (title !== undefined) {
        updateData.title = title;
      }

      if (publishDate !== undefined) {
        updateData.publishDate = publishDate;
      }

      if (description !== undefined) {
        updateData.description = description;
      }

      if (genre !== undefined) {
        updateData.genre = genre;
      }

      if (isSerial !== undefined) {
        updateData.isSerial = isSerial;
      }

      if (seasonCount !== undefined) {
        updateData.seasonCount = seasonCount;
      }

      if (episodeCount !== undefined) {
        updateData.episodeCount = episodeCount;
      }

      if (actorIds !== undefined && actorIds.length) {
        const actors = await tx.actor.findMany({
          where: { id: { in: actorIds } },
        });

        if (actors.length !== actorIds.length) {
          throw new NotFoundException('Один или несколько актеров не найдены');
        }

        updateData.actors = {
          connect: actors.map((actor) => ({ id: actor.id })),
        };
      }

      if (imageUrl !== undefined) {
        updateData.poster = imageUrl
          ? { create: { url: imageUrl } }
          : { disconnect: true };
      }

      await tx.movie.update({ where: { id }, data: updateData });
      return true;
    });
  }

  public async delete(id: string): Promise<string> {
    try {
      await this.prismaService.movie.delete({
        where: { id },
      });

      return id;
    } catch (error) {
      if (error?.code === 'P2025') {
        throw new NotFoundException(`Фильм с айди: ${id} не найден`);
      }

      throw error;
    }
  }

  public async getMoviesStats(): Promise<MoviesStatsResponse> {
    const [allMovies, allSerials] = await Promise.all([
      this.prismaService.movie.count(),
      this.prismaService.movie.count({ where: { isSerial: true } }),
    ]);

    // Общая статистика по всем пользователям
    const [allFavorites, allSeeLater] = await Promise.all([
      this.prismaService.userMovie.count({ where: { isFavorite: true } }),
      this.prismaService.userMovie.count({ where: { seeLater: true } }),
    ]);

    return {
      allMovies,
      allFavorites,
      allSerials,
      allSeeLater,
    };
  }

  public async search(
    query: string,
    filters: MovieFilters = {},
  ): Promise<Movie[]> {
    const hasQuery = !!query?.trim();
    const hasFilters = Object.values(filters).some(
      (v) => v !== undefined && v !== '',
    );

    if (!hasQuery && !hasFilters) {
      return this.findAll();
    }

    const where = this.buildWhereClause(filters, hasQuery ? query.trim() : undefined);

    const movies = await this.prismaService.movie.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        actors: true,
        poster: true,
        reviews: true,
      },
    });

    return movies;
  }

  private buildWhereClause(
    filters: MovieFilters,
    query?: string,
  ): Prisma.MovieWhereInput {
    const where: Prisma.MovieWhereInput = {};

    if (query) {
      where.title = {
        contains: query,
        mode: 'insensitive',
      };
    }

    if (filters.genre) {
      where.genre = filters.genre;
    }

    if (filters.publishDateFrom || filters.publishDateTo) {
      where.publishDate = {};
      if (filters.publishDateFrom) {
        where.publishDate.gte = new Date(filters.publishDateFrom);
      }
      if (filters.publishDateTo) {
        where.publishDate.lte = new Date(filters.publishDateTo);
      }
    }

    return where;
  }
}

export default MovieService;
