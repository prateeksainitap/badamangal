/**
 * Public homepage stats, for the mobile app.
 *
 * The BadaMangal React Native app wants to show the SAME headline
 * numbers the website renders (visitor count, total/listed/spotted
 * bhandaras, community size, areas covered) so the two surfaces never
 * disagree. Rather than re-implement the queries on the app side, we
 * expose the single source of truth, getHomepageStats() from
 * lib/stats.ts, as a small read-only JSON endpoint.
 *
 * We return a deliberate SUBSET of SiteStats (the fields the app
 * surfaces), not the whole shape, so the contract stays small and the
 * app doesn't accidentally depend on internal counters.
 *
 * Public + CORS-open: every value here is already shown publicly on the
 * website homepage, so there is nothing to gate. "Access-Control-Allow-
 * Origin: *" lets the app (and any web client) read it cross-origin.
 *
 * force-dynamic so the numbers track the DB. getHomepageStats() has its
 * own short module-level TTL cache (see lib/stats.ts), so bursts of
 * requests still collapse onto a shared compute, dynamic here just keeps
 * Next from trying to statically pre-render the route.
 */
import { NextResponse } from "next/server";
import { getHomepageStats } from "@/lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CORS-open, public read-only stats. */
const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  // A small s-maxage gives CDNs a brief shared cache while keeping the
  // numbers near-live, the same lens as the homepage's own revalidate.
  "Cache-Control": "public, s-maxage=45, stale-while-revalidate=60",
};

export async function GET() {
  try {
    const stats = await getHomepageStats();
    return NextResponse.json(
      {
        visitorNumber: stats.visitorNumber,
        bhandarasTotal: stats.bhandarasTotal,
        bhandarasListed: stats.bhandarasListed,
        bhandarasSpotted: stats.bhandarasSpotted,
        communityMembers: stats.communityMembers,
        areasCovered: stats.areasCovered,
      },
      { headers: HEADERS },
    );
  } catch {
    // Best-effort: never 500 the app over a transient DB blip. The app
    // renders zeros (or its own cached numbers) rather than an error,
    // so a pooler hiccup never breaks the homepage screen.
    return NextResponse.json(
      {
        visitorNumber: 0,
        bhandarasTotal: 0,
        bhandarasListed: 0,
        bhandarasSpotted: 0,
        communityMembers: 0,
        areasCovered: 0,
      },
      { headers: HEADERS },
    );
  }
}
