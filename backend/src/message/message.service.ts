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

    const latestByPeer = new Map<string, (typeof messages)[number]>();

    for (const message of messages) {
      const peerId =
        message.senderId === userId ? message.receiverId : message.senderId;

      if (!peerId || peerId === userId) {
        continue;
      }

      if (!latestByPeer.has(peerId)) {
        latestByPeer.set(peerId, message);
      }
    }

    const result: Array<{
      otherUser: {
        id: string;
        email: string;
        fullName: string;
      };
      lastMessage: (typeof messages)[number];
      unreadCount: number;
    }> = [];

    for (const [peerId, lastMessage] of latestByPeer) {
      const otherUser =
        lastMessage.senderId === userId
          ? lastMessage.receiver
          : lastMessage.sender;

      if (!otherUser || otherUser.id !== peerId) {
        continue;
      }

      const unreadCount = await this.prismaService.message.count({
        where: {
          senderId: peerId,
          receiverId: userId,
          isRead: false,
        },
      });

      result.push({
        otherUser,
        lastMessage,
        unreadCount,
      });
    }

    result.sort(
      (a, b) =>
        new Date(b.lastMessage.createdAt).getTime() -
        new Date(a.lastMessage.createdAt).getTime(),
    );

    return result;
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
