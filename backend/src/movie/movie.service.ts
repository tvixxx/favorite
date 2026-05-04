import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { normalizeMovieTitle } from '../common/utils';

interface MovieFilters {
  genres?: Genre[];
  countryCodes?: string[];
  publishDateFrom?: string;
  publishDateTo?: string;
  actorIds?: string[];
}

export type MovieWithAverageRating = Movie & {
  averageRating: number | null;
};

@Injectable()
class MovieService {
  constructor(private readonly prismaService: PrismaService) {}

  private async findDuplicateMovieIdByNormalizedTitle(
    title: string,
    excludeMovieId?: string,
  ): Promise<string | null> {
    const normalized = normalizeMovieTitle(title);

    if (!normalized.length) {
      return null;
    }

    const existing = await this.prismaService.movie.findFirst({
      where: {
        titleNormalized: normalized,
        ...(excludeMovieId ? { NOT: { id: excludeMovieId } } : {}),
      },
      select: { id: true },
    });

    return existing?.id ?? null;
  }

  private async withAverageRatings<M extends { id: string }>(
    movies: M[],
  ): Promise<Array<M & { averageRating: number | null }>> {
    if (!movies.length) {
      return [];
    }
    const ids = movies.map((m) => m.id);
    const grouped = await this.prismaService.review.groupBy({
      by: ['movieId'],
      where: { movieId: { in: ids } },
      _avg: { rate: true },
    });
    const map = new Map(grouped.map((g) => [g.movieId, g._avg.rate]));
    return movies.map((m) => ({
      ...m,
      averageRating: map.get(m.id) ?? null,
    }));
  }

  public async findAll(
    filters: MovieFilters = {},
  ): Promise<MovieWithAverageRating[]> {
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

    return this.withAverageRatings(movies);
  }

  public async create(
    dto: CreateMovieRequest,
  ): Promise<MovieWithAverageRating> {
    const {
      actorIds,
      imageUrl,
      title,
      publishDate,
      description,
      countryCodes,
      genres,
      isSerial,
      seasonCount,
      episodeCount,
    } = dto;

    const duplicateOnCreate =
      await this.findDuplicateMovieIdByNormalizedTitle(title);
    if (duplicateOnCreate) {
      throw new ConflictException(
        'Фильм с таким названием уже есть в общем каталоге. Измените название или добавьте существующую позицию из каталога.',
      );
    }

    const created = await this.prismaService.$transaction(async (tx) => {
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
          titleNormalized: normalizeMovieTitle(title),
          publishDate,
          description,
          countryCodes,
          genres,
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

    return (await this.withAverageRatings([created]))[0];
  }

  public async findById(id: string): Promise<MovieWithAverageRating> {
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

    const avg = await this.prismaService.review.aggregate({
      where: { movieId: id },
      _avg: { rate: true },
    });

    return {
      ...movie,
      averageRating: avg._avg.rate ?? null,
    };
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
      countryCodes,
      genres,
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

      const duplicateId = await this.findDuplicateMovieIdByNormalizedTitle(
        title,
        id,
      );
      if (duplicateId) {
        throw new ConflictException(
          'Фильм с таким названием уже есть в общем каталоге.',
        );
      }

      await tx.movie.update({
        where: { id },
        data: {
          title,
          titleNormalized: normalizeMovieTitle(title),
          publishDate,
          description,
          countryCodes,
          genres,
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
        countryCodes,
        genres,
        isSerial,
        seasonCount,
        episodeCount,
      } = dto;

      const updateData: Prisma.MovieUpdateInput = {};

      if (title !== undefined) {
        const duplicateId = await this.findDuplicateMovieIdByNormalizedTitle(
          title,
          id,
        );
        if (duplicateId) {
          throw new ConflictException(
            'Фильм с таким названием уже есть в общем каталоге.',
          );
        }
        updateData.title = title;
        updateData.titleNormalized = normalizeMovieTitle(title);
      }

      if (publishDate !== undefined) {
        updateData.publishDate = publishDate;
      }

      if (description !== undefined) {
        updateData.description = description;
      }

      if (countryCodes !== undefined) {
        updateData.countryCodes = { set: countryCodes };
      }

      if (genres !== undefined) {
        updateData.genres = { set: genres };
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
    query?: string,
    filters: MovieFilters = {},
  ): Promise<MovieWithAverageRating[]> {
    const hasQuery = !!query?.trim();
    const hasFilters = this.filtersNonEmpty(filters);

    if (!hasQuery && !hasFilters) {
      return this.findAll();
    }

    const where = this.buildWhereClause(
      filters,
      hasQuery && query ? query.trim() : undefined,
    );

    const movies = await this.prismaService.movie.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        actors: true,
        poster: true,
        _count: {
          select: {
            reviews: true,
            actors: true,
          },
        },
      },
    });

    return this.withAverageRatings(movies);
  }

  private filtersNonEmpty(filters: MovieFilters): boolean {
    return !!(
      filters.genres?.length ||
      filters.countryCodes?.length ||
      filters.publishDateFrom ||
      filters.publishDateTo ||
      filters.actorIds?.length
    );
  }

  private buildWhereClause(
    filters: MovieFilters,
    query?: string,
  ): Prisma.MovieWhereInput {
    const and: Prisma.MovieWhereInput[] = [];

    if (query) {
      and.push({
        title: {
          contains: query,
          mode: 'insensitive',
        },
      });
    }

    if (filters.genres?.length) {
      and.push({
        genres: { hasSome: filters.genres },
      });
    }

    if (filters.countryCodes?.length) {
      and.push({
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
      and.push({ publishDate });
    }

    if (filters.actorIds?.length) {
      and.push({
        actors: { some: { id: { in: filters.actorIds } } },
      });
    }

    if (!and.length) {
      return {};
    }

    return and.length === 1 ? and[0] : { AND: and };
  }
}

export default MovieService;
