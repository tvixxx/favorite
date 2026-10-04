import { MessageService } from './message.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('История сообщений', () => {
  it('возвращает последние сообщения в хронологическом порядке', async () => {
    const history = Array.from({ length: 60 }, (_, index) => ({
      id: String(index),
      createdAt: new Date(index * 1000),
    }));
    const prisma = {
      message: {
        findMany: jest.fn(
          (query: { orderBy: { createdAt: string }; take: number }) => {
            const rows =
              query.orderBy.createdAt === 'desc'
                ? [...history].reverse()
                : [...history];
            return Promise.resolve(rows.slice(0, query.take));
          },
        ),
      },
    };
    const service = new MessageService(prisma as unknown as PrismaService);
    const result = await service.getMessages('user-id', 'peer-id', 50);
    expect(result.map((item) => item.id)).toEqual(
      history.slice(10).map((item) => item.id),
    );
  });
});
