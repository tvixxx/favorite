import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadgeService,
  type LeaderboardBadgePreview,
} from '../badge/badge.service';
import {
  LeaderboardMovieSortBy,
  LeaderboardMovieSortOrder,
  LeaderboardQueryDto,
  LeaderboardSortBy,
  LeaderboardSortOrder,
  LeaderboardTopMoviesQueryDto,
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

export interface LeaderboardMovieItemDto {
  rank: number;
  movieId: string;
  title: string;
  isSerial: boolean;
  publishDate: string | null;
  posterUrl: string | null;
  /** null, если ни у кого нет personal_rate по этому фильму */
  avgPersonalRate: number | null;
  ratingsCount: number;
}

export interface LeaderboardTopMoviesResponseDto {
  items: LeaderboardMovieItemDto[];
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
  const directed = sortOrder === LeaderboardSortOrder.DESC ? -primary : primary;

  if (directed !== 0) {
    return directed;
  }

  return a.userId.localeCompare(b.userId);
}

interface MovieAggRow {
  movieId: string;
  title: string;
  isSerial: boolean;
  publishDate: Date | null;
  posterUrl: string | null;
  avgPersonal: number | null;
  ratingsCount: number;
  /** Для фильтра и сортировки по «среднему»: без оценок = 0 */
  effectiveAvg: number;
}

function buildTopMoviesMovieWhere(
  query: LeaderboardTopMoviesQueryDto,
): Prisma.MovieWhereInput {
  const and: Prisma.MovieWhereInput[] = [];

  if (query.genres?.length) {
    and.push({ genres: { hasSome: query.genres } });
  }

  if (query.countryCodes?.length) {
    and.push({ countryCodes: { hasSome: query.countryCodes } });
  }

  if (query.publishDateFrom || query.publishDateTo) {
    const publishDate: Prisma.DateTimeNullableFilter = {};
    if (query.publishDateFrom) {
      publishDate.gte = new Date(query.publishDateFrom);
    }
    if (query.publishDateTo) {
      publishDate.lte = new Date(query.publishDateTo);
    }
    and.push({ publishDate });
  }

  if (query.actorIds?.length) {
    and.push({
      actors: { some: { id: { in: query.actorIds } } },
    });
  }

  if (!and.length) {
    return {};
  }

  return and.length === 1 ? and[0] : { AND: and };
}

function pickMovieSortValue(
  row: MovieAggRow,
  sortBy: LeaderboardMovieSortBy,
): number | string {
  switch (sortBy) {
    case LeaderboardMovieSortBy.RATINGS_COUNT:
      return row.ratingsCount;
    case LeaderboardMovieSortBy.TITLE:
      return row.title.toLowerCase();
    case LeaderboardMovieSortBy.PUBLISH_DATE:
      return row.publishDate?.getTime() ?? 0;
    case LeaderboardMovieSortBy.AVG_PERSONAL_RATE:
    default:
      return row.effectiveAvg;
  }
}

function compareMovieRows(
  a: MovieAggRow,
  b: MovieAggRow,
  sortBy: LeaderboardMovieSortBy,
  sortOrder: LeaderboardMovieSortOrder,
): number {
  const va = pickMovieSortValue(a, sortBy);
  const vb = pickMovieSortValue(b, sortBy);

  let primary: number;
  if (typeof va === 'string' && typeof vb === 'string') {
    primary = va.localeCompare(vb, 'ru');
  } else if (typeof va === 'number' && typeof vb === 'number') {
    primary = va === vb ? 0 : va < vb ? -1 : 1;
  } else {
    primary = String(va).localeCompare(String(vb), 'ru');
  }

  const directed =
    sortOrder === LeaderboardMovieSortOrder.DESC ? -primary : primary;

  if (directed !== 0) {
    return directed;
  }

  return a.movieId.localeCompare(b.movieId);
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

  /**
   * Топ фильмов/сериалов по среднему personal_rate среди user_movies.
   * Фильмы без ни одной оценки считаются с effectiveAvg = 0 (учитываются при диапазоне с 0).
   * При большом каталоге имеет смысл вынести агрегацию в SQL.
   */
  public async getTopMovies(
    query: LeaderboardTopMoviesQueryDto,
  ): Promise<LeaderboardTopMoviesResponseDto> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 20);
    const offset = Math.max(query.offset ?? 0, 0);
    const sortBy = query.sortBy ?? LeaderboardMovieSortBy.AVG_PERSONAL_RATE;
    const sortOrder = query.sortOrder ?? LeaderboardMovieSortOrder.DESC;

    let rateMin = query.personalRateMin ?? 0;
    let rateMax = query.personalRateMax ?? 10;
    if (rateMin > rateMax) {
      [rateMin, rateMax] = [rateMax, rateMin];
    }

    const where = buildTopMoviesMovieWhere(query);

    const movies = await this.prismaService.movie.findMany({
      where,
      select: {
        id: true,
        title: true,
        isSerial: true,
        publishDate: true,
        poster: { select: { url: true } },
      },
    });

    if (!movies.length) {
      return { items: [], total: 0, limit, offset };
    }

    const movieIds = movies.map((m) => m.id);

    const grouped = await this.prismaService.userMovie.groupBy({
      by: ['movieId'],
      where: {
        movieId: { in: movieIds },
        personalRate: { not: null },
      },
      _avg: { personalRate: true },
      _count: { _all: true },
    });

    const statMap = new Map(
      grouped.map((g) => [
        g.movieId,
        {
          avg: g._avg.personalRate != null ? Number(g._avg.personalRate) : null,
          count: g._count._all,
        },
      ]),
    );

    const rows: MovieAggRow[] = movies.map((m) => {
      const s = statMap.get(m.id);
      const avgPersonal = s?.avg ?? null;
      const ratingsCount = s?.count ?? 0;
      const effectiveAvg =
        avgPersonal !== null && !Number.isNaN(avgPersonal) ? avgPersonal : 0;

      return {
        movieId: m.id,
        title: m.title,
        isSerial: m.isSerial,
        publishDate: m.publishDate,
        posterUrl: m.poster?.url ?? null,
        avgPersonal: avgPersonal,
        ratingsCount,
        effectiveAvg,
      };
    });

    const filtered = rows.filter(
      (r) => r.effectiveAvg >= rateMin && r.effectiveAvg <= rateMax,
    );

    filtered.sort((a, b) => compareMovieRows(a, b, sortBy, sortOrder));

    const total = filtered.length;
    const pageRows = filtered.slice(offset, offset + limit);

    const items: LeaderboardMovieItemDto[] = pageRows.map((row, index) => ({
      rank: offset + index + 1,
      movieId: row.movieId,
      title: row.title,
      isSerial: row.isSerial,
      publishDate: row.publishDate?.toISOString() ?? null,
      posterUrl: row.posterUrl,
      avgPersonalRate: row.avgPersonal,
      ratingsCount: row.ratingsCount,
    }));

    return {
      items,
      total,
      limit,
      offset,
    };
  }
}
