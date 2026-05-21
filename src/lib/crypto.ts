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

export function readClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "unknown";
}
