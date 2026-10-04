import { ForbiddenException } from '@nestjs/common';
import type { User } from '../../generated/prisma/client';

export type CatalogUser = Pick<User, 'id' | 'role'>;

export function assertCatalogOwner(
  createdById: string | null | undefined,
  user: CatalogUser,
): void {
  if (user.role !== 'ADMIN' && createdById !== user.id) {
    throw new ForbiddenException(
      'Менять запись может только её автор или администратор',
    );
  }
}
