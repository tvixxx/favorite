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
  let linkedHistory: boolean;
  let progress: { currentSeason: number | null; currentEpisode: number | null };

  beforeEach(() => {
    movie = {
      id: 'movie-id',
      title: 'Исходное название',
      createdById: null,
      isSerial: false,
    };
    posterExists = true;
    posterFailure = false;
    linkedHistory = false;
    progress = { currentSeason: null, currentEpisode: null };
    const tx = {
      adminAuditLog: { create: jest.fn().mockResolvedValue({}) },
      $executeRaw: jest.fn().mockResolvedValue(1),
      userMovie: {
        findFirst: jest.fn(
          ({
            where,
          }: {
            where: {
              movieId: string;
              OR: Array<
                Partial<
                  Record<'currentSeason' | 'currentEpisode', { gt: number }>
                >
              >;
            };
          }) =>
            Promise.resolve(
              where.movieId === movie.id &&
                where.OR.some((condition) =>
                  Object.entries(condition).some(
                    ([key, range]) =>
                      (progress[key as keyof typeof progress] ?? 0) >
                      (range as { gt: number }).gt,
                  ),
                )
                ? { id: 'another-users-progress' }
                : null,
            ),
        ),
      },
      movie: {
        findUnique: jest.fn(() => Promise.resolve(movie)),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(({ data }: { data: Prisma.MovieUpdateInput }) =>
          Promise.resolve(Object.assign(movie, data)),
        ),
        delete: jest.fn(() => {
          if (linkedHistory)
            return Promise.reject(
              Object.assign(new Error('Foreign key constraint'), {
                code: 'P2003',
              }),
            );
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
          if (posterFailure) {
            throw new Error('Ошибка удаления постера');
          }

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

    service = new MovieService(client, new UserMovieService(client), {
      select: jest.fn(),
      release: jest.fn(),
    } as never);
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

  it('не перезаписывает карточку из устаревшего административного редактора', async () => {
    movie.updatedAt = new Date('2026-10-13T10:00:00Z');

    await expect(
      service.patch(
        'movie-id',
        { title: 'Устаревшее', expectedUpdatedAt: '2026-10-13T09:00:00Z' },
        { id: 'admin-id', role: 'ADMIN' },
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(movie.title).toBe('Исходное название');
  });

  describe.each(['patch', 'update'] as const)(
    '%s: изменение типа',
    (method) => {
      const dto = {
        title: 'Исходное название',
        description: 'Описание',
        countryCodes: ['US'],
        genres: [Genre.DRAMA],
        actorIds: ['actor-id'],
        isSerial: false,
      };

      it.each([
        { currentSeason: 1, currentEpisode: null },
        { currentSeason: null, currentEpisode: 1 },
      ])('сохраняет сериал при чужом прогрессе %p', async (savedProgress) => {
        movie.isSerial = true;
        progress = savedProgress;

        await expect(
          service[method]('movie-id', dto, { id: 'admin-id', role: 'ADMIN' }),
        ).rejects.toMatchObject({ status: 409 });
        expect(movie.isSerial).toBe(true);
        expect(progress).toEqual(savedProgress);
      });

      it('разрешает исправление типа без прогресса и очищает числа сезонов/эпизодов', async () => {
        movie.isSerial = true;
        movie.seasonCount = 2;
        movie.episodeCount = 14;
        progress = { currentSeason: 0, currentEpisode: 0 };

        await service[method]('movie-id', dto, {
          id: 'admin-id',
          role: 'ADMIN',
        });
        expect(movie).toMatchObject({
          isSerial: false,
          seasonCount: null,
          episodeCount: null,
        });
      });
    },
  );

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

  it('возвращает понятный конфликт при удалении тайтла с историей, сохраняя тайтл и постер', async () => {
    movie.createdById = 'user-id';
    movie.posterId = 'poster-id';
    linkedHistory = true;
    await expect(
      service.delete('movie-id', { id: 'user-id', role: 'USER' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(movie.id).toBe('movie-id');
    expect(posterExists).toBe(true);
  });
});
