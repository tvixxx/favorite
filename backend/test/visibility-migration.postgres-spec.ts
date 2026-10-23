import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { featuresDatabase } from './features-database';

it('добавляет включённую видимость существующему аккаунту, не меняя его данные и прежние настройки', async () => {
  const db = await featuresDatabase();
  try {
    const before = await db.prisma.user.create({
      data: {
        email: 'visibility-upgrade@example.test',
        fullName: 'Проверка обновления',
        password: 'unused-test-hash',
        quickAddEnabled: false,
        notifyNewMessages: false,
      },
    });
    // Только в принадлежащей тесту случайной БД воспроизводим схему до миграции.
    await db.pool.query(`ALTER TABLE "users"
      DROP COLUMN "show_achievements", DROP COLUMN "show_detailed_analytics",
      DROP COLUMN "show_community_tops", DROP COLUMN "show_actors_section"`);
    await db.pool.query(
      await readFile(
        join(
          __dirname,
          '../prisma/migrations/20261023130000_visibility_preferences/migration.sql',
        ),
        'utf8',
      ),
    );
    const after = await db.prisma.user.findUnique({ where: { id: before.id } });
    expect(after).toEqual(before);
    expect(after).toMatchObject({
      quickAddEnabled: false,
      notifyNewMessages: false,
      showAchievements: true,
      showDetailedAnalytics: true,
      showCommunityTops: true,
      showActorsSection: true,
    });
  } finally {
    await db.close();
  }
});
