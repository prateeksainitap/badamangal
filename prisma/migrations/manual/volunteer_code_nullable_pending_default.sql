-- Volunteer programme: switch to admin-approval model.
--
-- BEFORE: signup auto-generated a code, status defaulted to PROBATIONARY,
--   user could submit immediately.
-- AFTER:  signup creates a PENDING row with no code; admin must
--   explicitly approve via /admin/volunteers, which generates the
--   code + flips status to PROBATIONARY + opens a wa.me link to
--   deliver the code to the volunteer's WhatsApp.
--
-- This requires:
--   1. Volunteer.code becomes nullable (was NOT NULL UNIQUE)
--   2. Volunteer.status default flips from PROBATIONARY to PENDING
--
-- Postgres allows multiple NULL values in a UNIQUE column, so the
-- existing unique constraint on `code` keeps working - it just gates
-- issued codes, not the placeholder NULL for unapproved rows.
--
-- Existing rows are NOT migrated (they already have codes + status).
-- Only new signups land as PENDING with code=null.
--
-- Run via: Supabase Dashboard → SQL Editor → New query → paste → Run.

ALTER TABLE "Volunteer" ALTER COLUMN "code" DROP NOT NULL;
ALTER TABLE "Volunteer" ALTER COLUMN "status" SET DEFAULT 'PENDING';
