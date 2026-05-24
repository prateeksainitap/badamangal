-- Content Hub — pitches, templates, prompts, image tagging.
--
-- Adds /admin/content's three storage surfaces:
--   1. Content       — pitches / templates / strategy markdown
--   2. Prompt        — AI/LLM prompts with cached last-run output
--   3. GalleryPhoto.tags — re-use existing photos with channel tags
--                          (ig | wa | reddit | press | pamphlet | brand …)
--
-- All changes are ADDITIVE:
--   • Two new tables (no impact on existing reads/writes)
--   • One new nullable column on GalleryPhoto with default '{}'
--   • No data migrations, no destructive changes
--
-- Idempotent: uses IF NOT EXISTS so re-running is a no-op.
--
-- Run via: Supabase Dashboard → SQL Editor → New query → paste → Run.

-- ── GalleryPhoto.tags ─────────────────────────────────────────────
ALTER TABLE "GalleryPhoto"
  ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT '{}'::TEXT[];

CREATE INDEX IF NOT EXISTS "GalleryPhoto_tags_idx"
  ON "GalleryPhoto" USING GIN ("tags");

-- ── Content ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Content" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "kind"       TEXT NOT NULL DEFAULT 'PITCH',
  "audience"   TEXT NOT NULL DEFAULT 'OTHER',
  "channel"    TEXT NOT NULL DEFAULT 'OTHER',
  "language"   TEXT NOT NULL DEFAULT 'en',
  "title"      TEXT NOT NULL,
  "body"       TEXT NOT NULL,
  "summary"    TEXT,
  "tags"       TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  "source"     TEXT,
  "status"     TEXT NOT NULL DEFAULT 'ACTIVE',
  "lastEditor" TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Content_status_kind_idx"
  ON "Content" ("status", "kind");
CREATE INDEX IF NOT EXISTS "Content_kind_audience_channel_idx"
  ON "Content" ("kind", "audience", "channel");
CREATE INDEX IF NOT EXISTS "Content_updatedAt_idx"
  ON "Content" ("updatedAt");

-- ── Prompt ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Prompt" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "title"         TEXT NOT NULL,
  "body"          TEXT NOT NULL,
  "systemPrompt"  TEXT,
  "defaultModel"  TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  "tags"          TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  "lastRunAt"     TIMESTAMP(3),
  "lastRunModel"  TEXT,
  "lastRunOutput" TEXT,
  "lastRunVars"   TEXT,
  "status"        TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Prompt_status_updatedAt_idx"
  ON "Prompt" ("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "Prompt_tags_idx"
  ON "Prompt" USING GIN ("tags");
