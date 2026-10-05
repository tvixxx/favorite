import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateActorDto } from './dto/create-actor.dto';
import type { ActorsListResponseDto } from './dto/actors-list-response.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { Actor, Prisma } from '../generated/prisma/client';
import { MediaService } from '../media/media.service';
import {
  assertCatalogOwner,
  type CatalogUser,
} from '../common/utils/catalog-owner';

@Injectable()
export class ActorService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly media: MediaService,
  ) {}

  public async findMany(params: {
    q?: string;
    limit: number;
    offset: number;
  }): Promise<ActorsListResponseDto> {
    const { q, limit, offset } = params;
    const trimmed = q?.trim();

    const where: Prisma.ActorWhereInput = trimmed
      ? {
          name: {
            contains: trimmed,
            mode: 'insensitive',
          },
        }
      : {};

    const [items, total] = await Promise.all([
      this.prismaService.actor.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: offset,
        take: limit,
      }),
      this.prismaService.actor.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  public async findById(id: string) {
    const actor = await this.prismaService.actor.findUnique({
      where: {
        id,
      },
    });

    if (!actor) {
      throw new NotFoundException('Actor not found');
    }

    return actor;
  }

  public async patch(
    id: string,
    dto: Partial<CreateActorDto>,
    user: CatalogUser,
  ): Promise<boolean> {
    const actor = await this.findById(id);

    assertCatalogOwner(actor.createdById, user);

    await this.prismaService.$transaction(async (tx) => {
      const current = await tx.actor.findUnique({ where: { id } });

      if (!current) {
        throw new NotFoundException('Актёр не найден');
      }

      assertCatalogOwner(current.createdById, user);

      const data: Prisma.ActorUpdateInput = { name: dto.name };

      if (dto.imageAssetId !== undefined || dto.imageUrl !== undefined) {
        const selected = await this.media.select(
          tx,
          { assetId: dto.imageAssetId, url: dto.imageUrl },
          user.id,
          'ACTOR_PHOTO',
          current.imageAssetId,
        );

        data.imageUrl = selected.url;
        data.imageThumbnailUrl = selected.thumbnailUrl;
        data.imageAsset = selected.assetId
          ? { connect: { id: selected.assetId } }
          : { disconnect: true };

        await tx.actor.update({ where: { id }, data });

        if (current.imageAssetId !== selected.assetId) {
          await this.media.release(tx, current.imageAssetId);
        }
      } else {
        await tx.actor.update({ where: { id }, data });
      }
    });

    return true;
  }

  public async create(
    createActorDto: CreateActorDto,
    user: CatalogUser,
  ): Promise<Actor> {
    const { name } = createActorDto;

    return this.prismaService.$transaction(async (tx) => {
      const photo =
        createActorDto.imageUrl || createActorDto.imageAssetId
          ? await this.media.select(
              tx,
              {
                assetId: createActorDto.imageAssetId,
                url: createActorDto.imageUrl,
              },
              user.id,
              'ACTOR_PHOTO',
            )
          : null;

      return tx.actor.create({
        data: {
          name,
          createdById: user.role === 'ADMIN' ? null : user.id,
          imageUrl: photo?.url,
          imageThumbnailUrl: photo?.thumbnailUrl,
          imageAssetId: photo?.assetId,
        },
      });
    });
  }
}
