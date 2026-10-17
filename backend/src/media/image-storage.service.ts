import {
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

@Injectable()
export class ImageStorage implements OnModuleDestroy {
  private readonly provider: 'local' | 's3';
  private readonly root: string;
  private readonly publicBase: string;
  private readonly bucket: string;
  private readonly privateBucket: string;
  private readonly client: S3Client | null;

  constructor(config: ConfigService) {
    const production = config.get<string>('NODE_ENV') === 'production';
    const provider =
      config.get<string>('MEDIA_STORAGE') ?? (production ? 's3' : 'local');

    if (provider !== 'local' && provider !== 's3') {
      throw new Error('MEDIA_STORAGE: ожидается local или s3');
    }

    if (production && provider !== 's3') {
      throw new Error('Для production настройте MEDIA_STORAGE=s3');
    }

    this.provider = provider;
    this.root = resolve(config.get<string>('MEDIA_LOCAL_DIR') ?? '.media');
    const configuredBase = (
      config.get<string>('MEDIA_PUBLIC_BASE_URL') ??
      (provider === 'local' ? 'http://localhost:3005/media' : '')
    ).replace(/\/$/, '');
    let publicURL: URL;

    try {
      publicURL = new URL(configuredBase);
    } catch {
      throw new Error('Укажите корректный MEDIA_PUBLIC_BASE_URL');
    }

    if (
      !['http:', 'https:'].includes(publicURL.protocol) ||
      publicURL.username ||
      publicURL.password ||
      publicURL.search ||
      publicURL.hash ||
      (production && publicURL.protocol !== 'https:')
    ) {
      throw new Error('Настройте MEDIA_PUBLIC_BASE_URL с HTTPS для production');
    }

    this.publicBase = publicURL.href.replace(/\/$/, '');
    this.bucket =
      provider === 's3' ? config.getOrThrow<string>('MEDIA_S3_BUCKET') : '';
    this.privateBucket = config.get<string>('MEDIA_S3_PRIVATE_BUCKET') ?? '';
    this.client =
      provider === 's3'
        ? new S3Client({
            maxAttempts: 2,
            requestHandler: {
              connectionTimeout: 3000,
              requestTimeout: 10000,
              throwOnRequestTimeout: true,
            },
            endpoint: config.getOrThrow<string>('MEDIA_S3_ENDPOINT'),
            region: config.get<string>('MEDIA_S3_REGION') ?? 'ru-1',
            forcePathStyle:
              config.get<string>('MEDIA_S3_PATH_STYLE') !== 'false',
            credentials: {
              accessKeyId: config.getOrThrow<string>('MEDIA_S3_ACCESS_KEY'),
              secretAccessKey: config.getOrThrow<string>('MEDIA_S3_SECRET_KEY'),
            },
          })
        : null;
  }

  private validateKey(key: string): void {
    if (
      !/^(images|feedback)\/[0-9a-f-]{36}\/(full|thumbnail)\.webp$/i.test(key)
    ) {
      throw new Error('Недопустимый ключ изображения');
    }
  }

  public onModuleDestroy(): void {
    this.client?.destroy();
  }

  public publicUrl(key: string): string {
    this.validateKey(key);
    if (key.startsWith('feedback/'))
      throw new Error('У вложения нет публичной ссылки');

    return `${this.publicBase}/${key}`;
  }

  public async put(key: string, bytes: Buffer): Promise<void> {
    this.validateKey(key);
    if (this.client) {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucketFor(key),
          Key: key,
          Body: bytes,
          ContentType: 'image/webp',
          ACL: key.startsWith('feedback/') ? 'private' : undefined,
          CacheControl: key.startsWith('feedback/')
            ? 'private, no-store'
            : 'public, max-age=31536000, immutable',
        }),
      );
    } else {
      const target = join(this.root, key);

      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes, { flag: 'wx' });
    }
  }

  public async remove(keys: string[]): Promise<void> {
    for (const key of keys.filter(Boolean)) {
      this.validateKey(key);
      if (this.client) {
        await this.client.send(
          new DeleteObjectCommand({ Bucket: this.bucketFor(key), Key: key }),
        );
      } else {
        await rm(join(this.root, key), { force: true });
      }
    }
  }

  public localPath(key: string): string {
    if (this.provider !== 'local') {
      throw new NotFoundException();
    }

    this.validateKey(key);

    return join(this.root, key);
  }

  private bucketFor(key: string): string {
    if (!key.startsWith('feedback/')) return this.bucket;
    if (!this.privateBucket || this.privateBucket === this.bucket)
      throw new ServiceUnavailableException(
        'Хранилище вложений пока не настроено',
      );
    return this.privateBucket;
  }

  public async readPrivate(key: string): Promise<Buffer> {
    this.validateKey(key);
    if (!key.startsWith('feedback/')) throw new NotFoundException();
    if (!this.client) return readFile(this.localPath(key));
    const object = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucketFor(key), Key: key }),
    );
    if (!object.Body) throw new NotFoundException();
    return Buffer.from(await object.Body.transformToByteArray());
  }
}
