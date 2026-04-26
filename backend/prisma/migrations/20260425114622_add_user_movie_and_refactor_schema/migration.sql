/*
  Warnings:

  - You are about to drop the column `date` on the `movies` table. All the data in the column will be lost.
  - You are about to drop the column `favorite_id` on the `movies` table. All the data in the column will be lost.
  - You are about to drop the column `is_favorite` on the `movies` table. All the data in the column will be lost.
  - You are about to drop the column `rate` on the `movies` table. All the data in the column will be lost.
  - Added the required column `user_id` to the `reviews` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "enum_watch_status" AS ENUM ('NOT_STARTED', 'WATCHING', 'COMPLETED', 'DROPPED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- AlterTable
ALTER TABLE "movies"
  DROP COLUMN IF EXISTS "date",
  DROP COLUMN IF EXISTS "favorite_id",
  DROP COLUMN IF EXISTS "is_favorite",
  DROP COLUMN IF EXISTS "rate",
  ADD COLUMN IF NOT EXISTS "episode_count" INTEGER,
  ADD COLUMN IF NOT EXISTS "is_serial" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "season_count" INTEGER;

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "user_id" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_movies" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "movie_id" TEXT NOT NULL,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "see_later" BOOLEAN NOT NULL DEFAULT false,
    "personal_rate" INTEGER,
    "watch_status" "enum_watch_status" NOT NULL DEFAULT 'NOT_STARTED',
    "current_season" INTEGER,
    "current_episode" INTEGER,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_watched_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_movies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_movies_user_id_idx" ON "user_movies"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_movies_movie_id_idx" ON "user_movies"("movie_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_movies_is_favorite_idx" ON "user_movies"("is_favorite");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_movies_see_later_idx" ON "user_movies"("see_later");

-- CreateIndex
DO $$
BEGIN
  CREATE UNIQUE INDEX "user_movies_user_id_movie_id_key" ON "user_movies"("user_id", "movie_id");
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END
$$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "reviews_user_id_idx" ON "reviews"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "reviews_movie_id_idx" ON "reviews"("movie_id");

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "reviews"
    ADD CONSTRAINT "reviews_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "user_movies"
    ADD CONSTRAINT "user_movies_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "user_movies"
    ADD CONSTRAINT "user_movies_movie_id_fkey"
    FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
