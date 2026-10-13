import { ForbiddenException } from '@nestjs/common';
import { MediaService } from './media.service';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Привязка загруженного медиа', () => {
  const storage = {
    publicUrl: jest.fn((key: string) => `https://media.example.test/${key}`),
  };
  const processor = {};
  const asset = {
    id: 'asset-id',
    ownerId: 'user-id',
    purpose: 'MOVIE_POSTER',
    status: 'READY',
    mainKey: 'images/asset/full.webp',
    thumbnailKey: 'images/asset/thumbnail.webp',
    claimedAt: null,
    expiresAt: new Date(Date.now() + 3600000),
  };
  let tx: { mediaAsset: { findUnique: jest.Mock; updateMany: jest.Mock } };
  let service: MediaService;

  beforeEach(() => {
    tx = {
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue({ ...asset }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    service = new MediaService(
      {} as never,
      storage as never,
      processor as never,
    );
  });

  it('не привязывает чужое изображение', async () => {
    await expect(
      service.claim(tx as never, 'asset-id', 'another-user', 'MOVIE_POSTER'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.mediaAsset.updateMany).not.toHaveBeenCalled();
  });

  it('не позволяет использовать аватар как постер', async () => {
    await expect(
      service.claim(tx as never, 'asset-id', 'user-id', 'USER_AVATAR'),
    ).rejects.toThrow();
  });

  it('проверяет атомарный захват перед возвратом URL', async () => {
    tx.mediaAsset.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.claim(tx as never, 'asset-id', 'user-id', 'MOVIE_POSTER'),
    ).rejects.toThrow();
  });

  it('возвращает обработанные ссылки после успешного захвата', async () => {
    expect(
      await service.claim(tx as never, 'asset-id', 'user-id', 'MOVIE_POSTER'),
    ).toMatchObject({
      url: 'https://media.example.test/images/asset/full.webp',
      thumbnailUrl: 'https://media.example.test/images/asset/thumbnail.webp',
    });
    expect(tx.mediaAsset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ownerId: 'user-id',
          claimedAt: null,
          status: 'READY',
        }) as unknown,
      }),
    );
  });

  it('проверяет владельца для собственного URL миниатюры с query-параметром', async () => {
    const id = '00000000-0000-4000-8000-000000000001';

    await expect(
      service.select(
        tx as never,
        { url: `https://media.example.test/images/${id}/thumbnail.webp?v=1` },
        'another-user',
        'MOVIE_POSTER',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('Лимиты загрузки', () => {
  const cases = [
    {
      count: 100,
      usage: 0,
      description: 'не обрабатывает файл сверх дневного лимита',
    },
    {
      count: 0,
      usage: 500 * 1024 * 1024,
      description: 'не обрабатывает файл сверх квоты хранения',
    },
  ];

  it.each(cases)('$description', async ({ count, usage }) => {
    const tx = {
      $executeRaw: jest.fn(),
      mediaAsset: {
        count: jest.fn().mockResolvedValue(count),
        aggregate: jest.fn().mockResolvedValue({ _sum: { byteSize: usage } }),
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    };
    const processor = { process: jest.fn() };
    const service = new MediaService(
      prisma as never,
      {} as never,
      processor as never,
    );

    await expect(
      service.upload(Buffer.from('fixture'), 'MOVIE_POSTER', 'user-id'),
    ).rejects.toMatchObject({ status: 429 });
    expect(tx.mediaAsset.create).not.toHaveBeenCalled();
    expect(processor.process).not.toHaveBeenCalled();
  });
});

describe('Очистка медиа', () => {
  it('не удаляет файлы, если изображение успели привязать', async () => {
    const prisma = {
      mediaAsset: {
        findMany: jest.fn().mockResolvedValue([{ id: 'asset-id' }]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const storage = { remove: jest.fn() };
    const service = new MediaService(
      prisma as never,
      storage as never,
      {} as never,
    );

    await service.cleanup();
    expect(storage.remove).not.toHaveBeenCalled();
    expect(prisma.mediaAsset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          poster: null,
          avatar: null,
          actorPhoto: null,
        }) as unknown,
      }),
    );
  });

  it('удаляет истёкшую строку дневного учёта без обращения к пустым ключам хранилища', async () => {
    const asset = {
      id: 'asset-id',
      status: 'DELETING',
      mainKey: '',
      thumbnailKey: '',
      createdAt: new Date(Date.now() - 25 * 3600000),
    };
    const prisma = {
      mediaAsset: {
        findMany: jest.fn().mockResolvedValue([asset]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(asset),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const storage = {
      remove: jest
        .fn()
        .mockImplementation((keys: string[]) =>
          keys.some((key) => !key)
            ? Promise.reject(new Error('empty key'))
            : Promise.resolve(),
        ),
    };
    const service = new MediaService(
      prisma as never,
      storage as never,
      {} as never,
    );

    await service.cleanup();
    expect(prisma.mediaAsset.deleteMany).toHaveBeenCalled();
    expect(storage.remove).toHaveBeenCalledWith([]);
  });

  it('учитывает удалённую загрузку в дневном лимите, освобождая объём', async () => {
    const asset = {
      id: 'asset-id',
      ownerId: 'user-id',
      status: 'DELETING',
      mainKey: 'images/asset/full.webp',
      thumbnailKey: 'images/asset/thumbnail.webp',
      createdAt: new Date(),
    };
    const prisma = {
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue(asset),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const storage = { remove: jest.fn().mockResolvedValue(undefined) };
    const service = new MediaService(
      prisma as never,
      storage as never,
      {} as never,
    );

    await service.discard('asset-id', 'user-id');
    expect(prisma.mediaAsset.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          byteSize: 0,
        }) as unknown,
      }),
    );
  });
});
