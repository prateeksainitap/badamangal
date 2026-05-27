-- Volunteer programme tables (Tier A - minimal, no OTP).
--
-- See schema.prisma → Volunteer / VolunteerSubmission for the design
-- rationale. Idempotent: safe to re-run if Supabase's SQL editor
-- times out partway through.
--
-- Run via: Supabase Dashboard → SQL Editor → New query →
--          paste this whole file → Run.
--
-- Order matters - VolunteerSubmission FKs to Volunteer, so create
-- Volunteer first.

-- ─── 1. Volunteer ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Volunteer" (
  "id"          TEXT          NOT NULL PRIMARY KEY,
  "code"        TEXT          NOT NULL UNIQUE,
  "name"        TEXT          NOT NULL,
  "phone"       TEXT          NOT NULL,
  "upi"         TEXT          NOT NULL,
  "areas"       TEXT          NOT NULL DEFAULT '[]',
  "status"      TEXT          NOT NULL DEFAULT 'PROBATIONARY',
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notifiedAt"  TIMESTAMP(3),
  "ipHash"      TEXT          NOT NULL,
  "userAgent"   TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS "Volunteer_code_unique"
  ON "Volunteer"("code");

CREATE INDEX IF NOT EXISTS "Volunteer_status_createdAt_idx"
  ON "Volunteer"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "Volunteer_notifiedAt_idx"
  ON "Volunteer"("notifiedAt");

-- ─── 2. VolunteerSubmission ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "VolunteerSubmission" (
  "id"                  TEXT          NOT NULL PRIMARY KEY,
  "volunteerId"         TEXT          NOT NULL,
  "volunteerCode"       TEXT          NOT NULL,
  -- bhandara info
  "bhandaraName"        TEXT          NOT NULL,
  "area"                TEXT          NOT NULL,
  "address"             TEXT          NOT NULL,
  "organizerName"       TEXT,
  "organizerPhone"      TEXT,
  "startTime"           TEXT,
  "menu"                TEXT,
  -- proof
  "photoUrls"           TEXT          NOT NULL DEFAULT '[]',
  "videoUrls"           TEXT          NOT NULL DEFAULT '[]',
  "spotPhotoUrl"        TEXT,
  -- location
  "gpsLat"              DOUBLE PRECISION,
  "gpsLng"              DOUBLE PRECISION,
  "mapsUrl"             TEXT,
  -- moderation
  "status"              TEXT          NOT NULL DEFAULT 'NEW',
  "payoutAmount"        INTEGER       NOT NULL DEFAULT 0,
  "adminNotes"          TEXT,
  "reviewedAt"          TIMESTAMP(3),
  "paidAt"              TIMESTAMP(3),
  "paymentRef"          TEXT,
  -- cross-links
  "resultingBhandaraId" TEXT,
  "resultingSpotId"     TEXT,
  -- metadata
  "volunteerNotes"      TEXT,
  "createdAt"           TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userAgent"           TEXT,
  "ipHash"              TEXT,

  CONSTRAINT "VolunteerSubmission_volunteer_fk"
    FOREIGN KEY ("volunteerId") REFERENCES "Volunteer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "VolunteerSubmission_volunteerId_createdAt_idx"
  ON "VolunteerSubmission"("volunteerId", "createdAt");

CREATE INDEX IF NOT EXISTS "VolunteerSubmission_status_createdAt_idx"
  ON "VolunteerSubmission"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "VolunteerSubmission_volunteerCode_createdAt_idx"
  ON "VolunteerSubmission"("volunteerCode", "createdAt");
