-- Existing duplicate reviews require an explicit data decision before migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "reviews"
    GROUP BY "user_id", "movie_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate reviews exist. Resolve them explicitly before applying the one-review constraint.';
  END IF;
END $$;

CREATE UNIQUE INDEX "reviews_user_id_movie_id_key" ON "reviews"("user_id", "movie_id");
