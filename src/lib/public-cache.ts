/**
 * Cached read helpers for the public homepage + /live + /map surfaces.
 *
 * Why this exists (added 2026-05-26 Tuesday-1 of Adhik Mas):
 *   The homepage previously hit Postgres directly inside its
 *   Promise.allSettled fan-out, with an in-memory `lastGood` fallback
 *   in page.tsx for soft degradation. That works for WARM Lambdas
 *   that have already served a successful query — but a COLD-START
 *   Lambda spinning up during a DB outage has no module-memory cache
 *   yet, so it falls through to the empty-array shape and renders
 *   "All 0 Bada Mangal bhandaras in Lucknow" to the visitor.
 *
 *   This caused a real production regression today: during the
 *   Supabase pool storm (EMAXCONN ceiling on Free tier, since
 *   upgraded to Pro), Vercel CDN cached a snapshot of the empty
 *   render and served it for a chunk of visits. Pro upgrade fixes
 *   the underlying connection ceiling, but doesn't protect against
 *   ANY future DB blip — every cold-start Lambda during any DB
 *   outage repeats the same empty-state regression.
 *
 *   `unstable_cache` is Next's edge-shared data cache (backed by
 *   Vercel's KV-like layer), persistent across function instances.
 *   When one Lambda successfully fetches bhandaras, the result is
 *   stored at the edge and EVERY other Lambda — including fresh
 *   cold-starts — reads from there until the cache key revalidates.
 *   If revalidation throws (DB unreachable), Next holds the stale-
 *   but-valid entry and keeps serving it. That's the durable
 *   "last known good" behaviour module-level memory can't give us.
 *
 * Revalidation:
 *   • 60s time-based revalidation matches the homepage's ISR window
 *   • Admin mutation actions call `revalidateTag("public-bhandaras")`
 *     / `revalidateTag("public-spots")` to bust the cache immediately
 *     on edits — operators never see stale data after their own
 *     action.
 *
 * Tags:
 *   public-bhandaras → busted when any Bhandara row is
 *                      created/updated/deleted
 *   public-spots     → busted when any Spot row is
 *                      created/updated/deleted
 */

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

/** APPROVED Bhandara rows for the homepage map + cards. The query
 *  shape mirrors what page.tsx's Promise.allSettled fan-out has
 *  always done; no field changes (downstream consumers like
 *  `toBhandara`, the map markers, area chips, and stat tiles
 *  expect every column on the row). */
export const getCachedApprovedBhandaras = unstable_cache(
  async () => {
    return prisma.bhandara.findMany({
      where: { status: "APPROVED" },
      orderBy: [{ isSponsored: "desc" }, { createdAt: "asc" }],
    });
  },
  ["public:approved-bhandaras"],
  { revalidate: 60, tags: ["public-bhandaras"] },
);

/** Currently-live Spots (APPROVED + non-expired) for the homepage
 *  chat panel, map heatmap, /live grid, and LiveChatterBoard SSR
 *  initial payload. Same `take: 500` cap as the direct query in
 *  page.tsx — natural ceiling via the 8h Spot TTL. */
export const getCachedLiveSpots = unstable_cache(
  async () => {
    return prisma.spot.findMany({
      where: { status: "APPROVED", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        bhandara: { select: { slug: true, name: true, nameHi: true } },
      },
    });
  },
  ["public:live-spots"],
  { revalidate: 60, tags: ["public-spots"] },
);
