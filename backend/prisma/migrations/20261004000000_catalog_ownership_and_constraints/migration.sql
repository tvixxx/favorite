BEGIN;

-- Старые записи остаются общими. Авторы из личных коллекций не выводятся.
ALTER TABLE "movies" ADD COLUMN "created_by_id" TEXT;
ALTER TABLE "actors" ADD COLUMN "created_by_id" TEXT;
ALTER TABLE "movies" ADD CONSTRAINT "movies_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "actors" ADD CONSTRAINT "actors_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- При дубликатах прерываем миграцию без удаления пользовательских данных.
DO $$
BEGIN
  IF EXISTS (
    SELECT lower(trim(regexp_replace("title", '\s+', ' ', 'g')))
    FROM "movies"
    GROUP BY lower(trim(regexp_replace("title", '\s+', ' ', 'g')))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate normalized movie titles. Review duplicates before applying this migration.';
  END IF;
END $$;

UPDATE "movies" SET "title_normalized" = lower(trim(regexp_replace("title", '\s+', ' ', 'g')));
CREATE UNIQUE INDEX "movies_title_normalized_key" ON "movies"("title_normalized");
DROP INDEX IF EXISTS "movies_title_normalized_idx";

-- Дружба и подписка являются разными отношениями, взаимные подписки допустимы.
CREATE UNIQUE INDEX "friendships_requester_id_addressee_id_type_key"
  ON "friendships"("requester_id", "addressee_id", "type");
DROP INDEX "friendships_requester_id_addressee_id_key";

COMMIT;
