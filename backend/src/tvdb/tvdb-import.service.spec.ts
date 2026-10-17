import { ServiceUnavailableException } from '@nestjs/common';
import MovieService from '../movie/movie.service';
import { UserMovieService } from '../user-movie/user-movie.service';
import { ContentKind, Genre, WatchStatus } from '../generated/prisma/enums';
import { TvdbImportService } from './tvdb-import.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

function setup() {
  const state = {
    movies: [] as Record<string, unknown>[],
    actors: [] as Record<string, unknown>[],
    collection: [] as Record<string, unknown>[],
  };
  let fail = false;
  const tx = {
    adminAuditLog: { create: jest.fn().mockResolvedValue({}) },
    $executeRaw: jest.fn().mockResolvedValue(1),
    movie: {
      findMany: jest.fn(({ where }: { where: { titleNormalized: string } }) =>
        Promise.resolve(
          state.movies.filter(
            (m) => m.titleNormalized === where.titleNormalized,
          ),
        ),
      ),
      findFirst: jest.fn(
        ({ where }: { where: { tvdbType: string; tvdbId: number } }) =>
          Promise.resolve(
            state.movies.find(
              (m) => m.tvdbType === where.tvdbType && m.tvdbId === where.tvdbId,
            ) ?? null,
          ),
      ),
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(state.movies.find((m) => m.id === where.id) ?? null),
      ),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        const row = { id: 'movie-' + state.movies.length, ...data };
        state.movies.push(row);
        return Promise.resolve(row);
      }),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const row = state.movies.find((m) => m.id === where.id)!;
          Object.assign(row, data);
          return Promise.resolve(row);
        },
      ),
    },
    actor: {
      findMany: jest.fn(({ where }: { where: { id: { in: unknown[] } } }) =>
        Promise.resolve(state.actors.filter((a) => where.id.in.includes(a.id))),
      ),
      upsert: jest.fn(
        ({
          where,
          create,
        }: {
          where: { tvdbId: number };
          create: Record<string, unknown>;
        }) => {
          let row = state.actors.find((a) => a.tvdbId === where.tvdbId);
          if (!row) {
            row = { id: 'actor-' + state.actors.length, ...create };
            state.actors.push(row);
          }
          return Promise.resolve(row);
        },
      ),
    },
    userMovie: {
      findUnique: jest.fn(
        ({
          where,
        }: {
          where: { userId_movieId: { userId: string; movieId: string } };
        }) =>
          Promise.resolve(
            state.collection.find(
              (m) =>
                m.userId === where.userId_movieId.userId &&
                m.movieId === where.userId_movieId.movieId,
            ) ?? null,
          ),
      ),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        if (fail) throw new Error('Ошибка коллекции');
        const row = { id: 'entry-' + state.collection.length, ...data };
        state.collection.push(row);
        return Promise.resolve(row);
      }),
    },
  };
  const prisma = {
    ...tx,
    $transaction: async (work: (client: typeof tx) => Promise<unknown>) => {
      const before = structuredClone(state);
      try {
        return await work(tx);
      } catch (error) {
        Object.assign(state, before);
        throw error;
      }
    },
  };
  const preview = {
    id: '6187',
    type: 'movie',
    title: 'Дюна',
    titleEn: 'Dune',
    originalTitle: 'Dune',
    aliases: ['Dune'],
    year: 2021,
    description: 'Описание',
    descriptionLanguage: 'ru',
    countryCodes: ['US'],
    genres: [Genre.DRAMA],
    unmappedGenres: [],
    contentKind: ContentKind.GENERAL,
    isSerial: false,
    posterUrl: null,
    actors: [{ id: '1', name: 'Актёр' }],
    seasonCount: null,
    episodeCount: null,
  };
  const provider = {
    assertAvailable: jest.fn(),
    preview: jest.fn().mockResolvedValue(preview),
  };
  const collection = new UserMovieService(prisma as never);
  const movies = new MovieService(prisma as never, collection, {
    select: jest.fn().mockResolvedValue({ url: null }),
  } as never);
  return {
    state,
    preview,
    provider,
    service: new TvdbImportService(
      provider as never,
      prisma as never,
      movies,
      collection,
    ),
    failCollection: () => {
      fail = true;
    },
  };
}
const user = { id: 'owner', role: 'USER' };
const input = { id: '6187', type: 'movie' as const };

describe('Добавление из TheTVDB', () => {
  it.each([
    { year: 1919 },
    { year: new Date().getUTCFullYear() + 6 },
    { seasonCount: 101 },
    { episodeCount: 5001 },
  ])(
    'не создаёт карточку и актёров при данных источника за новыми границами %#',
    async (change) => {
      const { service, preview, state } = setup();
      Object.assign(preview, change);
      await expect(service.importMovie(input, user)).rejects.toMatchObject({
        status: 400,
      });
      expect(state).toEqual({ movies: [], actors: [], collection: [] });
    },
  );
  it('по умолчанию связывает только первые 15 актёров и позволяет явно расширить состав', async () => {
    for (const [limit, expected] of [
      [undefined, 15],
      [25, 25],
      [58, 58],
    ] as const) {
      const { service, state, preview } = setup();
      preview.actors = Array.from({ length: 58 }, (_, i) => ({
        id: String(i + 1),
        name: `Актёр ${i + 1}`,
      }));
      await service.importMovie({ ...input, actorLimit: limit }, user);
      expect(state.actors).toHaveLength(expected);
      expect(state.movies[0].actors).toEqual({
        connect: state.actors.map((actor) => ({ id: actor.id })),
      });
    }
  });
  it('не сбрасывает положительный прогресс статусом Не начато и отклоняет превышение лимита', async () => {
    const { service, preview, state } = setup();
    Object.assign(preview, {
      type: 'series',
      isSerial: true,
      seasonCount: 1,
      episodeCount: 10,
    });
    await expect(
      service.importMovie(
        { id: '6187', type: 'series', collection: { currentEpisode: 5 } },
        user,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.importMovie(
        {
          id: '6187',
          type: 'series',
          collection: { currentEpisode: 11, watchStatus: WatchStatus.WATCHING },
        },
        user,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(state.collection).toEqual([]);
    await service.importMovie(
      {
        id: '6187',
        type: 'series',
        collection: { currentEpisode: 5, watchStatus: WatchStatus.WATCHING },
      },
      user,
    );
    expect(state.collection[0]).toMatchObject({
      currentEpisode: 5,
      watchStatus: WatchStatus.WATCHING,
    });
  });
  it('разрешает отдельное совпадающее произведение только администратору с явным объяснением', async () => {
    const { service, state } = setup();
    state.movies.push({
      id: 'manual',
      title: 'Дюна',
      titleNormalized: 'дюна',
      publishDate: new Date('2021-01-01'),
      isSerial: false,
    });
    const request = {
      ...input,
      distinctReason: 'Это отдельное произведение, подтверждено',
    };
    await expect(service.importMovie(request, user)).rejects.toMatchObject({
      status: 403,
    });
    await service.importMovie(request, { ...user, role: 'ADMIN' });
    expect(state.movies).toHaveLength(2);
  });
  it('выключенный источник не создаёт карточки или актёров', async () => {
    const { service, provider, state } = setup();
    provider.assertAvailable.mockImplementation(() => {
      throw new ServiceUnavailableException();
    });
    await expect(service.importMovie(input, user)).rejects.toMatchObject({
      status: 503,
    });
    expect(state).toEqual({ movies: [], actors: [], collection: [] });
  });
  it('создаёт одну карточку с языками, внешним ID и записью коллекции', async () => {
    const { service, state } = setup();
    await service.importMovie(input, user);
    expect(state.movies).toEqual([
      expect.objectContaining({
        title: 'Дюна',
        titleEn: 'Dune',
        originalTitle: 'Dune',
        tvdbId: 6187,
        tvdbType: 'movie',
      }),
    ]);
    expect(state.collection).toEqual([
      expect.objectContaining({
        userId: 'owner',
        watchStatus: WatchStatus.NOT_STARTED,
        seeLater: true,
      }),
    ]);
    expect(state.actors).toHaveLength(1);
  });
  it('повторное добавление сохраняет личную оценку, статус и прогресс', async () => {
    const { service, state } = setup();
    const first = await service.importMovie(input, user);
    Object.assign(state.collection[0], {
      personalRate: 9,
      watchStatus: WatchStatus.COMPLETED,
      currentEpisode: 20,
    });
    expect(
      await service.importMovie(
        {
          ...input,
          collection: { currentEpisode: 50, watchStatus: WatchStatus.WATCHING },
        },
        user,
      ),
    ).toMatchObject({ movieId: first.movieId, alreadyInCollection: true });
    expect(state.movies).toHaveLength(1);
    expect(state.collection).toEqual([
      expect.objectContaining({
        personalRate: 9,
        watchStatus: WatchStatus.COMPLETED,
        currentEpisode: 20,
      }),
    ]);
  });
  it('использует ту же карточку для второго аккаунта без повторного создания актёров', async () => {
    const { service, state } = setup();
    await service.importMovie(input, user);
    await service.importMovie(input, { ...user, id: 'other' });
    expect(state.movies).toHaveLength(1);
    expect(state.actors).toHaveLength(1);
    expect(state.collection.map((m) => m.userId)).toEqual(['owner', 'other']);
  });
  it('откатывает карточку и актёров при ошибке записи коллекции', async () => {
    const { service, state, failCollection } = setup();
    failCollection();
    await expect(service.importMovie(input, user)).rejects.toThrow(
      'Ошибка коллекции',
    );
    expect(state).toEqual({ movies: [], actors: [], collection: [] });
  });
  it('не обходит существующую защиту от одинаковых названий, годов и форматов', async () => {
    const { service, state } = setup();
    state.movies.push({
      id: 'manual',
      title: 'Дюна',
      titleNormalized: 'дюна',
      publishDate: new Date('2021-01-01'),
      isSerial: false,
    });
    await expect(service.importMovie(input, user)).rejects.toMatchObject({
      status: 409,
    });
    expect(state.movies).toHaveLength(1);
    expect(state.actors).toEqual([]);
  });
  it('выбор готовой карточки не меняет её общие данные и не назначает внешнюю связь', async () => {
    const { service, state } = setup();
    const manual = {
      id: 'manual',
      title: 'Ручная карточка',
      description: 'Собственный текст',
      isSerial: false,
    };
    state.movies.push(manual);
    await service.importMovie({ ...input, existingMovieId: 'manual' }, user);
    expect(state.movies).toEqual([manual]);
    expect(state.collection).toHaveLength(1);
  });
});
