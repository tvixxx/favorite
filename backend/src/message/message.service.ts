import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessageService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(senderId: string, receiverId: string, content: string) {
    return this.prismaService.message.create({
      data: {
        senderId,
        receiverId,
        content,
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        receiver: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });
  }

  async getConversations(userId: string) {
    const messages = await this.prismaService.message.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        receiver: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    const conversationsMap = new Map();

    for (const message of messages) {
      const otherUserId =
        message.senderId === userId ? message.receiverId : message.senderId;

      if (!conversationsMap.has(otherUserId)) {
        const otherUser =
          message.senderId === userId ? message.receiver : message.sender;

        const unreadCount = await this.prismaService.message.count({
          where: {
            senderId: otherUserId,
            receiverId: userId,
            isRead: false,
          },
        });

        conversationsMap.set(otherUserId, {
          otherUser,
          lastMessage: message,
          unreadCount,
        });
      }
    }

    return Array.from(conversationsMap.values());
  }

  async getMessages(userId: string, otherUserId: string, limit = 50) {
    return this.prismaService.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: limit,
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        receiver: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });
  }

  async markConversationAsRead(userId: string, otherUserId: string) {
    return this.prismaService.message.updateMany({
      where: {
        senderId: otherUserId,
        receiverId: userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });
  }

  async getUnreadCount(userId: string) {
    return this.prismaService.message.count({
      where: {
        receiverId: userId,
        isRead: false,
      },
    });
  }
}
