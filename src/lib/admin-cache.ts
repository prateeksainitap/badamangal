/**
 * Cached read helpers for the admin console.
 *
 * The admin dashboard fans out ~6 queries on every page load. Most
 * of them must be fresh (pending counts change minute-to-minute as
 * the operator moderates), but a few are slow-changing and don't
 * need to refetch from Postgres on every navigation:
 *
 *   • Community member total — pushed by the WhatsApp bot once an
 *     hour. Caching for 5 minutes is invisible to the operator.
 *
 * Wrapping these in `unstable_cache` lets the in-memory cache serve
 * subsequent dashboard hits in <1ms instead of running a Prisma
 * round-trip through pgbouncer (which serialises behind
 * `connection_limit=1` and easily costs 100-300ms each).
 *
 * Revalidation strategy:
 *   • Time-based for now (60s for community counter, 30s for tab
 *     counts). The dashboard's "freshness" feel doesn't suffer
 *     because moderation counts still go through a fresh fetch.
 *   • `revalidatePath` from server actions punches through cache
 *     immediately on mutations, so the operator never sees stale
 *     counts after their own action.
 */

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

/** Total members across all bot-tracked WhatsApp groups. Pushed by
 *  the bot every hour or so; cache aggressively. */
export const getCachedCommunityMembers = unstable_cache(
  async (): Promise<number> => {
    const row = await prisma.siteCounter.findUnique({
      where: { id: "community_total_members" },
      select: { count: true },
    });
    return row?.count ?? 0;
  },
  ["admin:community-members"],
  { revalidate: 300, tags: ["community-counter"] },
);

/** Cumulative homepage visitor count. Incremented once per visit by
 *  /api/visit. Cached for 60s so the dashboard doesn't re-query
 *  this every navigation — it's a counter that's monotonically
 *  increasing, so a minute of staleness is invisible to the
 *  operator. */
export const getCachedVisitorCount = unstable_cache(
  async (): Promise<number> => {
    const row = await prisma.siteCounter.findUnique({
      where: { id: "home" },
      select: { count: true },
    });
    return row?.count ?? 0;
  },
  ["admin:visitor-count"],
  { revalidate: 60, tags: ["visitor-counter"] },
);
