import { BadRequestException } from '@nestjs/common';
import type { UserMovie } from '../generated/prisma/client';
import { WatchStatus } from '../generated/prisma/enums';
import { MAX_SEASONS, MAX_EPISODES } from '../common/validation/media-numbers';
import type { UpdateUserMovieDto } from './dto';

type MovieProgressMeta = {
  isSerial: boolean;
  seasonCount: number | null;
  episodeCount: number | null;
};

export function resolveWatchProgress(
  movie: MovieProgressMeta,
  dto: UpdateUserMovieDto,
  current?: Pick<
    UserMovie,
    | 'watchStatus'
    | 'currentSeason'
    | 'currentEpisode'
    | 'completedAt'
    | 'startedAt'
  >,
): UpdateUserMovieDto {
  const allowed = new Set([
    'isFavorite',
    'seeLater',
    'personalRate',
    'watchStatus',
    'currentSeason',
    'currentEpisode',
    'lastWatchedAt',
    'startedAt',
    'completedAt',
    'droppedAt',
  ]);
  const result = Object.fromEntries(
    Object.entries(dto).filter(([key]) => allowed.has(key)),
  ) as UpdateUserMovieDto;
  const now = new Date();

  const seasonCap = movie.seasonCount ?? null;
  const episodeCap = movie.episodeCount ?? null;

  const hasSeason = seasonCap !== null && seasonCap > 0;
  const hasEpisode = episodeCap !== null && episodeCap > 0;
  const isSerial = movie.isSerial;

  if (!isSerial) {
    if (
      result.currentSeason !== undefined ||
      result.currentEpisode !== undefined
    ) {
      result.currentSeason = null as unknown as number;
      result.currentEpisode = null as unknown as number;
    }

    if (
      result.watchStatus === WatchStatus.COMPLETED &&
      result.completedAt === undefined
    ) {
      result.completedAt = current?.completedAt ?? now;
    }

    if (
      result.watchStatus !== undefined &&
      result.watchStatus !== WatchStatus.COMPLETED
    ) {
      result.completedAt = null as unknown as Date;
    }
    if (result.watchStatus === WatchStatus.NOT_STARTED) {
      result.currentSeason = null as unknown as number;
      result.currentEpisode = null as unknown as number;
      result.lastWatchedAt = null as unknown as Date;
    }
    applyStatusDates(result, current, now);

    return result;
  }

  if (
    result.watchStatus === WatchStatus.COMPLETED &&
    ((seasonCap ?? 0) > MAX_SEASONS || (episodeCap ?? 0) > MAX_EPISODES)
  ) {
    throw new BadRequestException(
      'Количество сезонов или серий превышает допустимый предел',
    );
  }

  for (const [value, cap, maximum] of [
    [result.currentSeason, seasonCap, MAX_SEASONS],
    [result.currentEpisode, episodeCap, MAX_EPISODES],
  ] as const) {
    if (
      value !== undefined &&
      value !== null &&
      (!Number.isInteger(value) ||
        value < 0 ||
        value > Math.min(cap ?? maximum, maximum))
    ) {
      throw new BadRequestException(
        'Прогресс превышает допустимое количество сезонов или серий',
      );
    }
  }

  const effectiveSeason =
    result.currentSeason !== undefined
      ? result.currentSeason
      : (current?.currentSeason ?? null);
  const effectiveEpisode =
    result.currentEpisode !== undefined
      ? result.currentEpisode
      : (current?.currentEpisode ?? null);
  const hasAnyProgress =
    (effectiveSeason ?? 0) > 0 || (effectiveEpisode ?? 0) > 0;
  const hasExplicitWatchStatus = result.watchStatus !== undefined;
  const hasProgressUpdate =
    result.currentSeason !== undefined || result.currentEpisode !== undefined;

  const reachedSeasonEnd = hasSeason && (effectiveSeason ?? 0) >= seasonCap;
  const reachedEpisodeEnd = hasEpisode && (effectiveEpisode ?? 0) >= episodeCap;
  const canBeCompleted = hasSeason || hasEpisode;
  const reachedEnd = canBeCompleted
    ? (hasSeason ? reachedSeasonEnd : true) &&
      (hasEpisode ? reachedEpisodeEnd : true)
    : false;

  if (result.watchStatus === WatchStatus.NOT_STARTED) {
    result.currentSeason = null as unknown as number;
    result.currentEpisode = null as unknown as number;
    result.completedAt = null as unknown as Date;
    result.lastWatchedAt = null as unknown as Date;
    applyStatusDates(result, current, now);

    return result;
  }

  if (result.watchStatus === WatchStatus.COMPLETED) {
    result.watchStatus = WatchStatus.COMPLETED;

    if (hasSeason) {
      result.currentSeason = seasonCap;
    }

    if (hasEpisode) {
      result.currentEpisode = episodeCap;
    }

    if (result.completedAt === undefined) {
      result.completedAt = current?.completedAt ?? now;
    }
  } else if (result.watchStatus === WatchStatus.WATCHING) {
    result.watchStatus = WatchStatus.WATCHING;
    result.completedAt = null as unknown as Date;
  } else if (result.watchStatus === WatchStatus.DROPPED) {
    result.watchStatus = WatchStatus.DROPPED;
    result.completedAt = null as unknown as Date;
  } else if (!hasExplicitWatchStatus && hasProgressUpdate && reachedEnd) {
    result.watchStatus = WatchStatus.COMPLETED;

    if (hasSeason && result.currentSeason === undefined) {
      result.currentSeason = seasonCap;
    }

    if (hasEpisode && result.currentEpisode === undefined) {
      result.currentEpisode = episodeCap;
    }

    if (result.completedAt === undefined) {
      result.completedAt = now;
    }
  } else if (!hasExplicitWatchStatus && hasProgressUpdate && hasAnyProgress) {
    result.watchStatus = WatchStatus.WATCHING;
    result.completedAt = null as unknown as Date;
  }

  if (
    (result.currentSeason !== undefined ||
      result.currentEpisode !== undefined) &&
    result.lastWatchedAt === undefined
  ) {
    result.lastWatchedAt = now;
  }

  applyStatusDates(result, current, now);

  return result;
}

/**
 * Даты смены статуса: их показывают чипы «Начал / Досмотрел / Бросил».
 * `startedAt` выставляется один раз и живёт, пока не сбросят статус в
 * «не начато». `droppedAt` актуален только для брошенных.
 */
function applyStatusDates(
  result: UpdateUserMovieDto,
  current: { startedAt?: Date | null } | undefined,
  now: Date,
): void {
  if (result.watchStatus === undefined) {
    return;
  }

  const hasStarted = !!(result.startedAt ?? current?.startedAt);

  if (result.watchStatus === WatchStatus.NOT_STARTED) {
    result.startedAt = null as unknown as Date;
    result.droppedAt = null as unknown as Date;

    return;
  }

  // Смотрю / просмотрено / брошено — просмотр начался
  if (!hasStarted && result.startedAt === undefined) {
    result.startedAt = now;
  }

  if (result.watchStatus === WatchStatus.DROPPED) {
    if (result.droppedAt === undefined) {
      result.droppedAt = now;
    }

    return;
  }

  result.droppedAt = null as unknown as Date;
}
