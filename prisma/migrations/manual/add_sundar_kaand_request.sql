-- Manual migration: add the SundarKaandRequest table for the
-- /organise/sundar-kaand "Organise a Sundar Kaand / Hanuman puja"
-- lead-capture flow.
--
-- Apply ONCE against the production DB (Supabase pooler) before the
-- commit hits prod. The build only runs `prisma generate`, so the
-- client type is fixed by the schema, but this table must exist for
-- the API to write at runtime. The public surface is date-gated to go
-- live after 23 Jun 2026 (see src/lib/sundarKaand.ts), so there is no
-- rush, but creating it now keeps prod ready and clean.
--
-- Idempotent on re-run: CREATE TABLE / INDEX IF NOT EXISTS won't blow
-- up if the table already exists.

CREATE TABLE IF NOT EXISTS "SundarKaandRequest" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  -- contact
  "name"           TEXT NOT NULL,
  "phone"          TEXT NOT NULL,
  "email"          TEXT,
  -- event
  "eventType"      TEXT NOT NULL DEFAULT 'SUNDAR_KAAND', -- SUNDAR_KAAND | HANUMAN_PUJA | BOTH
  "area"           TEXT,
  "addressNotes"   TEXT,
  "preferredDates" TEXT NOT NULL DEFAULT '[]', -- JSON string[] of ISO YYYY-MM-DD dates
  "preferredTime"  TEXT,
  "audienceSize"   INTEGER,
  "servicesNeeded" TEXT NOT NULL DEFAULT '[]', -- JSON string[] of service codes
  -- misc
  "notes"          TEXT,
  -- moderation
  "status"         TEXT NOT NULL DEFAULT 'NEW', -- NEW | CONTACTED | CONFIRMED | COMPLETED | REJECTED
  -- metadata
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipHash"         TEXT NOT NULL,
  "userAgent"      TEXT
);

CREATE INDEX IF NOT EXISTS "SundarKaandRequest_status_createdAt_idx"
  ON "SundarKaandRequest" ("status", "createdAt");
