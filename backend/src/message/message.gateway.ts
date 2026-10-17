import { forwardRef, Inject, Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessageService } from './message.service';
import { UserStatusService } from '../user-status/user-status.service';
import { FriendshipService } from '../friendship/friendship.service';
import { NotificationService } from '../notification/notification.service';
import type { NotificationDto } from '../notification/notification.service';
import { AuthService } from '../auth/auth.service';
import { isAllowedOrigin } from '../common/utils/cors-policy';
import { isUUID } from 'class-validator';
import { isPlainText } from '../common/validation/plain-text';

type ChatSocket = Omit<Socket, 'data'> & {
  data: {
    userId?: string;
    accessToken?: string;
    expiryTimer?: ReturnType<typeof setTimeout>;
  };
};

@WebSocketGateway({
  cors: {
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allowed: boolean) => void,
    ) =>
      callback(
        null,
        isAllowedOrigin(
          origin,
          process.env.CORS_ORIGINS ?? process.env.FRONTEND_ORIGIN,
        ),
      ),
    credentials: true,
  },
  namespace: '/chat',
})
export class MessageGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly connections = new Map<string, Set<string>>();
  private readonly presenceUpdates = new Map<string, Promise<void>>();
  private readonly eventWindows = new Map<
    string,
    { count: number; expiresAt: number }
  >();
  private readonly logger = new Logger(MessageGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly messageService: MessageService,
    private readonly userStatusService: UserStatusService,
    @Inject(forwardRef(() => FriendshipService))
    private readonly friendshipService: FriendshipService,
    private readonly notificationService: NotificationService,
    private readonly authService: AuthService,
  ) {}

  emitToUser(userId: string, dto: NotificationDto): Promise<void> {
    try {
      this.server.to(`user:${userId}`).emit('notification:new', dto);
    } catch {
      this.logger.warn('Не удалось доставить уведомление по WebSocket');
    }

    return Promise.resolve();
  }

  public disconnectUser(userId: string): void {
    this.server.in(`user:${userId}`).disconnectSockets(true);
  }

  async handleConnection(client: ChatSocket) {
    try {
      if (
        !isAllowedOrigin(
          client.handshake.headers?.origin,
          process.env.CORS_ORIGINS ?? process.env.FRONTEND_ORIGIN,
        )
      ) {
        client.disconnect();

        return;
      }

      const token: unknown = client.handshake.auth?.token;

      if (typeof token !== 'string' || !token) {
        client.disconnect();

        return;
      }

      const user = await this.authService.verifyAccessToken(token);
      const userId = user.id;

      if (!client.connected) {
        return;
      }

      client.data.userId = userId;
      client.data.accessToken = token;
      await client.join(`user:${userId}`);

      // Блокировка могла завершиться до вступления сокета в отключаемую комнату.
      await this.authService.verifyAccessToken(token);

      if (!client.connected) {
        return;
      }

      if (user.accessTokenExpiresAt !== undefined) {
        client.data.expiryTimer = setTimeout(
          () => client.disconnect(),
          Math.min(
            Math.max(0, user.accessTokenExpiresAt - Date.now()),
            2 ** 31 - 1,
          ),
        );
        client.data.expiryTimer.unref();
      }

      const sockets = this.connections.get(userId) ?? new Set<string>();
      const wasOnline = sockets.size > 0;

      sockets.add(client.id);
      this.connections.set(userId, sockets);
      await this.updatePresence(userId);

      if (wasOnline || !this.connections.has(userId)) {
        return;
      }

      // Уведомить друзей что пользователь онлайн (один запрос вместо N+1)
      const friends = await this.friendshipService.getFriends(userId);
      const onlineFriends = await this.userStatusService.getOnlineFriends(
        friends.map((f) => f.friend.id),
      );

      for (const status of onlineFriends) {
        if (this.connections.has(userId)) {
          this.server
            .to(`user:${status.userId}`)
            .emit('user:online', { userId });
        }
      }

      console.log(`User ${userId} connected with socket ${client.id}`);
    } catch {
      this.logger.warn('Не удалось подключить чат');
      client.disconnect();
      await this.handleDisconnect(client);
    }
  }

  async handleDisconnect(client: ChatSocket) {
    clearTimeout(client.data.expiryTimer);
    try {
      const userId = client.data.userId;

      if (!userId) {
        return;
      }

      const sockets = this.connections.get(userId);

      if (!sockets?.delete(client.id)) {
        return;
      }

      if (sockets.size > 0) {
        return;
      }

      this.connections.delete(userId);

      await this.updatePresence(userId);

      // Уведомить друзей что пользователь оффлайн (один запрос вместо N+1)
      const friends = await this.friendshipService.getFriends(userId);
      const onlineFriends = await this.userStatusService.getOnlineFriends(
        friends.map((f) => f.friend.id),
      );

      for (const status of onlineFriends) {
        if (!this.connections.has(userId)) {
          this.server
            .to(`user:${status.userId}`)
            .emit('user:offline', { userId });
        }
      }

      console.log(`User ${userId} disconnected`);
    } catch {
      this.logger.warn('Не удалось обновить статус чата');
    }
  }

  @SubscribeMessage('message:send')
  async handleMessage(
    @MessageBody() data: { receiverId: string; content: string },
    @ConnectedSocket() client: ChatSocket,
  ) {
    try {
      if (
        client.data.userId &&
        !this.allowEvent(`${client.data.userId}:send`, 60)
      ) {
        return { error: 'Too many requests' };
      }

      const senderId = await this.getAuthorizedUserId(client);

      if (!senderId) {
        return { error: 'Unauthorized' };
      }

      if (
        !data ||
        Object.keys(data).some(
          (key) => !['receiverId', 'content'].includes(key),
        ) ||
        typeof data.receiverId !== 'string' ||
        !isUUID(data.receiverId, '4') ||
        typeof data.content !== 'string' ||
        !isPlainText(data.content, true) ||
        !data.content.trim() ||
        data.content.length > 5000
      ) {
        return { error: 'Invalid message' };
      }

      // Сохранить в БД
      const { message, notification } = await this.messageService.create(
        senderId,
        data.receiverId,
        data.content,
      );

      await this.emitToUser(
        data.receiverId,
        this.notificationService.toDto(notification),
      );

      // Отправить получателю через WebSocket
      try {
        this.server
          .to(`user:${data.receiverId}`)
          .emit('message:received', message);
        this.server
          .to(`user:${senderId}`)
          .except(client.id)
          .emit('message:received', message);
      } catch {
        this.logger.warn(
          'Сообщение сохранено, доставка по WebSocket не удалась',
        );
      }

      return message;
    } catch {
      this.logger.warn('Не удалось сохранить сообщение');

      return { error: 'Failed to send message' };
    }
  }

  @SubscribeMessage('message:read')
  async handleMessageRead(
    @MessageBody() data: { otherUserId: string },
    @ConnectedSocket() client: ChatSocket,
  ) {
    try {
      if (
        client.data.userId &&
        !this.allowEvent(`${client.data.userId}:read`, 120)
      ) {
        return { error: 'Too many requests' };
      }

      const userId = await this.getAuthorizedUserId(client);

      if (!userId) {
        return { error: 'Unauthorized' };
      }

      if (
        !data ||
        Object.keys(data).some((key) => key !== 'otherUserId') ||
        typeof data.otherUserId !== 'string' ||
        !isUUID(data.otherUserId, '4')
      ) {
        return { error: 'Invalid conversation' };
      }

      await this.messageService.markConversationAsRead(
        userId,
        data.otherUserId,
      );

      this.server
        .to(`user:${data.otherUserId}`)
        .emit('messages:read', { userId });

      return { success: true };
    } catch {
      this.logger.warn('Не удалось отметить сообщения прочитанными');

      return { error: 'Failed to mark as read' };
    }
  }

  private allowEvent(key: string, limit: number): boolean {
    const now = Date.now();
    const current = this.eventWindows.get(key);

    if (current && current.expiresAt > now) {
      current.count++;

      return current.count <= limit;
    }

    this.eventWindows.delete(key);

    if (this.eventWindows.size >= 4096) {
      for (const [storedKey, window] of this.eventWindows) {
        if (window.expiresAt <= now) {
          this.eventWindows.delete(storedKey);
        }
      }
    }

    if (this.eventWindows.size >= 4096) {
      return false;
    }

    this.eventWindows.set(key, { count: 1, expiresAt: now + 60000 });

    return true;
  }

  private async updatePresence(userId: string): Promise<void> {
    const previous = this.presenceUpdates.get(userId) ?? Promise.resolve();
    const update = previous
      .catch(() => undefined)
      .then(async () => {
        const socketId: unknown = this.connections
          .get(userId)
          ?.values()
          .next().value;

        if (typeof socketId === 'string') {
          await this.userStatusService.setOnline(userId, socketId);
        } else {
          await this.userStatusService.setOffline(userId);
        }
      });

    this.presenceUpdates.set(userId, update);

    try {
      await update;
    } finally {
      if (this.presenceUpdates.get(userId) === update) {
        this.presenceUpdates.delete(userId);
      }
    }
  }

  private async getAuthorizedUserId(
    client: ChatSocket,
  ): Promise<string | null> {
    const token: unknown = client.data.accessToken;

    if (!client.connected || typeof token !== 'string') {
      return null;
    }

    try {
      const user = await this.authService.verifyAccessToken(token);

      return user.id === client.data.userId ? user.id : null;
    } catch {
      client.disconnect();

      return null;
    }
  }
}
