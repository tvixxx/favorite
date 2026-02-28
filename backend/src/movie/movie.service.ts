import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateMovieRequest } from './dto';
import { PrismaService } from '../prisma/prisma.service';
import type { Actor, Movie, Prisma, Review } from '../generated/prisma/client';
import { MoviesStatsResponse } from './dto/movies-stats.dto';

@Injectable()
class MovieService {
  constructor(private readonly prismaService: PrismaService) {}

  public async findAll(): Promise<Movie[]> {
    const movies = await this.prismaService.movie.findMany({
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
      rate,
      genre,
      date,
      isFavorite,
      seeLater,
      isSerial,
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
          rate,
          genre,
          date,
          isFavorite,
          seeLater,
          isSerial,
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
      rate,
      genre,
      date,
      isFavorite,
      seeLater,
      isSerial,
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
          rate,
          genre,
          date,
          isFavorite,
          seeLater,
          isSerial,
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
        rate,
        genre,
        date,
        isFavorite,
        seeLater,
        isSerial,
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

      if (rate !== undefined) {
        updateData.rate = rate;
      }

      if (genre !== undefined) {
        updateData.genre = genre;
      }

      if (date !== undefined) {
        updateData.date = date;
      }

      if (isFavorite !== undefined) {
        updateData.isFavorite = isFavorite;
      }

      if (seeLater !== undefined) {
        updateData.seeLater = seeLater;
      }

      if (isSerial !== undefined) {
        updateData.isSerial = isSerial;
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
    const [allMovies, allFavorites, allSerials, allSeeLater] =
      await Promise.all([
        this.prismaService.movie.count(),
        this.prismaService.movie.count({ where: { isFavorite: true } }),
        this.prismaService.movie.count({ where: { isSerial: true } }),
        this.prismaService.movie.count({ where: { seeLater: true } }),
      ]);

    return {
      allMovies,
      allFavorites,
      allSerials,
      allSeeLater,
    };
  }

  public async search(query: string): Promise<Movie[]> {
    if (!query) {
      return this.findAll();
    }

    const movies = await this.prismaService.movie.findMany({
      where: {
        title: {
          contains: query,
          mode: 'insensitive',
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        actors: true,
        poster: true,
        reviews: true,
      },
      // include: {
      //   poster: {
      //     select: {
      //       url: true,
      //     },
      //   },
      //   _count: {
      //     select: {
      //       reviews: true,
      //       actors: true,
      //     },
      //   },
      // },
    });

    return movies;
  }
}

export default MovieService;
