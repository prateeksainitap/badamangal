-- BotIngestionLog — audit row for every /api/bot/ingest attempt.
--
-- Additive only: new table, no changes to existing models. Safe to
-- run on production; the bot endpoint writes to this table from the
-- next deploy onward. Empty rows mean "either no ingests have run
-- since deploy, or the endpoint isn't writing" — both diagnosable
-- from the row count.
--
-- Idempotent (IF NOT EXISTS) so re-running is a no-op.
--
-- Run via: Supabase Dashboard → SQL Editor → New query → paste → Run.

CREATE TABLE IF NOT EXISTS "BotIngestionLog" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "senderName"    TEXT,
  "msgId"         TEXT,
  "groupName"     TEXT,
  "outcome"       TEXT NOT NULL,
  "resultRowId"   TEXT,
  "resultRowKind" TEXT,
  "reason"        TEXT,
  "imageHash"     TEXT,
  "extractedName" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "BotIngestionLog_outcome_createdAt_idx"
  ON "BotIngestionLog" ("outcome", "createdAt");
CREATE INDEX IF NOT EXISTS "BotIngestionLog_msgId_idx"
  ON "BotIngestionLog" ("msgId");
CREATE INDEX IF NOT EXISTS "BotIngestionLog_imageHash_idx"
  ON "BotIngestionLog" ("imageHash");
CREATE INDEX IF NOT EXISTS "BotIngestionLog_createdAt_idx"
  ON "BotIngestionLog" ("createdAt");
