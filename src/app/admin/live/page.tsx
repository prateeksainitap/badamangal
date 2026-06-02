import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminNavCounts } from "@/lib/admin-nav-counts";
import BotHeartbeat from "@/components/admin/BotHeartbeat";
import ActivityStream from "@/components/admin/ActivityStream";
import { buildActivityEvents } from "@/components/admin/ActivityFeed";

/**
 * /admin/live — the ENTIRE live feed, editable.
 *
 * The dashboard shows a 14-row summary of the same stream inside the
 * merged Live-chat panel. This page shows everything from the last
 * 24h (all spots + published bhandaras + approved SHARING chat
 * mentions), reusing the exact same row component (ActivityStream),
 * so each row is clickable into its edit page and dismissable via the
 * inline ✕. One source of truth for row shape: buildActivityEvents().
 */
export const metadata: Metadata = {
  title: "Live feed · Admin · Bada Mangal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const WINDOW_HOURS = 24;

export default async function AdminLiveFeedPage() {
  if (!(await isAdmin())) redirect("/admin");

  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);

  // allSettled so one transient EMAXCONN doesn't blank the whole feed.
  const [navCounts, settled] = await Promise.all([
    getAdminNavCounts().catch(() => ({}) as Partial<Record<string, number>>),
    Promise.allSettled([
      prisma.bhandara.findMany({
        where: { createdAt: { gt: since } },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          slug: true,
          name: true,
          area: true,
          timeStart: true,
          tuesdayDates: true,
          organizerName: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.spot.findMany({
        where: { createdAt: { gt: since } },
        orderBy: { createdAt: "desc" },
        take: 400,
        select: {
          id: true,
          area: true,
          address: true,
          caption: true,
          reporterName: true,
          createdAt: true,
          status: true,
        },
      }),
      prisma.bhandaraMention.findMany({
        where: {
          status: "APPROVED",
          intent: "SHARING",
          createdAt: { gt: since },
        },
        orderBy: { createdAt: "desc" },
        take: 400,
        select: {
          id: true,
          cleanedText: true,
          originalText: true,
          senderName: true,
          locationLabel: true,
          createdAt: true,
        },
      }),
      prisma.volunteer.findMany({
        where: { createdAt: { gt: since } },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, name: true, status: true, createdAt: true },
      }),
    ]),
  ]);

  const safe = <T,>(idx: number): T[] => {
    const r = settled[idx];
    return r && r.status === "fulfilled" ? (r.value as T[]) : [];
  };

  const events = buildActivityEvents(
    safe<{
      id: string;
      slug: string;
      name: string;
      area: string;
      timeStart: string;
      tuesdayDates: string;
      organizerName: string;
      status: string;
      createdAt: Date;
    }>(0).map((b) => ({ ...b, createdAt: b.createdAt.toISOString() })),
    safe<{
      id: string;
      area: string | null;
      address: string | null;
      caption: string | null;
      reporterName: string | null;
      createdAt: Date;
      status: string;
    }>(1).map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
    safe<{
      id: string;
      cleanedText: string | null;
      originalText: string;
      senderName: string | null;
      locationLabel: string | null;
      createdAt: Date;
    }>(2).map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
    safe<{ id: string; name: string; status: string; createdAt: Date }>(3).map(
      (v) => ({ ...v, createdAt: v.createdAt.toISOString() }),
    ),
    1000,
  );

  return (
    <AdminShell navCounts={navCounts} botHeartbeat={<BotHeartbeat />}>
      <div className="px-4 sm:px-6 py-6 max-w-3xl mx-auto">
        <header className="mb-4">
          <p className="text-[0.65rem] uppercase tracking-[0.22em] text-cyan-300/70 font-mukta">
            Live feed · last {WINDOW_HOURS}h · {events.length} items
          </p>
          <h1 className="text-xl font-semibold text-white mt-1">
            Entire live feed
          </h1>
          <p className="text-sm text-white/55 mt-1 leading-snug">
            Every spot, chat mention and published bhandara from the last{" "}
            {WINDOW_HOURS} hours. Tap any row to edit it; use the ✕ to remove it
            from the feed.
          </p>
        </header>
        <ActivityStream
          events={events}
          dismissable
          emptyLabel="Nothing in the live feed in the last 24 hours yet."
        />
      </div>
    </AdminShell>
  );
}
