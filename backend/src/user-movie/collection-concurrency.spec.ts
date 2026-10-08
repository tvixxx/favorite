import { UserMovieService } from './user-movie.service';
import { UserListService } from '../user-list/user-list.service';
import { transactionRunner } from '../common/testing/transaction-lock';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Параллельные изменения коллекции', () => {
  it('сохраняет одну согласованную оценку и один отзыв', async () => {
    let personalRate = 0;
    const reviews: Array<{ id: string; rate: number; text: string }> = [];
    const tx = {
      userMovie: {
        findUnique: () => Promise.resolve({ personalRate }),
        update: ({ data }: { data: { personalRate: number } }) => {
          personalRate = data.personalRate;
          return Promise.resolve({ personalRate, movie: {} });
        },
      },
      review: {
        findFirst: () => Promise.resolve(reviews[0] ? { ...reviews[0] } : null),
        create: ({ data }: { data: { rate: number; text: string } }) => {
          reviews.push({ id: 'review', ...data });

          return Promise.resolve();
        },
        update: ({ data }: { data: { rate: number; text: string } }) => {
          Object.assign(reviews[0], data);

          return Promise.resolve();
        },
        aggregate: () =>
          Promise.resolve({ _avg: { rate: reviews[0]?.rate ?? null } }),
      },
    };
    const service = new UserMovieService({
      ...tx,
      $transaction: transactionRunner(tx),
    } as never);

    await Promise.all([
      service.rate('user', 'movie', {
        personalRate: 7,
        reviewText: 'Первый содержательный отзыв',
      }),
      service.rate('user', 'movie', {
        personalRate: 8,
        reviewText: 'Второй содержательный отзыв',
      }),
    ]);
    expect(reviews).toHaveLength(1);
    expect(reviews[0].rate).toBe(personalRate);
    expect(personalRate).toBe(8);
  });

  it('не оставляет элемент списка при одновременном удалении из коллекции', async () => {
    let inCollection = true;
    let items = 0;
    let unblockRead!: () => void;
    let readStarted!: () => void;
    const reading = new Promise<void>((resolve) => {
      readStarted = resolve;
    });
    const releaseRead = new Promise<void>((resolve) => {
      unblockRead = resolve;
    });
    const tx = {
      userMovie: {
        findUnique: async () => {
          const row = inCollection ? { movieId: 'movie' } : null;

          readStarted();
          await releaseRead;
          return row;
        },
        delete: async () => {
          await Promise.resolve();
          inCollection = false;
        },
      },
      userList: {
        findFirst: () => Promise.resolve({ id: 'list', userId: 'user' }),
      },
      userListItem: {
        deleteMany: () => {
          items = 0;

          return Promise.resolve();
        },
        create: () => {
          items++;
          return Promise.resolve({ id: 'item' });
        },
      },
    };
    const prisma = { ...tx, $transaction: transactionRunner(tx) };
    const collection = new UserMovieService(prisma as never);
    const lists = new UserListService(prisma as never);

    const adding = lists.addMovie('user', 'list', { movieId: 'movie' });

    await reading;
    const deleting = collection.delete('user', 'movie');

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    unblockRead();
    await Promise.allSettled([adding, deleting]);
    expect(inCollection).toBe(false);
    expect(items).toBe(0);
  });
});
