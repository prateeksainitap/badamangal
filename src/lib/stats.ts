import { prisma } from "@/lib/db";
import { ALL_TUESDAY_ISO } from "@/lib/dates";
import { AREAS } from "@/lib/lucknow";

export type SiteStats = {
  /** Total visits to the homepage so far (across all visitors). */
  visitorNumber: number;
  /** All bhandaras the site has on record this season, listed + spotted.
   *  Exposed as a separate hero number alongside the visitor pill so the
   *  homepage opens on two summary counts (visitors + bhandaras) and the
   *  per-source tiles below act as the breakdown. */
  bhandarasTotal: number;
  /** Total APPROVED listings. */
  bhandarasListed: number;
  /** Cumulative count of all APPROVED spotted-bhandara reports submitted
   *  to /spot. Includes both currently-live spots and ones whose 8-hour
   *  window has expired (they still count toward "the city did this"). */
  bhandarasSpotted: number;
  /** Cumulative count of standalone APPROVED BhandaraMention rows
   *  that represent a CONFIRMED bhandara — every text/location signal
   *  from the WhatsApp community where someone declared or referenced
   *  a bhandara that exists. Includes:
   *   • SHARING declarations ("Aliganj sector E me ho raha hai")
   *   • MENTIONING chatter (photos, thanks, follow-ups about a
   *     real ongoing bhandara)
   *   • Mentions carrying a structured location (WhatsApp share,
   *     Google Maps URL, extracted address)
   *
   *  Explicitly EXCLUDES `intent: "ASKING"` — those are questions
   *  ("Alambagh me kahi bhandara h kya?"), which are demand-signal,
   *  not supply. A question about whether a bhandara exists is not
   *  a confirmation that one does (2026-05-26 operator correction).
   *
   *  Restricted to mentions NOT already linked to an existing
   *  Bhandara row (`bhandaraId IS NULL`) so events that exist in
   *  both surfaces count once (under `bhandarasListed`). */
  bhandarasMentioned: number;
  /** Distinct curated `area` values that have at least one approved listing. */
  areasCovered: number;
  /** Total curated areas in the Lucknow neighbourhood list (lib/lucknow.ts).
   *  Used as the denominator for the "areas covered" stat tile so it
   *  reads as "22 of 36" instead of a bare "22", matching the
   *  "Tuesdays served · 2 of 8" pattern. Driven off AREAS.length so
   *  adding a neighbourhood to the curated list automatically updates
   *  every visible counter, no manual sync needed. */
  areasTotal: number;
  /** Tuesdays in the 2026 season that are already in the past (IST). */
  tuesdaysSoFar: number;
  /** Total WhatsApp community + group + channel participants the bot
   *  is in. Sourced from SiteCounter `community_total_members`, which
   *  the Baileys bot upserts every 30 minutes via
   *  /api/bot/community-stats. 0 when the bot hasn't pushed yet. */
  communityMembers: number;
};

/* ────────────────────────────────────────────────────────────────────
   Module-level homepage stats cache.

   Why this exists:
     Vercel's first deploy attempt failed during static page generation
     with the SAME connection-pool exhaustion that bit us on Netlify
     (see the big comment in lib/db.ts for the full story). Vercel
     builds 150+ pages in parallel and every page that ends up calling
     getHomepageStats fires 3 small queries that all queue through the
     Supabase pooler with connection_limit=1. The queue overflows even
     on small queries:
       Error [PrismaClientKnownRequestError]:
         Invalid `prisma.siteCounter.findUnique()` invocation:
         Timed out fetching a new connection from the connection pool.

   The fix:
     Cache the Promise at module scope. Same pattern as
     getAllApprovedBhandaras. 150 builders × 3 queries = 450 queries
     collapses into 3 queries shared by every page in the same build
     process.

   MUTATION CONTRACT:
     Any server action that mutates SiteCounter, Bhandara, or Spot
     in a way the homepage counters care about MUST call
     invalidateHomepageStatsCache() alongside its revalidatePath()
     calls, otherwise the next homepage render hits the stale Promise.
     /api/visit currently does NOT invalidate, the visitor-counter lag
     (a few seconds to a few minutes) is intentional, see the long
     comment on getHomepageStats below for why.
   ──────────────────────────────────────────────────────────────── */

let homepageStatsPromise: Promise<SiteStats> | null = null;

/**
 * Read-only homepage stats, safe to call from a cacheable (ISR) page.
 *
 * We deliberately do NOT mutate the visitor counter here anymore. Bumping
 * inside the page render forced the route to be `force-dynamic` (every
 * request did a DB write), which meant the host had to cold-start a
 * Function for every visitor and the homepage took 4-6s to TTFB.
 *
 * The counter is now bumped client-side via a small beacon after first
 * paint (see `src/components/VisitorBeacon.tsx` POSTing to `/api/visit`),
 * which keeps the page itself fully cacheable while still tracking real
 * traffic. The visible number lags by a few seconds for the first
 * visitor of a new revalidate window, fine for a homepage stat.
 *
 * Module-level cached, pass `{ fresh: true }` to skip the cache.
 */
export function getHomepageStats(opts?: { fresh?: boolean }): Promise<SiteStats> {
  if (opts?.fresh || !homepageStatsPromise) {
    // Self-invalidating cache: if the underlying compute rejects
    // (transient Supabase pooler blip during cold start, etc.), we
    // clear the memoised promise so the next caller retries instead
    // of being stuck with a permanently-rejected promise for the
    // lifetime of the Lambda. The .catch() attaches a no-op handler
    // only for the invalidation side-effect — the rejection is
    // re-thrown via the returned promise so callers still see it
    // and can degrade locally (see page.tsx Promise.allSettled).
    const p = computeHomepageStats();
    p.catch(() => {
      if (homepageStatsPromise === p) homepageStatsPromise = null;
    });
    homepageStatsPromise = p;
  }
  return homepageStatsPromise;
}

/**
 * Drop the module-level homepage stats cache so the next caller
 * fetches fresh from the DB. Pair with revalidatePath() in any
 * server action that meaningfully changes the homepage counters.
 */
export function invalidateHomepageStatsCache(): void {
  homepageStatsPromise = null;
}

async function computeHomepageStats(): Promise<SiteStats> {
  const now = new Date();
  const todayIso = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const pastTuesdays = ALL_TUESDAY_ISO.filter((iso) => iso < todayIso);

  // Fan out the five reads in parallel — same Supabase pooler, so
  // serialising them would multiply the round-trip cost on a cold
  // pool. visitorCounter + communityCounter are both 1-row lookups by
  // primary key (cheap); the other three do the work.
  //
  // `mentionedCount` — APPROVED BhandaraMention rows where the
  // mention CONFIRMS a bhandara exists. SHARING (declarations) +
  // MENTIONING (chatter / photos / thanks). ASKING is excluded:
  // "Alambagh me kahi bhandara h kya?" is a question about supply,
  // not a confirmation of it. (2026-05-26 operator correction;
  // we'd briefly broadened to include ASKING earlier in the day on
  // a wider read of "every tracked signal".)
  //
  // The bhandaraId=null gate stays: mentions pinned to a Bhandara
  // row would otherwise double-count against `bhandarasListed`.
  // expiresAt is also unfiltered — same lens as bhandara + spot,
  // which both keep expired/past rows in the cumulative "so far"
  // tally.
  const [counter, communityCounter, records, spottedCount, mentionedCount] =
    await Promise.all([
      prisma.siteCounter.findUnique({
        where: { id: "home" },
        select: { count: true },
      }),
      prisma.siteCounter.findUnique({
        where: { id: "community_total_members" },
        select: { count: true },
      }),
      prisma.bhandara.findMany({
        where: { status: "APPROVED" },
        select: { area: true },
      }),
      prisma.spot.count({ where: { status: "APPROVED" } }),
      prisma.bhandaraMention.count({
        where: {
          status: "APPROVED",
          bhandaraId: null,
          intent: { not: "ASKING" },
        },
      }),
    ]);

  // Stats panel counters are cumulative ("so far" in the labels):
  // every APPROVED bhandara counts toward `bhandarasListed`, every
  // APPROVED spot toward `bhandarasSpotted`, and the area set spans
  // all-time. This is intentionally a different lens from the main
  // list / map / area chips, which filter to upcoming-only via
  // `hasUpcomingDate` (a past-only bhandara still happened, it
  // should count toward "the city did this" stats even though it's
  // no longer on the active map). The "so far" word in the labels
  // tells visitors the number is cumulative.
  const areas = new Set<string>();
  for (const r of records) {
    if (r.area) areas.add(r.area);
  }

  return {
    visitorNumber: counter?.count ?? 0,
    bhandarasTotal: records.length + spottedCount + mentionedCount,
    bhandarasListed: records.length,
    bhandarasSpotted: spottedCount,
    bhandarasMentioned: mentionedCount,
    areasCovered: areas.size,
    areasTotal: AREAS.length,
    tuesdaysSoFar: pastTuesdays.length,
    communityMembers: communityCounter?.count ?? 0,
  };
}

/**
 * Atomic +1 on the homepage visitor counter. Called from `POST /api/visit`
 * which is fired client-side after first paint, so the homepage HTML stays
 * cacheable. Returns the new count for clients that want to display it.
 */
export async function bumpVisitorCounter(): Promise<number> {
  const counter = await prisma.siteCounter.upsert({
    where: { id: "home" },
    update: { count: { increment: 1 } },
    create: { id: "home", count: 1 },
    select: { count: true },
  });
  return counter.count;
}
