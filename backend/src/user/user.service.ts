import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'argon2';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import type { Prisma } from '../generated/prisma/client';
import { lockResource } from '../common/utils/transaction-lock';
import { invalidateDataCache } from '../common/utils/data-revision';
import { ZonedCalendar } from '../common/utils/timezone';

const publicUserSelect = {
  id: true,
  email: true,
  fullName: true,
  timezone: true,
  role: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
  avatarUrl: true,
  avatarThumbnailUrl: true,
  avatarAssetId: true,
} as const;

const profileUserSelect = {
  ...publicUserSelect,
  quickAddEnabled: true,
  watchTonightEnabled: true,
  collectionFilesEnabled: true,
  notifyNewMessages: true,
  notifyFriendRequests: true,
  notifyRecommendations: true,
} as const;

@Injectable()
export class UserService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly media: MediaService,
  ) {}

  public async findAll() {
    return this.prismaService.user.findMany({
      select: publicUserSelect,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  public async findById(id: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  public async findByEmail(email: string) {
    const user = await this.prismaService.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  public async create(dto: CreateUserDto) {
    const { email, fullName, tags, password } = dto;
    const hashedPass = await hash(password);

    return this.prismaService.user.create({
      data: {
        email,
        fullName,
        password: hashedPass,
        tags,
      },
      select: publicUserSelect,
    });
  }

  public async update(id: string, dto: UpdateUserDto, actorId = id) {
    return this.patch(id, dto, { allowTags: true, actorId });
  }

  public async patch(
    id: string,
    dto: Partial<UpdateUserDto>,
    options?: { allowTags?: boolean; actorId?: string },
  ) {
    const result = await this.prismaService.$transaction(async (tx) => {
      await lockResource(tx, `user:${id}`);
      const current = await tx.user.findUnique({
        where: { id },
        select: publicUserSelect,
      });

      if (!current) {
        throw new NotFoundException('Пользователь не найден');
      }

      const data: Prisma.UserUpdateInput = {
        fullName: dto.fullName,
        quickAddEnabled: dto.quickAddEnabled,
        watchTonightEnabled: dto.watchTonightEnabled,
        collectionFilesEnabled: dto.collectionFilesEnabled,
        notifyNewMessages: dto.notifyNewMessages,
        notifyFriendRequests: dto.notifyFriendRequests,
        notifyRecommendations: dto.notifyRecommendations,
      };
      if (dto.timezone !== undefined)
        data.timezone = new ZonedCalendar(dto.timezone).zone;

      if (options?.allowTags && dto.tags !== undefined) {
        data.tags = dto.tags;
      }

      if (dto.avatarAssetId !== undefined || dto.avatarUrl !== undefined) {
        const selected = await this.media.select(
          tx,
          { assetId: dto.avatarAssetId, url: dto.avatarUrl },
          options?.actorId ?? id,
          'USER_AVATAR',
          current.avatarAssetId,
        );

        data.avatarUrl = selected.url;
        data.avatarThumbnailUrl = selected.thumbnailUrl;
        data.avatarAsset = selected.assetId
          ? { connect: { id: selected.assetId } }
          : { disconnect: true };
        const updated = await tx.user.update({
          where: { id },
          data,
          select: profileUserSelect,
        });

        if (current.avatarAssetId !== selected.assetId) {
          await this.media.release(tx, current.avatarAssetId);
        }

        return updated;
      }

      return tx.user.update({ where: { id }, data, select: profileUserSelect });
    });
    invalidateDataCache(this.prismaService);
    return result;
  }

  public async delete(id: string, actorId?: string) {
    if (actorId === id) {
      throw new ForbiddenException(
        'Нельзя удалить собственный аккаунт администратора',
      );
    }

    try {
      await this.prismaService.$transaction(async (tx) => {
        await lockResource(tx, 'admin:user-access');
        if (actorId) {
          const actor = await tx.user.findFirst({
            where: { id: actorId, role: 'ADMIN', blockedAt: null },
            select: { id: true },
          });

          if (!actor) {
            throw new ForbiddenException('Права администратора изменились');
          }
        }
        await lockResource(tx, `user:${id}`);
        const target = await tx.user.findUnique({
          where: { id },
          select: { role: true, blockedAt: true },
        });

        if (
          target?.role === 'ADMIN' &&
          !target.blockedAt &&
          (await tx.user.count({
            where: { role: 'ADMIN', blockedAt: null },
          })) <= 1
        ) {
          throw new ConflictException(
            'Нельзя удалить последнего администратора',
          );
        }

        const deleted = await tx.user.delete({
          where: { id },
          select: { avatarAssetId: true },
        });

        await this.media.release(tx, deleted.avatarAssetId);
      });

      invalidateDataCache(this.prismaService);
      return id;
    } catch (error: unknown) {
      const code = (error as { code?: string }).code;

      if (code === 'P2025') {
        throw new NotFoundException(`Пользователь с айди: ${id} не найден`);
      }

      throw error;
    }
  }
}
