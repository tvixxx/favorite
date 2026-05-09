-- CreateEnum
CREATE TYPE "enum_user_role" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "role" "enum_user_role" NOT NULL DEFAULT 'USER';
