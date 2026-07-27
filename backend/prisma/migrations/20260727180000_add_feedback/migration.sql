-- Обращения из формы «Обратная связь» (/feedback)
CREATE TYPE "enum_feedback_type" AS ENUM ('IDEA', 'BUG', 'OTHER');
CREATE TYPE "enum_feedback_status" AS ENUM ('NEW', 'IN_PROGRESS', 'DONE');

CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "type" "enum_feedback_type" NOT NULL,
    "message" TEXT NOT NULL,
    "email" TEXT,
    "page_url" TEXT,
    "user_agent" TEXT,
    "viewport" TEXT,
    "status" "enum_feedback_status" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- Выборка в админке: свежие в рамках статуса
CREATE INDEX "feedback_status_created_at_idx" ON "feedback"("status", "created_at");
CREATE INDEX "feedback_user_id_idx" ON "feedback"("user_id");

-- Автора могли удалить — обращение остаётся с user_id = NULL
ALTER TABLE "feedback"
  ADD CONSTRAINT "feedback_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
