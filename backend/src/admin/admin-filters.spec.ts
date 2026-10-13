import { AdminService } from './admin.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Серверная фильтрация пользователей', () => {
  it('применяет роль, доступ и даты до пагинации и к общему числу', async () => {
    const findMany = jest
      .fn<Promise<never[]>, [Prisma.UserFindManyArgs]>()
      .mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const service = new AdminService(
      {
        user: { findMany, count },
        $transaction: (requests: Promise<unknown>[]) => Promise.all(requests),
      } as unknown as PrismaService,
      {} as never,
    );

    await service.users({
      q: 'анна',
      role: 'USER',
      state: 'blocked',
      from: '2026-10-01',
      to: '2026-10-13',
      sort: 'oldest',
      limit: 20,
      offset: 40,
    });
    const query = findMany.mock.calls[0][0];

    expect(query.where).toMatchObject({
      role: 'USER',
      blockedAt: { not: null },
      createdAt: {
        gte: new Date('2026-09-30T20:00:00Z'),
        lt: new Date('2026-10-13T20:00:00Z'),
      },
    });
    expect(query).toMatchObject({
      take: 20,
      skip: 40,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    expect(count).toHaveBeenCalledWith({ where: query.where });
  });
});
