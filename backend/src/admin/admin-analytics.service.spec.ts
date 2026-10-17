import { AdminAnalyticsService } from './admin-analytics.service';
import type { PrismaService } from '../prisma/prisma.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Учёт использования', () => {
  it('берёт семь календарных дней UTC+4 и не выдаёт неполную историю за нулевую', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-13T21:30:00Z'));
    const query = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const service = new AdminAnalyticsService({
      user: { count },
      movie: { count },
      review: { count },
      feedback: { count },
      usageEvent: {
        aggregate: jest.fn().mockResolvedValue({
          _min: { occurredAt: new Date('2026-10-13T20:00:00Z') },
        }),
      },
      $queryRaw: query,
    } as unknown as PrismaService);

    try {
      const result = await service.overview(7, 'Europe/Samara');

      expect(result.since).toBe('2026-10-07T20:00:00.000Z');
      expect(result.until).toBe('2026-10-13T21:30:00.000Z');
      expect(result.returning).toBeNull();
      expect(result.inactive).toBeNull();
      await service.overview(7, 'Europe/Samara');
      expect(count).toHaveBeenCalledTimes(5);
    } finally {
      jest.useRealTimers();
    }
  });
  it('берёт пользователя из сессии, не принимает чужой id и клиентское время', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new AdminAnalyticsService({
      usageEvent: { createMany },
    } as unknown as PrismaService);

    await service.record('session-user', {
      id: 'event',
      feature: 'SEARCH',
      userId: 'attacker',
      occurredAt: '2000-01-01',
    } as never);
    expect(createMany).toHaveBeenCalledWith({
      data: [{ id: 'event', feature: 'SEARCH', userId: 'session-user' }],
      skipDuplicates: true,
    });
  });
});
