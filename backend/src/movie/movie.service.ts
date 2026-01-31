import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateMovieRequest } from './dto';
import { PrismaService } from '../prisma/prisma.service';
import type { Actor, Movie, Review } from '../generated/prisma/client';

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
      favoriteId,
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
          favoriteId,
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
      favoriteId,
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
          favoriteId,
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
      const updateData: any = { ...dto };

      if (dto.actorIds !== undefined && dto.actorIds.length) {
        const actors = await tx.actor.findMany({
          where: { id: { in: dto.actorIds } },
        });

        if (actors.length !== dto.actorIds.length) {
          throw new NotFoundException('Один или несколько актеров не найдены');
        }

        updateData.actors = { connect: dto.actorIds.map((id) => ({ id })) };
      }

      if (dto.imageUrl !== undefined) {
        updateData.poster = { create: { url: dto.imageUrl } };
      }

      await tx.movie.update({
        where: { id },
        data: updateData,
      });

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
      if (error.code === 'P2025') {
        throw new NotFoundException(`Фильм с айди: ${id} не найден`);
      }

      throw error;
    }
  }
}

export default MovieService;
