/**
 * Admin authentication helpers, single source of truth.
 *
 * Before this module existed, every admin route / server action /
 * page handler reimplemented the same body:
 *   const expected = process.env.ADMIN_PASSWORD;
 *   const c = await cookies();
 *   return c.get("admin")?.value === expected;
 *
 * Twelve files carried that snippet. Drift risk on every future
 * auth tweak (cookie name change, session expiry, IP allowlist,
 * etc.). Centralised here.
 *
 * Cookie format (BREAKING CHANGE from the legacy plaintext format):
 *   admin = "<issuedAt>.<signature>"
 * where
 *   issuedAt  = milliseconds-since-epoch when the cookie was issued
 *   signature = HMAC-SHA256(MOD_SECRET, `admin:${issuedAt}`), hex
 *
 * Why the format change:
 *   The legacy format stored the password VERBATIM in the cookie
 *   (cookies.value === process.env.ADMIN_PASSWORD). Any cookie leak
 *   (XSS, dev-tools-shoulder-surf, error-page accident) handed the
 *   master password to the attacker, with no way to revoke a single
 *   session without rotating the password everywhere. The signed
 *   format gives us:
 *     • the cookie value reveals only an issued-at timestamp
 *       (already a public-ish piece of info), not the password
 *     • the password lives ONLY in ADMIN_PASSWORD env var, used at
 *       login time, then never read again per request
 *     • session expiry is enforced server-side (issuedAt + 7 days),
 *       not just by the cookie's own maxAge (which the browser can
 *       lie about)
 *     • timing-safe comparison via crypto.timingSafeEqual on the
 *       HMAC, so a CPU-side attacker can't byte-leak the signature
 *
 * Backward compatibility:
 *   Existing logged-in admins WILL be logged out after this lands
 *   (their cookies hold a plaintext password value, this format
 *   rejects them). Single password reset on next login restores
 *   access. One-time cost, acceptable for the security gain.
 */

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "admin";

/** Session lifetime. Matches the cookie's maxAge so client and
 *  server agree on when a session expires. */
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
const ADMIN_SESSION_MAX_AGE_MS = ADMIN_SESSION_MAX_AGE_SECONDS * 1000;

/** Read MOD_SECRET at module init so we fail fast in production if
 *  it's unset, rather than silently signing every cookie with a
 *  predictable string. */
function getModSecret(): string {
  const secret = process.env.MOD_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      // Hard-fail in prod. A predictable signing key is worse than
      // a missing-config error at startup.
      throw new Error(
        "MOD_SECRET env var must be set in production. Admin cookies cannot be signed without it.",
      );
    }
    // Dev convenience: still works locally without an env var, but
    // never matches a production-signed cookie because the secret
    // differs.
    return "bm-dev-secret-change-me-in-prod";
  }
  return secret;
}

/** Compute the HMAC signature for a given issuedAt timestamp. Hex
 *  string of constant length so timing-safe compare works without
 *  needing to length-pad. */
function sign(issuedAt: number): string {
  return createHmac("sha256", getModSecret())
    .update(`admin:${issuedAt}`)
    .digest("hex");
}

/** Produce the cookie VALUE to set after a successful login.
 *  Caller is responsible for setting the cookie attributes
 *  (httpOnly, sameSite, path, maxAge, secure). */
export function issueAdminCookie(): string {
  const issuedAt = Date.now();
  return `${issuedAt}.${sign(issuedAt)}`;
}

/** Given a cookie value, return true if its signature is valid AND
 *  the issued-at timestamp is within the session window. Constant-
 *  time on the signature compare; non-constant on the parse, which
 *  is fine (parse failure is structural, leaks no secret data). */
function verifyAdminCookie(value: string | undefined): boolean {
  if (!value) return false;
  const dot = value.indexOf(".");
  if (dot <= 0 || dot === value.length - 1) return false;
  const issuedAtStr = value.slice(0, dot);
  const sigHex = value.slice(dot + 1);
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt) || issuedAt <= 0) return false;
  // Reject sessions older than the configured lifetime.
  if (Date.now() - issuedAt > ADMIN_SESSION_MAX_AGE_MS) return false;
  // Recompute the expected signature and compare in constant time.
  const expectedHex = sign(issuedAt);
  if (expectedHex.length !== sigHex.length) return false;
  let aBuf: Buffer;
  let bBuf: Buffer;
  try {
    aBuf = Buffer.from(sigHex, "hex");
    bBuf = Buffer.from(expectedHex, "hex");
  } catch {
    return false;
  }
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/** Is the current request authenticated as admin? Reads the cookie
 *  from next/headers. Use from server components and server actions. */
export async function isAdmin(): Promise<boolean> {
  const c = await cookies();
  return verifyAdminCookie(c.get(ADMIN_COOKIE)?.value);
}

/** Throw if not admin. Use at the top of any admin-only server action. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw new Error("Unauthorized");
  }
}

/** Validate a plaintext password submitted from the login form
 *  against ADMIN_PASSWORD. Constant-time comparison so a timing
 *  attacker can't byte-leak the env var. */
export function verifyAdminPassword(submitted: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(submitted);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
