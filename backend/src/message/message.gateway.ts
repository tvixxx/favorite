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

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class MessageGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly messageService: MessageService,
    private readonly userStatusService: UserStatusService,
    private readonly friendshipService: FriendshipService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const userId = this.extractUserId(client);
      if (!userId) {
        client.disconnect();
        return;
      }

      await this.userStatusService.setOnline(userId, client.id);

      // Уведомить друзей что пользователь онлайн
      const friends = await this.friendshipService.getFriends(userId);
      for (const friend of friends) {
        const friendStatus = await this.userStatusService.getStatus(
          friend.friend.id,
        );
        if (friendStatus?.isOnline && friendStatus.socketId) {
          this.server.to(friendStatus.socketId).emit('user:online', { userId });
        }
      }

      console.log(`User ${userId} connected with socket ${client.id}`);
    } catch (error) {
      console.error('Connection error:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const userId = this.extractUserId(client);
      if (!userId) return;

      await this.userStatusService.setOffline(userId);

      // Уведомить друзей что пользователь оффлайн
      const friends = await this.friendshipService.getFriends(userId);
      for (const friend of friends) {
        const friendStatus = await this.userStatusService.getStatus(
          friend.friend.id,
        );
        if (friendStatus?.isOnline && friendStatus.socketId) {
          this.server
            .to(friendStatus.socketId)
            .emit('user:offline', { userId });
        }
      }

      console.log(`User ${userId} disconnected`);
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }

  @SubscribeMessage('message:send')
  async handleMessage(
    @MessageBody() data: { receiverId: string; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const senderId = this.extractUserId(client);
      if (!senderId) {
        return { error: 'Unauthorized' };
      }

      // Сохранить в БД
      const message = await this.messageService.create(
        senderId,
        data.receiverId,
        data.content,
      );

      // Отправить получателю через WebSocket
      const receiverStatus = await this.userStatusService.getStatus(
        data.receiverId,
      );
      if (receiverStatus?.isOnline && receiverStatus.socketId) {
        this.server
          .to(receiverStatus.socketId)
          .emit('message:received', message);
      }

      return message;
    } catch (error) {
      console.error('Send message error:', error);
      return { error: 'Failed to send message' };
    }
  }

  @SubscribeMessage('message:read')
  async handleMessageRead(
    @MessageBody() data: { otherUserId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = this.extractUserId(client);
      if (!userId) {
        return { error: 'Unauthorized' };
      }

      await this.messageService.markConversationAsRead(userId, data.otherUserId);

      // Уведомить отправителя что сообщения прочитаны
      const senderStatus = await this.userStatusService.getStatus(
        data.otherUserId,
      );
      if (senderStatus?.isOnline && senderStatus.socketId) {
        this.server
          .to(senderStatus.socketId)
          .emit('messages:read', { userId });
      }

      return { success: true };
    } catch (error) {
      console.error('Mark as read error:', error);
      return { error: 'Failed to mark as read' };
    }
  }

  private extractUserId(client: Socket): string | null {
    // Извлечение userId из handshake (можно передать через auth token)
    const userId = client.handshake.auth?.userId || client.handshake.query?.userId;
    return userId as string | null;
  }
}
