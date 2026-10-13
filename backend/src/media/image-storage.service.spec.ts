import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ImageStorage } from './image-storage.service';

const send = jest.fn<Promise<unknown>, [{ input: unknown }]>();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send })),
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
  DeleteObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));

describe('Хранение изображения', () => {
  it.each([
    'https://user:password@media.example.test',
    'https://media.example.test?key=fixture',
    'https://media.example.test#fragment',
    'https://',
  ])('отклоняет непригодный базовый публичный адрес %s', (address) => {
    expect(
      () =>
        new ImageStorage(
          new ConfigService({
            NODE_ENV: 'test',
            MEDIA_PUBLIC_BASE_URL: address,
          }),
        ),
    ).toThrow();
  });
  const key = 'images/00000000-0000-4000-8000-000000000001/full.webp';

  beforeEach(() => send.mockReset().mockResolvedValue({}));

  it('пишет и удаляет локальный файл без потери данных после нового экземпляра', async () => {
    const root = await mkdtemp(join(tmpdir(), 'favourite-media-test-'));
    const config = new ConfigService({
      NODE_ENV: 'test',
      MEDIA_LOCAL_DIR: root,
    });

    try {
      await new ImageStorage(config).put(key, Buffer.from('fixture'));
      const storage = new ImageStorage(config);

      expect(await readFile(storage.localPath(key), 'utf8')).toBe('fixture');
      await storage.remove([key]);
      await expect(readFile(storage.localPath(key))).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('не принимает путь вне пространства медиа', async () => {
    const storage = new ImageStorage(new ConfigService({ NODE_ENV: 'test' }));

    await expect(
      storage.put('../../file', Buffer.from('fixture')),
    ).rejects.toThrow();
    expect(() => storage.localPath('../file')).toThrow();
  });

  it('отправляет бинарный WebP в S3 и использует настроенный публичный адрес', async () => {
    const storage = new ImageStorage(
      new ConfigService({
        NODE_ENV: 'production',
        MEDIA_STORAGE: 's3',
        MEDIA_PUBLIC_BASE_URL: 'https://media.example.test',
        MEDIA_S3_ENDPOINT: 'https://storage.example.test',
        MEDIA_S3_BUCKET: 'fixture-bucket',
        MEDIA_S3_ACCESS_KEY: 'fixture-access',
        MEDIA_S3_SECRET_KEY: 'fixture-secret',
      }),
    );

    await storage.put(key, Buffer.from('fixture'));
    expect(send.mock.calls[0][0].input).toMatchObject({
      Bucket: 'fixture-bucket',
      Key: key,
      ContentType: 'image/webp',
      Body: Buffer.from('fixture'),
    });
    expect(storage.publicUrl(key)).toBe(`https://media.example.test/${key}`);
    await storage.remove([key]);
    expect(send.mock.calls[1][0].input).toMatchObject({
      Bucket: 'fixture-bucket',
      Key: key,
    });
  });

  it('не позволяет случайно использовать локальный диск в production', () => {
    expect(
      () =>
        new ImageStorage(
          new ConfigService({ NODE_ENV: 'production', MEDIA_STORAGE: 'local' }),
        ),
    ).toThrow();
  });
});
