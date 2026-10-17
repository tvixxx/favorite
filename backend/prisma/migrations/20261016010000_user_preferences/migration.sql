ALTER TABLE "users"
  ADD COLUMN "quick_add_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "watch_tonight_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "collection_files_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "notify_new_messages" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notify_friend_requests" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notify_recommendations" BOOLEAN NOT NULL DEFAULT false;
