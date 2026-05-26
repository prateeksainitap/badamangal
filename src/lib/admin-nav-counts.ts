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

/** Raw count fetch — one round-trip per queue, all in parallel.
 *  Promise.allSettled so a transient EMAXCONN on any single count
 *  doesn't take down the whole AdminShell sidebar (and with it the
 *  entire admin tree). Failed counts fall back to 0 so the badge
 *  silently hides; the rest of the sidebar still renders. */
async function _fetchNavCounts(): Promise<AdminNavCounts> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const settled = await Promise.allSettled([
    prisma.bhandara.count({ where: { status: "PENDING" } }),
    prisma.spot.count({
      where: { status: "APPROVED", expiresAt: { gt: now } },
    }),
    prisma.bhandaraMention.count({ where: { status: "PENDING" } }),
    prisma.organiseRequest.count({ where: { status: "NEW" } }),
    // Volunteer count = total signups (any status). Previously
    // filtered to status="PENDING" which is always 0 because new
    // signups auto-advance to PROBATIONARY → the badge always
    // hid. Switching to total so the sidebar shows the size of
    // the volunteer programme at a glance (operator's view, no
    // workflow-action implied).
    prisma.volunteer.count(),
    prisma.contactMessage.count({ where: { status: "NEW" } }),
    // Bot-log badge surfaces last-24h ingest failures so the
    // operator notices Gemini hiccups / R2 upload errors / classify
    // 502s without having to manually open the log. Count includes
    // every FAILED_* outcome; SUCCESS_* and DUPLICATE_* don't count.
    prisma.botIngestionLog.count({
      where: {
        outcome: {
          in: [
            "FAILED_CLASSIFY",
            "FAILED_EXTRACT",
            "FAILED_UPLOAD",
            "FAILED_OTHER",
          ],
        },
        createdAt: { gte: dayAgo },
      },
    }),
  ]);
  const pick = (idx: number): number => {
    const r = settled[idx];
    if (r && r.status === "fulfilled") return r.value;
    if (r && r.status === "rejected") {
      console.error(
        `[admin-nav-counts] query ${idx} rejected:`,
        r.reason instanceof Error ? r.reason.message : r.reason,
      );
    }
    return 0;
  };
  return {
    "/admin/bhandaras": pick(0),
    "/admin/spots": pick(1),
    "/admin/mentions": pick(2),
    "/admin/organise": pick(3),
    "/admin/volunteers": pick(4),
    "/admin/emails": pick(5),
    "/admin/bot-log": pick(6),
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
