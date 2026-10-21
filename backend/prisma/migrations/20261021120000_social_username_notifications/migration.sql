ALTER TABLE "users" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
ALTER TYPE "enum_notification_type" ADD VALUE 'FRIEND_REJECTED';
