import { ForbiddenException } from '@nestjs/common';
import MovieService from './movie.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserMovieService } from '../user-movie/user-movie.service';
import type { Prisma } from '../generated/prisma/client';
import { Genre } from '../generated/prisma/enums';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Права на общие и пользовательские фильмы', () => {
  let movie: Record<string, unknown>;
  let service: MovieService;
  let posterExists: boolean;
  let posterFailure: boolean;
  beforeEach(() => {
    movie = {
      id: 'movie-id',
      title: 'Исходное название',
      createdById: null,
      isSerial: false,
    };
    posterExists = true;
    posterFailure = false;
    const tx = {
      movie: {
        findUnique: jest.fn(() => Promise.resolve(movie)),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(({ data }: { data: Prisma.MovieUpdateInput }) =>
          Promise.resolve(Object.assign(movie, data)),
        ),
        delete: jest.fn(() => {
          const old = movie;
          movie = null!;
          return Promise.resolve(old);
        }),
        create: jest.fn(({ data }: { data: Prisma.MovieCreateInput }) => {
          movie = {
            id: 'movie-id',
            ...data,
            createdById: data.createdBy?.connect?.id ?? null,
          };
          return Promise.resolve(movie);
        }),
      },
      actor: { findMany: jest.fn().mockResolvedValue([{ id: 'actor-id' }]) },
      review: { groupBy: jest.fn().mockResolvedValue([]) },
      moviePoster: {
        deleteMany: jest.fn(() => {
          if (posterFailure) throw new Error('Ошибка удаления постера');
          posterExists = false;
          return Promise.resolve({ count: 1 });
        }),
      },
    };
    const prisma = {
      ...tx,
      $transaction: async <T>(
        work: (client: typeof tx) => Promise<T>,
      ): Promise<T> => {
        const before = structuredClone({ movie, posterExists });
        try {
          return await work(tx);
        } catch (error) {
          movie = before.movie;
          posterExists = before.posterExists;
          throw error;
        }
      },
    };
    const client = prisma as unknown as PrismaService;
    service = new MovieService(client, new UserMovieService(client));
  });

  it('не позволяет обычному пользователю менять общий фильм', async () => {
    await expect(
      service.patch(
        'movie-id',
        { title: 'Новое' },
        { id: 'user-id', role: 'USER' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(movie.title).toBe('Исходное название');
  });

  it('позволяет автору менять созданный им фильм', async () => {
    movie.createdById = 'user-id';
    await service.patch(
      'movie-id',
      { title: 'Новое' },
      { id: 'user-id', role: 'USER' },
    );
    expect(movie.title).toBe('Новое');
  });

  it('не позволяет менять фильм другого автора', async () => {
    movie.createdById = 'other-user';
    await expect(
      service.patch(
        'movie-id',
        { title: 'Новое' },
        { id: 'user-id', role: 'USER' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('позволяет администратору менять общий фильм', async () => {
    await service.patch(
      'movie-id',
      { title: 'Новое' },
      { id: 'admin-id', role: 'ADMIN' },
    );
    expect(movie.title).toBe('Новое');
  });

  it('не позволяет удалять общий фильм обычному пользователю', async () => {
    await expect(
      service.delete('movie-id', { id: 'user-id', role: 'USER' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(movie).not.toBeNull();
  });

  it('назначает автора новой записи из текущей сессии', async () => {
    const result = await service.create(
      {
        title: 'Новый фильм',
        description: 'Описание',
        countryCodes: ['US'],
        genres: [Genre.DRAMA],
        actorIds: ['actor-id'],
        isSerial: false,
      },
      { id: 'user-id', role: 'USER' },
    );
    expect(result.createdById).toBe('user-id');
  });

  it('удаляет постер вместе с разрешённым к удалению тайтлом', async () => {
    movie.createdById = 'user-id';
    movie.posterId = 'poster-id';
    await service.delete('movie-id', { id: 'user-id', role: 'USER' });
    expect(movie).toBeNull();
    expect(posterExists).toBe(false);
  });

  it('не теряет фильм при ошибке очистки постера', async () => {
    movie.createdById = 'user-id';
    movie.posterId = 'poster-id';
    posterFailure = true;
    await expect(
      service.delete('movie-id', { id: 'user-id', role: 'USER' }),
    ).rejects.toThrow('Ошибка удаления постера');
    expect(movie.id).toBe('movie-id');
    expect(posterExists).toBe(true);
  });
});
