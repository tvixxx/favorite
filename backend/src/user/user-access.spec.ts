import { ForbiddenException } from '@nestjs/common';
import { UserService } from './user.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Удаление пользователя при смене прав администратора', () => {
  it('не удаляет аккаунт, если инициатор потерял права во время ожидания', async () => {
    let exists = true;
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest
          .fn()
          .mockResolvedValue({ role: 'USER', blockedAt: null }),
        delete: jest.fn(() => {
          exists = false;
          return Promise.resolve({ avatarAssetId: null });
        }),
      },
    };
    const service = new UserService(
      {
        $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
      } as never,
      { release: jest.fn() } as never,
    );

    await expect(
      service.delete('target', 'former-admin'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(exists).toBe(true);
  });
});
