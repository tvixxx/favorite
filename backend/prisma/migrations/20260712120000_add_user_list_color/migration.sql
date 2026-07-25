-- Add optional cover color (HEX) for user lists
ALTER TABLE "user_lists" ADD COLUMN "color" TEXT DEFAULT '#FF0032';
