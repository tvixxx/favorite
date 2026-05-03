import { PRODUCTION_COUNTRY_CODES } from '../../constants/production-countries';
import { Genre } from '../../generated/prisma/enums';

/** Повторяющиеся query-параметры или CSV: `a,b` → `['a','b'] */
export function parseCsvOrRepeated(
  param?: string | string[],
): string[] | undefined {
  if (param === undefined || param === '') {
    return undefined;
  }
  const raw = Array.isArray(param) ? param : [param];
  const parts = raw
    .flatMap((s) => String(s).split(','))
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
  const genres = raw.filter((g): g is Genre => GENRE_SET.has(g));
  return genres.length ? genres : undefined;
}

export function parseCountryFilters(
  param?: string | string[],
): string[] | undefined {
  const raw = parseCsvOrRepeated(param);
  if (!raw) {
    return undefined;
  }
  const countries = raw
    .map((c) => c.toUpperCase())
    .filter((c) => COUNTRY_SET.has(c));
  return countries.length ? countries : undefined;
}
