import { LeaderboardService } from './leaderboard.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { BadgeService } from '../badge/badge.service';
import { LeaderboardQueryDto, LeaderboardTopMoviesQueryDto } from './dto';
import { invalidateDataCache } from '../common/utils/data-revision';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Кэш страниц рейтинга', () => {
  it('объединяет одновременные чтения и получает бейджи только для страницы', async () => {
    const row = {
      userId: 'user-id',
      registeredAt: '2026-01-01T00:00:00+00:00',
      rank: 21,
      displayName: 'Тест',
      filmsCount: 0,
      serialsTotal: 1,
      serialsCompleted: 1,
      totalScore: 1,
    };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ items: [row], total: 40 }]),
    };
    const badge = {
      getTopUnlockedBadgesForUsers: jest
        .fn()
        .mockResolvedValue(new Map([['user-id', [{ id: 'badge' }]]])),
    };
    const service = new LeaderboardService(
      prisma as unknown as PrismaService,
      badge as unknown as BadgeService,
    );
    const query = Object.assign(new LeaderboardQueryDto(), { offset: 20 });
    const [first, second] = await Promise.all([
      service.getTopUsers(query),
      service.getTopUsers(query),
    ]);
    expect(first).toEqual(second);
    expect(first.total).toBe(40);
    expect(first.items[0]).toMatchObject({
      rank: 21,
      totalScore: 1,
      serialsCompleted: 1,
      registeredAt: '2026-01-01T00:00:00.000Z',
      badges: [{ id: 'badge' }],
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(badge.getTopUnlockedBadgesForUsers).toHaveBeenCalledWith(
      ['user-id'],
      6,
    );
  });

  it('не выдаёт старое незавершённое чтение новым запросам после записи', async () => {
    let finish!: (value: unknown) => void;
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finish = resolve;
            }),
        )
        .mockResolvedValue([{ items: [], total: 2 }]),
    };
    const service = new LeaderboardService(
      prisma as unknown as PrismaService,
      {} as BadgeService,
    );
    const query = new LeaderboardTopMoviesQueryDto();
    const old = service.getTopMovies(query);
    await Promise.resolve();
    invalidateDataCache(prisma);
    const current = await service.getTopMovies(query);
    finish([{ items: [], total: 1 }]);
    expect((await old).total).toBe(1);
    expect(current.total).toBe(2);
    expect((await service.getTopMovies(query)).total).toBe(2);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });
});
