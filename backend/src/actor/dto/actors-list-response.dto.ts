import type { Actor } from '../../generated/prisma/client';

export interface ActorsListResponseDto {
  items: Actor[];
  total: number;
  limit: number;
  offset: number;
}
