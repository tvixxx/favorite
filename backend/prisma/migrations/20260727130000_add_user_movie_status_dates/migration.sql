-- Даты смены статуса просмотра: нужны чипам «Начал / Досмотрел / Бросил»
-- на детальной странице (completed_at уже существовал).
ALTER TABLE "user_movies" ADD COLUMN "started_at" TIMESTAMP(3);
ALTER TABLE "user_movies" ADD COLUMN "dropped_at" TIMESTAMP(3);

-- Бэкфилл существующих записей: без него у уже начатых тайтлов чипов не будет.
-- «Начал» — для всех, кто уже смотрит, досмотрел или бросил.
UPDATE "user_movies"
SET "started_at" = COALESCE("last_watched_at", "added_at")
WHERE "started_at" IS NULL
  AND "watch_status" IN ('WATCHING', 'COMPLETED', 'DROPPED');

-- «Бросил» — по последней активности, если она известна.
UPDATE "user_movies"
SET "dropped_at" = "last_watched_at"
WHERE "dropped_at" IS NULL
  AND "watch_status" = 'DROPPED'
  AND "last_watched_at" IS NOT NULL;
