CREATE TABLE "watch_entries" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "movie_id" TEXT,
  "request_id" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "viewed_on" DATE NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'TITLE',
  "season" INTEGER,
  "is_rewatch" BOOLEAN NOT NULL DEFAULT false,
  "rating" INTEGER,
  "note" TEXT NOT NULL DEFAULT '',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "watch_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "watch_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "watch_entries_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "watch_entries_active_movie_check" CHECK ("deleted_at" IS NOT NULL OR "movie_id" IS NOT NULL),
  CONSTRAINT "watch_entries_scope_check" CHECK (("scope" = 'TITLE' AND "season" IS NULL) OR ("scope" = 'SEASON' AND "season" IS NOT NULL AND "season" BETWEEN 1 AND 100)),
  CONSTRAINT "watch_entries_rating_check" CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 10),
  CONSTRAINT "watch_entries_note_check" CHECK (char_length("note") <= 500),
  CONSTRAINT "watch_entries_revision_check" CHECK ("revision" >= 1)
);
CREATE UNIQUE INDEX "watch_entries_user_id_request_id_key" ON "watch_entries"("user_id", "request_id");
CREATE INDEX "watch_entries_user_id_deleted_at_viewed_on_created_at_id_idx" ON "watch_entries"("user_id", "deleted_at", "viewed_on", "created_at", "id");
CREATE INDEX "watch_entries_user_id_movie_id_deleted_at_viewed_on_idx" ON "watch_entries"("user_id", "movie_id", "deleted_at", "viewed_on");
CREATE INDEX "watch_entries_movie_id_idx" ON "watch_entries"("movie_id");
