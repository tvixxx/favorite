import { BadgeService } from './badge.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Расчёт достижений без запросов на каждого участника рейтинга', () => {
  it('считает последние семь и тридцать суток независимо от перехода на летнее время', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-04-01T10:00:00Z'));

    try {
      const groupBy = jest
        .fn<Promise<unknown[]>, [{ where: { addedAt?: { gte: Date } } }]>()
        .mockResolvedValue([]);
      const service = new BadgeService(
        { userMovie: { groupBy } } as never,
        {} as never,
      );

      await service.getTopUnlockedBadgesForUsers(['first']);

      expect(groupBy.mock.calls[5][0].where.addedAt?.gte).toEqual(
        new Date('2024-03-25T10:00:00Z'),
      );
      expect(groupBy.mock.calls[6][0].where.addedAt?.gte).toEqual(
        new Date('2024-03-02T10:00:00Z'),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('сохраняет пороги достижений и выполняет семь группировок для всей страницы', async () => {
    const groupBy = jest
      .fn()
      .mockResolvedValue([{ userId: 'first', _count: { _all: 1 } }]);
    const service = new BadgeService(
      { userMovie: { groupBy } } as never,
      {} as never,
    );
    const result = await service.getTopUnlockedBadgesForUsers([
      'first',
      'second',
    ]);

    expect(result.get('first')).toEqual([
      {
        id: 'first-steps',
        title: 'Первые шаги',
        icon: '🎬',
        tier: 'bronze',
        category: 'movies',
      },
    ]);
    expect(result.get('second')).toEqual([]);
    expect(groupBy).toHaveBeenCalledTimes(7);
  });
});
