import { PRODUCTION_COUNTRY_CODES } from '../../constants/production-countries';
import { Genre } from '../../generated/prisma/enums';
import { normalizeGenre } from './normalize-genre';
import { BadRequestException } from '@nestjs/common';

/** Повторяющиеся query-параметры или CSV: `a,b` → `['a','b'] */
export function parseCsvOrRepeated(
  param?: string | string[],
): string[] | undefined {
  if (param === undefined || param === '') {
    return undefined;
  }
  const raw = Array.isArray(param) ? param : [param];

  if (raw.some((value: unknown) => typeof value !== 'string')) {
    throw new BadRequestException('Фильтр должен содержать строки');
  }

  const parts = raw
    .flatMap((s) => s.split(','))
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

const GENRE_SET = new Set<string>(Object.values(Genre));

const COUNTRY_SET = new Set(
  PRODUCTION_COUNTRY_CODES.map((c) => c.toUpperCase()),
);

export function parseGenreFilters(
  param?: string | string[],
): Genre[] | undefined {
  const raw = parseCsvOrRepeated(param);
  if (!raw) {
    return undefined;
  }
  const genres = raw.map(normalizeGenre);

  if (
    genres.some((genre) => typeof genre !== 'string' || !GENRE_SET.has(genre))
  ) {
    throw new BadRequestException('Неверный жанр');
  }

  return genres as Genre[];
}

export function parseCountryFilters(
  param?: string | string[],
): string[] | undefined {
  const raw = parseCsvOrRepeated(param);
  if (!raw) {
    return undefined;
  }
  const countries = raw.map((country) => country.toUpperCase());

  if (countries.some((country) => !COUNTRY_SET.has(country))) {
    throw new BadRequestException('Недопустимый код страны');
  }

  return countries;
}
