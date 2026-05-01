import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BadgeService, type LeaderboardBadgePreview } from '../badge/badge.service';
import {
  LeaderboardQueryDto,
  LeaderboardSortBy,
  LeaderboardSortOrder,
} from './dto';

export interface LeaderboardUserItemDto {
  rank: number;
  userId: string;
  displayName: string;
  registeredAt: string;
  filmsCount: number;
  serialsTotal: number;
  serialsCompleted: number;
  totalScore: number;
  badges: LeaderboardBadgePreview[];
}

export interface LeaderboardTopUsersResponseDto {
  items: LeaderboardUserItemDto[];
  total: number;
  limit: number;
  offset: number;
}

interface UserAggRow {
  userId: string;
  displayName: string;
  registeredAt: Date;
  filmsCount: number;
  serialsTotal: number;
  serialsCompleted: number;
}

function pickSortValue(row: UserAggRow, sortBy: LeaderboardSortBy): number {
  switch (sortBy) {
    case LeaderboardSortBy.REGISTERED_AT:
      return row.registeredAt.getTime();
    case LeaderboardSortBy.FILMS:
      return row.filmsCount;
    case LeaderboardSortBy.SERIALS_COMPLETED:
      return row.serialsCompleted;
    case LeaderboardSortBy.SERIALS_TOTAL:
      return row.serialsTotal;
    case LeaderboardSortBy.TOTAL_SCORE:
    default:
      return row.filmsCount + row.serialsCompleted;
  }
}

/** Сериал считается досмотренным, если позиция не ниже последнего сезона и последней серии. */
function isSerialWatchCompleted(
  isSerial: boolean,
  seasonCount: number | null | undefined,
  episodeCount: number | null | undefined,
  currentSeason: number | null | undefined,
  currentEpisode: number | null | undefined,
): boolean {
  if (!isSerial) {
    return false;
  }
  const seasonsComplete = !!(
    seasonCount &&
    currentSeason &&
    currentSeason >= seasonCount
  );
  const episodesComplete = !!(
    episodeCount &&
    currentEpisode &&
    currentEpisode >= episodeCount
  );
  return seasonsComplete && episodesComplete;
}

function compareRows(
  a: UserAggRow,
  b: UserAggRow,
  sortBy: LeaderboardSortBy,
  sortOrder: LeaderboardSortOrder,
): number {
  const va = pickSortValue(a, sortBy);
  const vb = pickSortValue(b, sortBy);
  const primary = va === vb ? 0 : va < vb ? -1 : 1;
  const directed =
    sortOrder === LeaderboardSortOrder.DESC ? -primary : primary;

  if (directed !== 0) {
    return directed;
  }

  return a.userId.localeCompare(b.userId);
}

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly badgeService: BadgeService,
  ) {}

  /**
   * Считает рейтинг через Prisma Client: загружаем связи user + movie и агрегируем в памяти.
   * При очень большом числе записей `user_movies` имеет смысл вынести агрегацию в SQL/материализованное представление.
   */
  private async buildAggregatedRows(): Promise<UserAggRow[]> {
    const rows = await this.prismaService.userMovie.findMany({
      select: {
        userId: true,
        currentSeason: true,
        currentEpisode: true,
        user: {
          select: {
            id: true,
            fullName: true,
            createdAt: true,
          },
        },
        movie: {
          select: {
            isSerial: true,
            seasonCount: true,
            episodeCount: true,
          },
        },
      },
    });

    const map = new Map<string, UserAggRow>();

    for (const um of rows) {
      const userId = um.userId;
      let agg = map.get(userId);

      if (!agg) {
        agg = {
          userId,
          displayName: um.user.fullName,
          registeredAt: um.user.createdAt,
          filmsCount: 0,
          serialsTotal: 0,
          serialsCompleted: 0,
        };
        map.set(userId, agg);
      }

      if (!um.movie.isSerial) {
        agg.filmsCount += 1;
        continue;
      }

      agg.serialsTotal += 1;

      if (
        isSerialWatchCompleted(
          um.movie.isSerial,
          um.movie.seasonCount,
          um.movie.episodeCount,
          um.currentSeason,
          um.currentEpisode,
        )
      ) {
        agg.serialsCompleted += 1;
      }
    }

    return [...map.values()];
  }

  public async getTopUsers(
    query: LeaderboardQueryDto,
  ): Promise<LeaderboardTopUsersResponseDto> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 20);
    const offset = Math.max(query.offset ?? 0, 0);
    const sortBy = query.sortBy ?? LeaderboardSortBy.TOTAL_SCORE;
    const sortOrder = query.sortOrder ?? LeaderboardSortOrder.DESC;

    const aggregated = await this.buildAggregatedRows();
    aggregated.sort((a, b) => compareRows(a, b, sortBy, sortOrder));

    const total = aggregated.length;
    const pageRows = aggregated.slice(offset, offset + limit);

    const items: LeaderboardUserItemDto[] = await Promise.all(
      pageRows.map(async (row, index) => {
        const badges = await this.badgeService.getTopUnlockedBadges(
          row.userId,
          6,
        );

        return {
          rank: offset + index + 1,
          userId: row.userId,
          displayName: row.displayName,
          registeredAt: row.registeredAt.toISOString(),
          filmsCount: row.filmsCount,
          serialsTotal: row.serialsTotal,
          serialsCompleted: row.serialsCompleted,
          totalScore: row.filmsCount + row.serialsCompleted,
          badges,
        };
      }),
    );

    return {
      items,
      total,
      limit,
      offset,
    };
  }
}
