import { ForbiddenException } from '@nestjs/common';

export function requireOwner(userId: string, user: { id: string }): string {
  if (userId !== user.id) throw new ForbiddenException();
  return user.id;
}
