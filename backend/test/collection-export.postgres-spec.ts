import { Test } from '@nestjs/testing';
import {
  ValidationPipe,
  type INestApplication,
  type ExecutionContext,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { featuresDatabase } from './features-database';
import { UserMovieController } from '../src/user-movie/user-movie.controller';
import { UserMovieService } from '../src/user-movie/user-movie.service';
import { CollectionImportController } from '../src/user-movie/collection-import.controller';
import { CollectionImportService } from '../src/user-movie/collection-import.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtGuard } from '../src/common/guards/auth.guard';
import { configureCollectionImportBody } from '../src/user-movie/collection-import-body';

let db: Awaited<ReturnType<typeof featuresDatabase>>;
let app: INestApplication;
let base: string;
let actor: string;
let owner: string;
let target: string;
let imports: CollectionImportService;
const dates = {
  addedAt: new Date('2020-01-02T03:04:05Z'),
  startedAt: null,
  completedAt: new Date('2020-02-03T04:05:06Z'),
  lastWatchedAt: null,
  droppedAt: null,
};
const fields = [
  'watchStatus',
  'isFavorite',
  'seeLater',
  'personalRate',
  'currentSeason',
  'currentEpisode',
  'addedAt',
  'startedAt',
  'completedAt',
  'lastWatchedAt',
  'droppedAt',
] as const;

beforeAll(async () => {
  db = await featuresDatabase();
  for (const email of ['owner@export.test', 'target@export.test']) {
    const user = await db.prisma.user.create({
      data: { email, password: 'test-only-not-a-login-secret', fullName: 'QA' },
    });
    if (!owner) owner = user.id;
    else target = user.id;
  }
  actor = owner;
  for (let i = 0; i < 23; i++) {
    const movie = await db.prisma.movie.create({
      data: {
        title: i === 0 ? '\'=Фильм, "пример"' : `Экспорт ${i}`,
        titleNormalized: i === 0 ? '\'=фильм, "пример"' : `экспорт ${i}`,
        description: 'Не экспортировать описание',
        genres: [],
        isSerial: true,
        seasonCount: 1,
        episodeCount: 10,
        publishDate: new Date('2020-01-01T00:00:00Z'),
        poster: { create: { url: 'https://example.test/poster.jpg' } },
      },
    });
    await db.prisma.userMovie.create({
      data: {
        userId: owner,
        movieId: movie.id,
        watchStatus: i % 2 ? 'WATCHING' : 'COMPLETED',
        personalRate: i === 0 ? null : i === 1 ? 0 : 8,
        currentSeason: 4,
        currentEpisode: 27,
        isFavorite: i === 0,
        seeLater: false,
        ...dates,
      },
    });
  }
  const module = await Test.createTestingModule({
    controllers: [UserMovieController, CollectionImportController],
    providers: [
      UserMovieService,
      CollectionImportService,
      { provide: PrismaService, useValue: db.prisma },
      {
        provide: JwtService,
        useValue: new JwtService({
          secret: 'collection-export-test-only-signing-key',
        }),
      },
    ],
  })
    .overrideGuard(JwtGuard)
    .useValue({
      canActivate: (ctx: ExecutionContext) => {
        ctx.switchToHttp().getRequest<{ user: { id: string } }>().user = {
          id: actor,
        };
        return true;
      },
    })
    .compile();
  app = module.createNestApplication({ logger: false });
  configureCollectionImportBody(app);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
  imports = app.get(CollectionImportService);
});
afterAll(async () => {
  await app?.close();
  await db?.close();
});
beforeEach(() => {
  actor = owner;
});

describe('Экспорт и обратный импорт: HTTP и PostgreSQL', () => {
  it('проверяет большой v2-файл по HTTP, не записывая коллекцию', async () => {
    const recipient = await db.prisma.user.create({
      data: {
        email: 'large@export.test',
        password: 'test-only',
        fullName: 'QA',
      },
    });
    actor = recipient.id;
    const catalog = Array.from({ length: 400 }, (_, index) => ({
      id: randomUUID(),
      title: `Большой снимок ${index}`,
      titleNormalized: `большой снимок ${index}`,
      description: 'QA',
      genres: [],
      isSerial: true,
    }));
    await db.prisma.movie.createMany({ data: catalog });
    const file = {
      format: 'json',
      content: JSON.stringify({
        version: 2,
        movies: catalog.map((movie) => ({
          title: movie.title,
          year: null,
          contentKind: null,
          isSerial: true,
          watchStatus: 'WATCHING',
          isFavorite: false,
          seeLater: false,
          personalRate: null,
          currentSeason: 2,
          currentEpisode: 3,
          addedAt: '2020-01-02T03:04:05.000Z',
          startedAt: null,
          completedAt: null,
          lastWatchedAt: null,
          droppedAt: null,
        })),
      }),
    };
    expect(Buffer.byteLength(JSON.stringify(file))).toBeGreaterThan(100 * 1024);
    const response = await fetch(
      `${base}/users/${recipient.id}/movies/import/check`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(file),
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ valid: true, ready: 400 });
    expect(
      await db.prisma.userMovie.count({ where: { userId: recipient.id } }),
    ).toBe(0);
  });

  it('отказывает при превышении лимита вместо частичной выгрузки', async () => {
    const large = await db.prisma.user.create({
      data: {
        email: 'limit@export.test',
        password: 'test-only',
        fullName: 'QA',
      },
    });
    actor = large.id;
    const movies = Array.from({ length: 1001 }, (_, index) => ({
      id: randomUUID(),
      title: `Лимит ${index}`,
      titleNormalized: `лимит ${index}`,
      description: 'QA',
      genres: [],
    }));
    await db.prisma.movie.createMany({ data: movies });
    await db.prisma.userMovie.createMany({
      data: movies.map((movie) => ({ userId: large.id, movieId: movie.id })),
    });
    expect(
      (await fetch(`${base}/users/${large.id}/movies/export`)).status,
    ).toBe(400);
    expect(
      await db.prisma.userMovie.count({ where: { userId: large.id } }),
    ).toBe(1001);
  });
  it('возвращает пустую выборку без файла', async () => {
    const empty = await db.prisma.user.create({
      data: {
        email: 'empty@export.test',
        password: 'test-only',
        fullName: 'QA',
      },
    });
    actor = empty.id;
    const response = await fetch(`${base}/users/${empty.id}/movies/export`);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });
  it.each(['json', 'csv'] as const)(
    'восстанавливает все поля из %s, включая NULL, 0 и исторический прогресс',
    async (format) => {
      await db.prisma.userMovie.deleteMany({ where: { userId: target } });
      const source = await db.prisma.userMovie.findMany({
        where: { userId: owner },
        orderBy: { movieId: 'asc' },
      });
      const response = await fetch(
        `${base}/users/${owner}/movies/export?format=${format}&limit=1&offset=20`,
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(response.headers.get('content-disposition')).toContain(
        'attachment',
      );
      const content = await response.text();
      expect(content).not.toContain(owner);
      expect(content).not.toContain('poster.jpg');
      expect(content).not.toContain('Не экспортировать');
      const file = { format, content };
      const checked = await imports.check({ id: target }, file);
      expect(checked).toMatchObject({ valid: true, ready: 23 });
      await imports.commit({ id: target }, { ...file, proof: checked.proof! });
      const restored = await db.prisma.userMovie.findMany({
        where: { userId: target },
        orderBy: { movieId: 'asc' },
      });
      expect(restored).toHaveLength(source.length);
      const pick = (row: (typeof source)[number]) =>
        Object.fromEntries(
          ['movieId', ...fields].map((key) => [
            key,
            row[key as keyof typeof row],
          ]),
        );
      expect(restored.map(pick)).toEqual(source.map(pick));
      const before = structuredClone(restored);
      const repeated = await imports.check({ id: target }, file);
      expect(
        await imports.commit(
          { id: target },
          { ...file, proof: repeated.proof! },
        ),
      ).toEqual({ added: 0, skipped: 23 });
      expect(
        await db.prisma.userMovie.findMany({
          where: { userId: target },
          orderBy: { movieId: 'asc' },
        }),
      ).toEqual(before);
    },
  );

  it('применяет поиск/фильтры только по явному выбору', async () => {
    const get = async (scope: string) => {
      const response = await fetch(
        `${base}/users/${owner}/movies/export?scope=${scope}&q=Экспорт%202&watchStatus=WATCHING`,
      );
      expect(response.status).toBe(200);
      return (await response.json()) as {
        movies: { title: string; watchStatus: string }[];
      };
    };
    expect((await get('all')).movies).toHaveLength(23);
    expect((await get('filtered')).movies.map((row) => row.title)).toEqual([
      'Экспорт 21',
    ]);
    expect((await get('completed')).movies).toHaveLength(12);
  });

  it('не даёт получить чужую коллекцию и отклоняет неверный формат', async () => {
    actor = target;
    expect((await fetch(`${base}/users/${owner}/movies/export`)).status).toBe(
      403,
    );
    actor = owner;
    expect(
      (await fetch(`${base}/users/${owner}/movies/export?format=xml`)).status,
    ).toBe(400);
  });

  it('PDF payload содержит только сведения для краткого отчёта', async () => {
    const response = await fetch(
      `${base}/users/${owner}/movies/export?format=pdf&scope=completed`,
    );
    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      movies: Record<string, unknown>[];
    };
    expect(result.movies).toHaveLength(12);
    expect(result.movies[0]).toHaveProperty('posterUrl');
    for (const row of result.movies) {
      expect(Object.keys(row).sort()).toEqual(
        [
          'title',
          'year',
          'isSerial',
          'contentKind',
          'watchStatus',
          'personalRate',
          'completedAt',
          'posterUrl',
        ].sort(),
      );
    }
  });
});
