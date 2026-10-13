BEGIN;

-- CreateEnum
CREATE TYPE "enum_media_purpose" AS ENUM ('MOVIE_POSTER', 'USER_AVATAR', 'ACTOR_PHOTO');

-- CreateEnum
CREATE TYPE "enum_media_status" AS ENUM ('PROCESSING', 'READY', 'FAILED', 'DELETING');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_asset_id" TEXT,
ADD COLUMN     "avatar_thumbnail_url" TEXT,
ADD COLUMN     "avatar_url" TEXT;

-- AlterTable
ALTER TABLE "movie_posters" ADD COLUMN     "asset_id" TEXT,
ADD COLUMN     "thumbnail_url" TEXT;

-- AlterTable
ALTER TABLE "actors" ADD COLUMN     "image_asset_id" TEXT,
ADD COLUMN     "image_thumbnail_url" TEXT,
ADD COLUMN     "image_url" TEXT;

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT,
    "purpose" "enum_media_purpose" NOT NULL,
    "status" "enum_media_status" NOT NULL DEFAULT 'PROCESSING',
    "main_key" TEXT NOT NULL DEFAULT '',
    "thumbnail_key" TEXT NOT NULL DEFAULT '',
    "mime_type" TEXT NOT NULL DEFAULT 'image/webp',
    "byte_size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 0,
    "height" INTEGER NOT NULL DEFAULT 0,
    "claimed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_assets_owner_id_created_at_idx" ON "media_assets"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "media_assets_status_expires_at_idx" ON "media_assets"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_avatar_asset_id_key" ON "users"("avatar_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "movie_posters_asset_id_key" ON "movie_posters"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "actors_image_asset_id_key" ON "actors"("image_asset_id");

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_asset_id_fkey" FOREIGN KEY ("avatar_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movie_posters" ADD CONSTRAINT "movie_posters_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actors" ADD CONSTRAINT "actors_image_asset_id_fkey" FOREIGN KEY ("image_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
