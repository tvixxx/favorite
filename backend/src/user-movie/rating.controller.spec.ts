import { Test } from '@nestjs/testing';
import {
  ValidationPipe,
  type INestApplication,
  type ExecutionContext,
} from '@nestjs/common';
import type { Server } from 'http';
import request from 'supertest';
import { UserMovieController } from './user-movie.controller';
import { UserMovieService } from './user-movie.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtGuard } from '../common/guards/auth.guard';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Атомарное сохранение оценки и отзыва через API', () => {
  let app: INestApplication<Server>;
  let personalRate: number;
  let review: { id: string; text: string; rate: number };
  let failReview: boolean;
  beforeEach(async () => {
    personalRate = 4;
    review = { id: 'review-id', text: 'Предыдущий отзыв', rate: 4 };
    failReview = false;
    const tx = {
      userMovie: {
        findUnique: jest.fn(() =>
          Promise.resolve({ id: 'link-id', personalRate }),
        ),
        update: jest.fn(({ data }: { data: { personalRate: number } }) => {
          personalRate = data.personalRate;
          return Promise.resolve({
            id: 'link-id',
            personalRate,
            movie: { id: 'movie-id' },
          });
        }),
      },
      review: {
        findFirst: jest.fn(() => Promise.resolve(review)),
        update: jest.fn(
          ({ data }: { data: { rate: number; text: string } }) => {
            if (failReview) throw new Error('Не удалось сохранить отзыв');
            Object.assign(review, data);
            return Promise.resolve(review);
          },
        ),
        aggregate: jest.fn(() =>
          Promise.resolve({ _avg: { rate: review.rate } }),
        ),
      },
    };
    const prisma = {
      ...tx,
      $transaction: async <T>(
        work: (client: typeof tx) => Promise<T>,
      ): Promise<T> => {
        const before = structuredClone({ personalRate, review });
        try {
          return await work(tx);
        } catch (error) {
          personalRate = before.personalRate;
          review = before.review;
          throw error;
        }
      },
    };
    const module = await Test.createTestingModule({
      controllers: [UserMovieController],
      providers: [
        UserMovieService,
        { provide: PrismaService, useValue: prisma },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest<{ user: { id: string } }>().user = {
            id: 'user-id',
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });

  it('сохраняет обе оценки и текст одним запросом', async () => {
    const response = await request(app.getHttpServer())
      .patch('/users/user-id/movies/movie-id/rating')
      .send({ personalRate: 8, reviewText: 'Новый содержательный отзыв' })
      .expect(200);
    expect(personalRate).toBe(8);
    expect(review).toMatchObject({
      rate: 8,
      text: 'Новый содержательный отзыв',
    });
    expect(response.body).toMatchObject({ movie: { averageRating: 8 } });
  });

  it('откатывает личную оценку при ошибке сохранения отзыва', async () => {
    failReview = true;
    await request(app.getHttpServer())
      .patch('/users/user-id/movies/movie-id/rating')
      .send({ personalRate: 8, reviewText: 'Новый содержательный отзыв' })
      .expect(500);
    expect(personalRate).toBe(4);
    expect(review.rate).toBe(4);
  });

  it('не позволяет менять оценку другого пользователя', async () => {
    await request(app.getHttpServer())
      .patch('/users/other-user/movies/movie-id/rating')
      .send({ personalRate: 8 })
      .expect(403);
    expect(personalRate).toBe(4);
  });

  it('отклоняет слишком короткий непустой отзыв до записи', async () => {
    await request(app.getHttpServer())
      .patch('/users/user-id/movies/movie-id/rating')
      .send({ personalRate: 8, reviewText: 'мало' })
      .expect(400);
    expect(personalRate).toBe(4);
  });
});
