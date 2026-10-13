import { ActorService } from './actor.service';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Фото актёра', () => {
  it('привязывает фото автора записи в одной транзакции', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      actor: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'actor-id',
          createdById: 'user-id',
          imageAssetId: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      ...tx,
      $transaction: jest.fn(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    };
    const media = {
      select: jest.fn().mockResolvedValue({
        assetId: 'asset-id',
        url: 'https://media.example.test/photo.webp',
        thumbnailUrl: 'https://media.example.test/small.webp',
      }),
      release: jest.fn(),
    };
    const service = new ActorService(prisma as never, media as never);

    await service.patch('actor-id', { imageAssetId: 'asset-id' } as never, {
      id: 'user-id',
      role: 'USER',
    });
    expect(media.select).toHaveBeenCalledWith(
      tx,
      { assetId: 'asset-id', url: undefined },
      'user-id',
      'ACTOR_PHOTO',
      null,
    );
    expect(tx.actor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          imageUrl: 'https://media.example.test/photo.webp',
          imageAsset: { connect: { id: 'asset-id' } },
        }) as unknown,
      }),
    );
  });
});
