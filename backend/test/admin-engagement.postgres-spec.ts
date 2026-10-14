import { jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { featuresDatabase } from './features-database';
import { AdminAnalyticsService } from '../src/admin/admin-analytics.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { UserMovieService } from '../src/user-movie/user-movie.service';

let db: Awaited<ReturnType<typeof featuresDatabase>>;
const now = new Date('2026-10-14T14:00:00Z');
const day = 86400000;
const ago = (days: number) => new Date(now.getTime() - days * day);
const user = async (createdAt: Date = ago(60)) =>
  db.prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      fullName: 'QA analytics',
      password: 'unused-test-hash',
      createdAt,
    },
  });
const event = async (userId: string, occurredAt: Date) =>
  db.prisma.usageEvent.create({
    data: { id: randomUUID(), userId, feature: 'MOVIE_VIEW', occurredAt },
  });
const analytics = () =>
  new AdminAnalyticsService(db.prisma as unknown as PrismaService);
beforeAll(async () => {
  db = await featuresDatabase();
});
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.prisma.$executeRawUnsafe('TRUNCATE TABLE users, movies CASCADE');
  jest
    .useFakeTimers({
      doNotFake: [
        'nextTick',
        'setImmediate',
        'clearImmediate',
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'performance',
        'hrtime',
      ],
    })
    .setSystemTime(now);
});
afterEach(() => jest.useRealTimers());
describe('Расширенная аналитика PostgreSQL18', () => {
  it('считает уникальных пользователей в rolling 24h/7d/30d, включая точные границы и исключая будущее', async () => {
    const users = await Promise.all(Array.from({ length: 6 }, () => user()));
    for (const [index, days] of [0, 1, 7, 30, 31, -1].entries())
      await event(users[index].id, ago(days));
    await event(users[0].id, ago(0));
    const result = await analytics().overview(7);
    expect(result.engagement.activity).toMatchObject({
      dau: 2,
      wau: 3,
      mau: 4,
      complete: { day: true, week: true, month: true },
    });
  });
  it('отделяет когорты UTC+4 и считает следующее календарное окно недели без дублей действий', async () => {
    const start = new Date('2026-09-27T20:00:00Z');
    const cohort = await Promise.all(
      [0, 1, 2, 6].map((days) => user(new Date(start.getTime() + days * day))),
    );
    const nextStart = new Date('2026-10-04T20:00:00Z');
    const nextEnd = new Date('2026-10-11T20:00:00Z');
    await event(cohort[0].id, nextStart);
    await event(cohort[0].id, new Date(nextStart.getTime() + 1000));
    await event(cohort[1].id, new Date(nextEnd.getTime() - 1));
    await event(cohort[2].id, nextEnd);
    const nextCohort = await user(nextStart);
    await event(nextCohort.id, now);
    const observer = await user(ago(80));
    await event(observer.id, ago(60));
    const result = await analytics().overview(90, 'Europe/Samara');
    expect(
      result.engagement.retention.find((row) => row.week === '2026-09-28'),
    ).toMatchObject({
      registered: 4,
      returned: 2,
      percent: 50,
      state: 'complete',
    });
    expect(
      result.engagement.retention.find((row) => row.week === '2026-10-05'),
    ).toMatchObject({
      registered: 1,
      returned: null,
      percent: null,
      state: 'collecting',
    });
    expect(result.engagement.retention).toHaveLength(8);
  });
  it('UTC одинаков в разных поясах процесса, выбранный IANA-пояс меняет именно календарные границы и группировку', async () => {
    const account = await user(new Date('2026-10-13T22:00:00Z'));
    await event(account.id, new Date('2026-10-13T22:00:00Z'));
    const utc = await analytics().overview(1);
    expect(utc.timezone).toBe('UTC');
    expect(utc.registrations).toEqual([]);
    const previous = process.env.TZ;
    try {
      process.env.TZ = 'America/New_York';
      const other = await analytics().overview(1);
      expect(other.since).toBe(utc.since);
      expect(other.registrations).toEqual(utc.registrations);
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
    const india = await analytics().overview(1, 'Asia/Kolkata');
    expect(india.since).toBe('2026-10-13T18:30:00.000Z');
    expect(india.registrations).toEqual([{ day: '2026-10-14', count: 1 }]);
    expect(india.heatmap).toEqual([{ day: 3, hour: 3, users: 1 }]);
    expect(india.active).toBe(1);
  });
  it('учитывает DST на границе календарной недели удержания', async () => {
    jest.setSystemTime(new Date('2024-04-15T12:00:00Z'));
    const account = await user(new Date('2024-03-25T01:00:00Z'));
    await event(account.id, new Date('2024-03-31T22:00:00Z'));
    const observer = await user(new Date('2024-02-01T00:00:00Z'));
    await event(observer.id, new Date('2024-03-01T00:00:00Z'));
    const result = await analytics().overview(90, 'Europe/Berlin');
    expect(
      result.engagement.retention.find((row) => row.week === '2024-03-25'),
    ).toMatchObject({
      registered: 1,
      returned: 1,
      percent: 100,
      state: 'complete',
    });
  });
  it('не выдаёт неполную историю за нулевое удержание', async () => {
    const account = await user(new Date('2026-09-28T00:00:00Z'));
    await event(account.id, new Date('2026-10-08T00:00:00Z'));
    const result = await analytics().overview(30);
    expect(
      result.engagement.retention.find((row) => row.week === '2026-09-28'),
    ).toMatchObject({
      registered: 1,
      returned: null,
      percent: null,
      state: 'insufficient',
    });
    expect(result.engagement.activity.complete.month).toBe(false);
  });
  it('строит воронку по сохранённым данным новых аккаунтов, учитывает импортированные оценки и не требует клиентских событий', async () => {
    const accounts = await Promise.all(
      [1, 1, 1, 1, 10].map((days) => user(ago(days))),
    );
    const movie = await db.prisma.movie.create({
      data: {
        title: 'QA фильм',
        titleNormalized: 'qa фильм',
        description: 'QA',
        genres: [],
      },
    });
    for (const index of [0, 1, 4])
      await db.prisma.userMovie.create({
        data: {
          userId: accounts[index].id,
          movieId: movie.id,
          addedAt: ago(0.5),
          personalRate: index === 1 ? 0 : 8,
        },
      });
    for (const index of [1, 3])
      await db.prisma.review.create({
        data: {
          userId: accounts[index].id,
          movieId: movie.id,
          text: 'Сохранённый отзыв',
          rate: 7,
          createdAt: ago(0.25),
        },
      });
    const service = analytics();
    const result = await service.overview(7);
    expect(result.engagement.funnel).toEqual({
      registered: 4,
      collected: 2,
      rated: 2,
    });
    expect(result.engagement.activity).toMatchObject({
      dau: 0,
      wau: 0,
      mau: 0,
      complete: { day: false, week: false, month: false },
    });
    await new UserMovieService(db.prisma as unknown as PrismaService).create(
      accounts[2].id,
      { movieId: movie.id, personalRate: 0 },
    );
    expect((await service.overview(7)).engagement.funnel).toEqual({
      registered: 4,
      collected: 3,
      rated: 2,
    });
  });
});
