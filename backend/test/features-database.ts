import { randomBytes } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client, Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { setTimeout as delay } from 'node:timers/promises';

export async function featuresDatabase(): Promise<{
  prisma: PrismaClient;
  pool: Pool;
  queryDurations: number[];
  close: () => Promise<void>;
}> {
  const connectionString =
    'postgresql://features_qa:features-qa-local-only@127.0.0.1:55441/features_qa';
  const control = new Client({
    connectionString,
    connectionTimeoutMillis: 5000,
  });
  const database = `features_qa_${randomBytes(8).toString('hex')}`;
  let created = false;
  let prisma: PrismaClient | undefined;
  let pool: Pool | undefined;
  const queryDurations: number[] = [];
  const close = async (): Promise<void> => {
    await prisma?.$disconnect();
    await pool?.end();
    try {
      if (created) {
        // pg-pool удаляет клиента из списка раньше завершения его TCP-соединения.
        for (let attempt = 0; attempt < 250; attempt++) {
          const result = await control.query<{ count: number }>(
            'SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = $1',
            [database],
          );
          if (!result.rows[0].count) break;
          if (attempt === 249)
            throw new Error('Соединения QA-БД не завершились перед очисткой');
          await delay(20);
        }
        await control.query(`DROP DATABASE "${database}"`);
        created = false;
      }
    } finally {
      await control.end();
    }
  };
  try {
    await control.connect();
    const { rows } = await control.query<{ name: string; version: number }>(
      "SELECT current_database() AS name, current_setting('server_version_num')::int AS version",
    );
    if (
      rows[0].name !== 'features_qa' ||
      Math.floor(rows[0].version / 10000) !== 18
    )
      throw new Error('Нужна отдельная features_qa PostgreSQL 18');
    await control.query(`CREATE DATABASE "${database}"`);
    created = true;
    const url = connectionString.replace(/\/features_qa$/, `/${database}`);
    const migration = new Client({
      connectionString: url,
      connectionTimeoutMillis: 5000,
    });
    try {
      await migration.connect();
      const directory = join(__dirname, '../prisma/migrations');
      const folders = (await readdir(directory, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
      for (const folder of folders)
        await migration.query(
          await readFile(join(directory, folder, 'migration.sql'), 'utf8'),
        );
    } finally {
      await migration.end();
    }
    pool = new Pool({
      connectionString: url,
      connectionTimeoutMillis: 5000,
      max: 10,
    });
    const client = new PrismaClient({
      adapter: new PrismaPg(pool),
      log: [{ emit: 'event', level: 'query' }],
    });
    client.$on('query', (event) => queryDurations.push(event.duration));
    prisma = client;
    await prisma.$connect();
    return { prisma, pool, queryDurations, close };
  } catch (error) {
    await close();
    throw error;
  }
}
