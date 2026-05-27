-- Content Hub — send-tracking columns.
--
-- Adds three columns to "Content" so the operator can track outbound
-- activity (which pitches were sent, to whom, when, and which are
-- still awaiting a reply). Powers the new Mission Strip on
-- /admin/content (Ready / Drafts / Sent 7d / Awaiting reply tiles)
-- and the per-card "Sent 3d ago to X" status pill.
--
-- All changes are ADDITIVE and idempotent:
--   • Three new nullable / defaulted columns
--   • Two new indexes
--   • No data migration, no destructive change
--
-- Run via: Supabase Dashboard → SQL Editor → New query → paste → Run.

ALTER TABLE "Content"
  ADD COLUMN IF NOT EXISTS "lastSentAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastSentTo"    TEXT,
  ADD COLUMN IF NOT EXISTS "awaitingReply" BOOLEAN NOT NULL DEFAULT false;

-- Plain B-tree on lastSentAt: drives the Mission Strip's "Sent 7d"
-- COUNT(*) WHERE lastSentAt > NOW() - INTERVAL '7 days'. A partial
-- index would be ideal (WHERE lastSentAt IS NOT NULL) but Prisma's
-- index DSL doesn't expose that yet; B-tree handles the count fine
-- and the row volume here (~50-200 Content rows) keeps the cost
-- trivial regardless.
CREATE INDEX IF NOT EXISTS "Content_lastSentAt_idx"
  ON "Content" ("lastSentAt");

-- Composite for the "Awaiting reply" tile + follow-up list ordering:
-- count rows where awaitingReply = true, then sort by lastSentAt desc
-- so the operator sees the oldest unanswered first.
CREATE INDEX IF NOT EXISTS "Content_awaitingReply_lastSentAt_idx"
  ON "Content" ("awaitingReply", "lastSentAt");
