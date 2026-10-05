import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Готовность приложения', () => {
  it('подтверждает готовность при доступной базе', async () => {
    const controller = new HealthController({
      $queryRaw: jest.fn().mockResolvedValue([{ ok: 1 }]),
    } as never);

    expect(await controller.ready()).toEqual({ status: 'ok' });
  });
  it('возвращает 503 при недоступной базе без раскрытия настроек', async () => {
    const controller = new HealthController({
      $queryRaw: jest
        .fn()
        .mockRejectedValue(new Error('private connection detail')),
    } as never);

    await expect(controller.ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(controller.ready()).rejects.toThrow('База данных недоступна');
  });
});
