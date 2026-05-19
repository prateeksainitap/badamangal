/**
 * Volunteer programme helpers — validation, parsing, formatting.
 *
 * IMPORTANT: this file is imported by BOTH server code (server
 * actions, route handlers) and CLIENT components (VolunteerSubmitForm,
 * VolunteerSignupForm). It MUST stay free of Node-only imports —
 * `node:crypto` etc. belongs in src/lib/volunteer-server.ts, which
 * is the server-only sibling. Webpack errors with
 *   UnhandledSchemeError: Reading from "node:crypto" is not handled
 *   by plugins (Unhandled scheme).
 * the moment a Node built-in is transitively reachable from a client
 * component, even via a "harmless" helper that doesn't itself touch
 * the built-in.
 *
 * Tier A (no OTP / no session): the volunteer code IS the auth.
 * Anyone with a valid code can submit. So the code MUST be:
 *   • Unguessable (~2 billion combinations from a 6-char alphanumeric
 *     suffix — brute-forcing the submit endpoint is impractical)
 *   • Human-readable (volunteer reads it off WhatsApp and types
 *     into a URL field on phone; ambiguous chars are excluded)
 *   • Brandable (BM-LKO-XXXX prefix anchors it as ours and signals
 *     "this is a Lucknow BadaMangal code" at a glance)
 *
 * Format: BM-LKO-XXXXXX where X ∈ unambiguous alphanumeric set.
 * Excluded: 0/O, 1/I/l (too easy to mis-type on a phone).
 *
 * generateVolunteerCode() (server-only, uses node:crypto) lives in
 * src/lib/volunteer-server.ts.
 */

/**
 * Shared Google Drive folder volunteers upload videos to.
 *
 * Why videos go to Drive instead of through /api/volunteer/upload-media:
 *   Phone videos are typically 30-120 MB at default capture quality.
 *   Our Supabase Storage upload + Netlify Function payload cap make
 *   in-app video upload slow and failure-prone, and we don't have
 *   server-side ffmpeg for transcoding. Drive handles the heavy
 *   lifting end-to-end and admins can review videos directly in the
 *   folder. Volunteers are instructed to prefix filenames with their
 *   volunteer code so the admin can match uploads to submissions
 *   when reviewing.
 *
 * If this URL changes (folder migrated, etc.), update the constant
 * here — it's referenced from VolunteerSubmitForm + any admin docs.
 */
export const VOLUNTEER_VIDEO_DRIVE_URL =
  "https://drive.google.com/drive/folders/19-99gSo8HagMEz_L6NoyfC6t3aXKBTNu?usp=sharing";

/**
 * Validate the shape of an incoming volunteer code. Rejects obvious
 * garbage before we hit the DB. Does NOT confirm the code exists —
 * that's the caller's job (look it up in the Volunteer table).
 */
export function isValidVolunteerCodeShape(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const trimmed = s.trim().toUpperCase();
  // BM-LKO-XXXXXX = 13 chars, [A-Z2-9] in suffix
  return /^BM-[A-Z]{3}-[A-Z2-9]{6}$/.test(trimmed);
}

/** Normalise a user-typed code to the canonical form. */
export function normaliseVolunteerCode(s: string): string {
  return s.trim().toUpperCase();
}

/**
 * Normalise a 10-digit Indian mobile number from a user-typed string.
 * Returns the canonical 10 digits if valid, or null if not.
 *
 * MUST match src/components/PhoneInput.tsx → toDigits() so the
 * client + server agree on what counts as "valid". See that file
 * for the full reasoning; the short version is: don't strip a
 * leading "91" off a real 10-digit mobile that happens to start
 * with 9. Only strip "91" when the input was clearly country-code-
 * prefixed (had a "+" OR was 12 digits long).
 */
export function toIndianMobileDigits(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const trimmed = s.trim();
  const hasPlusPrefix = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");

  if (hasPlusPrefix && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  // Cap at 10 to mirror the client-side max-length.
  digits = digits.slice(0, 10);

  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return digits;
}

/**
 * Parse the JSON-encoded areas string into a string[]. Tolerant of
 * legacy / malformed values: returns [] rather than throwing so a
 * single bad row can't break the admin registry page.
 */
export function parseAreas(jsonString: string | null | undefined): string[] {
  if (!jsonString) return [];
  try {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
  } catch {
    return [];
  }
}

/**
 * Inverse of parseAreas — used by the signup endpoint to canonicalise
 * the areas list before write. Caps each entry at 60 chars and the
 * whole array at 12 entries so a malicious form can't write 10 MB of
 * JSON into a TEXT column.
 */
export function stringifyAreas(input: unknown): string {
  if (!Array.isArray(input)) return "[]";
  const cleaned = input
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim().slice(0, 60))
    .filter((s) => s.length > 0)
    .slice(0, 12);
  return JSON.stringify(cleaned);
}

/** Human label for the volunteer status enum. */
export function volunteerStatusLabel(
  status: string,
): { en: string; emoji: string; tone: "neutral" | "good" | "warn" | "info" } {
  switch (status) {
    case "PENDING":
      return { en: "Pending review", emoji: "⏳", tone: "info" };
    case "PROBATIONARY":
      return { en: "Probationary", emoji: "🟡", tone: "neutral" };
    case "TRUSTED":
      return { en: "Trusted", emoji: "🟢", tone: "good" };
    case "SUSPENDED":
      return { en: "Suspended", emoji: "🔴", tone: "warn" };
    default:
      return { en: status, emoji: "⚪", tone: "neutral" };
  }
}

/** Human label for the submission status enum. */
export function submissionStatusLabel(
  status: string,
): { en: string; emoji: string; tone: "neutral" | "good" | "warn" | "info" } {
  switch (status) {
    case "NEW":
      return { en: "New", emoji: "🆕", tone: "info" };
    case "APPROVED":
      return { en: "Approved", emoji: "✅", tone: "good" };
    case "PARTIAL":
      return { en: "Partial (₹25)", emoji: "🟡", tone: "neutral" };
    case "REJECTED":
      return { en: "Rejected", emoji: "❌", tone: "warn" };
    case "DUPLICATE":
      return { en: "Duplicate", emoji: "♻️", tone: "neutral" };
    default:
      return { en: status, emoji: "⚪", tone: "neutral" };
  }
}
