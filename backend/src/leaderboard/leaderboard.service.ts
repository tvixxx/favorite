import { Injectable } from '@nestjs/common';
import type { ContentKind } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { TtlCache } from '../common/utils/ttl-cache';
import { dataRevision } from '../common/utils/data-revision';
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
  contentKind?: ContentKind | null;
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

const LEADERBOARD_TTL_MS = 30_000;

@Injectable()
export class LeaderboardService {
  private readonly topUsersCache = new TtlCache<LeaderboardTopUsersResponseDto>(
    LEADERBOARD_TTL_MS,
  );
  private readonly topMoviesCache =
    new TtlCache<LeaderboardTopMoviesResponseDto>(LEADERBOARD_TTL_MS);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly badgeService: BadgeService,
  ) {}

  public getTopUsers(
    query: LeaderboardQueryDto,
  ): Promise<LeaderboardTopUsersResponseDto> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 20);
    const offset = Math.max(query.offset ?? 0, 0);
    const sortBy = query.sortBy ?? LeaderboardSortBy.TOTAL_SCORE;
    const sortOrder = query.sortOrder ?? LeaderboardSortOrder.DESC;
    return this.topUsersCache.wrap(
      `${dataRevision(this.prismaService)}|${sortBy}|${sortOrder}|${offset}|${limit}`,
      () => this.computeTopUsers(limit, offset, sortBy, sortOrder),
    );
  }

  private async computeTopUsers(
    limit: number,
    offset: number,
    sortBy: LeaderboardSortBy,
    sortOrder: LeaderboardSortOrder,
  ): Promise<LeaderboardTopUsersResponseDto> {
    // Одна команда даёт страницу и total из одного снимка БД, включая пустую страницу.
    const [result] = await this.prismaService.$queryRaw<
      Array<{
        items: Omit<LeaderboardUserItemDto, 'badges'>[];
        total: number;
      }>
    >`
      WITH aggregated AS (
        SELECT u.id AS "userId", u."fullName" AS "displayName", u.created_at AS "registeredAt",
          count(*) FILTER (WHERE NOT m.is_serial)::int AS "filmsCount",
          count(*) FILTER (WHERE m.is_serial)::int AS "serialsTotal",
          count(*) FILTER (WHERE m.is_serial AND um.watch_status = 'COMPLETED')::int AS "serialsCompleted"
        FROM user_movies um JOIN users u ON u.id = um.user_id JOIN movies m ON m.id = um.movie_id
        GROUP BY u.id
      ), scored AS (
        SELECT *, "filmsCount" + "serialsCompleted" AS "totalScore",
          CASE ${sortBy}::text
            WHEN 'registeredAt' THEN extract(epoch FROM "registeredAt")
            WHEN 'films' THEN "filmsCount"
            WHEN 'serialsCompleted' THEN "serialsCompleted"
            WHEN 'serialsTotal' THEN "serialsTotal"
            ELSE "filmsCount" + "serialsCompleted"
          END AS sort_value
        FROM aggregated
      ), page AS (
        SELECT "userId", "displayName", "registeredAt" AT TIME ZONE 'UTC' AS "registeredAt", "filmsCount", "serialsTotal", "serialsCompleted", "totalScore",
          row_number() OVER (ORDER BY
            CASE WHEN ${sortOrder}::text = 'asc' THEN sort_value END ASC,
            CASE WHEN ${sortOrder}::text = 'desc' THEN sort_value END DESC, "userId" ASC)::int AS rank
        FROM scored
        ORDER BY rank LIMIT ${limit} OFFSET ${offset}
      )
      SELECT (SELECT count(*)::int FROM scored) AS total,
        COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY rank) FROM page), '[]'::jsonb) AS items
    `;
    const badges = await this.badgeService.getTopUnlockedBadgesForUsers(
      result.items.map((row) => row.userId),
      6,
    );
    return {
      items: result.items.map((row) => ({
        ...row,
        registeredAt: new Date(row.registeredAt).toISOString(),
        badges: badges.get(row.userId) ?? [],
      })),
      total: result.total,
      limit,
      offset,
    };
  }

  public getTopMovies(
    query: LeaderboardTopMoviesQueryDto,
  ): Promise<LeaderboardTopMoviesResponseDto> {
    return this.topMoviesCache.wrap(
      `${dataRevision(this.prismaService)}|${JSON.stringify(query)}`,
      () => this.computeTopMovies(query),
    );
  }

  private async computeTopMovies(
    query: LeaderboardTopMoviesQueryDto,
  ): Promise<LeaderboardTopMoviesResponseDto> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 20);
    const offset = Math.max(query.offset ?? 0, 0);
    const sortBy = query.sortBy ?? LeaderboardMovieSortBy.AVG_PERSONAL_RATE;
    const sortOrder = query.sortOrder ?? LeaderboardMovieSortOrder.DESC;
    const rateMin = Math.min(
      query.personalRateMin ?? 0,
      query.personalRateMax ?? 10,
    );
    const rateMax = Math.max(
      query.personalRateMin ?? 0,
      query.personalRateMax ?? 10,
    );
    const genres = (query.genres ?? []).map((genre) =>
      genre === 'Sci_fi' ? 'Sci-fi' : genre,
    );
    const countries = query.countryCodes ?? [];
    const actors = query.actorIds ?? [];
    const from = query.publishDateFrom ? new Date(query.publishDateFrom) : null;
    const to = query.publishDateTo ? new Date(query.publishDateTo) : null;
    const [result] = await this.prismaService.$queryRaw<
      Array<{
        items: LeaderboardMovieItemDto[];
        total: number;
      }>
    >`
      WITH aggregated AS (
        SELECT m.id AS "movieId", m.title, m.is_serial AS "isSerial", m.content_kind AS "contentKind", m.publish_date AS "publishDate",
          p.url AS "posterUrl", avg(um.personal_rate)::float8 AS "avgPersonalRate",
          count(um.personal_rate)::int AS "ratingsCount"
        FROM movies m LEFT JOIN movie_posters p ON p.id = m.poster_id
          LEFT JOIN user_movies um ON um.movie_id = m.id AND um.personal_rate IS NOT NULL
        WHERE (${genres.length} = 0 OR m.genres::text[] && ${genres}::text[])
          AND (${countries.length} = 0 OR m.country_codes::text[] && ${countries}::text[])
          AND (${from}::timestamp IS NULL OR m.publish_date >= ${from})
          AND (${to}::timestamp IS NULL OR m.publish_date <= ${to})
          AND (${actors.length} = 0 OR EXISTS (
            SELECT 1 FROM "_movie_actors" ma WHERE ma."B" = m.id AND ma."A" = ANY(${actors}::text[])
          ))
        GROUP BY m.id, p.url
      ), filtered AS (
        SELECT *, CASE ${sortBy}::text
          WHEN 'ratingsCount' THEN "ratingsCount"
          WHEN 'publishDate' THEN coalesce(extract(epoch FROM "publishDate"), 0)
          ELSE coalesce("avgPersonalRate", 0)
        END AS sort_value
        FROM aggregated
        WHERE coalesce("avgPersonalRate", 0) BETWEEN ${rateMin} AND ${rateMax}
      ), page AS (
        SELECT "movieId", title, "isSerial", "contentKind", "publishDate" AT TIME ZONE 'UTC' AS "publishDate", "posterUrl", "avgPersonalRate", "ratingsCount",
          row_number() OVER (ORDER BY
            CASE WHEN ${sortBy}::text = 'title' AND ${sortOrder}::text = 'asc' THEN lower(title) END COLLATE "ru-x-icu" ASC,
            CASE WHEN ${sortBy}::text = 'title' AND ${sortOrder}::text = 'desc' THEN lower(title) END COLLATE "ru-x-icu" DESC,
            CASE WHEN ${sortBy}::text <> 'title' AND ${sortOrder}::text = 'asc' THEN sort_value END ASC,
            CASE WHEN ${sortBy}::text <> 'title' AND ${sortOrder}::text = 'desc' THEN sort_value END DESC,
            "movieId" ASC)::int AS rank
        FROM filtered
        ORDER BY rank LIMIT ${limit} OFFSET ${offset}
      )
      SELECT (SELECT count(*)::int FROM filtered) AS total,
        COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY rank) FROM page), '[]'::jsonb) AS items
    `;
    return {
      items: result.items.map((row) => ({
        ...row,
        publishDate: row.publishDate
          ? new Date(row.publishDate).toISOString()
          : null,
      })),
      total: result.total,
      limit,
      offset,
    };
  }
}
