ALTER TABLE "users" ADD COLUMN "blocked_at" TIMESTAMP(3), ADD COLUMN "blocked_reason" TEXT;
ALTER TABLE "reviews" ADD COLUMN "hidden_at" TIMESTAMP(3), ADD COLUMN "moderation_reason" TEXT;

CREATE TABLE "review_reports" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "review_id" TEXT NOT NULL REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "reporter_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "reason" TEXT NOT NULL,
  "comment" TEXT,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "review_reports_review_id_reporter_id_key" ON "review_reports"("review_id", "reporter_id");
CREATE INDEX "review_reports_resolved_at_created_at_idx" ON "review_reports"("resolved_at", "created_at");

CREATE TABLE "admin_audit_log" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actor_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "action" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "admin_audit_log_target_id_created_at_idx" ON "admin_audit_log"("target_id", "created_at");

CREATE TABLE "usage_events" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "feature" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "usage_events_feature_occurred_at_idx" ON "usage_events"("feature", "occurred_at");
CREATE INDEX "usage_events_user_id_occurred_at_idx" ON "usage_events"("user_id", "occurred_at");
CREATE INDEX "usage_events_occurred_at_idx" ON "usage_events"("occurred_at");
