-- Multi-city expansion (Kanpur, Hardoi, Barabanki) 2026-07.
-- Purely additive + defaulted, so it is safe to run against the live DB:
-- every pre-existing row genuinely IS Lucknow, which is exactly what the
-- default backfills. Reversible with DROP COLUMN.
ALTER TABLE "Bhandara"        ADD COLUMN IF NOT EXISTS "city" TEXT NOT NULL DEFAULT 'lucknow';
ALTER TABLE "Spot"            ADD COLUMN IF NOT EXISTS "city" TEXT NOT NULL DEFAULT 'lucknow';
ALTER TABLE "BhandaraMention" ADD COLUMN IF NOT EXISTS "city" TEXT NOT NULL DEFAULT 'lucknow';

CREATE INDEX IF NOT EXISTS "Bhandara_city_status_idx"
  ON "Bhandara" ("city", "status");
CREATE INDEX IF NOT EXISTS "Spot_city_status_expiresAt_idx"
  ON "Spot" ("city", "status", "expiresAt");
CREATE INDEX IF NOT EXISTS "BhandaraMention_city_status_expiresAt_idx"
  ON "BhandaraMention" ("city", "status", "expiresAt");
