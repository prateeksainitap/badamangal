-- DonationIntent - audit row per "Sponsor this bhandara" tap.
--
-- We don't see the actual UPI transaction (bank ↔ bank), only the
-- intent: the donor opened the UPI app via our deep-link. This table
-- captures who tapped, for which bhandara, with what amount, and
-- (optionally) the donor's name / phone / email / message.
--
-- Foreign key on bhandaraId with ON DELETE CASCADE so a deleted
-- bhandara cleans up its intent rows. unique-indexed razorpayPaymentId
-- so a duplicate webhook callback can't double-create rows when the
-- Phase 2 PG integration ships.
--
-- Additive only - no existing column or table is touched. Idempotent
-- via IF NOT EXISTS so re-running is safe.
--
-- Run via: Supabase Dashboard → SQL Editor → New query → paste → Run.

CREATE TABLE IF NOT EXISTS "DonationIntent" (
  "id"                  TEXT PRIMARY KEY,
  "bhandaraId"          TEXT NOT NULL REFERENCES "Bhandara"("id") ON DELETE CASCADE,
  "amount"              INTEGER NOT NULL,
  "recipientType"       TEXT NOT NULL,
  "recipientUpiId"      TEXT NOT NULL,
  "recipientName"       TEXT,
  "donorName"           TEXT,
  "donorPhone"          TEXT,
  "donorEmail"          TEXT,
  "donorMessage"        TEXT,
  "ipHash"              TEXT,
  "userAgent"           TEXT,
  "status"              TEXT NOT NULL DEFAULT 'CLICKED',
  "donorConfirmedAt"    TIMESTAMP(3),
  "organiserConfirmedAt" TIMESTAMP(3),
  "razorpayPaymentId"   TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "DonationIntent_razorpayPaymentId_key"
  ON "DonationIntent"("razorpayPaymentId")
  WHERE "razorpayPaymentId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "DonationIntent_bhandaraId_createdAt_idx"
  ON "DonationIntent"("bhandaraId", "createdAt");

CREATE INDEX IF NOT EXISTS "DonationIntent_status_createdAt_idx"
  ON "DonationIntent"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "DonationIntent_createdAt_idx"
  ON "DonationIntent"("createdAt");
