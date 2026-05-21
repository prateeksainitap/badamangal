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
};

/**
 * Read-only homepage stats, safe to call from a cacheable (ISR) page.
 *
 * We deliberately do NOT mutate the visitor counter here anymore. Bumping
 * inside the page render forced the route to be `force-dynamic` (every
 * request did a DB write), which meant Netlify had to cold-start a
 * Function for every visitor and the homepage took 4-6s to TTFB.
 *
 * The counter is now bumped client-side via a small beacon after first
 * paint (see `src/components/VisitorBeacon.tsx` POSTing to `/api/visit`),
 * which keeps the page itself fully cacheable while still tracking real
 * traffic. The visible number lags by a few seconds for the first
 * visitor of a new revalidate window, fine for a homepage stat.
 */
export async function getHomepageStats(): Promise<SiteStats> {
  // Pure read on the counter; if the row doesn't exist yet, treat as 0.
  const counter = await prisma.siteCounter.findUnique({
    where: { id: "home" },
    select: { count: true },
  });

  const now = new Date();
  const todayIso = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const pastTuesdays = ALL_TUESDAY_ISO.filter((iso) => iso < todayIso);

  // Fan out the two reads in parallel, both go through the same
  // Supabase pooler so serialising them would double the round-trip
  // cost on a cold pool.
  const [records, spottedCount] = await Promise.all([
    prisma.bhandara.findMany({
      where: { status: "APPROVED" },
      select: { area: true },
    }),
    prisma.spot.count({ where: { status: "APPROVED" } }),
  ]);

  // Stats panel counters are cumulative ("so far" in the labels):
  // every APPROVED bhandara counts toward `bhandarasListed`, every
  // APPROVED spot toward `bhandarasSpotted`, and the area set spans
  // all-time. This is intentionally a different lens from the main
  // list / map / area chips, which filter to upcoming-only via
  // `hasUpcomingDate` (a past-only bhandara still happened — it
  // should count toward "the city did this" stats even though it's
  // no longer on the active map). The "so far" word in the labels
  // tells visitors the number is cumulative.
  const areas = new Set<string>();
  for (const r of records) {
    if (r.area) areas.add(r.area);
  }

  return {
    visitorNumber: counter?.count ?? 0,
    bhandarasTotal: records.length + spottedCount,
    bhandarasListed: records.length,
    bhandarasSpotted: spottedCount,
    areasCovered: areas.size,
    areasTotal: AREAS.length,
    tuesdaysSoFar: pastTuesdays.length,
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
