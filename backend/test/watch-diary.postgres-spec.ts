import { randomUUID } from 'node:crypto';
import { featuresDatabase } from './features-database';
import { WatchDiaryService } from '../src/watch-diary/watch-diary.service';
import { UserMovieService } from '../src/user-movie/user-movie.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { CreateDiaryInput } from '../src/watch-diary/diary.types';
import { WatchStatus } from '../src/generated/prisma/enums';

let db: Awaited<ReturnType<typeof featuresDatabase>>;
let service: WatchDiaryService;
let collection: UserMovieService;
let ownerId: string, otherId: string, movieId: string, serialId: string;
const input = (): CreateDiaryInput => ({
  requestId: randomUUID(),
  movieId,
  viewedOn: '2020-05-10',
  scope: 'TITLE',
  isRewatch: false,
});
const query = { limit: 20, offset: 0 };

beforeAll(async () => {
  db = await featuresDatabase();
  collection = new UserMovieService(db.prisma as PrismaService);
  service = new WatchDiaryService(db.prisma as PrismaService, collection);
});
beforeEach(async () => {
  const users = await Promise.all(
    ['owner', 'other'].map((name) =>
      db.prisma.user.create({
        data: {
          email: `${name}-${randomUUID()}@diary.test`,
          fullName: name,
          password: 'test-only',
          timezone: 'Europe/Samara',
        },
      }),
    ),
  );
  [ownerId, otherId] = users.map((user) => user.id);
  const movies = await Promise.all(
    [false, true].map((isSerial) =>
      db.prisma.movie.create({
        data: {
          title: isSerial ? 'Магическая битва' : 'Интерстеллар',
          titleEn: isSerial ? 'JUJUTSU KAISEN' : 'Interstellar',
          description: 'Тест дневника',
          isSerial,
          seasonCount: isSerial ? 3 : null,
          episodeCount: isSerial ? 59 : null,
        },
      }),
    ),
  );
  [movieId, serialId] = movies.map((movie) => movie.id);
  await db.prisma.userMovie.createMany({
    data: movies.map((movie) => ({
      userId: ownerId,
      movieId: movie.id,
      personalRate: 9,
      watchStatus: WatchStatus.WATCHING,
      currentSeason: movie.isSerial ? 1 : null,
      currentEpisode: movie.isSerial ? 3 : null,
    })),
  });
});
afterAll(async () => {
  await db?.close();
});

describe('Личный дневник в настоящей БД', () => {
  it('сохраняет запись, личную заметку и оценку без изменения коллекции или публичного отзыва', async () => {
    await db.prisma.review.create({
      data: { userId: ownerId, movieId, rate: 6, text: 'Публичный отзыв' },
    });
    const result = await service.create(ownerId, {
      ...input(),
      rating: 8,
      note: 'Снова посмотрел <3',
      isRewatch: true,
    });
    expect(result.status).toBe('saved');
    const page = await service.list(ownerId, query);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      viewedOn: '2020-05-10',
      rating: 8,
      note: 'Снова посмотрел <3',
      isRewatch: true,
      movie: { id: movieId },
    });
    expect(
      await db.prisma.userMovie.findUnique({
        where: { userId_movieId: { userId: ownerId, movieId } },
      }),
    ).toMatchObject({ personalRate: 9, watchStatus: WatchStatus.WATCHING });
    expect(
      await db.prisma.review.findFirst({ where: { userId: ownerId, movieId } }),
    ).toMatchObject({ rate: 6, text: 'Публичный отзыв' });
  });

  it('разделяет предупреждение о совпадении и намеренный второй просмотр в тот же день', async () => {
    await service.create(ownerId, input());
    const second = { ...input(), isRewatch: true };
    const warning = await service.create(ownerId, second);
    expect(warning.status).toBe('duplicate');
    expect((await service.list(ownerId, query)).total).toBe(1);
    const result = await service.create(ownerId, {
      ...second,
      allowDuplicate: true,
    });
    expect(result.status).toBe('saved');
    expect((await service.list(ownerId, query)).stats).toEqual({
      entries: 2,
      titles: 1,
      rewatches: 1,
    });
  });

  it('повторные параллельные запросы создают ровно одну запись, изменённый запрос с тем же ключом отклоняется', async () => {
    const request = input();
    const results = await Promise.all(
      Array.from({ length: 8 }, () => service.create(ownerId, request)),
    );
    expect(results.every((result) => result.status === 'saved')).toBe(true);
    expect(new Set(results.map((result) => result.entry.id)).size).toBe(1);
    expect((await service.list(ownerId, query)).total).toBe(1);
    await expect(
      service.create(ownerId, { ...request, note: 'Изменённый запрос' }),
    ).rejects.toThrow();
    expect((await service.list(ownerId, query)).items[0].note).toBe('');
  });

  it('сезон не завершает сериал, запрет синхронизации сезона не оставляет частичной записи', async () => {
    const request = {
      ...input(),
      movieId: serialId,
      scope: 'SEASON' as const,
      season: 1,
    };
    await service.create(ownerId, request);
    expect(
      await db.prisma.userMovie.findUnique({
        where: { userId_movieId: { userId: ownerId, movieId: serialId } },
      }),
    ).toMatchObject({
      watchStatus: WatchStatus.WATCHING,
      currentSeason: 1,
      currentEpisode: 3,
    });
    await expect(
      service.create(ownerId, {
        ...request,
        requestId: randomUUID(),
        viewedOn: '2020-05-11',
        syncStatus: true,
      }),
    ).rejects.toThrow();
    expect((await service.list(ownerId, query)).total).toBe(1);
  });

  it('обновляет только явно выбранные личные поля и не меняет рейтинг публичного отзыва', async () => {
    await db.prisma.review.create({
      data: {
        userId: ownerId,
        movieId: serialId,
        rate: 6,
        text: 'Публичный отзыв',
      },
    });
    await service.create(ownerId, {
      ...input(),
      movieId: serialId,
      rating: 10,
      syncRating: true,
      syncStatus: true,
    });
    expect(
      await db.prisma.userMovie.findUnique({
        where: { userId_movieId: { userId: ownerId, movieId: serialId } },
      }),
    ).toMatchObject({
      personalRate: 10,
      watchStatus: WatchStatus.COMPLETED,
      currentEpisode: 59,
      currentSeason: 3,
    });
    const member = await db.prisma.userMovie.findUniqueOrThrow({
      where: { userId_movieId: { userId: ownerId, movieId: serialId } },
    });
    expect(member.completedAt!.getTime()).toBeGreaterThanOrEqual(
      member.startedAt!.getTime(),
    );
    expect(
      await db.prisma.review.findFirst({
        where: { userId: ownerId, movieId: serialId },
      }),
    ).toMatchObject({ rate: 6 });
  });

  it('скрывает чужие записи и не разрешает изменять или удалять их по известному идентификатору', async () => {
    const result = await service.create(ownerId, {
      ...input(),
      note: 'Личная заметка',
    });
    expect((await service.list(otherId, query)).items).toEqual([]);
    await expect(
      service.update(otherId, result.entry.id, { ...input(), revision: 1 }),
    ).rejects.toThrow();
    await expect(service.remove(otherId, result.entry.id, 1)).rejects.toThrow();
    expect((await service.list(ownerId, query)).items[0].note).toBe(
      'Личная заметка',
    );
  });

  it('сохраняет историю после удаления из коллекции и позволяет редактировать заметку без повторного добавления', async () => {
    const result = await service.create(ownerId, input());
    await collection.delete(ownerId, movieId);
    const page = await service.list(ownerId, query);
    expect(page.items[0]).toMatchObject({
      inCollection: false,
      movie: { id: movieId },
    });
    await service.update(ownerId, result.entry.id, {
      viewedOn: '2020-05-10',
      scope: 'TITLE',
      isRewatch: false,
      note: 'История сохранена',
      revision: 1,
    });
    expect((await service.list(ownerId, query)).items[0].note).toBe(
      'История сохранена',
    );
    expect(
      await db.prisma.userMovie.count({ where: { userId: ownerId, movieId } }),
    ).toBe(0);
    await expect(
      db.prisma.movie.delete({ where: { id: movieId } }),
    ).rejects.toThrow();
  });

  it('защищает изменения от устаревшей вкладки и не восстанавливает удалённую запись повтором запроса', async () => {
    const request = input(),
      result = await service.create(ownerId, request);
    const changes = {
      viewedOn: request.viewedOn,
      scope: request.scope,
      isRewatch: false,
      note: 'Новая заметка',
      revision: 1,
    };
    await service.update(ownerId, result.entry.id, changes);
    await expect(
      service.update(ownerId, result.entry.id, {
        ...changes,
        note: 'Устаревшая',
      }),
    ).rejects.toThrow();
    await expect(service.remove(ownerId, result.entry.id, 1)).rejects.toThrow();
    await service.remove(ownerId, result.entry.id, 2);
    await expect(service.create(ownerId, request)).rejects.toThrow();
    expect((await service.list(ownerId, query)).total).toBe(0);
    expect(
      await db.prisma.userMovie.findUnique({
        where: { userId_movieId: { userId: ownerId, movieId } },
      }),
    ).toMatchObject({ personalRate: 9, watchStatus: WatchStatus.WATCHING });
  });

  it('ищет по русскому и английскому названию, фильтрует даты и считает итоги до пагинации', async () => {
    await service.create(ownerId, input());
    await service.create(ownerId, {
      ...input(),
      viewedOn: '2020-06-11',
      isRewatch: true,
    });
    const page = await service.list(ownerId, {
      ...query,
      limit: 1,
      q: 'Interstellar',
      from: '2020-01-01',
      to: '2020-12-31',
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].viewedOn).toBe('2020-06-11');
    expect(page.stats).toEqual({ entries: 2, titles: 1, rewatches: 1 });
    expect(
      (
        await service.list(ownerId, {
          ...query,
          q: 'Интерстеллар',
          isRewatch: true,
        })
      ).total,
    ).toBe(1);
    for (const q of ['%', '_', '\\', "' OR 1=1 --"]) {
      const filtered = await service.list(ownerId, { ...query, q });
      expect(filtered.total).toBe(filtered.items.length);
      expect(filtered.stats.entries).toBe(filtered.items.length);
    }
  });

  it('ошибка обновления коллекции откатывает запись и все личные изменения', async () => {
    await db.pool.query(
      `CREATE FUNCTION reject_diary_sync() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test diary rollback'; END $$`,
    );
    await db.pool.query(
      'CREATE TRIGGER reject_diary_sync BEFORE UPDATE ON user_movies FOR EACH ROW EXECUTE FUNCTION reject_diary_sync()',
    );
    try {
      await expect(
        service.create(ownerId, { ...input(), rating: 8, syncRating: true }),
      ).rejects.toThrow();
      expect((await service.list(ownerId, query)).total).toBe(0);
      expect(
        await db.prisma.userMovie.findUnique({
          where: { userId_movieId: { userId: ownerId, movieId } },
        }),
      ).toMatchObject({ personalRate: 9 });
    } finally {
      await db.pool.query('DROP TRIGGER reject_diary_sync ON user_movies');
      await db.pool.query('DROP FUNCTION reject_diary_sync()');
    }
  });
});
