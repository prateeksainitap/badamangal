/**
 * Lightweight in-memory per-key rate limiter.
 *
 * Used to cap abuse against expensive endpoints (Gemini-backed
 * scan routes, R2 uploads, Ola Maps geocode passes). Per-key
 * because callers slot in either an IP hash or a session token,
 * depending on the surface.
 *
 * Limitations (deliberate, accepted):
 *   - In-memory. Resets on every cold start. A determined attacker
 *     can spray fresh requests across cold starts, but each cold
 *     start has a non-trivial wall time (~500ms on Vercel) and
 *     they still pay the floor latency for each one. Bounded
 *     enough for a community site; not bank-grade.
 *   - Per-instance. Vercel can scale the same route across multiple
 *     warm instances; an attacker hitting all of them in parallel
 *     gets RATE_LIMIT_MAX × instance_count. Still bounded.
 *   - The first-cleanup heuristic (every ~100 inserts) keeps the
 *     Map from growing unbounded; under steady traffic it stabilises
 *     around the active-IPs count.
 *
 * Pattern duplicated from src/app/api/public/scan-bhandara/route.ts
 * (which had it inlined), extracted here so admin/scan,
 * admin/upload-image, admin/resolve-coords, and any future
 * cost-sensitive endpoint can share one implementation.
 */

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

export interface RateLimitOptions {
  /** Stable key per "actor", usually `ipHash(readClientIp(req.headers))`
   *  for public routes, or `"admin:<cookie-value>"` for admin routes. */
  key: string;
  /** Max requests per window. */
  max: number;
  /** Window length in ms. */
  windowMs: number;
  /** Logical bucket name; lets one process host multiple buckets
   *  (e.g. "scan", "upload", "resolve") without keys colliding. */
  bucket: string;
}

// Per-bucket Map<key, timestamps[]>. Kept outside the function so
// it survives warm-function reuse on a single Vercel instance.
const bucketsByName = new Map<string, Map<string, number[]>>();

let cleanupCounter = 0;

export function checkRateLimit(opts: RateLimitOptions): RateLimitResult {
  const { key, max, windowMs, bucket } = opts;
  let map = bucketsByName.get(bucket);
  if (!map) {
    map = new Map();
    bucketsByName.set(bucket, map);
  }
  const now = Date.now();
  const cutoff = now - windowMs;
  const stamps = (map.get(key) ?? []).filter((t) => t > cutoff);
  if (stamps.length >= max) {
    const oldest = stamps[0]!;
    const retryAfterSec = Math.max(
      1,
      Math.ceil((oldest + windowMs - now) / 1000),
    );
    map.set(key, stamps);
    return { ok: false, retryAfterSec };
  }
  stamps.push(now);
  map.set(key, stamps);

  // Opportunistic cleanup so the per-bucket Map doesn't grow
  // unbounded under a long-lived warm function. Every ~100 inserts
  // (across all buckets), walk every bucket and drop any key whose
  // newest stamp fell outside its window. Cheap because the inner
  // arrays are small.
  cleanupCounter++;
  if (cleanupCounter >= 100) {
    cleanupCounter = 0;
    for (const [bname, bm] of bucketsByName) {
      for (const [k, ts] of bm) {
        if (!ts.length || ts[ts.length - 1]! <= cutoff) {
          bm.delete(k);
        }
      }
      if (bm.size === 0) bucketsByName.delete(bname);
    }
  }

  return { ok: true };
}
