-- Manual migration: add the OrganiseRequest table for the
-- /organise-bhandara lead-capture flow (Wave 8).
--
-- Apply ONCE against the production DB (Neon / Supabase pooler) before
-- the Wave 8 commit hits prod. Local-dev DBs picked it up automatically
-- via `prisma db push` if you ran that with DIRECT_URL set; this file
-- exists so the production apply is explicit and auditable.
--
-- Idempotent on re-run: `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX
-- IF NOT EXISTS` won't blow up if the table already exists.

CREATE TABLE IF NOT EXISTS "OrganiseRequest" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  -- contact
  "name"           TEXT NOT NULL,
  "phone"          TEXT NOT NULL,
  "email"          TEXT,
  -- event
  "area"           TEXT,
  "addressNotes"   TEXT,
  "eventDates"     TEXT, -- JSON string[] of ISO YYYY-MM-DD dates, e.g. '["2026-05-19","2026-05-26"]'
  "eventTime"      TEXT, -- HH:MM
  -- size
  "quantityType"   TEXT NOT NULL, -- "PLATES" | "WHEAT_KG"
  "quantityValue"  INTEGER NOT NULL,
  "packageTier"    TEXT NOT NULL, -- "SMALL" | "MEDIUM" | "LARGE" | "CUSTOM"
  -- misc
  "notes"          TEXT,
  -- moderation
  "status"         TEXT NOT NULL DEFAULT 'NEW',
  -- attribution
  "source"         TEXT,
  -- metadata
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipHash"         TEXT NOT NULL,
  "userAgent"      TEXT
);

CREATE INDEX IF NOT EXISTS "OrganiseRequest_status_createdAt_idx"
  ON "OrganiseRequest" ("status", "createdAt");
