-- CreateTable
CREATE TABLE "user_lists" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "name_normalized" TEXT NOT NULL,
  "description" TEXT,
  "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_list_items" (
  "id" TEXT NOT NULL,
  "list_id" TEXT NOT NULL,
  "movie_id" TEXT NOT NULL,
  "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_lists_user_id_name_normalized_key"
ON "user_lists"("user_id", "name_normalized");

-- CreateIndex
CREATE INDEX "user_lists_user_id_idx" ON "user_lists"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_list_items_list_id_movie_id_key"
ON "user_list_items"("list_id", "movie_id");

-- CreateIndex
CREATE INDEX "user_list_items_list_id_idx" ON "user_list_items"("list_id");

-- CreateIndex
CREATE INDEX "user_list_items_movie_id_idx" ON "user_list_items"("movie_id");

-- AddForeignKey
ALTER TABLE "user_lists"
ADD CONSTRAINT "user_lists_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_list_items"
ADD CONSTRAINT "user_list_items_list_id_fkey"
FOREIGN KEY ("list_id") REFERENCES "user_lists"("id")
ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_list_items"
ADD CONSTRAINT "user_list_items_movie_id_fkey"
FOREIGN KEY ("movie_id") REFERENCES "movies"("id")
ON DELETE CASCADE ON UPDATE NO ACTION;
