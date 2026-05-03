-- Страна производства (ISO alpha-2) и несколько жанров; перенос данных из legacy genre.

ALTER TABLE "movies"
ADD COLUMN "production_country_code" VARCHAR(2) NOT NULL DEFAULT 'US';

ALTER TABLE "movies"
ADD COLUMN "genres" "enum_genre"[] NOT NULL DEFAULT ARRAY[]::"enum_genre"[];

UPDATE "movies"
SET "genres" = ARRAY["genre"]::"enum_genre"[]
WHERE "genre" IS NOT NULL;

ALTER TABLE "movies" DROP COLUMN "genre";

CREATE INDEX "movies_production_country_code_idx" ON "movies"("production_country_code");
