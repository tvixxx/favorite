import { Injectable } from '@nestjs/common';
import type { Notification } from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';
import { NotificationType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationDto = {
  id: string;
  userId: string;
  type: NotificationType;
  payload: Prisma.JsonValue;
  readAt: string | null;
  createdAt: string;
};

@Injectable()
export class NotificationService {
  constructor(private readonly prismaService: PrismaService) {}

  toDto(row: Notification): NotificationDto {
    return {
      id: row.id,
      userId: row.userId,
      type: row.type,
      payload: row.payload,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async create(
    userId: string,
    type: NotificationType,
    payload: Prisma.InputJsonValue,
  ): Promise<Notification> {
    return this.prismaService.notification.create({
      data: {
        userId,
        type,
        payload,
      },
    });
  }

  async findManyForUser(
    userId: string,
    limit = 30,
    types?: NotificationType[],
  ): Promise<NotificationDto[]> {
    const rows = await this.prismaService.notification.findMany({
      where: { userId, ...(types ? { type: { in: types } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
    });

    return rows.map((r) => this.toDto(r));
  }

  async unreadCount(
    userId: string,
    types?: NotificationType[],
  ): Promise<number> {
    return this.prismaService.notification.count({
      where: {
        userId,
        readAt: null,
        ...(types ? { type: { in: types } } : {}),
      },
    });
  }

  async markRead(
    userId: string,
    notificationId: string,
  ): Promise<NotificationDto | null> {
    const existing = await this.prismaService.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!existing) {
      return null;
    }

    const updated = await this.prismaService.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });

    return this.toDto(updated);
  }

  async markAllRead(userId: string, types?: NotificationType[]): Promise<void> {
    await this.prismaService.notification.updateMany({
      where: {
        userId,
        readAt: null,
        ...(types ? { type: { in: types } } : {}),
      },
      data: { readAt: new Date() },
    });
  }
}
