import { Injectable } from '@nestjs/common';
import type { Notification } from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';
import { NotificationType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { markMessageNotificationsRead } from './read-conversation';
import { notificationEvents } from './notification-events';

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
    tx: Prisma.TransactionClient = this.prismaService,
  ): Promise<Notification> {
    const actor =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Prisma.InputJsonObject)
        : undefined;
    const actorId = actor?.senderId ?? actor?.requesterId ?? actor?.friendId;
    const actorName =
      actor?.senderName ?? actor?.requesterName ?? actor?.friendName;
    return tx.notification.create({
      data: {
        userId,
        type,
        payload,
        actorId: typeof actorId === 'string' ? actorId : null,
        actorName: typeof actorName === 'string' ? actorName : null,
      },
    });
  }

  async findManyForUser(
    userId: string,
    limit = 30,
    types?: NotificationType[],
    unreadOnly = false,
  ): Promise<NotificationDto[]> {
    const rows = await this.prismaService.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { readAt: null } : {}),
        ...(types ? { type: { in: types } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: Math.min(Math.max(limit, 1), 50),
    });

    return rows.map((r) => this.toDto(r));
  }

  public async page(userId: string, limit: number, offset: number) {
    const where = { userId };
    const [rows, total] = await Promise.all([
      this.prismaService.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prismaService.notification.count({ where }),
    ]);
    return { items: rows.map((row) => this.toDto(row)), total };
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

  public async resolveFriendRequest(
    userId: string,
    friendshipId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.notification.updateMany({
      where: {
        userId,
        type: NotificationType.FRIEND_REQUEST,
        readAt: null,
        payload: { path: ['friendshipId'], equals: friendshipId },
      },
      data: { readAt: new Date() },
    });
  }

  async markRead(
    userId: string,
    notificationId: string,
  ): Promise<NotificationDto | null> {
    const updated = await this.prismaService.$transaction(async (tx) => {
      const existing = await tx.notification.findFirst({
        where: { id: notificationId, userId },
      });
      if (!existing || existing.readAt) return existing;
      if (existing.type === 'CHAT_MESSAGE' && existing.actorId) {
        const messageId = (existing.payload as Prisma.JsonObject).messageId;
        if (typeof messageId === 'string')
          await tx.message.updateMany({
            where: {
              id: messageId,
              receiverId: userId,
              senderId: existing.actorId,
            },
            data: { isRead: true },
          });
      }
      await tx.notification.update({
        where: { id: notificationId },
        data: { readAt: new Date() },
      });
      return tx.notification.findUniqueOrThrow({
        where: { id: notificationId },
      });
    });
    if (!updated) return null;
    notificationEvents.emit('changed', userId);
    if (updated.type === 'CHAT_MESSAGE' && updated.actorId)
      notificationEvents.emit('conversation-read', {
        userId,
        actorId: updated.actorId,
        through: updated.createdAt.toISOString(),
        messageId: (updated.payload as Prisma.JsonObject).messageId,
      });
    return this.toDto(updated);
  }

  async markAllRead(userId: string, types?: NotificationType[]): Promise<void> {
    const through = new Date();
    const peers = await this.prismaService.$transaction(async (tx) => {
      const peers =
        !types || types.includes(NotificationType.CHAT_MESSAGE)
          ? await tx.message.findMany({
              where: {
                receiverId: userId,
                isRead: false,
                createdAt: { lte: through },
              },
              select: { senderId: true },
              distinct: ['senderId'],
            })
          : [];
      if (!types || types.includes(NotificationType.CHAT_MESSAGE)) {
        await tx.message.updateMany({
          where: {
            receiverId: userId,
            isRead: false,
            createdAt: { lte: through },
          },
          data: { isRead: true },
        });
        await markMessageNotificationsRead(tx, userId, through);
      }
      await tx.notification.updateMany({
        where: {
          userId,
          readAt: null,
          createdAt: { lte: through },
          type: { not: 'CHAT_MESSAGE', ...(types ? { in: types } : {}) },
        },
        data: { readAt: through },
      });
      return peers;
    });
    notificationEvents.emit('changed', userId);
    for (const peer of peers)
      notificationEvents.emit('conversation-read', {
        userId,
        actorId: peer.senderId,
        through: through.toISOString(),
      });
  }
}
