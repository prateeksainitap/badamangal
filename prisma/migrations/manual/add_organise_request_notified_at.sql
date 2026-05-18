-- Adds the OrganiseRequest.notifiedAt column + supporting index for
-- the WhatsApp-team-alert flow. The bot polls
-- /api/bot/organise-requests/pending which filters
-- WHERE "notifiedAt" IS NULL, sends WA messages to BM Ingest 2,
-- then POSTs back to mark-notified which sets this column to NOW.
--
-- Idempotent — safe to re-run if Supabase's SQL editor times out
-- partway through.
--
-- Run via: Supabase Dashboard → SQL Editor → New query →
--          paste this whole file → Run.

ALTER TABLE "OrganiseRequest"
  ADD COLUMN IF NOT EXISTS "notifiedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "OrganiseRequest_notifiedAt_idx"
  ON "OrganiseRequest"("notifiedAt");
