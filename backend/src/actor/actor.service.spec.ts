import { ForbiddenException } from '@nestjs/common';
import { ActorService } from './actor.service';
import { PrismaService } from '../prisma/prisma.service';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Права на актёров', () => {
  it('не разрешает менять общую запись обычному пользователю', async () => {
    const actor = { id: 'actor-id', name: 'Исходное имя', createdById: null };
    const prisma = {
      actor: {
        findUnique: jest.fn(() => Promise.resolve(actor)),
        update: jest.fn(({ data }: { data: { name?: string } }) =>
          Promise.resolve(Object.assign(actor, data)),
        ),
      },
    };
    const service = new ActorService(prisma as unknown as PrismaService);
    await expect(
      service.patch(
        'actor-id',
        { name: 'Новое имя' },
        { id: 'user-id', role: 'USER' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(actor.name).toBe('Исходное имя');
  });
});
