import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto';
import type { Feedback } from '../generated/prisma/client';
import { FeedbackStatus } from '../generated/prisma/enums';

export interface FeedbackListResponse {
  items: Feedback[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable()
export class FeedbackService {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Создаёт обращение. `userId` приходит из токена — тело запроса им управлять
   * не может. Автоконтекст (страница, браузер, вьюпорт) присылает фронт.
   */
  public async create(
    userId: string,
    dto: CreateFeedbackDto,
  ): Promise<{ id: string }> {
    const created = await this.prismaService.feedback.create({
      data: {
        userId,
        type: dto.type,
        message: dto.message.trim(),
        email: dto.email?.trim() || null,
        pageUrl: dto.pageUrl ?? null,
        userAgent: dto.userAgent ?? null,
        viewport: dto.viewport ?? null,
      },
      select: { id: true },
    });

    return created;
  }

  /** Список для администратора: свежие сверху, с фильтром по статусу. */
  public async findAll(params: {
    status?: FeedbackStatus;
    limit: number;
    offset: number;
  }): Promise<FeedbackListResponse> {
    const where = params.status ? { status: params.status } : {};

    const [items, total] = await Promise.all([
      this.prismaService.feedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
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
  ): Promise<Feedback> {
    const existing = await this.prismaService.feedback.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(`Обращение с айди: ${id} не найдено`);
    }

    return this.prismaService.feedback.update({
      where: { id },
      data: { status },
    });
  }
}
