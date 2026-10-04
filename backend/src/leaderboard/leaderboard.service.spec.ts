import { LeaderboardService } from './leaderboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadgeService } from '../badge/badge.service';
import { LeaderboardQueryDto } from './dto';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

describe('Одинаковая завершённость сериала в профиле и рейтинге', () => {
  it('считает просмотренным сериал со статусом completed без известного числа серий', async () => {
    const prisma = {
      userMovie: {
        findMany: jest.fn(() =>
          Promise.resolve([
            {
              userId: 'user-id',
              watchStatus: 'COMPLETED',
              currentSeason: null,
              currentEpisode: null,
              user: { id: 'user-id', fullName: 'Тест', createdAt: new Date() },
              movie: { isSerial: true, seasonCount: null, episodeCount: null },
            },
          ]),
        ),
      },
    };
    const service = new LeaderboardService(
      prisma as unknown as PrismaService,
      {
        getTopUnlockedBadges: jest.fn().mockResolvedValue([]),
      } as unknown as BadgeService,
    );
    const result = await service.getTopUsers(new LeaderboardQueryDto());
    expect(result.items[0]).toMatchObject({
      serialsCompleted: 1,
      totalScore: 1,
    });
  });

  it('не считает брошенный сериал завершённым по одним конечным позициям', async () => {
    const prisma = {
      userMovie: {
        findMany: jest.fn(() =>
          Promise.resolve([
            {
              userId: 'user-id',
              watchStatus: 'DROPPED',
              currentSeason: 2,
              currentEpisode: 10,
              user: { id: 'user-id', fullName: 'Тест', createdAt: new Date() },
              movie: { isSerial: true, seasonCount: 2, episodeCount: 10 },
            },
          ]),
        ),
      },
    };
    const service = new LeaderboardService(
      prisma as unknown as PrismaService,
      {
        getTopUnlockedBadges: jest.fn().mockResolvedValue([]),
      } as unknown as BadgeService,
    );
    const result = await service.getTopUsers(new LeaderboardQueryDto());
    expect(result.items[0]).toMatchObject({
      serialsCompleted: 0,
      totalScore: 0,
    });
  });
});
