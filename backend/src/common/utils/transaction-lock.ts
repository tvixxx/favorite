import type { Prisma } from '../../generated/prisma/client';

/** Блокировка конкретного ресурса до завершения транзакции PostgreSQL. */
export async function lockResource(
  tx: Prisma.TransactionClient,
  key: string,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}
