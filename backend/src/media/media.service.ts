import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { MediaAsset, Prisma } from '../generated/prisma/client';
import { ImageStorage } from './image-storage.service';
import { ImageProcessor } from './image-processor.service';
import {
  MAX_DAILY_UPLOADS,
  MAX_USER_MEDIA_BYTES,
  MEDIA_POLICIES,
  TEMPORARY_MEDIA_MS,
  type ImagePurpose,
} from './media-policy';

export interface MediaSelection {
  assetId?: string | null;
  url?: string | null;
}

@Injectable()
export class MediaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaService.name);
  private cleanupTimer: ReturnType<typeof setInterval> | undefined;
  private cleaning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ImageStorage,
    private readonly processor: ImageProcessor,
  ) {}

  public describe(asset: MediaAsset) {
    const privateImage = asset.purpose === 'FEEDBACK_SCREENSHOT';
    return {
      id: asset.id,
      url: privateImage
        ? `/uploads/images/${asset.id}/full.webp`
        : this.storage.publicUrl(asset.mainKey),
      thumbnailUrl: privateImage
        ? `/uploads/images/${asset.id}/thumbnail.webp`
        : this.storage.publicUrl(asset.thumbnailKey),
      mimeType: asset.mimeType,
      byteSize: asset.byteSize,
      width: asset.width,
      height: asset.height,
    };
  }

  public async upload(input: Buffer, purpose: ImagePurpose, ownerId: string) {
    const policy = MEDIA_POLICIES[purpose];

    if (!policy || !input?.length || input.length > policy.maxBytes) {
      throw new BadRequestException('Недопустимый размер изображения');
    }

    const id = randomUUID();
    const prefix = purpose === 'FEEDBACK_SCREENSHOT' ? 'feedback' : 'images';
    const mainKey = `${prefix}/${id}/full.webp`;
    const thumbnailKey = `${prefix}/${id}/thumbnail.webp`;
    const since = new Date(Date.now() - TEMPORARY_MEDIA_MS);

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ownerId}))`;
      const [count, usage] = await Promise.all([
        tx.mediaAsset.count({ where: { ownerId, createdAt: { gte: since } } }),
        tx.mediaAsset.aggregate({
          where: { ownerId },
          _sum: { byteSize: true },
        }),
      ]);

      if (count >= MAX_DAILY_UPLOADS) {
        throw new HttpException('Достигнут дневной лимит загрузок', 429);
      }

      if ((usage._sum.byteSize ?? 0) + input.length > MAX_USER_MEDIA_BYTES) {
        throw new HttpException('Достигнут лимит хранения изображений', 429);
      }

      await tx.mediaAsset.create({
        data: {
          id,
          ownerId,
          purpose,
          byteSize: input.length,
          mainKey,
          thumbnailKey,
          expiresAt: new Date(Date.now() + TEMPORARY_MEDIA_MS),
        },
      });
    });

    try {
      const image = await this.processor.process(input, policy);

      await this.storage.put(mainKey, image.main);
      await this.storage.put(thumbnailKey, image.thumbnail);
      const asset = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ownerId}))`;
        const usage = await tx.mediaAsset.aggregate({
          where: { ownerId, id: { not: id } },
          _sum: { byteSize: true },
        });
        const byteSize = image.main.length + image.thumbnail.length;

        if ((usage._sum.byteSize ?? 0) + byteSize > MAX_USER_MEDIA_BYTES) {
          throw new HttpException('Достигнут лимит хранения изображений', 429);
        }

        return tx.mediaAsset.update({
          where: { id },
          data: {
            status: 'READY',
            byteSize,
            width: image.width,
            height: image.height,
          },
        });
      });

      return this.describe(asset);
    } catch (error) {
      // Строка остаётся на сутки для учёта дневного лимита, даже при отмене.
      await this.prisma.mediaAsset.update({
        where: { id },
        data: { status: 'DELETING', expiresAt: new Date() },
      });
      await this.deleteFiles(id).catch(() =>
        this.logger.warn('Очистка неудачной загрузки отложена'),
      );
      throw error;
    }
  }

  public async claim(
    tx: Prisma.TransactionClient,
    id: string,
    ownerId: string,
    purpose: ImagePurpose,
    currentAssetId?: string | null,
  ) {
    const asset = await tx.mediaAsset.findUnique({ where: { id } });

    if (!asset || asset.status !== 'READY') {
      throw new NotFoundException('Изображение недоступно');
    }

    if (asset.purpose !== purpose) {
      throw new BadRequestException(
        'Изображение загружено для другого назначения',
      );
    }

    if (currentAssetId === id) {
      const image = this.describe(asset);
      return {
        assetId: id,
        url: image.url,
        thumbnailUrl: image.thumbnailUrl,
      };
    }

    if (asset.ownerId !== ownerId) {
      throw new ForbiddenException('Нельзя использовать чужую загрузку');
    }

    const result = await tx.mediaAsset.updateMany({
      where: {
        id,
        ownerId,
        purpose,
        status: 'READY',
        claimedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { claimedAt: new Date(), expiresAt: null },
    });

    if (!result.count) {
      throw new ConflictException(
        'Изображение уже используется или срок загрузки истёк',
      );
    }

    const image = this.describe(asset);
    return {
      assetId: id,
      url: image.url,
      thumbnailUrl: image.thumbnailUrl,
    };
  }

  public async select(
    tx: Prisma.TransactionClient,
    selection: MediaSelection,
    ownerId: string,
    purpose: ImagePurpose,
    currentAssetId?: string | null,
  ) {
    if (selection.assetId) {
      if (selection.url) {
        throw new BadRequestException('Выберите файл или ссылку');
      }

      return this.claim(
        tx,
        selection.assetId,
        ownerId,
        purpose,
        currentAssetId,
      );
    }

    if (selection.url) {
      let url: URL;

      try {
        url = new URL(selection.url.trim());
      } catch {
        throw new BadRequestException('Укажите HTTP(S) ссылку на изображение');
      }

      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password
      ) {
        throw new BadRequestException('Укажите HTTP(S) ссылку на изображение');
      }

      // Собственные media URL привязываются по ID, чтобы очистка не ломала ссылку.
      const managed =
        /\/images\/([0-9a-f-]{36})\/(full|thumbnail)\.webp$/i.exec(
          url.pathname,
        );

      if (managed) {
        const expected = new URL(
          this.storage.publicUrl(`images/${managed[1]}/${managed[2]}.webp`),
        );

        if (
          expected.origin === url.origin &&
          expected.pathname === url.pathname
        ) {
          return this.claim(tx, managed[1], ownerId, purpose, currentAssetId);
        }
      }

      return { assetId: null, url: url.href, thumbnailUrl: null };
    }

    return { assetId: null, url: null, thumbnailUrl: null };
  }

  public async release(
    tx: Prisma.TransactionClient,
    id?: string | null,
  ): Promise<void> {
    if (id) {
      await tx.mediaAsset.updateMany({
        where: { id, status: 'READY' },
        data: { expiresAt: new Date(Date.now() + TEMPORARY_MEDIA_MS) },
      });
    }
  }

  public async discard(id: string, ownerId: string): Promise<void> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });

    if (!asset || asset.ownerId !== ownerId) {
      throw new NotFoundException('Загрузка не найдена');
    }

    const result = await this.prisma.mediaAsset.updateMany({
      where: {
        id,
        ownerId,
        claimedAt: null,
        status: { in: ['READY', 'FAILED'] },
        poster: null,
        avatar: null,
        actorPhoto: null,
        feedback: null,
      },
      data: { status: 'DELETING', expiresAt: new Date() },
    });

    if (!result.count) {
      throw new ConflictException('Изображение уже используется');
    }

    await this.deleteFiles(id);
  }

  private async deleteFiles(id: string): Promise<void> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });

    if (!asset || asset.status !== 'DELETING') {
      return;
    }

    await this.storage.remove(
      [asset.mainKey, asset.thumbnailKey].filter(Boolean),
    );
    if (asset.createdAt.getTime() > Date.now() - TEMPORARY_MEDIA_MS) {
      await this.prisma.mediaAsset.updateMany({
        where: { id, status: 'DELETING' },
        data: {
          status: 'FAILED',
          byteSize: 0,
          mainKey: '',
          thumbnailKey: '',
          expiresAt: new Date(asset.createdAt.getTime() + TEMPORARY_MEDIA_MS),
        },
      });
    } else {
      await this.prisma.mediaAsset.deleteMany({
        where: {
          id,
          status: 'DELETING',
          poster: null,
          avatar: null,
          actorPhoto: null,
          feedback: null,
        },
      });
    }
  }

  public async cleanup(): Promise<void> {
    if (this.cleaning) {
      return;
    }

    this.cleaning = true;

    try {
      const assets = await this.prisma.mediaAsset.findMany({
        where: {
          OR: [{ status: 'DELETING' }, { expiresAt: { lte: new Date() } }],
          poster: null,
          avatar: null,
          actorPhoto: null,
          feedback: null,
        },
        take: 100,
      });

      for (const asset of assets) {
        const result = await this.prisma.mediaAsset.updateMany({
          where: {
            id: asset.id,
            OR: [{ status: 'DELETING' }, { expiresAt: { lte: new Date() } }],
            poster: null,
            avatar: null,
            actorPhoto: null,
            feedback: null,
          },
          data: { status: 'DELETING' },
        });

        if (result.count) {
          await this.deleteFiles(asset.id).catch(() =>
            this.logger.warn('Удаление медиа будет повторено'),
          );
        }
      }
    } finally {
      this.cleaning = false;
    }
  }

  public async localImage(id: string, filename: string): Promise<string> {
    if (!['full.webp', 'thumbnail.webp'].includes(filename)) {
      throw new NotFoundException();
    }

    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });

    if (
      !asset ||
      asset.status !== 'READY' ||
      asset.purpose === 'FEEDBACK_SCREENSHOT'
    ) {
      throw new NotFoundException();
    }

    return this.storage.localPath(
      filename === 'full.webp' ? asset.mainKey : asset.thumbnailKey,
    );
  }

  public onModuleInit(): void {
    this.cleanupTimer = setInterval(
      () =>
        void this.cleanup().catch(() =>
          this.logger.warn('Плановая очистка медиа отложена'),
        ),
      15 * 60 * 1000,
    );
    this.cleanupTimer.unref();
  }

  public onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
  }

  public async privateImage(
    id: string,
    filename: string,
    user: { id: string; role: string },
  ): Promise<Buffer> {
    if (!['full.webp', 'thumbnail.webp'].includes(filename))
      throw new NotFoundException();
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (
      !asset ||
      asset.status !== 'READY' ||
      asset.purpose !== 'FEEDBACK_SCREENSHOT' ||
      (asset.ownerId !== user.id && user.role !== 'ADMIN')
    )
      throw new NotFoundException();
    return this.storage.readPrivate(
      filename === 'full.webp' ? asset.mainKey : asset.thumbnailKey,
    );
  }
}
