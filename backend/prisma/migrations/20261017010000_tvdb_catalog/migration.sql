ALTER TABLE "movies"
  ADD COLUMN "title_en" TEXT,
  ADD COLUMN "original_title" TEXT,
  ADD COLUMN "title_aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "description_language" TEXT NOT NULL DEFAULT 'ru',
  ADD COLUMN "tvdb_id" INTEGER,
  ADD COLUMN "tvdb_type" TEXT;
ALTER TABLE "movies" ADD CONSTRAINT "movies_tvdb_identity_check" CHECK (
  ("tvdb_id" IS NULL AND "tvdb_type" IS NULL) OR
  ("tvdb_id" IS NOT NULL AND "tvdb_id" > 0 AND "tvdb_type" IS NOT NULL AND "tvdb_type" IN ('movie', 'series'))
);
ALTER TABLE "movies" ADD CONSTRAINT "movies_description_language_check" CHECK ("description_language" IN ('ru', 'en'));
CREATE UNIQUE INDEX "movies_tvdb_type_tvdb_id_key" ON "movies"("tvdb_type", "tvdb_id");
ALTER TABLE "actors" ADD COLUMN "tvdb_id" INTEGER;
ALTER TABLE "actors" ADD CONSTRAINT "actors_tvdb_id_check" CHECK ("tvdb_id" IS NULL OR "tvdb_id" > 0);
CREATE UNIQUE INDEX "actors_tvdb_id_key" ON "actors"("tvdb_id");
