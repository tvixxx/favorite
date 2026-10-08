import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserStatusService implements OnModuleInit {
  constructor(private readonly prismaService: PrismaService) {}

  public async onModuleInit(): Promise<void> {
    // ponytail: один экземпляр API. Перед репликами нужен общий учёт присутствия.
    await this.prismaService.userStatus.updateMany({
      where: { isOnline: true },
      data: { isOnline: false, socketId: null },
    });
  }

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
    return this.prismaService.userStatus.updateMany({
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
