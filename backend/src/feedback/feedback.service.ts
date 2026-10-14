import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto';
import type { Feedback, Prisma } from '../generated/prisma/client';
import {
  createdAtRange,
  type FeedbackQueryDto,
} from '../common/dto/list-query.dto';
import { FeedbackStatus } from '../generated/prisma/enums';
import { MediaService } from '../media/media.service';

export interface FeedbackListResponse {
  items: Feedback[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly media: MediaService,
  ) {}

  /**
   * Создаёт обращение. `userId` приходит из токена — тело запроса им управлять
   * не может. Автоконтекст (страница, браузер, вьюпорт) присылает фронт.
   */
  public async create(
    userId: string,
    dto: CreateFeedbackDto,
  ): Promise<{ id: string }> {
    return this.prismaService.$transaction(async (tx) => {
      if (dto.screenshotAssetId)
        await this.media.claim(
          tx,
          dto.screenshotAssetId,
          userId,
          'FEEDBACK_SCREENSHOT',
        );
      const created = await tx.feedback.create({
        data: {
          userId,
          type: dto.type,
          message: dto.message.trim(),
          email: dto.email?.trim() || null,
          pageUrl: dto.pageUrl ?? null,
          userAgent: dto.userAgent ?? null,
          viewport: dto.viewport ?? null,
          screenshotAssetId: dto.screenshotAssetId ?? null,
        },
        select: { id: true },
      });

      return created;
    });
  }

  /** Список для администратора: свежие сверху, с фильтром по статусу. */
  public async findAll(
    params: FeedbackQueryDto,
    timezone = 'UTC',
  ): Promise<FeedbackListResponse> {
    const where: Prisma.FeedbackWhereInput = {
      status: params.status,
      type: params.type,
      createdAt: createdAtRange(params, timezone),
      ...(params.q
        ? {
            OR: [
              { message: { contains: params.q, mode: 'insensitive' } },
              { email: { contains: params.q, mode: 'insensitive' } },
              {
                user: { fullName: { contains: params.q, mode: 'insensitive' } },
              },
            ],
          }
        : {}),
    };
    const order = params.sort === 'oldest' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      this.prismaService.feedback.findMany({
        where,
        orderBy: [{ createdAt: order }, { id: order }],
        take: params.limit,
        skip: params.offset,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
      }),
      this.prismaService.feedback.count({ where }),
    ]);

    return {
      items,
      total,
      limit: params.limit,
      offset: params.offset,
    };
  }

  public async updateStatus(
    id: string,
    status: FeedbackStatus,
    actorId: string,
  ): Promise<Feedback> {
    const existing = await this.prismaService.feedback.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existing) {
      throw new NotFoundException(`Обращение с айди: ${id} не найдено`);
    }

    return this.prismaService.$transaction(async (tx) => {
      const updated = await tx.feedback.update({
        where: { id },
        data: { status },
      });

      await tx.adminAuditLog.create({
        data: {
          actorId,
          targetId: id,
          action: 'FEEDBACK_STATUS',
          reason: `${existing.status} → ${status}`,
        },
      });

      return updated;
    });
  }
}
