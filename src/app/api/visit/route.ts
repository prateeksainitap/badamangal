import { NextResponse } from "next/server";
import { bumpVisitorCounter } from "@/lib/stats";

/**
 * Fire-and-forget visitor-counter bump.
 *
 * Called once per page-load by <VisitorBeacon /> after first paint. We
 * moved the increment out of the homepage SSR render so the homepage
 * itself can be statically cached (ISR) instead of running through a
 * Netlify Function on every request, that alone cut homepage TTFB
 * from 4-6s to ~200ms.
 *
 * The endpoint is intentionally:
 *   • POST only (so crawlers/prefetch don't accidentally bump it)
 *   • Unauthenticated (it's a public counter)
 *   • Edge-safe (single Prisma upsert, no other I/O)
 *
 * If Prisma errors (pool exhausted, DNS blip, whatever), we still
 * return 200 with `ok: false`, a missed counter tick must never
 * surface as a visible error to a visitor.
 */
export const runtime = "nodejs";

export async function POST(): Promise<NextResponse> {
  try {
    const count = await bumpVisitorCounter();
    return NextResponse.json(
      { ok: true, count },
      // Don't let edge caches collapse beacons.
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    console.warn("[/api/visit] bump failed", err);
    return NextResponse.json(
      { ok: false },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  }
}
