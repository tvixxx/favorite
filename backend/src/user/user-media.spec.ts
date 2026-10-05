import { ForbiddenException } from '@nestjs/common';
import { UserService } from './user.service';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Сохранение фото профиля', () => {
  it('освобождает медиа аватара при удалении пользователя в той же транзакции', async () => {
    const tx = {
      user: {
        delete: jest.fn().mockResolvedValue({ avatarAssetId: 'avatar-id' }),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    };
    const media = { release: jest.fn().mockResolvedValue(undefined) };
    const service = new UserService(prisma as never, media as never);

    await expect(service.delete('user-id')).resolves.toBe('user-id');
    expect(media.release).toHaveBeenCalledWith(tx, 'avatar-id');
  });
  it('не меняет профиль, если медиа принадлежит другому пользователю', async () => {
    const tx = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'user-id', avatarAssetId: null }),
        update: jest.fn(),
      },
    };
    const prisma = {
      ...tx,
      $transaction: jest.fn(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    };
    const media = {
      select: jest.fn().mockRejectedValue(new ForbiddenException()),
    };
    const service = new UserService(prisma as never, media as never);

    await expect(
      service.patch('user-id', { avatarAssetId: 'foreign-id' } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
