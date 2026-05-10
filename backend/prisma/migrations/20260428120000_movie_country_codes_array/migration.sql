-- Несколько стран производства: массив кодов; перенос из одной колонки production_country_code.

ALTER TABLE "movies" ADD COLUMN "country_codes" VARCHAR(2)[];

UPDATE "movies"
SET "country_codes" = ARRAY["production_country_code"]::VARCHAR(2)[];

ALTER TABLE "movies"
ALTER COLUMN "country_codes" SET NOT NULL;

ALTER TABLE "movies"
ALTER COLUMN "country_codes" SET DEFAULT ARRAY['US']::VARCHAR(2)[];

ALTER TABLE "movies" DROP COLUMN "production_country_code";

DROP INDEX IF EXISTS "movies_production_country_code_idx";

CREATE INDEX "movies_country_codes_idx" ON "movies" USING GIN ("country_codes");
