ALTER TABLE "users"
  ADD COLUMN "show_achievements" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "show_detailed_analytics" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "show_community_tops" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "show_actors_section" BOOLEAN NOT NULL DEFAULT true;
