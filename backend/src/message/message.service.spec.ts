import { MessageService } from './message.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('История сообщений', () => {
  it('загружает только последнее сообщение каждого диалога', async () => {
    const people = {
      self: { id: 'self', fullName: 'Я', email: 'self@example.test' },
      peer: { id: 'peer', fullName: 'Друг', email: 'peer@example.test' },
    };
    const latest = {
      id: 'latest',
      senderId: 'peer',
      receiverId: 'self',
      sender: people.peer,
      receiver: people.self,
      createdAt: new Date(2),
    };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'latest' }]),
      message: {
        findMany: jest.fn().mockResolvedValue([latest]),
        groupBy: jest
          .fn()
          .mockResolvedValue([{ senderId: 'peer', _count: { _all: 3 } }]),
      },
    };
    const result = await new MessageService(prisma as never).getConversations(
      'self',
    );

    expect(result).toEqual([
      { otherUser: people.peer, lastMessage: latest, unreadCount: 3 },
    ]);
    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['latest'] } } }),
    );
  });
  it('откатывает сообщение при ошибке сохранения уведомления', async () => {
    const messages: string[] = [];
    const tx = {
      message: {
        create: () => {
          messages.push('message');
          return Promise.resolve({
            id: 'message',
            sender: { fullName: 'Тест' },
          });
        },
      },
      notification: {
        create: jest
          .fn()
          .mockRejectedValue(new Error('notification unavailable')),
      },
    };
    const prisma = {
      ...tx,
      $transaction: async (
        callback: (client: typeof tx) => Promise<unknown>,
      ) => {
        const before = [...messages];

        try {
          return await callback(tx);
        } catch (error) {
          messages.splice(0, messages.length, ...before);
          throw error;
        }
      },
    };
    const service = new MessageService(prisma as unknown as PrismaService);

    await expect(
      service.create('sender', 'receiver', 'Привет'),
    ).rejects.toThrow('notification unavailable');
    expect(messages).toEqual([]);
  });
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
