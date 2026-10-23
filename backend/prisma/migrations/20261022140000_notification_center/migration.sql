ALTER TABLE "notifications" ADD COLUMN "actor_id" TEXT, ADD COLUMN "actor_name" TEXT;
UPDATE "notifications" SET
  "actor_id" = COALESCE(payload->>'senderId', payload->>'requesterId', payload->>'friendId'),
  "actor_name" = COALESCE(payload->>'senderName', payload->>'requesterName', payload->>'friendName');
CREATE INDEX "notifications_user_id_actor_id_created_at_idx" ON "notifications"("user_id", "actor_id", "created_at" DESC);

CREATE TABLE "announcements" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "release_id" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "category" TEXT NOT NULL CHECK ("category" IN ('NEWS', 'SERVICE', 'RELEASE')),
  "actions" JSONB NOT NULL DEFAULT '[]',
  "published_at" TIMESTAMP(3),
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "announcements_release_id_key" ON "announcements"("release_id");
CREATE INDEX "announcements_published_at_idx" ON "announcements"("published_at" DESC);
CREATE TABLE "announcement_reads" (
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "announcement_id" TEXT NOT NULL REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("user_id", "announcement_id")
);
