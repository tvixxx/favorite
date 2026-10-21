import sharp from 'sharp';
import { performanceFixture } from './performance-fixture';
import { FeedbackService } from '../src/feedback/feedback.service';
import { MediaService } from '../src/media/media.service';

let fixture: Awaited<ReturnType<typeof performanceFixture>>;
let base: string;
let png: Buffer;
const origin = 'http://127.0.0.1:8096';
const headers = (index: number) => ({
  Authorization: `Bearer ${fixture.tokens[index]}`,
  Origin: origin,
});
async function upload(
  index = 1,
  bytes: Buffer = png,
  purpose = 'FEEDBACK_SCREENSHOT',
) {
  const body = new FormData();
  body.append('purpose', purpose);
  body.append(
    'file',
    new Blob([new Uint8Array(bytes)], { type: 'image/png' }),
    'screenshot.png',
  );
  return fetch(base + '/uploads/images', {
    method: 'POST',
    headers: headers(index),
    body,
    signal: AbortSignal.timeout(15000),
  });
}
async function asset(index = 1, purpose = 'FEEDBACK_SCREENSHOT') {
  const result = await upload(index, png, purpose);
  expect(result.status).toBe(201);
  return result.json() as Promise<{
    id: string;
    url: string;
    thumbnailUrl: string;
  }>;
}
beforeAll(async () => {
  fixture = await performanceFixture(false, { feedbackEnabled: true });
  await fixture.app.listen(0, '127.0.0.1');
  base = await fixture.app.getUrl();
  png = await sharp({
    create: { width: 800, height: 600, channels: 3, background: '#f33' },
  })
    .png()
    .toBuffer();
});
afterAll(async () => {
  await fixture?.close();
});
describe('Скриншоты обращений: реальный HTTP, worker и PostgreSQL18', () => {
  it('перекодирует в WebP, привязывает атомарно и выдаёт только автору/администратору без публичного кэша', async () => {
    const image = await asset();
    expect(image.url).toBe(`/uploads/images/${image.id}/full.webp`);
    const created = await fetch(base + '/feedback', {
      method: 'POST',
      headers: { ...headers(1), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'BUG',
        message: 'Подробное описание ошибки',
        screenshotAssetId: image.id,
      }),
    });
    expect(created.status).toBe(201);
    const feedback = await fixture.db.prisma.feedback.findUniqueOrThrow({
      where: { id: ((await created.json()) as { id: string }).id },
    });
    expect(feedback.userId).toBe(fixture.users[1]);
    expect(feedback.screenshotAssetId).toBe(image.id);
    for (const index of [0, 1]) {
      const result = await fetch(base + image.url, { headers: headers(index) });
      expect(result.status).toBe(200);
      expect(result.headers.get('cache-control')).toBe('private, no-store');
      expect(result.headers.get('x-content-type-options')).toBe('nosniff');
      const metadata = await sharp(
        Buffer.from(await result.arrayBuffer()),
      ).metadata();
      expect(metadata.format).toBe('webp');
      expect(metadata.exif).toBeUndefined();
    }
    expect(
      (await fetch(base + image.url, { headers: headers(2) })).status,
    ).toBe(404);
    expect((await fetch(base + image.url)).status).toBe(401);
    expect(
      (await fetch(`${base}/media/images/${image.id}/full.webp`)).status,
    ).toBe(404);
    expect(
      (
        await fetch(base + image.url.replace('full.webp', 'unknown'), {
          headers: headers(1),
        })
      ).status,
    ).toBe(404);
    await fixture.db.prisma.mediaAsset.update({
      where: { id: image.id },
      data: { expiresAt: new Date(0) },
    });
    await fixture.app.get(MediaService).cleanup();
    expect(
      await fixture.db.prisma.mediaAsset.findUnique({
        where: { id: image.id },
      }),
    ).not.toBeNull();
    await expect(
      fixture.app.get(MediaService).discard(image.id, fixture.users[1]),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('отклоняет поддельный PNG/SVG и превышение 5 МБ независимо от расширения и MIME', async () => {
    for (const bytes of [
      Buffer.from('<svg onload="alert(1)"></svg>'),
      Buffer.from('not an image'),
      Buffer.alloc(5 * 1024 * 1024 + 1),
    ]) {
      const result = await upload(3, bytes);
      expect(result.status).toBe(400);
    }
  });
  it('не привязывает чужой файл, иной purpose, истёкшую загрузку и не создаёт частичное обращение', async () => {
    const feedback = fixture.app.get(FeedbackService);
    const image = await asset(4);
    const avatar = await asset(4, 'USER_AVATAR');
    const count = await fixture.db.prisma.feedback.count();
    const data = { type: 'BUG' as const, message: 'Тест безопасного вложения' };
    await expect(
      feedback.create(fixture.users[5], {
        ...data,
        screenshotAssetId: image.id,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      feedback.create(fixture.users[4], {
        ...data,
        screenshotAssetId: avatar.id,
      }),
    ).rejects.toMatchObject({ status: 400 });
    await fixture.db.prisma.mediaAsset.update({
      where: { id: image.id },
      data: { expiresAt: new Date(0) },
    });
    await expect(
      feedback.create(fixture.users[4], {
        ...data,
        screenshotAssetId: image.id,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await fixture.db.prisma.feedback.count()).toBe(count);
    expect(
      (
        await fixture.db.prisma.mediaAsset.findUniqueOrThrow({
          where: { id: avatar.id },
        })
      ).claimedAt,
    ).toBeNull();
  });
  it('одна загрузка не может попасть в два одновременно создаваемых обращения', async () => {
    const image = await asset(6);
    const service = fixture.app.get(FeedbackService);
    const count = await fixture.db.prisma.feedback.count();
    const result = await Promise.allSettled(
      [1, 2].map(() =>
        service.create(fixture.users[6], {
          type: 'BUG',
          message: 'Гонка отправки обращения',
          screenshotAssetId: image.id,
        }),
      ),
    );
    expect(result.filter((item) => item.status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(await fixture.db.prisma.feedback.count()).toBe(count + 1);
  });
});
