import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

let mockConnected = false;
const mockOrder: string[] = [];
jest.mock('../generated/prisma/client', () => ({
  PrismaClient: class {
    $connect() {
      mockConnected = true;
      return Promise.resolve();
    }
    $disconnect() {
      mockConnected = false;
      mockOrder.push('disconnect');
      return Promise.resolve();
    }
    $queryRaw() {
      if (!mockConnected)
        return Promise.reject(new Error('БД закрыта до завершения работы'));
      mockOrder.push('background-write');
      return Promise.resolve([]);
    }
  },
}));

@Injectable()
class PendingWork {
  constructor(private readonly prisma: PrismaService) {}
  async onModuleDestroy() {
    await Promise.resolve();
    await this.prisma.$queryRaw`SELECT 1`;
  }
}

it('дожидается фоновой работы модулей перед отключением Prisma', async () => {
  mockOrder.length = 0;
  const module = await Test.createTestingModule({
    providers: [PrismaService, PendingWork],
  }).compile();
  const app = module.createNestApplication();
  await app.init();
  await expect(app.close()).resolves.toBeUndefined();
  expect(mockOrder).toEqual(['background-write', 'disconnect']);
});
