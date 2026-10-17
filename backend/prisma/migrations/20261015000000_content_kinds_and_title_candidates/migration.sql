-- Старые карточки остаются с прежними ID и серийностью, категория не угадывается.
BEGIN;
CREATE TYPE "enum_content_kind" AS ENUM ('GENERAL', 'ANIME', 'ANIMATION', 'TV_SHOW');
ALTER TABLE "movies" ADD COLUMN "content_kind" "enum_content_kind";

-- Применять только вместе с новым сопоставлением импорта и проверкой совпадений.
CREATE INDEX "movies_title_normalized_idx" ON "movies"("title_normalized");
DROP INDEX "movies_title_normalized_key";
COMMIT;
