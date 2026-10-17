import { featuresDatabase } from './features-database';
import { TvdbImportService } from '../src/tvdb/tvdb-import.service';
import MovieService from '../src/movie/movie.service';
import { UserMovieService } from '../src/user-movie/user-movie.service';
import { ContentKind, Genre, WatchStatus } from '../src/generated/prisma/enums';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { TvdbProvider } from '../src/tvdb/tvdb-provider';
import type { TvdbPreview } from '../src/tvdb/tvdb.types';

let db: Awaited<ReturnType<typeof featuresDatabase>>;
let service: TvdbImportService;
let movies: MovieService;
let collection: UserMovieService;
let users: { id: string; role: string }[];
const preview: TvdbPreview = {
  id: '6187',
  type: 'movie',
  title: 'Дюна',
  titleEn: 'Dune',
  originalTitle: 'Dune',
  aliases: ['Dune: Part One'],
  year: 2021,
  description: 'Описание',
  descriptionLanguage: 'ru',
  countryCodes: ['US'],
  genres: [Genre.DRAMA],
  unmappedGenres: [],
  contentKind: ContentKind.GENERAL,
  isSerial: false,
  posterUrl: null,
  actors: [{ id: '123', name: 'Актёр' }],
  seasonCount: null,
  episodeCount: null,
};
beforeAll(async () => {
  db = await featuresDatabase();
  const prisma = db.prisma as PrismaService;
  users = await Promise.all(
    ['owner', 'other'].map((name) =>
      db.prisma.user.create({
        data: {
          email: `${name}@tvdb.test`,
          fullName: name,
          password: 'qa-only',
        },
      }),
    ),
  );
  collection = new UserMovieService(prisma);
  movies = new MovieService(prisma, collection, {
    select: () => Promise.resolve({ url: null }),
  } as never);
  const provider = {
    assertAvailable() {},
    preview: () => Promise.resolve(preview),
  } as unknown as TvdbProvider;
  service = new TvdbImportService(provider, prisma, movies, collection);
});
afterAll(async () => {
  await db?.close();
});

it('параллельные запросы создают одну карточку, одного актёра и по одной записи двух пользователей', async () => {
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      service.importMovie({ id: '6187', type: 'movie' }, users[i % 2]),
    ),
  );
  expect(new Set(results.map((r) => r.movieId)).size).toBe(1);
  expect(await db.prisma.movie.count()).toBe(1);
  expect(await db.prisma.actor.count()).toBe(1);
  expect(await db.prisma.userMovie.count()).toBe(2);
  const saved = await db.prisma.movie.findFirstOrThrow();
  expect(saved.titleEn).toBe('Dune');
  expect(saved.titleAliases).toContain('dune: part one');
});
it('находит импортированную карточку по английскому названию и точному псевдониму во всех списках', async () => {
  const id = (await db.prisma.movie.findFirstOrThrow()).id;
  expect((await movies.search('Dune')).map((m) => m.id)).toContain(id);
  expect(
    (await movies.suggestions(users[0].id, 'Dune: Part One')).map((m) => m.id),
  ).toContain(id);
  expect(
    (await collection.searchUserMovies(users[0].id, 'Dune')).map(
      (m) => m.movieId,
    ),
  ).toContain(id);
});
it('повторный импорт сохраняет личную оценку и статус в настоящей БД', async () => {
  const entry = await db.prisma.userMovie.findFirstOrThrow({
    where: { userId: users[0].id },
  });
  await db.prisma.userMovie.update({
    where: { id: entry.id },
    data: { personalRate: 8, watchStatus: WatchStatus.COMPLETED },
  });
  await service.importMovie({ id: '6187', type: 'movie' }, users[0]);
  expect(
    await db.prisma.userMovie.findUnique({ where: { id: entry.id } }),
  ).toMatchObject({ personalRate: 8, watchStatus: WatchStatus.COMPLETED });
});
it('ошибка коллекции откатывает новую карточку, внешнюю связь и нового актёра', async () => {
  await db.pool.query(
    `CREATE FUNCTION reject_tvdb_member() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced collection failure'; END $$`,
  );
  await db.pool.query(
    `CREATE TRIGGER reject_tvdb_member BEFORE INSERT ON user_movies FOR EACH ROW EXECUTE FUNCTION reject_tvdb_member()`,
  );
  const before = {
    movies: await db.prisma.movie.count(),
    actors: await db.prisma.actor.count(),
  };
  const previous = structuredClone(preview);
  try {
    Object.assign(preview, {
      id: '6188',
      title: 'Другой фильм',
      actors: [{ id: '124', name: 'Другой актёр' }],
    });
    await expect(
      service.importMovie({ id: '6188', type: 'movie' }, users[0]),
    ).rejects.toThrow();
    expect(await db.prisma.movie.count()).toBe(before.movies);
    expect(await db.prisma.actor.count()).toBe(before.actors);
    expect(
      await db.prisma.movie.findFirst({ where: { tvdbId: 6188 } }),
    ).toBeNull();
  } finally {
    Object.assign(preview, previous);
    await db.pool.query('DROP TRIGGER reject_tvdb_member ON user_movies');
    await db.pool.query('DROP FUNCTION reject_tvdb_member()');
  }
});
