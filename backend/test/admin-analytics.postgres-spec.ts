import { randomBytes, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';
import { AdminAnalyticsService } from '../src/admin/admin-analytics.service';

// Только одноразовый локальный контейнер, рабочий DATABASE_URL не используется.
// docker run --rm -d --name favourite-analytics-qa -p 127.0.0.1:55439:5432
//   -e POSTGRES_USER=analytics_qa -e POSTGRES_PASSWORD=analytics-qa-local-only
//   -e POSTGRES_DB=analytics_qa postgres:18-alpine
// Запуск: yarn test:postgres. После проверки: docker stop favourite-analytics-qa.
const connectionString =
  'postgresql://analytics_qa:analytics-qa-local-only@127.0.0.1:55439/analytics_qa';
const database = `analytics_qa_${randomBytes(8).toString('hex')}`;
const testUrl = connectionString.replace(/\/analytics_qa$/, `/${database}`);
const now = new Date('2030-01-08T12:00:00Z');
const day = 86_400_000;
const ago = (days: number): Date => new Date(now.getTime() - days * day);
const control = new Client({ connectionString });
let prisma: PrismaClient;
let service: AdminAnalyticsService;
let created = false;

async function user(createdAt = now): Promise<string> {
  const id = randomUUID();

  await prisma.user.create({
    data: {
      id,
      email: `${id}@example.test`,
      password: 'not-a-login-hash',
      fullName: 'QA analytics',
      createdAt,
    },
  });
  return id;
}

async function event(
  userId: string,
  occurredAt: Date,
  feature = 'SEARCH',
): Promise<string> {
  const id = randomUUID();

  await prisma.usageEvent.create({ data: { id, userId, occurredAt, feature } });
  return id;
}

beforeAll(async () => {
  await control.connect();
  const { rows } = await control.query<{ name: string; version: number }>(
    "SELECT current_database() AS name, current_setting('server_version_num')::int AS version",
  );

  expect(rows[0].name).toBe('analytics_qa');
  expect(Math.floor(rows[0].version / 10000)).toBe(18);
  await control.query(`CREATE DATABASE "${database}"`);
  created = true;
  const migrationClient = new Client({ connectionString: testUrl });

  try {
    await migrationClient.connect();
    const directory = join(__dirname, '../prisma/migrations');
    const migrations = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    for (const migration of migrations) {
      await migrationClient.query(
        await readFile(join(directory, migration, 'migration.sql'), 'utf8'),
      );
    }
  } finally {
    await migrationClient.end();
  }
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: testUrl }),
  });
  await prisma.$connect();
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE users CASCADE');
  // Сетевые таймеры настоящие, подменяется только дата приложения.
  jest.useFakeTimers({
    now,
    doNotFake: [
      'nextTick',
      'queueMicrotask',
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'setImmediate',
      'clearImmediate',
      'hrtime',
      'performance',
    ],
  });
  service = new AdminAnalyticsService(prisma as PrismaService);
});

afterEach(() => {
  service?.onModuleDestroy();
  jest.useRealTimers();
});

afterAll(async () => {
  await prisma?.$disconnect();
  try {
    if (created) {
      await control.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    }
  } finally {
    await control.end();
  }
});

describe('Расчёты административной аналитики на PostgreSQL 18', () => {
  it('считает уникальных пользователей отдельно от числа действий', async () => {
    const first = await user();
    const second = await user();
    const timestamp = new Date('2030-01-08T10:00:00Z');

    await event(first, timestamp);
    await event(first, timestamp);
    await event(second, timestamp);
    await event(first, timestamp, 'LIST');
    const result = await service.overview(7, 'Europe/Samara');

    expect(result.users).toBe(2);
    expect(result.active).toBe(2);
    expect(result.features).toEqual([
      { feature: 'SEARCH', users: 2, actions: 3 },
      { feature: 'LIST', users: 1, actions: 1 },
    ]);
    expect(result.heatmap).toEqual([{ day: 2, hour: 14, users: 2 }]);
  });

  it('по умолчанию рассчитывает границы периода и часы событий в UTC', async () => {
    const id = await user();
    await event(id, new Date('2030-01-08T10:00:00Z'));

    const result = await service.overview(7);

    expect(result.timezone).toBe('UTC');
    expect(result.since).toBe('2030-01-02T00:00:00.000Z');
    expect(result.heatmap).toEqual([{ day: 2, hour: 10, users: 1 }]);
  });

  it('соблюдает обе границы периода и полночь UTC+4', async () => {
    const since = new Date('2030-01-01T20:00:00Z');
    const id = await user(since);

    await user(new Date(since.getTime() - 1));
    await user(new Date(now.getTime() + 1));
    await event(id, new Date(since.getTime() - 1));
    await event(id, since);
    await event(id, new Date('2030-01-07T19:59:59.999Z'));
    await event(id, new Date('2030-01-07T20:00:00Z'));
    await event(id, now);
    await event(id, new Date(now.getTime() + 1));
    const result = await service.overview(7, 'Europe/Samara');

    expect(result.since).toBe(since.toISOString());
    expect(result.until).toBe(now.toISOString());
    expect(result.registrations).toEqual([{ day: '2030-01-02', count: 1 }]);
    expect(result.features).toEqual([
      { feature: 'SEARCH', users: 1, actions: 4 },
    ]);
    expect(result.heatmap).toContainEqual({ day: 1, hour: 23, users: 1 });
    expect(result.heatmap).toContainEqual({ day: 2, hour: 0, users: 1 });
  });

  it('считает вернувшегося человека один раз и включает перерыв ровно 28 дней', async () => {
    const twice = await user(ago(80));
    const exact = await user(ago(40));
    const recent = await user(ago(40));
    const newcomer = await user();

    for (const age of [70, 40, 10]) {
      await event(twice, ago(age));
    }
    await event(exact, ago(28));
    await event(exact, now);
    await event(recent, new Date(ago(28).getTime() + 1));
    await event(recent, now);
    await event(newcomer, now);

    expect((await service.overview(90)).returning).toBe(2);
    expect((await service.overview(7)).returning).toBe(1);
  });

  it('считает неактивность на дату среза, включая ровно 28 дней', async () => {
    const exact = await user(ago(50));
    const recent = await user(ago(50));
    const older = await user(ago(50));
    const expired = await user(ago(100));

    await user(ago(50));
    await event(exact, ago(28));
    await event(recent, new Date(ago(28).getTime() + 1));
    await event(older, new Date(ago(28).getTime() - 1));
    await event(older, new Date(now.getTime() + 1));
    await event(expired, ago(91));
    const result = await service.overview(30);

    expect(result.inactive).toBe(2);
    expect(result.startedAt).toEqual(new Date(ago(28).getTime() - 1));
  });

  it('не использует просроченную историю даже до фоновой очистки', async () => {
    const id = await user(ago(100));
    const observed = await user(ago(60));

    await event(id, ago(91));
    await event(id, now);
    await event(observed, ago(60));
    const result = await service.overview(7);

    expect(result.startedAt).toEqual(ago(60));
    expect(result.returning).toBe(0);
    expect(result.inactive).toBe(1);
  });

  it('возвращает недостаточную историю вместо ложного нуля', async () => {
    const id = await user(ago(30));

    await event(id, ago(27));
    await event(id, now);
    const result = await service.overview(30);

    expect(result.returning).toBeNull();
    expect(result.inactive).toBeNull();
    expect(result.active).toBe(1);
  });

  it('удаляет только события старше 90 дней и сбрасывает кеш после очистки', async () => {
    const id = await user(ago(100));
    const expired = await event(id, new Date(ago(90).getTime() - 1));
    const boundary = await event(id, ago(90));
    const justInside = await event(id, new Date(ago(90).getTime() + 1));
    const fresh = await event(id, now);

    expect((await service.overview(90)).users).toBe(1);
    await user();
    service.onModuleInit();
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (
        !(await prisma.usageEvent.findUnique({ where: { id: expired } })) &&
        (await service.overview(90)).users === 2
      ) {
        break;
      }
      await delay(10);
    }
    expect(
      (await prisma.usageEvent.findMany()).map((row) => row.id).sort(),
    ).toEqual([boundary, justInside, fresh].sort());
    expect((await service.overview(90)).users).toBe(2);
    expect((await service.overview(90)).startedAt).toEqual(ago(90));
  });

  it('не удваивает повторное событие и обновляет закешированные показатели после записи', async () => {
    const [{ serverTime }] = await prisma.$queryRaw<
      Array<{ serverTime: Date }>
    >`SELECT now() AS "serverTime"`;

    jest.setSystemTime(new Date(serverTime.getTime() + 60_000));
    const id = await user(serverTime);
    const eventId = randomUUID();

    expect((await service.overview(7)).active).toBe(0);
    await service.record(id, { id: eventId, feature: 'SEARCH' });
    await service.record(id, { id: eventId, feature: 'SEARCH' });
    await service.record(id, { id: randomUUID(), feature: 'SEARCH' });
    const result = await service.overview(7);

    expect(await prisma.usageEvent.count()).toBe(2);
    expect(result.active).toBe(1);
    expect(result.features).toEqual([
      { feature: 'SEARCH', users: 1, actions: 2 },
    ]);
  });

  it('не меняет календарные расчёты при другом часовом поясе сессии PostgreSQL', async () => {
    const id = await user(new Date('2030-01-07T20:00:00Z'));

    await event(id, new Date('2030-01-07T20:00:00Z'));
    const other = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: testUrl,
        options: '-c timezone=Pacific/Honolulu',
      }),
    });

    try {
      const result = await new AdminAnalyticsService(
        other as PrismaService,
      ).overview(7, 'Europe/Samara');

      expect(result.registrations).toEqual([{ day: '2030-01-08', count: 1 }]);
      expect(result.heatmap).toEqual([{ day: 2, hour: 0, users: 1 }]);
    } finally {
      await other.$disconnect();
    }
  });
});
