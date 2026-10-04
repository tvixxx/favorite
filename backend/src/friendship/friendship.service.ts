import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  FriendshipStatus,
  FriendshipType,
  NotificationType,
} from '../generated/prisma/enums';
import { CreateFriendshipDto, FriendshipTypeDto } from './dto';
import { NotificationService } from '../notification/notification.service';
import { MessageGateway } from '../message/message.gateway';

const friendshipPeople = {
  requester: { select: { id: true, fullName: true, email: true } },
  addressee: { select: { id: true, fullName: true, email: true } },
} as const;

@Injectable()
export class FriendshipService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => MessageGateway))
    private readonly messageGateway: MessageGateway,
  ) {}

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

    const directions = [
      { requesterId, addresseeId: dto.addresseeId },
      { requesterId: dto.addresseeId, addresseeId: requesterId },
    ];
    const blocked = await this.prismaService.friendship.findFirst({
      where: { OR: directions, status: FriendshipStatus.BLOCKED },
    });
    if (blocked) throw new ConflictException('Relationship is blocked');

    const existing = await this.prismaService.friendship.findFirst({
      where: {
        type: dto.type,
        OR:
          dto.type === FriendshipTypeDto.FRIEND_REQUEST
            ? directions
            : [directions[0]],
      },
    });

    if (existing && existing.status !== FriendshipStatus.REJECTED) {
      throw new ConflictException('Friendship already exists');
    }

    const data = {
      requesterId,
      addresseeId: dto.addresseeId,
      type: dto.type,
      status:
        dto.type === FriendshipTypeDto.SUBSCRIPTION
          ? FriendshipStatus.ACCEPTED
          : FriendshipStatus.PENDING,
    };
    const friendship = existing
      ? await this.prismaService.friendship.update({
          where: { id: existing.id },
          data,
          include: friendshipPeople,
        })
      : await this.prismaService.friendship.create({
          data,
          include: friendshipPeople,
        });

    if (
      dto.type === FriendshipTypeDto.FRIEND_REQUEST &&
      friendship.status === FriendshipStatus.PENDING
    ) {
      const row = await this.notificationService.create(
        friendship.addresseeId,
        NotificationType.FRIEND_REQUEST,
        {
          friendshipId: friendship.id,
          requesterId: friendship.requesterId,
          requesterName: friendship.requester.fullName,
        },
      );

      await this.messageGateway.emitToUser(
        friendship.addresseeId,
        this.notificationService.toDto(row),
      );
    }

    return friendship;
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

    if (
      friendship.status !== 'PENDING' ||
      friendship.type !== FriendshipType.FRIEND_REQUEST
    ) {
      throw new ConflictException('Request is not pending');
    }

    const updated = await this.prismaService.friendship.update({
      where: { id: friendshipId },
      data: { status: 'ACCEPTED' },
      include: friendshipPeople,
    });

    const row = await this.notificationService.create(
      updated.requesterId,
      NotificationType.FRIEND_ACCEPTED,
      {
        friendshipId: updated.id,
        friendId: updated.addresseeId,
        friendName: updated.addressee.fullName,
      },
    );

    await this.messageGateway.emitToUser(
      updated.requesterId,
      this.notificationService.toDto(row),
    );

    return updated;
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

    if (
      friendship.status !== FriendshipStatus.PENDING ||
      friendship.type !== FriendshipType.FRIEND_REQUEST
    ) {
      throw new ConflictException('Request is not pending');
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
