import { BadgeService } from './badge.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Расчёт достижений без запросов на каждого участника рейтинга', () => {
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
