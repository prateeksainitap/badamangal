import { prisma } from "@/lib/db";
import AdminOlaMap from "@/components/admin/AdminOlaMap";

/**
 * Async server component wrapper around AdminOlaMap.
 *
 * Lifted out of /admin/home/page.tsx so the 3 `findMany` queries that
 * populate the map (live spots, approved bhandaras, geocoded mentions)
 * can stream in via Suspense INSTEAD of blocking the dashboard's
 * first paint. Previously these 3 queries lived in the page-level
 * `Promise.all` and added ~150–300ms to time-to-first-byte even on
 * a warm pgbouncer connection (the map dataset is ~150KB serialized).
 *
 * Why a server wrapper (not just direct calls in the page):
 *   - Lets the page paint KPIs + greeting first, then stream the
 *     map column in seconds later. Same Suspense pattern as the
 *     ActivityFeed split on the right side of the Live-chat panel.
 *   - The data still ends up as props on AdminOlaMap (a client
 *     component), so the WebGL marker setup runs on the client as
 *     before — no behavior change, just a different render order.
 *
 * Data freshness:
 *   These rows change frequently (new spots every minute on a Tuesday
 *   bhandara day), so we intentionally DO NOT cache them. The whole
 *   /admin/home page is `force-dynamic` and the Suspense boundary
 *   just controls render ORDER, not staleness.
 */
export default async function DashboardLiveMap({
  liveSpotsCount,
}: {
  /** Already computed in the parent's Promise.all so the count tile
   *  + the map's "X live spots" overlay stay in sync. */
  liveSpotsCount: number;
}) {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [liveSpotsForMap, bhandarasForMap, mentionsForMap] = await Promise.all([
    prisma.spot.findMany({
      where: { status: "APPROVED", expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        lat: true,
        lng: true,
        area: true,
        caption: true,
        createdAt: true,
      },
    }),
    prisma.bhandara.findMany({
      where: { status: "APPROVED", lat: { not: 0 } },
      orderBy: { isVerified: "desc" },
      take: 300,
      select: {
        id: true,
        slug: true,
        name: true,
        area: true,
        lat: true,
        lng: true,
        isVerified: true,
      },
    }),
    prisma.bhandaraMention.findMany({
      where: {
        status: "APPROVED",
        createdAt: { gt: dayAgo },
        lat: { not: null },
        lng: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        cleanedText: true,
        originalText: true,
        senderName: true,
        locationLabel: true,
        lat: true,
        lng: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <AdminOlaMap
      spots={liveSpotsForMap}
      bhandaras={bhandarasForMap}
      mentions={mentionsForMap}
      count={liveSpotsCount}
    />
  );
}

/** Skeleton shown by the parent Suspense while the map data fetches.
 *  Matches AdminOlaMap's height stack (h-[22rem] sm:h-[24rem]
 *  lg:h-[28rem]) so the layout doesn't jump when the real map lands. */
export function DashboardLiveMapSkeleton() {
  return (
    <div className="relative h-[22rem] sm:h-[24rem] lg:h-[28rem] bg-[#0A0C13] overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 admin-data-grid opacity-50 pointer-events-none"
      />
      {/* Soft pulsing label so the user knows the map is loading,
          not broken. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/[0.06] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-cyan-300/85">
          <span aria-hidden className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-cyan-400/70 motion-safe:animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
          </span>
          Loading map…
        </div>
      </div>
    </div>
  );
}
