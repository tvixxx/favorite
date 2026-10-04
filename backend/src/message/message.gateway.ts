import { forwardRef, Inject } from '@nestjs/common';
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
import { NotificationType } from '../generated/prisma/enums';
import { AuthService } from '../auth/auth.service';

type ChatSocket = Omit<Socket, 'data'> & {
  data: { userId?: string; accessToken?: string };
};

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class MessageGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly connections = new Map<string, Set<string>>();

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
    this.server.to(`user:${userId}`).emit('notification:new', dto);
    return Promise.resolve();
  }

  async handleConnection(client: ChatSocket) {
    try {
      const token: unknown = client.handshake.auth?.token;
      if (typeof token !== 'string' || !token) {
        client.disconnect();
        return;
      }
      const user = await this.authService.verifyAccessToken(token);
      const userId = user.id;
      client.data.userId = userId;
      client.data.accessToken = token;
      await client.join(`user:${userId}`);
      const sockets = this.connections.get(userId) ?? new Set<string>();
      const wasOnline = sockets.size > 0;
      sockets.add(client.id);
      this.connections.set(userId, sockets);
      await this.userStatusService.setOnline(userId, client.id);

      if (wasOnline) return;

      // Уведомить друзей что пользователь онлайн (один запрос вместо N+1)
      const friends = await this.friendshipService.getFriends(userId);
      const onlineFriends = await this.userStatusService.getOnlineFriends(
        friends.map((f) => f.friend.id),
      );
      for (const status of onlineFriends) {
        this.server.to(`user:${status.userId}`).emit('user:online', { userId });
      }

      console.log(`User ${userId} connected with socket ${client.id}`);
    } catch (error) {
      console.error('Connection error:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: ChatSocket) {
    try {
      const userId = client.data.userId;
      if (!userId) return;

      const sockets = this.connections.get(userId);
      if (!sockets?.delete(client.id)) return;
      if (sockets.size > 0) return;
      this.connections.delete(userId);

      await this.userStatusService.setOffline(userId);

      // Уведомить друзей что пользователь оффлайн (один запрос вместо N+1)
      const friends = await this.friendshipService.getFriends(userId);
      const onlineFriends = await this.userStatusService.getOnlineFriends(
        friends.map((f) => f.friend.id),
      );
      for (const status of onlineFriends) {
        this.server
          .to(`user:${status.userId}`)
          .emit('user:offline', { userId });
      }

      console.log(`User ${userId} disconnected`);
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }

  @SubscribeMessage('message:send')
  async handleMessage(
    @MessageBody() data: { receiverId: string; content: string },
    @ConnectedSocket() client: ChatSocket,
  ) {
    try {
      const senderId = await this.getAuthorizedUserId(client);
      if (!senderId) {
        return { error: 'Unauthorized' };
      }
      if (
        !data ||
        typeof data.receiverId !== 'string' ||
        !data.receiverId.trim() ||
        typeof data.content !== 'string' ||
        !data.content.trim() ||
        data.content.length > 5000
      ) {
        return { error: 'Invalid message' };
      }

      // Сохранить в БД
      const message = await this.messageService.create(
        senderId,
        data.receiverId,
        data.content,
      );

      const created = await this.notificationService.create(
        data.receiverId,
        NotificationType.CHAT_MESSAGE,
        {
          messageId: message.id,
          senderId,
          senderName: message.sender.fullName,
          preview: data.content.slice(0, 200),
        },
      );

      await this.emitToUser(
        data.receiverId,
        this.notificationService.toDto(created),
      );

      // Отправить получателю через WebSocket
      this.server
        .to(`user:${data.receiverId}`)
        .emit('message:received', message);
      this.server
        .to(`user:${senderId}`)
        .except(client.id)
        .emit('message:received', message);

      return message;
    } catch (error) {
      console.error('Send message error:', error);
      return { error: 'Failed to send message' };
    }
  }

  @SubscribeMessage('message:read')
  async handleMessageRead(
    @MessageBody() data: { otherUserId: string },
    @ConnectedSocket() client: ChatSocket,
  ) {
    try {
      const userId = await this.getAuthorizedUserId(client);
      if (!userId) {
        return { error: 'Unauthorized' };
      }
      if (
        !data ||
        typeof data.otherUserId !== 'string' ||
        !data.otherUserId.trim()
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
    } catch (error) {
      console.error('Mark as read error:', error);
      return { error: 'Failed to mark as read' };
    }
  }

  private async getAuthorizedUserId(
    client: ChatSocket,
  ): Promise<string | null> {
    const token: unknown = client.data.accessToken;
    if (typeof token !== 'string') return null;
    try {
      const user = await this.authService.verifyAccessToken(token);
      return user.id === client.data.userId ? user.id : null;
    } catch {
      client.disconnect();
      return null;
    }
  }
}
