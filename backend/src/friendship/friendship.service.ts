import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFriendshipDto } from './dto';

@Injectable()
export class FriendshipService {
  constructor(private readonly prismaService: PrismaService) {}

  async sendRequest(requesterId: string, dto: CreateFriendshipDto) {
    if (requesterId === dto.addresseeId) {
      throw new ConflictException('Cannot send request to yourself');
    }

    const addressee = await this.prismaService.user.findUnique({
      where: { id: dto.addresseeId },
    });

    if (!addressee) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.prismaService.friendship.findFirst({
      where: {
        OR: [
          { requesterId, addresseeId: dto.addresseeId },
          { requesterId: dto.addresseeId, addresseeId: requesterId },
        ],
      },
    });

    if (existing) {
      throw new ConflictException('Friendship already exists');
    }

    return this.prismaService.friendship.create({
      data: {
        requesterId,
        addresseeId: dto.addresseeId,
        type: dto.type,
        status: dto.type === 'SUBSCRIPTION' ? 'ACCEPTED' : 'PENDING',
      },
      include: {
        requester: true,
        addressee: true,
      },
    });
  }

  async acceptRequest(userId: string, friendshipId: string) {
    const friendship = await this.prismaService.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      throw new NotFoundException('Friendship request not found');
    }

    if (friendship.addresseeId !== userId) {
      throw new ConflictException('You can only accept requests sent to you');
    }

    if (friendship.status !== 'PENDING') {
      throw new ConflictException('Request is not pending');
    }

    return this.prismaService.friendship.update({
      where: { id: friendshipId },
      data: { status: 'ACCEPTED' },
      include: {
        requester: true,
        addressee: true,
      },
    });
  }

  async rejectRequest(userId: string, friendshipId: string) {
    const friendship = await this.prismaService.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      throw new NotFoundException('Friendship request not found');
    }

    if (friendship.addresseeId !== userId) {
      throw new ConflictException('You can only reject requests sent to you');
    }

    return this.prismaService.friendship.update({
      where: { id: friendshipId },
      data: { status: 'REJECTED' },
    });
  }

  async removeFriendship(userId: string, friendshipId: string) {
    const friendship = await this.prismaService.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }

    if (
      friendship.requesterId !== userId &&
      friendship.addresseeId !== userId
    ) {
      throw new ConflictException('You can only remove your own friendships');
    }

    return this.prismaService.friendship.delete({
      where: { id: friendshipId },
    });
  }

  async getFriends(userId: string) {
    const friendships = await this.prismaService.friendship.findMany({
      where: {
        OR: [{ requesterId: userId }, { addresseeId: userId }],
        status: 'ACCEPTED',
        type: 'FRIEND_REQUEST',
      },
      include: {
        requester: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        addressee: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    // Вернуть друга (не текущего пользователя)
    return friendships.map((f) => ({
      friendshipId: f.id,
      friend: f.requesterId === userId ? f.addressee : f.requester,
      createdAt: f.createdAt,
    }));
  }

  async getSubscribers(userId: string) {
    const subscriptions = await this.prismaService.friendship.findMany({
      where: {
        addresseeId: userId,
        status: 'ACCEPTED',
        type: 'SUBSCRIPTION',
      },
      include: {
        requester: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    return subscriptions.map((s) => ({
      friendshipId: s.id,
      subscriber: s.requester,
      createdAt: s.createdAt,
    }));
  }

  async getSubscriptions(userId: string) {
    const subscriptions = await this.prismaService.friendship.findMany({
      where: {
        requesterId: userId,
        status: 'ACCEPTED',
        type: 'SUBSCRIPTION',
      },
      include: {
        addressee: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    return subscriptions.map((s) => ({
      friendshipId: s.id,
      subscribedTo: s.addressee,
      createdAt: s.createdAt,
    }));
  }

  async getRequests(userId: string) {
    return this.prismaService.friendship.findMany({
      where: {
        addresseeId: userId,
        status: 'PENDING',
        type: 'FRIEND_REQUEST',
      },
      include: {
        requester: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });
  }

  async getStats(userId: string) {
    const [
      friendsCount,
      subscribersCount,
      subscriptionsCount,
      pendingRequestsCount,
    ] = await Promise.all([
      this.prismaService.friendship.count({
        where: {
          OR: [{ requesterId: userId }, { addresseeId: userId }],
          status: 'ACCEPTED',
          type: 'FRIEND_REQUEST',
        },
      }),
      this.prismaService.friendship.count({
        where: {
          addresseeId: userId,
          status: 'ACCEPTED',
          type: 'SUBSCRIPTION',
        },
      }),
      this.prismaService.friendship.count({
        where: {
          requesterId: userId,
          status: 'ACCEPTED',
          type: 'SUBSCRIPTION',
        },
      }),
      this.prismaService.friendship.count({
        where: {
          addresseeId: userId,
          status: 'PENDING',
          type: 'FRIEND_REQUEST',
        },
      }),
    ]);

    return {
      friendsCount,
      subscribersCount,
      subscriptionsCount,
      pendingRequestsCount,
    };
  }
}
