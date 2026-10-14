import { randomUUID } from 'node:crypto';
import { featuresDatabase } from './features-database';
import { UserMovieService } from '../src/user-movie/user-movie.service';
import { LeaderboardService } from '../src/leaderboard/leaderboard.service';
import MovieService from '../src/movie/movie.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { CollectionQueryDto } from '../src/user-movie/dto/collection-query.dto';
import {
  LeaderboardQueryDto,
  LeaderboardSortBy,
  LeaderboardSortOrder,
  LeaderboardTopMoviesQueryDto,
  LeaderboardMovieSortBy,
  LeaderboardMovieSortOrder,
} from '../src/leaderboard/dto';

let database: Awaited<ReturnType<typeof featuresDatabase>>;
let users: string[];
let movies: string[];
let collection: UserMovieService;
let ranking: LeaderboardService;
beforeAll(async () => {
  database = await featuresDatabase();
});
afterAll(async () => {
  await database?.close();
});
beforeEach(async () => {
  const { prisma } = database;
  await prisma.$executeRawUnsafe('TRUNCATE TABLE users, movies CASCADE');
  users = Array.from({ length: 3 }, () => randomUUID());
  movies = Array.from({ length: 4 }, () => randomUUID());
  for (const [index, id] of users.entries())
    await prisma.user.create({
      data: {
        id,
        email: `${id}@example.test`,
        password: 'not-a-login-hash',
        fullName: `QA ${index}`,
        createdAt: new Date('2026-01-01'),
      },
    });
  for (const [index, id] of movies.entries())
    await prisma.movie.create({
      data: {
        id,
        title: `Тайтл ${index}`,
        description: 'QA',
        titleNormalized: `тайтл ${index}`,
        genres: index % 2 ? ['COMEDY'] : ['DRAMA'],
        countryCodes: index % 2 ? ['US'] : ['RU'],
        isSerial: index >= 2,
        seasonCount: index === 2 ? 2 : null,
        episodeCount: index === 2 ? 10 : null,
      },
    });
  await prisma.userMovie.createMany({
    data: [
      {
        userId: users[0],
        movieId: movies[0],
        personalRate: 8,
        isFavorite: true,
      },
      { userId: users[0], movieId: movies[1], personalRate: null },
      { userId: users[0], movieId: movies[3], watchStatus: 'COMPLETED' },
      { userId: users[1], movieId: movies[0], personalRate: 6 },
      {
        userId: users[1],
        movieId: movies[2],
        watchStatus: 'DROPPED',
        currentSeason: 2,
        currentEpisode: 10,
      },
    ],
  });
  collection = new UserMovieService(prisma as PrismaService);
  ranking = new LeaderboardService(
    prisma as PrismaService,
    { getTopUnlockedBadgesForUsers: () => Promise.resolve(new Map()) } as never,
  );
});

describe('Пагинация и рейтинги на PostgreSQL 18', () => {
  it('выдаёт страницы только владельца и сохраняет total', async () => {
    const first = await collection.pageByUser(
      users[0],
      Object.assign(new CollectionQueryDto(), { limit: 2 }),
    );
    const next = await collection.pageByUser(
      users[0],
      Object.assign(new CollectionQueryDto(), { limit: 2, offset: 2 }),
    );
    expect(first.total).toBe(3);
    expect(first.items).toHaveLength(2);
    expect(next.items).toHaveLength(1);
    expect(
      new Set([...first.items, ...next.items].map((row) => row.movieId)).size,
    ).toBe(3);
    expect(
      [...first.items, ...next.items].every((row) => row.userId === users[0]),
    ).toBe(true);
  });
  it('применяет поиск, избранное и жанр до пагинации', async () => {
    const result = await collection.pageByUser(
      users[0],
      Object.assign(new CollectionQueryDto(), {
        q: 'Тайтл',
        isFavorite: true,
        genres: ['DRAMA'],
        limit: 1,
      }),
    );
    expect(result.total).toBe(1);
    expect(result.items[0].movieId).toBe(movies[0]);
  });
  it('не исполняет SQL из строки поиска', async () => {
    const result = await collection.pageByUser(
      users[0],
      Object.assign(new CollectionQueryDto(), { q: "' OR 1=1 --" }),
    );
    expect(result.total).toBe(0);
    expect(await database.prisma.user.count()).toBe(3);
  });
  it('считает просмотренным сериал со статусом completed без известного числа серий', async () => {
    const result = await ranking.getTopUsers(new LeaderboardQueryDto());
    expect(result.total).toBe(2);
    expect(result.items.find((row) => row.userId === users[0])).toMatchObject({
      filmsCount: 2,
      serialsTotal: 1,
      serialsCompleted: 1,
      totalScore: 3,
    });
  });
  it('не считает брошенный сериал завершённым по одним конечным позициям', async () => {
    const result = await ranking.getTopUsers(new LeaderboardQueryDto());
    expect(result.items.find((row) => row.userId === users[1])).toMatchObject({
      filmsCount: 1,
      serialsCompleted: 0,
      totalScore: 1,
    });
  });
  it('сортирует и считает ранг до выборки страницы', async () => {
    const result = await ranking.getTopUsers(
      Object.assign(new LeaderboardQueryDto(), {
        limit: 1,
        offset: 1,
        sortBy: LeaderboardSortBy.TOTAL_SCORE,
        sortOrder: LeaderboardSortOrder.DESC,
      }),
    );
    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ userId: users[1], rank: 2 });
  });
  it('сохраняет различие отсутствия оценки и нуля при фильтрации среднего', async () => {
    const rated = await ranking.getTopMovies(
      Object.assign(new LeaderboardTopMoviesQueryDto(), {
        personalRateMin: 7,
        personalRateMax: 7,
      }),
    );
    expect(rated.items.map((row) => row.movieId)).toEqual([movies[0]]);
    expect(rated.items[0]).toMatchObject({
      avgPersonalRate: 7,
      ratingsCount: 2,
    });
    const unrated = await ranking.getTopMovies(
      Object.assign(new LeaderboardTopMoviesQueryDto(), {
        personalRateMin: 0,
        personalRateMax: 0,
      }),
    );
    expect(unrated.total).toBe(3);
    expect(
      unrated.items.every(
        (row) => row.avgPersonalRate === null && row.ratingsCount === 0,
      ),
    ).toBe(true);
  });
  it('фильтрует страны и жанры до вычисления total и учитывает пустую последнюю страницу', async () => {
    const result = await ranking.getTopMovies(
      Object.assign(new LeaderboardTopMoviesQueryDto(), {
        genres: ['COMEDY'],
        countryCodes: ['US'],
        limit: 1,
        offset: 20,
        sortBy: LeaderboardMovieSortBy.TITLE,
        sortOrder: LeaderboardMovieSortOrder.ASC,
      }),
    );
    expect(result.total).toBe(2);
    expect(result.items).toEqual([]);
  });
  it('обновляет кэш сразу после добавления, смены статуса, оценки и удаления', async () => {
    const query = new LeaderboardQueryDto();
    await ranking.getTopUsers(query);
    const movieQuery = new LeaderboardTopMoviesQueryDto();
    await ranking.getTopMovies(movieQuery);
    await collection.create(users[2], { movieId: movies[0] });
    expect((await ranking.getTopUsers(query)).total).toBe(3);
    await collection.update(users[0], movies[3], { watchStatus: 'DROPPED' });
    expect(
      (await ranking.getTopUsers(query)).items.find(
        (row) => row.userId === users[0],
      )?.totalScore,
    ).toBe(2);
    await collection.rate(users[0], movies[0], { personalRate: 10 });
    expect(
      (await ranking.getTopMovies(movieQuery)).items.find(
        (row) => row.movieId === movies[0],
      )?.avgPersonalRate,
    ).toBe(8);
    await collection.delete(users[2], movies[0]);
    expect((await ranking.getTopUsers(query)).total).toBe(2);
  });
  it('сохраняет русскую сортировку, привязку актёров, даты и mapped-жанр Sci_fi', async () => {
    const actor = await database.prisma.actor.create({ data: { name: 'QA' } });
    await database.prisma.movie.update({
      where: { id: movies[0] },
      data: {
        title: 'Ёлки',
        genres: ['Sci_fi'],
        publishDate: new Date('2026-01-01'),
        actors: { connect: { id: actor.id } },
      },
    });
    const result = await ranking.getTopMovies(
      Object.assign(new LeaderboardTopMoviesQueryDto(), {
        genres: ['Sci_fi'],
        actorIds: [actor.id],
        publishDateFrom: '2026-01-01',
        publishDateTo: '2026-01-01',
      }),
    );
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      movieId: movies[0],
      publishDate: '2026-01-01T00:00:00.000Z',
    });
    const sorted = await ranking.getTopMovies(
      Object.assign(new LeaderboardTopMoviesQueryDto(), {
        sortBy: 'title',
        sortOrder: 'asc',
      }),
    );
    expect(sorted.items.map((row) => row.title)).toEqual([
      'Ёлки',
      'Тайтл 1',
      'Тайтл 2',
      'Тайтл 3',
    ]);
  });
  it('ограничивает подсказки и определяет коллекцию по авторизованному пользователю', async () => {
    const service = new MovieService(
      database.prisma as PrismaService,
      collection,
      {} as never,
    );
    const result = await service.suggestions(users[1], 'Тайтл', 2);
    expect(result).toHaveLength(2);
    expect(result.map((row) => [row.id, row.inCollection])).toEqual([
      [movies[0], true],
      [movies[1], false],
    ]);
    expect(
      result.every((row) => !('userMovies' in row) && !('description' in row)),
    ).toBe(true);
    expect(await service.suggestions(users[0], "' OR 1=1 --", 10)).toEqual([]);
  });
});
