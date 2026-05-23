import { createHash } from "node:crypto";

// Single shared secret used to salt the IP / phone hashes we store
// for moderation + abuse-detection. Never used for cryptographic
// privacy, these are pseudonymisation hashes, not encryption keys.
//
// In production MUST be set: the fallback is a public string from
// this source file. If the prod env var is unset, every IP/phone
// hash becomes predictable to anyone who reads this repo — abuse
// detection collapses (the same hash for an attacker becomes
// trivially recomputable to deanonymise). Hard-fail at module init.
function resolveSecret(): string {
  const fromEnv = process.env.MOD_SECRET;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "MOD_SECRET env var must be set in production. Phone/IP hashes are otherwise predictable.",
    );
  }
  return "bm-dev-secret-change-me-in-prod";
}
const SECRET = resolveSecret();

export function phoneHash(phone: string): string {
  return createHash("sha256").update(`${SECRET}::${phone.trim()}`).digest("hex");
}

export function ipHash(ip: string | null | undefined): string {
  return createHash("sha256")
    .update(`${SECRET}::${ip ?? "unknown"}`)
    .digest("hex");
}

/**
 * Resolve the real client IP from request headers, picking the most
 * platform-trustworthy source first.
 *
 * Why the order matters: a naive `X-Forwarded-For: ...split(",")[0]`
 * lets an attacker spoof their per-IP rate-limit bucket by including
 * `X-Forwarded-For: 1.2.3.4` in any request — every quota check then
 * sees a fresh IP and the limiter is defeated. The platform-set
 * headers below ARE trustworthy because the user request can't reach
 * the application without going through the edge that sets them.
 *
 * Preference (best → worst):
 *   1. `x-vercel-forwarded-for` (Vercel edge sets this from the
 *      actual TCP source; clients can't override).
 *   2. `cf-connecting-ip` (Cloudflare, same guarantee — only present
 *      when fronted by CF, harmless otherwise).
 *   3. `x-nf-client-connection-ip` (Netlify edge equivalent).
 *   4. `x-real-ip` (nginx/typical reverse proxy header — usually set
 *      by the LB, not the client, but spoofable on a misconfigured
 *      setup; we accept it after the platform-specific headers since
 *      most installs do not allow clients to set it).
 *   5. `x-forwarded-for` LAST entry (right-most). The right-most
 *      token is the IP the LAST proxy saw — which on Vercel/Netlify
 *      IS the real client. The LEFT-most entry is whatever the
 *      client claimed, which is exactly the spoof we want to avoid.
 *   6. "unknown" — we never throw because abuse-detection only
 *      needs a stable bucket per request, and a single bucket for
 *      "unknown" still prevents the runaway-quota worst case.
 */
export function readClientIp(headers: Headers): string {
  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.trim();
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const netlify = headers.get("x-nf-client-connection-ip");
  if (netlify) return netlify.trim();
  const xri = headers.get("x-real-ip");
  if (xri) return xri.trim();
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return "unknown";
}
