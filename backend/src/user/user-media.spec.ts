import { ForbiddenException } from '@nestjs/common';
import { UserService } from './user.service';
import { transactionRunner } from '../common/testing/transaction-lock';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Сохранение фото профиля', () => {
  it('при двух заменах освобождает каждое вытесненное фото ровно один раз', async () => {
    let avatarAssetId: string | null = 'old';
    const tx = {
      user: {
        findUnique: async () => {
          const snapshot = { id: 'user-id', avatarAssetId };

          await Promise.resolve();
          return snapshot;
        },
        update: ({
          data,
        }: {
          data: { avatarAsset: { connect: { id: string } } };
        }) => {
          avatarAssetId = data.avatarAsset.connect.id;
          return Promise.resolve({ id: 'user-id', avatarAssetId });
        },
      },
    };
    const media = {
      select: (_tx: unknown, { assetId }: { assetId: string }) =>
        Promise.resolve({
          assetId,
          url: `https://example.com/${assetId}`,
          thumbnailUrl: null,
        }),
      release: jest.fn(),
    };
    const service = new UserService(
      { $transaction: transactionRunner(tx) } as never,
      media as never,
    );

    await Promise.all([
      service.patch('user-id', { avatarAssetId: 'first' }),
      service.patch('user-id', { avatarAssetId: 'second' }),
    ]);
    expect(avatarAssetId).toBe('second');
    expect(media.release.mock.calls.map((call: unknown[]) => call[1])).toEqual([
      'old',
      'first',
    ]);
  });
  it('освобождает медиа аватара при удалении пользователя в той же транзакции', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
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
      $executeRaw: jest.fn().mockResolvedValue(1),
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
