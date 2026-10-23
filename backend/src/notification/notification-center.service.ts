import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, type Notification } from '../generated/prisma/client';
import { AnnouncementService } from './announcement.service';
import { notificationEvents } from './notification-events';
import {
  readConversation,
  markMessageNotificationsRead,
} from './read-conversation';

export interface CenterQuery {
  limit: number;
  offset: number;
  q?: string;
  unreadOnly?: boolean;
  kind?: 'chat' | 'friends';
  through?: Date;
}
export interface CenterEvent {
  id: string;
  source: 'people';
  type: string;
  actorId: string | null;
  actorName: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  actions: { label: string; path: string }[];
}
const contains = (value: string): string =>
  '%' + value.replace(/[\\%_]/g, '\\$&') + '%';

@Injectable()
export class NotificationCenterService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly announcements: AnnouncementService,
  ) {}

  public async summary(userId: string) {
    const [people, system] = await Promise.all([
      this.prisma.notification.count({ where: { userId, readAt: null } }),
      this.prisma.announcement.count({
        where: this.announcements.visibleWhere(userId, { unreadOnly: true }),
      }),
    ]);
    return { people, system, asOf: new Date().toISOString() };
  }

  public async senders(userId: string, options: CenterQuery) {
    const through = options.through ?? new Date();
    const query = contains(options.q ?? '');
    return this.prisma.$transaction(
      async (tx) => {
        const condition = Prisma.sql`n.user_id = ${userId} AND n.actor_id IS NOT NULL AND n.created_at <= ${through}
        AND (COALESCE(u."fullName", n.actor_name, '') ILIKE ${query} OR COALESCE(u.username, '') ILIKE ${query})`;
        const rows = await tx.$queryRaw<
          Array<{
            id: string;
            name: string;
            username: string | null;
            total: number;
            unread: number;
            preview: string;
            lastAt: Date;
          }>
        >`
        SELECT n.actor_id AS id, COALESCE(MAX(u."fullName"), (array_agg(n.actor_name ORDER BY n.created_at DESC,n.id DESC))[1], 'Пользователь') AS name,
          MAX(u.username) AS username, COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE n.read_at IS NULL)::int AS unread,
          (array_agg(COALESCE(n.payload->>'preview','Событие дружбы') ORDER BY n.created_at DESC,n.id DESC))[1] AS preview,
          MAX(n.created_at) AS "lastAt"
        FROM notifications n LEFT JOIN users u ON u.id = n.actor_id WHERE ${condition}
        GROUP BY n.actor_id ORDER BY MAX(n.created_at) DESC, n.actor_id ASC LIMIT ${options.limit} OFFSET ${options.offset}
      `;
        const counts = await tx.$queryRaw<Array<{ total: number }>>`
        SELECT COUNT(DISTINCT n.actor_id)::int AS total FROM notifications n LEFT JOIN users u ON u.id = n.actor_id WHERE ${condition}
      `;
        return {
          items: rows.map((row) => ({
            ...row,
            lastAt: row.lastAt.toISOString(),
          })),
          total: counts[0].total,
          asOf: through.toISOString(),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  public async people(userId: string, actorId: string, options: CenterQuery) {
    const through = options.through ?? new Date();
    const body = Prisma.sql`CASE WHEN n.type='CHAT_MESSAGE' THEN COALESCE(m.content,'Сообщение больше недоступно.')
      WHEN n.type='FRIEND_REQUEST' THEN 'Хочет добавить вас в друзья.'
      WHEN n.type='FRIEND_ACCEPTED' THEN 'Принял(а) вашу заявку в друзья.'
      ELSE 'Отклонил(а) вашу заявку в друзья.' END`;
    const condition = Prisma.sql`n.user_id=${userId} AND n.actor_id=${actorId} AND n.created_at<=${through}
      ${options.unreadOnly ? Prisma.sql`AND n.read_at IS NULL` : Prisma.empty}
      ${options.kind === 'chat' ? Prisma.sql`AND n.type='CHAT_MESSAGE'` : options.kind === 'friends' ? Prisma.sql`AND n.type<>'CHAT_MESSAGE'` : Prisma.empty}
      AND ${body} ILIKE ${contains(options.q ?? '')}`;
    const join = Prisma.sql`FROM notifications n LEFT JOIN messages m ON m.id=n.payload->>'messageId' AND m.receiver_id=${userId} AND m.sender_id=${actorId}`;
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          Array<Notification & { fullBody: string }>
        >`
        SELECT n.id,n.user_id AS "userId",n.type,n.payload,n.actor_id AS "actorId",n.actor_name AS "actorName",n.read_at AS "readAt",n.created_at AS "createdAt",${body} AS "fullBody"
        ${join} WHERE ${condition} ORDER BY n.created_at DESC,n.id DESC LIMIT ${options.limit} OFFSET ${options.offset}
      `;
        const count = await tx.$queryRaw<
          Array<{ total: number }>
        >`SELECT COUNT(*)::int AS total ${join} WHERE ${condition}`;
        return {
          items: rows.map((row) => this.toEvent(row, row.fullBody)),
          total: count[0].total,
          unread: await tx.notification.count({
            where: { userId, actorId, readAt: null },
          }),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  private toEvent(row: Notification, body: string): CenterEvent {
    const name = row.actorName ?? 'Пользователь';
    const path =
      row.type === 'CHAT_MESSAGE'
        ? `/chat/${row.actorId}`
        : row.type === 'FRIEND_REQUEST'
          ? '/friends?tab=requests'
          : '/friends';
    return {
      id: row.id,
      source: 'people',
      type: row.type,
      actorId: row.actorId,
      actorName: name,
      title: name,
      body,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      actions: [
        {
          label: row.type === 'CHAT_MESSAGE' ? 'Открыть чат' : 'Открыть друзей',
          path,
        },
      ],
    };
  }

  public async readPeople(
    userId: string,
    actorId: string | undefined,
    through: Date,
  ): Promise<void> {
    const peers = await this.prisma.$transaction(async (tx) => {
      const peers = actorId
        ? [{ senderId: actorId }]
        : await tx.message.findMany({
            where: {
              receiverId: userId,
              isRead: false,
              createdAt: { lte: through },
            },
            select: { senderId: true },
            distinct: ['senderId'],
          });
      if (actorId) await readConversation(tx, userId, actorId, through);
      else
        await tx.message.updateMany({
          where: {
            receiverId: userId,
            isRead: false,
            createdAt: { lte: through },
          },
          data: { isRead: true },
        });
      if (!actorId) await markMessageNotificationsRead(tx, userId, through);
      await tx.notification.updateMany({
        where: {
          userId,
          type: { not: 'CHAT_MESSAGE' },
          readAt: null,
          createdAt: { lte: through },
          ...(actorId ? { actorId } : {}),
        },
        data: { readAt: new Date() },
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
