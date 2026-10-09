import { ReviewService } from './review.service';
import { PrismaService } from '../prisma/prisma.service';
import { transactionRunner } from '../common/testing/transaction-lock';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Один отзыв пользователя на фильм', () => {
  it('сохраняет один из двух одновременных запросов, затем разрешает редактирование', async () => {
    const rows: Array<{
      id: string;
      userId: string;
      movieId: string;
      text: string;
      rate: number;
    }> = [];
    const review = {
      findFirst: jest.fn(
        ({ where }: { where: { userId: string; movieId: string } }) =>
          Promise.resolve(
            rows.find(
              (row) =>
                row.userId === where.userId && row.movieId === where.movieId,
            ) ?? null,
          ),
      ),
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(rows.find((row) => row.id === where.id)),
      ),
      create: jest.fn(
        ({
          data,
        }: {
          data: {
            text: string;
            rate: number;
            user: { connect: { id: string } };
            movie: { connect: { id: string } };
          };
        }) => {
          const row = {
            id: 'review-id',
            userId: data.user.connect.id,
            movieId: data.movie.connect.id,
            text: data.text,
            rate: data.rate,
          };

          rows.push(row);

          return Promise.resolve(row);
        },
      ),
      update: jest.fn(({ data }: { data: { text: string; rate: number } }) =>
        Promise.resolve(Object.assign(rows[0], data)),
      ),
    };
    const client = { review, $transaction: transactionRunner({ review }) };
    const service = new ReviewService(client as unknown as PrismaService);
    const dto = { movieId: 'movie-id', text: 'Исходный отзыв', rate: 7 };
    const results = await Promise.allSettled([
      service.create(dto, 'user-id'),
      service.create(dto, 'user-id'),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === 'rejected'),
    ).toMatchObject({
      reason: { status: 409 },
    });
    expect(rows).toHaveLength(1);
    await service.update(
      'review-id',
      { text: 'Изменённый отзыв', rate: 8 },
      'user-id',
    );
    expect(rows[0]).toMatchObject({ text: 'Изменённый отзыв', rate: 8 });
    await expect(
      service.update(
        'review-id',
        { text: 'Чужая правка', rate: 1 },
        'other-user',
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});
