-- Шаг 1: колонка с временным DEFAULT — без этого PostgreSQL не добавит NOT NULL к строкам с данными.
ALTER TABLE "movies" ADD COLUMN "title_normalized" TEXT NOT NULL DEFAULT '';

-- Шаг 2: заполнить из title (та же логика, что normalizeMovieTitle в приложении).
UPDATE "movies"
SET "title_normalized" = lower(regexp_replace(trim(title), '\s+', ' ', 'g'));

-- Шаг 3: убрать дефолт у колонки (новые строки задают title_normalized из кода).
ALTER TABLE "movies" ALTER COLUMN "title_normalized" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "movies_title_normalized_idx" ON "movies"("title_normalized");
