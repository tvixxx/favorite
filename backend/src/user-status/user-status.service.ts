import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserStatusService {
  constructor(private readonly prismaService: PrismaService) {}

  async setOnline(userId: string, socketId: string) {
    return this.prismaService.userStatus.upsert({
      where: { userId },
      create: {
        userId,
        isOnline: true,
        socketId,
        lastSeenAt: new Date(),
      },
      update: {
        isOnline: true,
        socketId,
        lastSeenAt: new Date(),
      },
    });
  }

  async setOffline(userId: string) {
    return this.prismaService.userStatus.update({
      where: { userId },
      data: {
        isOnline: false,
        socketId: null,
        lastSeenAt: new Date(),
      },
    });
  }

  async getStatus(userId: string) {
    return this.prismaService.userStatus.findUnique({
      where: { userId },
    });
  }

  async getOnlineFriends(friendIds: string[]) {
    return this.prismaService.userStatus.findMany({
      where: {
        userId: { in: friendIds },
        isOnline: true,
      },
    });
  }
}
