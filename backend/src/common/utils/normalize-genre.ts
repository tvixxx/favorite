import { Genre } from '../../generated/prisma/enums';

/** Принимаем также название PostgreSQL enum, сохраняя контракт API Sci_fi. */
export function normalizeGenre(value: unknown): unknown {
  return value === 'Sci-fi' ? Genre.Sci_fi : value;
}
