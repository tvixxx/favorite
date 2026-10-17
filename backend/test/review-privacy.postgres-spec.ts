import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { featuresDatabase } from './features-database';
import { ReviewController } from '../src/review/review.controller';
import { ReviewService } from '../src/review/review.service';
import type { PrismaService } from '../src/prisma/prisma.service';

let db: Awaited<ReturnType<typeof featuresDatabase>>;
let app: INestApplication;
let service: ReviewService;
let userId: string;
let otherUserId: string;
let movieId: string;
let base: string;
const text = '<img src=x onerror=alert(1)> Обычный текст отзыва';

beforeAll(async () => {
  db = await featuresDatabase();
  const user = await db.prisma.user.create({
    data: {
      email: 'review-author@example.test',
      fullName: 'Автор отзыва',
      password: 'qa-unused-password-hash',
    },
  });
  userId = user.id;
  otherUserId = (
    await db.prisma.user.create({
      data: {
        email: 'other-reader@example.test',
        fullName: 'Другой читатель',
        password: 'qa-unused-password-hash',
      },
    })
  ).id;
  movieId = (
    await db.prisma.movie.create({
      data: {
        title: 'Фильм для проверки приватности',
        titleNormalized: 'фильм для проверки приватности',
        description: 'QA',
        genres: [],
      },
    })
  ).id;
  service = new ReviewService(db.prisma as PrismaService);
  const module = await Test.createTestingModule({
    controllers: [ReviewController],
    providers: [{ provide: ReviewService, useValue: service }],
  }).compile();
  app = module.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
});

beforeEach(async () => {
  await db.prisma.review.deleteMany();
});

afterAll(async () => {
  await app?.close();
  await db?.close();
});

describe('Приватность автора отзыва на PostgreSQL', () => {
  it('сохраняет спойлер, не сбрасывает его старым запросом и позволяет снять отметку', async () => {
    const created = await service.create(
      { movieId, text, rate: 7, isSpoiler: true },
      userId,
    );
    expect(await service.findById(created.id)).toMatchObject({
      isSpoiler: true,
      text,
    });
    await service.update(created.id, { text, rate: 8 }, userId);
    expect(await service.findById(created.id)).toHaveProperty(
      'isSpoiler',
      true,
    );
    await service.update(
      created.id,
      { text, rate: 8, isSpoiler: false },
      userId,
    );
    expect(await service.findById(created.id)).toHaveProperty(
      'isSpoiler',
      false,
    );
  });

  it('оставляет отзыв без нового флага видимым', async () => {
    const created = await service.create({ movieId, text, rate: 7 }, userId);
    expect(await service.findById(created.id)).toHaveProperty(
      'isSpoiler',
      false,
    );
  });

  it('публичный ответ сохраняет имя и текст без email, пароля и HTML-ответа', async () => {
    const review = await service.create({ movieId, text, rate: 7 }, userId);
    const response = await fetch(`${base}/reviews/${review.id}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    const result: unknown = await response.json();
    expect(result).toMatchObject({
      text,
      user: { id: userId, fullName: 'Автор отзыва' },
    });
    expect(result).not.toHaveProperty('user.email');
    expect(result).not.toHaveProperty('user.password');
  });

  it('создание и изменение также возвращают только публичные сведения автора', async () => {
    const created = await service.create({ movieId, text, rate: 7 }, userId);
    const updated = await service.update(
      created.id,
      { text: 'Изменённый отзыв', rate: 8 },
      userId,
    );

    for (const result of [created, updated]) {
      expect(result).toHaveProperty('user.fullName', 'Автор отзыва');
      expect(result).not.toHaveProperty('user.email');
      expect(result).not.toHaveProperty('user.password');
    }
    await expect(
      service.update(
        created.id,
        { text: 'Чужая правка', rate: 1 },
        otherUserId,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(await service.findById(created.id)).toMatchObject({
      text: 'Изменённый отзыв',
      rate: 8,
    });
  });

  it('скрытый отзыв недоступен публично и остаётся доступным автору', async () => {
    const review = await service.create({ movieId, text, rate: 7 }, userId);
    await db.prisma.review.update({
      where: { id: review.id },
      data: { hiddenAt: new Date(), moderationReason: 'QA причина' },
    });

    expect((await fetch(`${base}/reviews/${review.id}`)).status).toBe(404);
    expect(await service.findMine(movieId, userId)).toMatchObject({
      id: review.id,
      moderationReason: 'QA причина',
    });
    expect(await service.findMine(movieId, otherUserId)).toBeNull();
  });
});
