import MovieService from './movie.service';
import { UserMovieService } from '../user-movie/user-movie.service';
import { PrismaService } from '../prisma/prisma.service';
import { Genre, WatchStatus } from '../generated/prisma/enums';
import type { Prisma } from '../generated/prisma/client';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Создание фильма вместе с личной записью', () => {
  let movies: Array<Record<string, unknown>>;
  let collection: Array<Record<string, unknown>>;
  let failCollection: boolean;
  let service: MovieService;

  beforeEach(() => {
    movies = [];
    collection = [];
    failCollection = false;
    const tx = {
      movie: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(() => Promise.resolve(movies[0])),
        create: jest.fn(({ data }: { data: Prisma.MovieCreateInput }) => {
          const movie = { id: 'movie-id', ...data };
          movies.push(movie);
          return Promise.resolve(movie);
        }),
      },
      actor: {
        findMany: jest.fn(({ where }: { where: { id: { in: string[] } } }) =>
          Promise.resolve(where.id.in.map((id) => ({ id }))),
        ),
      },
      review: { groupBy: jest.fn().mockResolvedValue([]) },
      userMovie: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(
          ({ data }: { data: Prisma.UserMovieUncheckedCreateInput }) => {
            if (failCollection) throw new Error('Ошибка коллекции');
            collection.push(data);
            return Promise.resolve(data);
          },
        ),
      },
    };
    const prisma = {
      ...tx,
      $transaction: async <T>(
        work: (client: typeof tx) => Promise<T>,
      ): Promise<T> => {
        const before = structuredClone({ movies, collection });
        try {
          return await work(tx);
        } catch (error) {
          movies = before.movies;
          collection = before.collection;
          throw error;
        }
      },
    } as unknown as PrismaService;
    const userMovies = new UserMovieService(prisma);
    service = new MovieService(prisma, userMovies);
  });

  const payload = () => ({
    title: 'Фильм без актёров',
    description: 'Описание',
    countryCodes: ['US'],
    genres: [Genre.DRAMA],
    actorIds: ['actor-id'],
    isSerial: true,
    seasonCount: 2,
    episodeCount: 10,
    collection: {
      personalRate: 8,
      watchStatus: WatchStatus.COMPLETED,
      seeLater: false,
    },
  });

  it('создаёт обе записи и нормализует прогресс в одной операции', async () => {
    await service.create(payload(), { id: 'user-id', role: 'USER' });
    expect(movies).toHaveLength(1);
    expect(collection).toHaveLength(1);
    expect(collection[0]).toMatchObject({
      userId: 'user-id',
      movieId: 'movie-id',
      personalRate: 8,
      watchStatus: WatchStatus.COMPLETED,
      currentSeason: 2,
      currentEpisode: 10,
    });
    expect(collection[0].completedAt).toBeInstanceOf(Date);
  });

  it('не оставляет фильм в каталоге при ошибке создания личной записи', async () => {
    failCollection = true;
    await expect(
      service.create(payload(), { id: 'user-id', role: 'USER' }),
    ).rejects.toThrow('Ошибка коллекции');
    expect(movies).toEqual([]);
    expect(collection).toEqual([]);
  });

  it('разрешает создать тайтл без необязательного списка актёров', async () => {
    const dto = payload();
    dto.actorIds = [];
    await service.create(dto, { id: 'user-id', role: 'USER' });
    expect(movies).toHaveLength(1);
  });
});
