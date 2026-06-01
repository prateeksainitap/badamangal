-- add_source_column - write-provenance tag on Bhandara, Spot, Volunteer.
--
-- Why: the Expo mobile app now stamps every write it makes with
-- source="mobile" (see the app's src/lib/api.ts). The website forms send
-- nothing, so the API routes default them to "web". This column lets
-- /admin + analytics split app-sourced rows from web-sourced ones.
--
-- Additive + safe to run on production:
--   - New nullable column with a constant DEFAULT 'web'. On Postgres 11+
--     adding a column with a constant default is a fast, metadata-only
--     operation (no full-table rewrite, no long lock), so existing rows
--     are backfilled to 'web' instantly and the app keeps serving.
--   - No changes to existing columns, indexes, or constraints.
--   - Idempotent (IF NOT EXISTS) so re-running is a no-op.
--
-- Pairs with the Prisma schema change (source String? @default("web") on
-- Bhandara / Spot / Volunteer). The route handlers read body.source and
-- write 'mobile' or 'web' explicitly; this DEFAULT covers any direct
-- inserts that omit it.
--
-- Run via: Supabase Dashboard / Neon SQL Editor -> New query -> paste -> Run.

ALTER TABLE "Bhandara"  ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'web';
ALTER TABLE "Spot"      ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'web';
ALTER TABLE "Volunteer" ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'web';
