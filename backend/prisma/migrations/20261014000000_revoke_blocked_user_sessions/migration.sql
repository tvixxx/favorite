ALTER TABLE "users" ADD COLUMN "auth_version" INTEGER NOT NULL DEFAULT 0;

-- Уже заблокированные аккаунты тоже должны пройти новый вход после разблокировки.
UPDATE "users" SET "auth_version" = 1 WHERE "blocked_at" IS NOT NULL;
