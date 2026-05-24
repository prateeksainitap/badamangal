/**
 * Shared "what's pending in each admin queue" counts, used by the
 * AdminShell sidebar to surface badge numbers next to each nav item.
 *
 * Why a shared util:
 *   Every admin page renders AdminShell, and every page wants the
 *   sidebar badges. Without a shared helper, each page would need
 *   to re-implement the 7 count queries — 7 round-trips per page
 *   load, duplicated 10x across the admin. Bad for both perf and
 *   maintenance.
 *
 *   This util gathers them all into ONE Promise.all so the cost is
 *   a single fan-out per page. Cached for 5 MINUTES via unstable_cache
 *   so in-session navigations don't re-hit the DB at all. The cache
 *   is busted explicitly via `revalidateTag("admin-nav-counts")` from
 *   every mutation that changes any of these counts (approve / reject /
 *   spam / verify etc.) — see actions.ts. 5 min is safe because the
 *   tag-revalidation gives us instant freshness on the queues that
 *   matter; the 30s window was wasted cache-miss tax on idle clicks.
 *
 * Tone semantics (handled in AdminShell):
 *   • Cyan/live tone   → spots (auto-expire, "happening now")
 *   • Saffron/attention → everything else that needs human review
 *
 * Keys MUST match NAV item hrefs in AdminShell — the shell looks
 * them up by href when deciding which badge to render.
 */

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

export type AdminNavCounts = Partial<Record<string, number>>;

/** Raw count fetch — one round-trip per queue, all in parallel. */
async function _fetchNavCounts(): Promise<AdminNavCounts> {
  const now = new Date();
  const [
    pendingBhandaras,
    liveSpots,
    pendingMentions,
    newOrganise,
    pendingVolunteers,
    newEmails,
  ] = await Promise.all([
    prisma.bhandara.count({ where: { status: "PENDING" } }),
    prisma.spot.count({
      where: { status: "APPROVED", expiresAt: { gt: now } },
    }),
    prisma.bhandaraMention.count({ where: { status: "PENDING" } }),
    prisma.organiseRequest.count({ where: { status: "NEW" } }),
    prisma.volunteer.count({ where: { status: "PENDING" } }),
    prisma.contactMessage.count({ where: { status: "NEW" } }),
  ]);

  return {
    "/admin/bhandaras": pendingBhandaras,
    "/admin/spots": liveSpots,
    "/admin/mentions": pendingMentions,
    "/admin/organise": newOrganise,
    "/admin/volunteers": pendingVolunteers,
    "/admin/emails": newEmails,
  };
}

/** Cached fetch — 5-minute TTL. Mutations that affect these counts
 *  should call `revalidateTag("admin-nav-counts")` to punch through
 *  instantly; we lean on that for freshness instead of polling. */
export const getAdminNavCounts = unstable_cache(
  _fetchNavCounts,
  ["admin-nav-counts"],
  { revalidate: 300, tags: ["admin-nav-counts"] },
);
