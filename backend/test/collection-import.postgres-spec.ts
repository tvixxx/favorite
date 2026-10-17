import { jest } from '@jest/globals';
import { performanceFixture } from './performance-fixture';
import { CollectionImportService } from '../src/user-movie/collection-import.service';
import { UserMovieService } from '../src/user-movie/user-movie.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { dataRevision } from '../src/common/utils/data-revision';

let fixture: Awaited<ReturnType<typeof performanceFixture>>;
let base: string;
let imports: CollectionImportService;
const entry = (index: number) => ({
  title: `QA Тайтл ${String(index).padStart(4, '0')}`,
  isSerial: index % 2 === 1,
  year: 2020,
  watchStatus: 'COMPLETED',
  isFavorite: true,
  personalRate: 8,
});
const dto = (indexes: number[]) => ({
  format: 'json' as const,
  content: JSON.stringify({ version: 1, movies: indexes.map(entry) }),
});
const user = (index = 0) => ({ id: fixture.users[index], authVersion: 0 });
const post = (path: string, data: unknown, index = 0) =>
  fetch(`${base}/users/${fixture.users[index]}/movies/import${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${fixture.tokens[index]}`,
      Origin: 'http://127.0.0.1:8096',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(30000),
  });
beforeAll(async () => {
  fixture = await performanceFixture();
  await fixture.app.listen(0, '127.0.0.1');
  base = await fixture.app.getUrl();
  imports = fixture.app.get(CollectionImportService);
});
afterAll(async () => {
  await fixture?.close();
});
describe('Импорт коллекции: реальные HTTP и PostgreSQL18', () => {
  it('предварительная проверка показывает ошибки, дубли и существующие записи, ничего не сохраняет', async () => {
    const movies = [
      entry(200),
      entry(200),
      entry(10),
      { ...entry(201), isSerial: false },
      { ...entry(202), year: 1990 },
      { ...entry(203), title: "'); DROP TABLE users; --" },
    ];
    const count = await fixture.db.prisma.userMovie.count();
    const response = await post('/check', {
      format: 'json',
      content: JSON.stringify({ version: 1, movies }),
    });
    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      proof: null;
      valid: boolean;
      ready: number;
      existing: number;
      errors: number;
      rows: { issue: string }[];
    };
    expect(result).toMatchObject({
      valid: false,
      proof: null,
      ready: 1,
      existing: 1,
      errors: 4,
    });
    expect(result.rows[1].issue).toContain('Дубликат');
    expect(result.rows[5].issue).toContain('не найден');
    expect(await fixture.db.prisma.userMovie.count()).toBe(count);
    expect(await fixture.db.prisma.user.count()).toBe(100);
  });
  it('сохраняет партию и даты статусов, пропускает существующую запись, повтор не меняет данные', async () => {
    const file = dto([210, 211, 10]);
    const checked = await imports.check(user(), file);
    expect(checked).toMatchObject({ valid: true, ready: 2, existing: 1 });
    const previous = await fixture.db.prisma.userMovie.findUniqueOrThrow({
      where: {
        userId_movieId: { userId: user().id, movieId: fixture.movies[10] },
      },
    });
    const revision = dataRevision(fixture.db.prisma);
    const response = await post('', { ...file, proof: checked.proof });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ added: 2, skipped: 1 });
    expect(dataRevision(fixture.db.prisma)).toBe(revision + 1);
    const serial = await fixture.db.prisma.userMovie.findUniqueOrThrow({
      where: {
        userId_movieId: { userId: user().id, movieId: fixture.movies[211] },
      },
    });
    expect(serial).toMatchObject({
      watchStatus: 'COMPLETED',
      currentSeason: 2,
      currentEpisode: 12,
      personalRate: 8,
      isFavorite: true,
    });
    expect(serial.completedAt).not.toBeNull();
    expect(
      await fixture.db.prisma.userMovie.findUniqueOrThrow({
        where: { id: previous.id },
      }),
    ).toEqual(previous);
    expect(
      await imports.commit(user(), { ...file, proof: checked.proof! }),
    ).toEqual({ added: 0, skipped: 3 });
  });
  it('не принимает запись без проверки, изменённый файл и подтверждение другого пользователя', async () => {
    const file = dto([220]);
    const checked = await imports.check(user(), file);
    expect((await post('', file)).status).toBe(400);
    await expect(
      imports.commit(user(), { ...dto([221]), proof: checked.proof! }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      imports.commit(user(1), { ...file, proof: checked.proof! }),
    ).rejects.toMatchObject({ status: 409 });
    const auth = await fetch(`${base}/users/${user().id}/movies/page`, {
      headers: { Authorization: `Bearer ${checked.proof}` },
    });
    expect(auth.status).toBe(401);
    const cross = await fetch(
      `${base}/users/${fixture.users[1]}/movies/import/check`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${fixture.tokens[0]}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(file),
      },
    );
    expect(cross.status).toBe(403);
  });
  it('требует повторной проверки после изменения каталога и истечения подтверждения', async () => {
    const file = dto([225]);
    const checked = await imports.check(user(), file);
    await fixture.db.prisma.movie.update({
      where: { id: fixture.movies[225] },
      data: { publishDate: new Date('2021-01-01') },
    });
    await expect(
      imports.commit(user(), { ...file, proof: checked.proof! }),
    ).rejects.toThrow();
    expect(
      await fixture.db.prisma.userMovie.count({
        where: { userId: user().id, movieId: fixture.movies[225] },
      }),
    ).toBe(0);
    const { JwtService } = await import('@nestjs/jwt');
    const expired = fixture.app
      .get(JwtService)
      .sign(
        { type: 'collection-import', userId: user().id, authVersion: 0 },
        { expiresIn: -1 },
      );
    await expect(
      imports.commit(user(), { ...file, proof: expired }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('два одновременных импорта создают каждую связь ровно один раз', async () => {
    const file = dto([230, 231]);
    const checked = await imports.check(user(), file);
    const results = await Promise.all(
      [1, 2].map(() =>
        imports.commit(user(), { ...file, proof: checked.proof! }),
      ),
    );
    expect(results.map((result) => result.added).sort()).toEqual([0, 2]);
    expect(
      await fixture.db.prisma.userMovie.count({
        where: {
          userId: user().id,
          movieId: { in: [fixture.movies[230], fixture.movies[231]] },
        },
      }),
    ).toBe(2);
  });
  it('ошибка внутри партии откатывает уже выполненную запись и не инвалидирует кэш', async () => {
    const file = dto([240, 241]);
    const checked = await imports.check(user(), file);
    const service = fixture.app.get<UserMovieService>(UserMovieService);
    const actual = new UserMovieService(
      fixture.app.get<PrismaService>(PrismaService),
    );
    let calls = 0;
    const spy = jest
      .spyOn(service, 'create')
      .mockImplementation(async (...args) => {
        if (++calls === 2) throw new Error('QA failure inside transaction');
        return await actual.create(...args);
      });
    const revision = dataRevision(fixture.db.prisma);
    try {
      await expect(
        imports.commit(user(), { ...file, proof: checked.proof! }),
      ).rejects.toThrow('QA failure');
    } finally {
      spy.mockRestore();
    }
    expect(
      await fixture.db.prisma.userMovie.count({
        where: {
          userId: user().id,
          movieId: { in: [fixture.movies[240], fixture.movies[241]] },
        },
      }),
    ).toBe(0);
    expect(dataRevision(fixture.db.prisma)).toBe(revision);
  });
  it('независимо от клиента отклоняет лишние поля и неправильный формат', async () => {
    expect(
      (await post('/check', { ...dto([250]), userId: fixture.users[1] }))
        .status,
    ).toBe(400);
    expect(
      (
        await post('/check', {
          format: 'xml',
          content: '<script>alert(1)</script>',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post('/check', {
          format: 'json',
          content: JSON.stringify({
            version: 1,
            movies: [{ ...entry(250), role: 'ADMIN' }],
          }),
        })
      ).status,
    ).toBe(400);
  });
  it('принимает партию максимального разрешённого размера без частичного сохранения', async () => {
    const file = dto(Array.from({ length: 200 }, (_, index) => index + 500));
    const checked = await imports.check(user(10), file);
    expect(checked).toMatchObject({ valid: true, ready: 200 });
    const started = Date.now();
    expect(
      await imports.commit(user(10), { ...file, proof: checked.proof! }),
    ).toEqual({ added: 200, skipped: 0 });
    expect(Date.now() - started).toBeLessThan(20000);
    expect(
      await fixture.db.prisma.userMovie.count({
        where: { userId: user(10).id },
      }),
    ).toBe(400);
  });
  it('проверяет и сохраняет CSV тем же серверным контрактом', async () => {
    const file = {
      format: 'csv' as const,
      content:
        'title,isSerial,year,watchStatus,isFavorite,personalRate\r\nQA Тайтл 0800,false,2020,COMPLETED,true,9\r\n',
    };
    const checked = await imports.check(user(11), file);
    expect(checked).toMatchObject({ valid: true, ready: 1 });
    expect(
      await imports.commit(user(11), { ...file, proof: checked.proof! }),
    ).toEqual({ added: 1, skipped: 0 });
    expect(
      await fixture.db.prisma.userMovie.findUniqueOrThrow({
        where: {
          userId_movieId: { userId: user(11).id, movieId: fixture.movies[800] },
        },
      }),
    ).toMatchObject({
      isFavorite: true,
      personalRate: 9,
      watchStatus: 'COMPLETED',
    });
  });
  it('отзывает подтверждение проверки при смене authVersion', async () => {
    const file = dto([810]);
    const checked = await imports.check(user(12), file);
    await fixture.db.prisma.user.update({
      where: { id: user(12).id },
      data: { authVersion: { increment: 1 } },
    });
    await expect(
      imports.commit(user(12), { ...file, proof: checked.proof! }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      await fixture.db.prisma.userMovie.count({
        where: { userId: user(12).id, movieId: fixture.movies[810] },
      }),
    ).toBe(0);
  });
});
