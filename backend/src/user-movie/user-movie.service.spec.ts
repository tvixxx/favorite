import { UserMovieService } from './user-movie.service';
import { PrismaService } from '../prisma/prisma.service';
import { WatchStatus } from '../generated/prisma/enums';
import type { Prisma } from '../generated/prisma/client';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Статусы просмотра и удаление из коллекции', () => {
  let current: Record<string, unknown>;
  let listItems: Array<{ userId: string; movieId: string }>;
  let isSerial: boolean;
  let listFailure: boolean;
  let service: UserMovieService;

  beforeEach(() => {
    current = {
      id: 'link-id',
      userId: 'user-id',
      movieId: 'movie-id',
      watchStatus: WatchStatus.COMPLETED,
      currentSeason: 2,
      currentEpisode: 10,
      startedAt: new Date('2026-01-01'),
      completedAt: new Date('2026-01-02'),
      droppedAt: new Date('2026-01-03'),
      lastWatchedAt: new Date('2026-01-02'),
    };
    listItems = [
      { userId: 'user-id', movieId: 'movie-id' },
      { userId: 'other-user', movieId: 'movie-id' },
    ];
    isSerial = false;
    listFailure = false;
    const tx = {
      userMovie: {
        findUnique: jest.fn(() => Promise.resolve(current)),
        update: jest.fn(({ data }: { data: Prisma.UserMovieUpdateInput }) => {
          Object.assign(current, data);
          return Promise.resolve({ ...current });
        }),
        delete: jest.fn(() => {
          const result = current;
          current = null!;
          return Promise.resolve(result);
        }),
      },
      movie: {
        findUnique: jest.fn(() =>
          Promise.resolve({
            isSerial,
            seasonCount: 2,
            episodeCount: 10,
          }),
        ),
      },
      userListItem: {
        deleteMany: jest.fn(
          ({
            where,
          }: {
            where: { movieId: string; list: { userId: string } };
          }) => {
            if (listFailure) throw new Error('Ошибка хранения списков');
            listItems = listItems.filter(
              (item) =>
                item.movieId !== where.movieId ||
                item.userId !== where.list.userId,
            );
            return Promise.resolve({ count: 1 });
          },
        ),
      },
    };
    const prisma = {
      ...tx,
      $transaction: async <T>(
        work: (client: typeof tx) => Promise<T>,
      ): Promise<T> => {
        const snapshot = structuredClone({ current, listItems });
        try {
          return await work(tx);
        } catch (error) {
          current = snapshot.current;
          listItems = snapshot.listItems;
          throw error;
        }
      },
    };
    service = new UserMovieService(prisma as unknown as PrismaService);
  });

  it('очищает дату завершения при возврате фильма в смотрю', async () => {
    const result = await service.update('user-id', 'movie-id', {
      watchStatus: WatchStatus.WATCHING,
    });
    expect(result.completedAt).toBeNull();
    expect(result.droppedAt).toBeNull();
    expect(result.startedAt).toEqual(new Date('2026-01-01'));
  });

  it.each([false, true])(
    'сбрасывает даты и прогресс при не начато, сериал: %s',
    async (serial) => {
      isSerial = serial;
      const result = await service.update('user-id', 'movie-id', {
        watchStatus: WatchStatus.NOT_STARTED,
      });
      expect(result).toMatchObject({
        currentSeason: null,
        currentEpisode: null,
        startedAt: null,
        completedAt: null,
        droppedAt: null,
        lastWatchedAt: null,
      });
    },
  );

  it('ставит начало и дату прекращения для брошенного фильма', async () => {
    current.startedAt = null;
    const result = await service.update('user-id', 'movie-id', {
      watchStatus: WatchStatus.DROPPED,
    });
    expect(result.startedAt).toBeInstanceOf(Date);
    expect(result.droppedAt).toBeInstanceOf(Date);
    expect(result.completedAt).toBeNull();
  });

  it('не меняет дату завершения при повторном выборе просмотрено', async () => {
    isSerial = true;
    const result = await service.update('user-id', 'movie-id', {
      watchStatus: WatchStatus.COMPLETED,
    });
    expect(result.completedAt).toEqual(new Date('2026-01-02'));
  });

  it('ставит полные позиции известного сериала при явном выборе просмотрено даже с нулевыми полями формы', async () => {
    isSerial = true;
    const result = await service.update('user-id', 'movie-id', {
      watchStatus: WatchStatus.COMPLETED,
      currentSeason: 0,
      currentEpisode: 0,
    });
    expect(result).toMatchObject({
      currentSeason: 2,
      currentEpisode: 10,
      watchStatus: WatchStatus.COMPLETED,
    });
  });

  it.each([WatchStatus.COMPLETED, WatchStatus.DROPPED])(
    'не меняет статус %s и даты при изменении избранного',
    async (status) => {
      isSerial = true;
      current.watchStatus = status;
      const before = structuredClone(current);
      const result = await service.update('user-id', 'movie-id', {
        isFavorite: true,
      });
      expect(result).toMatchObject({ ...before, isFavorite: true });
    },
  );

  it('сохраняет явное очищение nullable позиции сериала', async () => {
    isSerial = true;
    const result = await service.update('user-id', 'movie-id', {
      currentEpisode: null,
    } as never);
    expect(result.currentEpisode).toBeNull();
  });

  it('не позволяет переносить личную запись на другого владельца через лишние поля', async () => {
    const result = await service.update('user-id', 'movie-id', {
      personalRate: 8,
      userId: 'other-user',
      movieId: 'other-movie',
    } as never);
    expect(result.userId).toBe('user-id');
    expect(result.movieId).toBe('movie-id');
  });

  it('удаляет тайтл только из коллекции и списков владельца', async () => {
    await service.delete('user-id', 'movie-id');
    expect(current).toBeNull();
    expect(listItems).toEqual([{ userId: 'other-user', movieId: 'movie-id' }]);
  });

  it('не теряет запись коллекции, если очистить списки не удалось', async () => {
    listFailure = true;
    await expect(service.delete('user-id', 'movie-id')).rejects.toThrow(
      'Ошибка хранения списков',
    );
    expect(current.movieId).toBe('movie-id');
    expect(listItems).toHaveLength(2);
  });
});
