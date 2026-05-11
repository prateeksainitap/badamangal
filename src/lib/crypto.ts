import { createHash } from "node:crypto";

// Single shared secret used to salt the IP / phone hashes we store for
// moderation + abuse-detection. Never used for cryptographic privacy —
// these are pseudonymisation hashes, not encryption keys.
const SECRET = process.env.MOD_SECRET ?? "bm-dev-secret-change-me-in-prod";

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
