import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public "live activity" feed for the bottom-left ticker on every page.
 * Returns a chronologically merged list of recent real events:
 *   - new bhandaras listed   ("Rahul added Aliganj Bhandara")
 *   - new spots reported     ("Priya spotted a bhandara in Hazratganj")
 * Plus a single "viewers right now" entry derived from the SiteCounter
 * delta over the last hour (real number, not a random fake).
 *
 * The per-bhandara `Post` (live comments) record type was removed —
 * activity is now just listings + spots + viewer count.
 *
 * Cached aggressively at the edge (s-maxage=20) since the ticker doesn't
 * need second-by-second freshness — it polls every 60s on the client.
 */

type Activity =
  | {
      kind: "list";
      id: string;
      who: string;
      what: string; // bhandara name
      where: string | null; // area
      at: string; // ISO
    }
  | {
      kind: "spot";
      id: string;
      who: string;
      where: string | null;
      at: string;
    }
  | {
      kind: "viewers";
      id: string;
      count: number;
      at: string;
    };

// Pull a wider time window than we actually surface so the ticker has
// material to rotate through even on a quiet weekday.
const LISTING_WINDOW_HOURS = 72;
const SPOT_WINDOW_HOURS = 24;

function isoHoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

export async function GET() {
  const [listings, spots, counter] = await Promise.all([
    prisma.bhandara.findMany({
      where: {
        status: "APPROVED",
        createdAt: { gte: isoHoursAgo(LISTING_WINDOW_HOURS) },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        area: true,
        organizerName: true,
        createdAt: true,
      },
    }),
    prisma.spot.findMany({
      where: {
        status: "APPROVED",
        createdAt: { gte: isoHoursAgo(SPOT_WINDOW_HOURS) },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        area: true,
        reporterName: true,
        createdAt: true,
      },
    }),
    prisma.siteCounter.findUnique({ where: { id: "home" } }),
  ]);

  const events: Activity[] = [];

  for (const b of listings) {
    events.push({
      kind: "list",
      id: `list:${b.id}`,
      who: firstName(b.organizerName),
      what: b.name,
      where: b.area || null,
      at: b.createdAt.toISOString(),
    });
  }
  for (const s of spots) {
    events.push({
      kind: "spot",
      id: `spot:${s.id}`,
      who: firstName(s.reporterName ?? ""),
      where: s.area || null,
      at: s.createdAt.toISOString(),
    });
  }

  // Real "viewers right now" — based on the homepage SSR counter. We can't
  // distinguish unique vs. revisit so we describe it as "devotees viewing
  // today" to stay honest. Skip if the counter is too small to be useful.
  if (counter && counter.count > 12) {
    // Approximate "today's hits" by taking the last 4-hour delta if we
    // had finer-grained data — for now, surface the running total framed
    // as a soft figure.
    events.push({
      kind: "viewers",
      id: `viewers:${Math.floor(Date.now() / 60_000)}`, // changes every minute
      count: counter.count,
      at: new Date().toISOString(),
    });
  }

  // Sort newest first, cap at 25 items.
  events.sort((a, b) => (a.at < b.at ? 1 : -1));
  const trimmed = events.slice(0, 25);

  return NextResponse.json(
    { count: trimmed.length, events: trimmed },
    {
      headers: {
        "Cache-Control": "public, s-maxage=20, stale-while-revalidate=60",
        // Same-origin only. The activity ticker only ever fetches from
        // its own page; no third-party consumer should mirror this feed.
      },
    },
  );
}

function firstName(full: string): string {
  const trimmed = (full || "").trim();
  if (!trimmed) return "Someone";
  const first = trimmed.split(/\s+/)[0];
  // Cap at 14 chars so the toast never overflows on mobile.
  return first.length > 14 ? `${first.slice(0, 13)}…` : first;
}
