ALTER TYPE "enum_media_purpose" ADD VALUE 'FEEDBACK_SCREENSHOT';
ALTER TABLE "feedback" ADD COLUMN "screenshot_asset_id" TEXT;
CREATE UNIQUE INDEX "feedback_screenshot_asset_id_key" ON "feedback"("screenshot_asset_id");
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_screenshot_asset_id_fkey" FOREIGN KEY ("screenshot_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
