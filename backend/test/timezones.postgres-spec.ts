import { performanceFixture } from './performance-fixture';
let fixture: Awaited<ReturnType<typeof performanceFixture>>;
let base: string;
const headers = (index = 0) => ({
  Authorization: `Bearer ${fixture.tokens[index]}`,
  Origin: 'http://127.0.0.1:8096',
  'Content-Type': 'application/json',
});
const patch = (data: unknown, target = 0, actor = 0) =>
  fetch(`${base}/users/${fixture.users[target]}`, {
    method: 'PATCH',
    headers: headers(actor),
    body: JSON.stringify(data),
  });
beforeAll(async () => {
  fixture = await performanceFixture();
  await fixture.app.listen(0, '127.0.0.1');
  base = await fixture.app.getUrl();
});
afterAll(async () => {
  await fixture?.close();
});
describe('Часовой пояс профиля: HTTP и PostgreSQL18', () => {
  it('по умолчанию UTC, сохраняет выбор, возвращает его при проверке сессии и применяет на сервере', async () => {
    const before = await fixture.db.prisma.user.findUniqueOrThrow({
      where: { id: fixture.users[0] },
    });
    expect(before.timezone).toBe('UTC');
    const zones = await fetch(base + '/timezones');
    expect(zones.status).toBe(200);
    expect(await zones.json()).toEqual(
      expect.arrayContaining(['UTC', 'Europe/Berlin']),
    );
    const response = await patch({ timezone: 'Europe/Berlin' });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ timezone: 'Europe/Berlin' });
    const me = await fetch(base + '/auth/@me', { headers: headers() });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ timezone: 'Europe/Berlin' });
    const overview = await fetch(
      base + '/admin/overview?days=7&timezone=America/New_York',
      { headers: headers() },
    );
    expect(overview.status).toBe(200);
    expect(await overview.json()).toMatchObject({ timezone: 'Europe/Berlin' });
    const after = await fixture.db.prisma.user.findUniqueOrThrow({
      where: { id: fixture.users[0] },
    });
    expect(after.createdAt).toEqual(before.createdAt);
    expect(after.authVersion).toBe(before.authVersion);
  });
  it('отклоняет произвольные значения и подмену чужой настройки', async () => {
    for (const timezone of [
      null,
      [],
      "UTC'); DROP TABLE users; --",
      'missing-zone',
    ])
      expect((await patch({ timezone })).status).toBe(400);
    expect((await patch({ timezone: 'UTC' }, 0, 1)).status).toBe(403);
    expect(
      (
        await fixture.db.prisma.user.findUniqueOrThrow({
          where: { id: fixture.users[0] },
        })
      ).timezone,
    ).toBe('Europe/Berlin');
    expect(await fixture.db.prisma.user.count()).toBe(100);
  });
});
