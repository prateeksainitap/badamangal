-- Bhandara.upiQrUrl — uploaded UPI QR image companion to upiId.
--
-- Additive only: a new nullable column on the existing Bhandara
-- table. No data is touched, no existing query can break. The
-- public-page render falls back to upiId-generated QR when this
-- column is null, so rows created before this migration ran are
-- handled by the upiId path unchanged.
--
-- Idempotent: IF NOT EXISTS makes re-running safe.
--
-- Run via: Supabase Dashboard → SQL Editor → New query → paste → Run.

ALTER TABLE "Bhandara"
  ADD COLUMN IF NOT EXISTS "upiQrUrl" TEXT;
