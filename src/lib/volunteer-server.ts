/**
 * Server-only helpers for the volunteer programme.
 *
 * Lives in a separate file from src/lib/volunteer.ts because this
 * module pulls in `node:crypto` (for crypto-secure random sampling
 * in generateVolunteerCode). The shared helpers in volunteer.ts
 * are imported by both server actions AND client components
 * (VolunteerSubmitForm, VolunteerSignupForm). Bundling node:crypto
 * into the client build fails with:
 *
 *   UnhandledSchemeError: Reading from "node:crypto" is not handled
 *   by plugins (Unhandled scheme).
 *
 * Splitting the server-only piece out keeps the import graph
 * client-safe + keeps the dev-server build error from recurring.
 *
 * Anything in this file MUST be called only from server code
 * (route handlers, server actions, server components). If a client
 * component needs a helper that's currently here, refactor it to
 * accept the value as a prop from a server parent rather than
 * importing this module directly.
 */

import { randomBytes } from "node:crypto";

// 30-char alphabet, no ambiguous glyphs. Crypto-secure random sampling
// gives ~30^6 ≈ 729M combinations per LKO prefix. Duplicates retry
// cheaply against the @@unique constraint on Volunteer.code.
const SAFE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Generate a single volunteer code. Caller MUST check uniqueness
 * against the DB and retry on collision — we don't do the DB read
 * here to keep this function pure (testable, no Prisma import).
 */
export function generateVolunteerCode(prefix = "BM-LKO"): string {
  const bytes = randomBytes(6);
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += SAFE_CHARS[bytes[i] % SAFE_CHARS.length];
  }
  return `${prefix}-${suffix}`;
}
