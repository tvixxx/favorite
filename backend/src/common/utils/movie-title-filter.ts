import type { Prisma } from '../../generated/prisma/client';
import { normalizeMovieTitle } from './normalize-movie-title';

export function movieTitleFilter(query: string): Prisma.MovieWhereInput {
  const contains = { contains: query.trim(), mode: 'insensitive' as const };
  return {
    OR: [
      { title: contains },
      { titleEn: contains },
      { originalTitle: contains },
      { titleAliases: { has: normalizeMovieTitle(query) } },
    ],
  };
}
