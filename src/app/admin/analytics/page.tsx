import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminNavCounts } from "@/lib/admin-nav-counts";
import BotHeartbeat from "@/components/admin/BotHeartbeat";
import { istTodayIso } from "@/lib/dates";
import TabPending from "./TabPending";

export const metadata: Metadata = {
  title: "Analytics · Admin · Bada Mangal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * /admin/analytics — operator analytics, weekly-summary first.
 *
 * Two surfaces in one page:
 *   1. Weekly summary (top) — Live chat + spot map activity since
 *      the most recent Friday at 00:00 IST. Mirrors the
 *      scripts/live-chat-insights.mjs output but live-queried.
 *      This is the "what just happened" view.
 *   2. All-time sections (below) — funnels, top areas, top
 *      organisers, 14-day timeseries. The "where are we overall"
 *      view.
 *
 * Everything pulls from our own Postgres tables; no GA round-trip,
 * no service-account JSON. Page is force-dynamic so it always
 * reflects the live DB. ~9 parallel queries via Promise.allSettled
 * so a single transient EMAXCONN doesn't 500 the page — each
 * section degrades to zero independently.
 */

/** Compute the most recent Friday at 00:00 IST as a UTC Date
 *  cutoff for "this week". Anchors the weekly view to a stable
 *  weekly boundary that captures Saturday's chat + Tuesday's
 *  Bada Mangal + the Mon-Wed wind-down. Calling at any time on a
 *  Friday returns today 00:00 IST; on a Thursday returns last
 *  Friday 00:00 IST. */
function mostRecentFridayCutoffUTC(now: Date = new Date()): Date {
  // Convert to IST, then walk back to Friday.
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const dayOfWeek = istNow.getUTCDay(); // 0=Sun … 5=Fri … 6=Sat
  // Days to subtract to land on Friday (5).
  const daysBack = (dayOfWeek - 5 + 7) % 7;
  const friday = new Date(istNow);
  friday.setUTCDate(istNow.getUTCDate() - daysBack);
  friday.setUTCHours(0, 0, 0, 0);
  // friday is "Friday 00:00 IST" expressed in UTC fields. Subtract
  // 5.5h to get the actual UTC moment that corresponds to IST
  // midnight on that date.
  return new Date(friday.getTime() - 5.5 * 60 * 60 * 1000);
}

const FEATURE_TABS = [
  { key: "chat", label: "Live chat" },
  { key: "map", label: "Live map" },
  { key: "spots", label: "Spots" },
  { key: "listings", label: "Listings" },
  { key: "volunteers", label: "Volunteers" },
] as const;
type FeatureKey = (typeof FEATURE_TABS)[number]["key"];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{ feature?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin");

  const sp = (await searchParams) ?? {};
  const feature: FeatureKey = FEATURE_TABS.some((t) => t.key === sp.feature)
    ? (sp.feature as FeatureKey)
    : "chat";

  const SINCE = mostRecentFridayCutoffUTC();
  const SINCE_LABEL = SINCE.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  return (
    <AdminShell
      navCounts={await getAdminNavCounts()}
      botHeartbeat={<BotHeartbeat />}
    >
      <div className="max-w-7xl mx-auto">
        {/* Page header */}
        <div className="mb-5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300/85 mb-1.5">
              Operator analytics
            </div>
            <h1 className="font-fraunces text-xl sm:text-2xl text-cream-50 leading-tight">
              What&apos;s happening on the site
            </h1>
            <p className="text-sm text-cream-50/55 mt-1 font-mukta">
              Weekly summary up top, all-time funnels + top movers
              below. Every number is live from the database — no
              GA, no service-account, no caching window.
            </p>
          </div>
          <Link
            href="/admin/home"
            prefetch={false}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-3 py-1.5 text-xs transition-colors font-mono font-medium"
          >
            ← Dashboard
          </Link>
        </div>

        {/* Weekly summary — the lead. Suspense-wrapped so the
            page paints chrome before the 9 parallel queries
            resolve. */}
        <Suspense fallback={<WeeklySummarySkeleton sinceLabel={SINCE_LABEL} />}>
          <WeeklySummary since={SINCE} sinceLabel={SINCE_LABEL} />
        </Suspense>

        {/* Qualitative insights — pattern-based observations
            derived from the same DB queries, surfaced as
            color-coded callouts so the operator gets the "what
            this means" without reading every chart. Independent
            Suspense so a slow query here doesn't block the
            feature deep-dive section below. */}
        <Suspense fallback={<InsightsSkeleton />}>
          <QualitativeInsights since={SINCE} />
        </Suspense>

        {/* Feature deep-dives. Tabbed (URL param ?feature=...) so
            five feature panels can coexist without scroll-bloat.
            Each tab is independently Suspense-wrapped so it streams
            from the server cleanly and any single feature's query
            failure stays contained to its tab. */}
        <section className="mt-10">
          <div className="mb-1 flex items-baseline gap-2 flex-wrap font-mono text-[10.5px] uppercase tracking-[0.18em]">
            <span className="text-violet-300">Feature deep-dive</span>
            <span className="text-cream-50/30">·</span>
            <span className="text-cream-50/65">
              {FEATURE_TABS.find((t) => t.key === feature)?.label}
            </span>
          </div>
          <h2 className="font-fraunces text-cream-50 text-lg mb-3">
            Per-feature breakdown
          </h2>

          {/* Tab strip — each tab is a Link so deep-links work +
              prefetch fires the next tab's data on hover. */}
          <div
            role="tablist"
            aria-label="Analytics feature tabs"
            className="mb-5 inline-flex flex-wrap items-center gap-1 rounded-2xl border border-cyan-400/20 bg-[#0B0E16]/85 backdrop-blur-sm p-1 font-mono"
          >
            {FEATURE_TABS.map((t) => {
              const active = feature === t.key;
              return (
                <Link
                  key={t.key}
                  href={`/admin/analytics?feature=${t.key}`}
                  role="tab"
                  aria-selected={active}
                  prefetch={false}
                  scroll={false}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors",
                    active
                      ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-cream-50 shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)]"
                      : "text-cream-50/65 hover:text-cream-50 hover:bg-cyan-400/[0.06]",
                  ].join(" ")}
                >
                  {/* Inline pending spinner — `useLinkStatus` flips
                      visible the moment this Link starts navigating.
                      Sits to the left of the label so the layout
                      stays stable (a 12px gap appears only when
                      pending). */}
                  <TabPending />
                  <span>{t.label}</span>
                </Link>
              );
            })}
          </div>

          <Suspense
            key={feature}
            fallback={<FeatureBreakdownSkeleton />}
          >
            {feature === "chat" ? <LiveChatDeepDive since={SINCE} /> : null}
            {feature === "map" ? <LiveMapDeepDive /> : null}
            {feature === "spots" ? <SpotsDeepDive since={SINCE} /> : null}
            {feature === "listings" ? <ListingsDeepDive /> : null}
            {feature === "volunteers" ? <VolunteersDeepDive since={SINCE} /> : null}
          </Suspense>
        </section>

        {/* All-time funnels + tables — secondary surface. */}
        <Suspense fallback={<AllTimeSkeleton />}>
          <AllTimeSection />
        </Suspense>
      </div>
    </AdminShell>
  );
}

/* ───────────────────── Weekly summary ─────────────────────────── */

async function WeeklySummary({
  since,
  sinceLabel,
}: {
  since: Date;
  sinceLabel: string;
}) {
  // Nine parallel queries via Promise.allSettled so any single
  // rejection degrades to zero in that tile, not a 500 on the page.
  const settled = await Promise.allSettled([
    prisma.bhandaraMention.count({ where: { createdAt: { gte: since } } }),
    prisma.bhandaraMention.count({
      where: { createdAt: { gte: since }, lat: { not: null } },
    }),
    prisma.spot.count({ where: { createdAt: { gte: since } } }),
    prisma.spot.count({
      where: {
        createdAt: { gte: since },
        photoUrl: { not: null },
        AND: [{ lat: { not: 0 } }, { lng: { not: 0 } }],
      },
    }),
    prisma.bhandara.count({ where: { createdAt: { gte: since } } }),
    prisma.bhandara.count({
      where: {
        createdAt: { gte: since },
        description: { contains: "[bot:" },
      },
    }),
    prisma.bhandaraMention.groupBy({
      by: ["intent"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.bhandaraMention.groupBy({
      by: ["groupName"],
      where: { createdAt: { gte: since }, groupName: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { groupName: "desc" } },
      take: 6,
    }),
    // botIngestionLog table is the only one that could be missing
    // (it was added late in the project; defensive catch returns
    // an empty array if the table doesn't exist yet in this env).
    prisma.botIngestionLog
      .groupBy({
        by: ["outcome"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        orderBy: { _count: { outcome: "desc" } },
      })
      .catch(() => [] as Array<{ outcome: string; _count: { _all: number } }>),
  ]);
  const unwrapN = (i: number): number =>
    settled[i]?.status === "fulfilled" ? (settled[i] as PromiseFulfilledResult<number>).value : 0;
  const unwrapArr = <T,>(i: number): T[] =>
    settled[i]?.status === "fulfilled" ? ((settled[i] as PromiseFulfilledResult<T[]>).value) : [];

  const mentions = unwrapN(0);
  const mentionsPlotted = unwrapN(1);
  const spots = unwrapN(2);
  const richSpots = unwrapN(3);
  const bhandaras = unwrapN(4);
  const bhandarasFromBot = unwrapN(5);
  const intentRows = unwrapArr<{ intent: string; _count: { _all: number } }>(6);
  const topGroups = unwrapArr<{ groupName: string | null; _count: { _all: number } }>(7);
  const ingestRows = unwrapArr<{ outcome: string; _count: { _all: number } }>(8);

  // Daily breakdown via raw SQL (only way to get IST-grouped
  // calendar dates cleanly). Wrapped in try/catch to keep parity
  // with the allSettled posture above.
  let dailyRows: Array<{ day: string; total: number; plotted: number }> = [];
  try {
    const rows = await prisma.$queryRaw<
      Array<{ day: Date | string; total: bigint | number; plotted: bigint | number }>
    >`
      SELECT
        TO_CHAR(DATE_TRUNC('day', "createdAt" AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS total,
        SUM(CASE WHEN "lat" IS NOT NULL THEN 1 ELSE 0 END)::int AS plotted
      FROM "BhandaraMention"
      WHERE "createdAt" >= ${since}
      GROUP BY day
      ORDER BY day ASC
    `;
    dailyRows = rows.map((r) => ({
      day: typeof r.day === "string" ? r.day : new Date(r.day).toISOString().slice(0, 10),
      total: Number(r.total),
      plotted: Number(r.plotted),
    }));
  } catch (err) {
    console.error("[analytics] daily-mentions query rejected:", err);
  }

  const dailyMax = Math.max(...dailyRows.map((d) => d.total), 1);

  // Top intent breakdown
  const intentMap = new Map<string, number>();
  for (const r of intentRows) intentMap.set(r.intent, r._count._all);
  const sharing = intentMap.get("SHARING") ?? 0;
  const asking = intentMap.get("ASKING") ?? 0;
  const mentioning = intentMap.get("MENTIONING") ?? 0;

  // Ingest funnel — collapse to two numbers for the headline tile
  const ingestTotal = ingestRows.reduce((s, r) => s + r._count._all, 0);
  const ingestSuccess =
    ingestRows.find((r) => r.outcome === "SUCCESS_SPOT")?._count._all ?? 0;
  const ingestSuccessBh =
    ingestRows.find((r) => r.outcome === "SUCCESS_BHANDARA")?._count._all ?? 0;
  const ingestSuccessRate =
    ingestTotal > 0
      ? (((ingestSuccess + ingestSuccessBh) / ingestTotal) * 100).toFixed(0)
      : "—";

  // Total community signals = mentions + spots + bhandaras
  const totalSignals = mentions + spots + bhandaras;
  // Map plots = mentions with coords + spots with coords (the same
  // accounting the homepage map performs)
  const mapPlots = mentionsPlotted + richSpots;

  return (
    <>
      {/* Eyebrow + window label */}
      <div className="mb-3 flex items-baseline gap-2 flex-wrap font-mono text-[10.5px] uppercase tracking-[0.18em]">
        <span className="text-saffron-300">This week</span>
        <span className="text-cream-50/30">·</span>
        <span className="text-cream-50/65">Since {sinceLabel}</span>
        <span className="text-cream-50/30">·</span>
        <span className="text-cream-50/45">
          {totalSignals.toLocaleString("en-IN")} community signals captured
        </span>
      </div>

      {/* 5 KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <WeekTile
          label="Chat mentions"
          value={mentions}
          sub={`${mentionsPlotted} plotted on map`}
          tone="cyan"
        />
        <WeekTile
          label="Map plots"
          value={mapPlots}
          sub="Mentions + rich spots"
          tone="leaf"
          emphasis
        />
        <WeekTile
          label="Spots"
          value={spots}
          sub={`${richSpots} with photo + coords`}
          tone="violet"
        />
        <WeekTile
          label="Bhandaras"
          value={bhandaras}
          sub={`${bhandarasFromBot} via bot`}
          tone="saffron"
        />
        <WeekTile
          label="Bot success"
          value={ingestTotal}
          sub={`${ingestSuccessRate}% conversion`}
          tone="ink"
          isAttemptCount
        />
      </div>

      {/* Daily breakdown chart */}
      <Panel
        title="Daily breakdown"
        subtitle="Mentions per day (IST), with the share that landed on the map"
      >
        {dailyRows.length === 0 ? (
          <EmptyHint text="No mentions yet in this window." />
        ) : (
          <div className="space-y-1.5">
            {dailyRows.map((d) => {
              const totalWidth = (d.total / dailyMax) * 100;
              const plottedWidth = (d.plotted / dailyMax) * 100;
              const dayDate = new Date(`${d.day}T00:00:00+05:30`);
              const dayName = dayDate.toLocaleDateString("en-IN", {
                weekday: "short",
                timeZone: "Asia/Kolkata",
              });
              const dayPretty = dayDate.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                timeZone: "Asia/Kolkata",
              });
              const isTuesday = dayName.toLowerCase().startsWith("tue");
              const isSaturday = dayName.toLowerCase().startsWith("sat");
              return (
                <div
                  key={d.day}
                  className="flex items-center gap-3 text-[12px]"
                >
                  <div
                    className={[
                      "w-24 font-mono tabular-nums shrink-0",
                      isTuesday
                        ? "text-saffron-300 font-semibold"
                        : isSaturday
                          ? "text-cyan-300"
                          : "text-cream-50/55",
                    ].join(" ")}
                  >
                    {dayName} · {dayPretty}
                  </div>
                  <div className="flex-1 h-5 bg-cream-50/[0.04] rounded overflow-hidden relative">
                    {/* Total mentions bar (cyan/violet faint) */}
                    <div
                      className="absolute inset-y-0 left-0 bg-violet-400/30"
                      style={{ width: `${totalWidth}%` }}
                    />
                    {/* Plotted-on-map overlay (cyan solid) */}
                    <div
                      className="absolute inset-y-0 left-0 bg-cyan-400/70"
                      style={{ width: `${plottedWidth}%` }}
                    />
                  </div>
                  <div className="w-32 text-right text-cream-50/70 tabular-nums font-mono">
                    {d.total}{" "}
                    <span className="text-cream-50/40">·</span>{" "}
                    <span className="text-cyan-300">{d.plotted}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-3 flex items-center gap-4 text-[10px] font-mono text-cream-50/55">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-cyan-400/70" />
            plotted on map
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-violet-400/30" />
            mention, no coords
          </span>
        </div>
      </Panel>

      {/* Side-by-side: top groups + intent + ingest funnel */}
      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Panel
          title="Top WhatsApp groups"
          subtitle="Mention volume by group, this week"
        >
          {topGroups.length === 0 ? (
            <EmptyHint text="No groups have contributed this week yet." />
          ) : (
            <ul className="space-y-1.5">
              {topGroups.map((g) => (
                <li
                  key={g.groupName ?? "—"}
                  className="flex items-center justify-between gap-2 text-[12.5px]"
                >
                  <span className="text-cream-50/85 truncate">
                    {g.groupName ?? "—"}
                  </span>
                  <span className="text-cream-50/70 font-mono tabular-nums">
                    {g._count._all}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="What people came to do"
          subtitle="Mention intent split (Gemini classifier)"
        >
          <IntentBar label="SHARING" value={sharing} total={mentions} tone="leaf" />
          <IntentBar label="ASKING" value={asking} total={mentions} tone="saffron" />
          <IntentBar label="MENTIONING" value={mentioning} total={mentions} tone="violet" />
          <p className="mt-3 text-[11px] text-cream-50/55 font-mukta leading-relaxed">
            {sharing > 0 && asking > 0 ? (
              <>
                {((asking / (sharing + asking)) * 100).toFixed(0)}% of
                actionable mentions are people <em>looking</em> for a
                bhandara, not announcing one. The chat is a demand
                signal, not just a feed.
              </>
            ) : null}
          </p>
        </Panel>
      </div>

      {/* Ingest funnel — full breakdown */}
      <div className="mt-4">
        <Panel
          title="Bot ingest funnel"
          subtitle="Every /api/bot/* attempt this week, by outcome"
        >
          {ingestRows.length === 0 ? (
            <EmptyHint text="No bot ingest attempts logged this week." />
          ) : (
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {ingestRows.map((r) => (
                <li
                  key={r.outcome}
                  className="rounded-lg border border-cream-50/10 bg-cream-50/[0.03] px-3 py-2 flex items-center justify-between gap-2"
                >
                  <span className="text-[11px] font-mono text-cream-50/75 truncate">
                    {r.outcome}
                  </span>
                  <span className="font-mono tabular-nums text-cream-50/85 text-sm">
                    {r._count._all}{" "}
                    <span className="text-cream-50/40 text-[10.5px]">
                      ({((r._count._all / Math.max(ingestTotal, 1)) * 100).toFixed(1)}%)
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

/* ───────────────────── All-time section ───────────────────────── */

async function AllTimeSection() {
  const settled = await Promise.allSettled([
    prisma.bhandara.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.spot.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.bhandara.groupBy({
      by: ["area"],
      where: { status: "APPROVED" },
      _count: { _all: true },
    }),
    prisma.spot.groupBy({
      by: ["area"],
      where: { status: "APPROVED" },
      _count: { _all: true },
    }),
    prisma.bhandara.findMany({
      where: { status: "APPROVED" },
      select: { organizerName: true, organizerPhone: true, slug: true },
    }),
    prisma.$queryRaw<
      Array<{ day: string; bhandaras: number; spots: number }>
    >`
      SELECT
        TO_CHAR(d.day, 'YYYY-MM-DD') AS day,
        COALESCE(b.n, 0)::int AS bhandaras,
        COALESCE(s.n, 0)::int AS spots
      FROM generate_series(
        ((CURRENT_DATE AT TIME ZONE 'Asia/Kolkata') - INTERVAL '13 days')::date,
        (CURRENT_DATE AT TIME ZONE 'Asia/Kolkata')::date,
        '1 day'
      ) AS d(day)
      LEFT JOIN (
        SELECT DATE("createdAt" AT TIME ZONE 'Asia/Kolkata') AS day, COUNT(*) AS n
        FROM "Bhandara" GROUP BY DATE("createdAt" AT TIME ZONE 'Asia/Kolkata')
      ) b ON b.day = d.day
      LEFT JOIN (
        SELECT DATE("createdAt" AT TIME ZONE 'Asia/Kolkata') AS day, COUNT(*) AS n
        FROM "Spot" GROUP BY DATE("createdAt" AT TIME ZONE 'Asia/Kolkata')
      ) s ON s.day = d.day
      ORDER BY d.day ASC
    `,
  ]);
  type Grp<K extends string> = Array<{ [k in K]: string | null } & { _count: { _all: number } }>;
  const unwrap = <T,>(i: number, fallback: T): T =>
    settled[i]?.status === "fulfilled"
      ? ((settled[i] as PromiseFulfilledResult<T>).value)
      : fallback;
  const bhandaraByStatus = unwrap<Grp<"status">>(0, []);
  const spotByStatus = unwrap<Grp<"status">>(1, []);
  const bhandaraByArea = unwrap<Grp<"area">>(2, []);
  const spotByArea = unwrap<Grp<"area">>(3, []);
  const organiserCounts = unwrap<
    Array<{ organizerName: string | null; organizerPhone: string | null; slug: string }>
  >(4, []);
  const recentDays = unwrap<
    Array<{ day: string; bhandaras: number; spots: number }>
  >(5, []);

  // Funnel derivations
  const bhStatusMap = new Map(bhandaraByStatus.map((r) => [r.status, r._count._all]));
  const bhPending = bhStatusMap.get("PENDING") ?? 0;
  const bhApproved = bhStatusMap.get("APPROVED") ?? 0;
  const bhRejected = bhStatusMap.get("REJECTED") ?? 0;
  const bhTotal = bhPending + bhApproved + bhRejected;
  const bhApprovalRate = bhTotal > 0 ? (bhApproved / bhTotal) * 100 : 0;

  const spStatusMap = new Map(spotByStatus.map((r) => [r.status, r._count._all]));
  const spPending = spStatusMap.get("PENDING") ?? 0;
  const spApproved = spStatusMap.get("APPROVED") ?? 0;
  const spRejected = spStatusMap.get("REJECTED") ?? 0;
  const spTotal = spPending + spApproved + spRejected;
  const spApprovalRate = spTotal > 0 ? (spApproved / spTotal) * 100 : 0;

  // Combined top areas
  const areaMap = new Map<string, { bhandaras: number; spots: number }>();
  for (const r of bhandaraByArea) {
    if (!r.area) continue;
    const e = areaMap.get(r.area) ?? { bhandaras: 0, spots: 0 };
    e.bhandaras = r._count._all;
    areaMap.set(r.area, e);
  }
  for (const r of spotByArea) {
    if (!r.area) continue;
    const e = areaMap.get(r.area) ?? { bhandaras: 0, spots: 0 };
    e.spots = r._count._all;
    areaMap.set(r.area, e);
  }
  const topAreas = Array.from(areaMap.entries())
    .map(([area, v]) => ({ area, ...v, total: v.bhandaras + v.spots }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Organisers with 2+ approved bhandaras
  const organiserMap = new Map<
    string,
    { name: string; phone: string | null; count: number }
  >();
  for (const r of organiserCounts) {
    const key = (r.organizerName ?? "").trim().toLowerCase();
    if (!key) continue;
    const e = organiserMap.get(key) ?? {
      name: r.organizerName ?? "—",
      phone: r.organizerPhone,
      count: 0,
    };
    e.count++;
    organiserMap.set(key, e);
  }
  const topOrganisers = Array.from(organiserMap.values())
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const submissionsByDayMax = Math.max(
    ...recentDays.map((d) => d.bhandaras + d.spots),
    1,
  );

  return (
    <section className="mt-10">
      <h2 className="font-fraunces text-cream-50 text-lg mb-1">All-time</h2>
      <p className="text-[12px] text-cream-50/55 mb-4 font-mukta">
        Conversion funnels + top movers across the lifetime of the
        platform. Weekly window above is a slice of this.
      </p>

      {/* Funnels side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <FunnelCard
          title="Listed bhandara funnel"
          subtitle="Organiser submissions through /organise + admin scan"
          stages={[
            { label: "Total submitted", count: bhTotal, tone: "neutral" },
            { label: "Pending", count: bhPending, tone: "amber" },
            {
              label: "Approved → live",
              count: bhApproved,
              tone: "green",
              pct: bhTotal > 0 ? (bhApproved / bhTotal) * 100 : 0,
            },
            {
              label: "Rejected",
              count: bhRejected,
              tone: "red",
              pct: bhTotal > 0 ? (bhRejected / bhTotal) * 100 : 0,
            },
          ]}
          footer={`Approval rate · ${bhApprovalRate.toFixed(1)}%`}
        />
        <FunnelCard
          title="Spot funnel"
          subtitle="Walker spots via the camera + GPS flow"
          stages={[
            { label: "Total submitted", count: spTotal, tone: "neutral" },
            { label: "Pending", count: spPending, tone: "amber" },
            {
              label: "Approved → live",
              count: spApproved,
              tone: "green",
              pct: spTotal > 0 ? (spApproved / spTotal) * 100 : 0,
            },
            {
              label: "Rejected",
              count: spRejected,
              tone: "red",
              pct: spTotal > 0 ? (spRejected / spTotal) * 100 : 0,
            },
          ]}
          footer={`Approval rate · ${spApprovalRate.toFixed(1)}%`}
        />
      </div>

      {/* Top areas + organisers */}
      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Panel
          title="Top 10 areas, all time"
          subtitle="Combined approved bhandaras + spots"
        >
          {topAreas.length === 0 ? (
            <EmptyHint text="No approved rows yet." />
          ) : (
            <table className="w-full text-[12.5px]">
              <thead className="text-cream-50/55 font-mono text-[10px] uppercase tracking-[0.14em]">
                <tr className="border-b border-cream-50/10">
                  <th className="text-left py-2 px-1">Area</th>
                  <th className="text-right py-2 px-1">Bhandaras</th>
                  <th className="text-right py-2 px-1">Spots</th>
                  <th className="text-right py-2 px-1">Total</th>
                </tr>
              </thead>
              <tbody>
                {topAreas.map((a) => (
                  <tr
                    key={a.area}
                    className="border-b border-cream-50/[0.06]"
                  >
                    <td className="py-2 px-1 text-cream-50/85">{a.area}</td>
                    <td className="py-2 px-1 text-right text-saffron-300 tabular-nums font-mono">
                      {a.bhandaras}
                    </td>
                    <td className="py-2 px-1 text-right text-violet-300 tabular-nums font-mono">
                      {a.spots}
                    </td>
                    <td className="py-2 px-1 text-right text-cream-50 tabular-nums font-mono font-semibold">
                      {a.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel
          title="Top organisers"
          subtitle="2+ approved bhandaras — candidates for thank-you outreach"
        >
          {topOrganisers.length === 0 ? (
            <EmptyHint text="No organisers with multiple listings yet." />
          ) : (
            <table className="w-full text-[12.5px]">
              <thead className="text-cream-50/55 font-mono text-[10px] uppercase tracking-[0.14em]">
                <tr className="border-b border-cream-50/10">
                  <th className="text-left py-2 px-1">Organiser</th>
                  <th className="text-left py-2 px-1">Phone</th>
                  <th className="text-right py-2 px-1">Bhandaras</th>
                </tr>
              </thead>
              <tbody>
                {topOrganisers.map((o) => (
                  <tr
                    key={o.name}
                    className="border-b border-cream-50/[0.06]"
                  >
                    <td className="py-2 px-1 text-cream-50/85">{o.name}</td>
                    <td className="py-2 px-1 text-cream-50/55 font-mono text-[11px]">
                      {o.phone ?? "—"}
                    </td>
                    <td className="py-2 px-1 text-right text-saffron-300 tabular-nums font-mono font-semibold">
                      {o.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      {/* 14-day timeseries */}
      <div className="mt-4">
        <Panel
          title="Submissions, last 14 days"
          subtitle="New bhandaras + spots by day (IST)"
        >
          {recentDays.length === 0 ? (
            <EmptyHint text="No data in window." />
          ) : (
            <div className="space-y-1.5">
              {recentDays.map((d) => {
                const total = d.bhandaras + d.spots;
                return (
                  <div
                    key={d.day}
                    className="flex items-center gap-3 text-[12px]"
                  >
                    <div className="w-20 font-mono text-cream-50/55 tabular-nums shrink-0">
                      {d.day.slice(5)}
                    </div>
                    <div className="flex-1 h-5 bg-cream-50/[0.04] rounded overflow-hidden flex">
                      {d.bhandaras > 0 && (
                        <div
                          className="bg-saffron-500/70 h-full"
                          style={{
                            width: `${(d.bhandaras / submissionsByDayMax) * 100}%`,
                          }}
                        />
                      )}
                      {d.spots > 0 && (
                        <div
                          className="bg-violet-500/70 h-full"
                          style={{
                            width: `${(d.spots / submissionsByDayMax) * 100}%`,
                          }}
                        />
                      )}
                    </div>
                    <div className="w-16 text-right text-cream-50/75 tabular-nums font-mono">
                      {total > 0 ? (
                        total
                      ) : (
                        <span className="text-cream-50/25">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-3 flex items-center gap-4 text-[10px] font-mono text-cream-50/55">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-saffron-500/70" />
              bhandaras
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-violet-500/70" />
              spots
            </span>
          </div>
        </Panel>
      </div>
    </section>
  );
}

/* ─────────────── Qualitative insights ─────────────────────────── */

/**
 * Pattern-based "what we're seeing" callouts derived from the
 * same DB the rest of the page queries. Each rule below checks a
 * threshold or comparison and emits a card if the condition is
 * worth surfacing — so the operator doesn't have to read every
 * chart to know what to do this week.
 *
 * Tone vocabulary:
 *   • good   — green; momentum + healthy signals
 *   • watch  — saffron; worth keeping an eye on, not urgent
 *   • fire   — red/alert; needs action today
 *   • info   — cyan; neutral observation, no judgement
 *
 * Rules currently implemented (more can be added by appending to
 * the rules array — each rule is a pure function of `data`):
 *   1. Tuesday concentration         (info)
 *   2. Week-over-week growth         (good / watch / info)
 *   3. Top-group concentration risk  (watch)
 *   4. Demand-vs-supply (ASKING:SHARING) (watch / info)
 *   5. Coverage gap (bhandaras with lat=0/lng=0) (fire / good)
 *   6. Classifier health             (good / watch)
 *   7. Spot quality (rich %)         (good / watch / info)
 *   8. Sunday traffic                (info; intentional dark day)
 *
 * Everything runs against the same `since` cutoff the rest of
 * the page uses + a `priorSince` for week-over-week.
 */
async function QualitativeInsights({ since }: { since: Date }) {
  // Last-week window: from 7 days before `since` until `since`.
  const priorSince = new Date(since.getTime() - 7 * 24 * 60 * 60 * 1000);

  const settled = await Promise.allSettled([
    // 0 — this week mention count
    prisma.bhandaraMention.count({ where: { createdAt: { gte: since } } }),
    // 1 — last week mention count
    prisma.bhandaraMention.count({
      where: { createdAt: { gte: priorSince, lt: since } },
    }),
    // 2 — this week SHARING + ASKING + Tuesday-share + Sunday count
    //     via raw SQL so we get the IST-grouped day-of-week breakdown
    prisma.$queryRaw<
      Array<{
        sharing: bigint | number;
        asking: bigint | number;
        tue_count: bigint | number;
        sun_count: bigint | number;
        total: bigint | number;
        approved: bigint | number;
      }>
    >`
      SELECT
        SUM(CASE WHEN intent = 'SHARING' THEN 1 ELSE 0 END)::int AS sharing,
        SUM(CASE WHEN intent = 'ASKING' THEN 1 ELSE 0 END)::int AS asking,
        SUM(CASE
          WHEN EXTRACT(DOW FROM ("createdAt" AT TIME ZONE 'Asia/Kolkata')) = 2
          THEN 1 ELSE 0
        END)::int AS tue_count,
        SUM(CASE
          WHEN EXTRACT(DOW FROM ("createdAt" AT TIME ZONE 'Asia/Kolkata')) = 0
          THEN 1 ELSE 0
        END)::int AS sun_count,
        COUNT(*)::int AS total,
        SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END)::int AS approved
      FROM "BhandaraMention"
      WHERE "createdAt" >= ${since}
    `,
    // 3 — top WhatsApp group this week (for concentration calc)
    prisma.bhandaraMention.groupBy({
      by: ["groupName"],
      where: { createdAt: { gte: since }, groupName: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { groupName: "desc" } },
      take: 1,
    }),
    // 4 — coverage gap: approved bhandaras with lat=0 or lng=0
    prisma.bhandara.count({
      where: {
        status: "APPROVED",
        OR: [{ lat: 0 }, { lng: 0 }],
      },
    }),
    // 5 — this week spot quality: total + rich (photo + coords)
    prisma.$queryRaw<
      Array<{ total: bigint | number; rich: bigint | number }>
    >`
      SELECT
        COUNT(*)::int AS total,
        SUM(CASE
          WHEN "photoUrl" IS NOT NULL AND "lat" <> 0 AND "lng" <> 0
          THEN 1 ELSE 0
        END)::int AS rich
      FROM "Spot"
      WHERE "createdAt" >= ${since}
    `,
    // 6 — this week map plots (mentions with coords + rich spots)
    prisma.bhandaraMention.count({
      where: { createdAt: { gte: since }, lat: { not: null } },
    }),
    // 7 — last week map plots for WoW comparison
    prisma.bhandaraMention.count({
      where: { createdAt: { gte: priorSince, lt: since }, lat: { not: null } },
    }),
  ]);

  const unwrap = <T,>(i: number, fallback: T): T =>
    settled[i]?.status === "fulfilled"
      ? ((settled[i] as PromiseFulfilledResult<T>).value)
      : fallback;

  const weekMentions = unwrap<number>(0, 0);
  const lastWeekMentions = unwrap<number>(1, 0);
  const intentRows = unwrap<
    Array<{
      sharing: bigint | number;
      asking: bigint | number;
      tue_count: bigint | number;
      sun_count: bigint | number;
      total: bigint | number;
      approved: bigint | number;
    }>
  >(2, []);
  const intent = intentRows[0];
  const sharing = Number(intent?.sharing ?? 0);
  const asking = Number(intent?.asking ?? 0);
  const tueCount = Number(intent?.tue_count ?? 0);
  const sunCount = Number(intent?.sun_count ?? 0);
  const intentTotal = Number(intent?.total ?? 0);
  const approvedCount = Number(intent?.approved ?? 0);
  const topGroupRows = unwrap<
    Array<{ groupName: string | null; _count: { _all: number } }>
  >(3, []);
  const topGroup = topGroupRows[0];
  const coverageGap = unwrap<number>(4, 0);
  const spotRows = unwrap<
    Array<{ total: bigint | number; rich: bigint | number }>
  >(5, []);
  const weekSpotsTotal = Number(spotRows[0]?.total ?? 0);
  const weekRichSpots = Number(spotRows[0]?.rich ?? 0);
  const weekMapPlots = unwrap<number>(6, 0);
  const lastWeekMapPlots = unwrap<number>(7, 0);

  // ─── Rule set ───────────────────────────────────────────────
  const insights: Insight[] = [];

  // Rule 1: Tuesday concentration
  if (intentTotal > 0) {
    const tueShare = tueCount / intentTotal;
    if (tueShare > 0.5) {
      insights.push({
        kind: "info",
        title: "Tuesday is the entire product",
        body: `${Math.round(tueShare * 100)}% of this week's chat activity hit on Tuesday alone. Off-day investment should target retention (notifications) + outreach, not chat features.`,
      });
    }
  }

  // Rule 2: Week-over-week mentions
  if (lastWeekMentions > 5) {
    const wow =
      ((weekMentions - lastWeekMentions) / lastWeekMentions) * 100;
    if (Math.abs(wow) > 10) {
      const direction = wow > 0 ? "up" : "down";
      insights.push({
        kind: wow > 0 ? "good" : "watch",
        title: `Mentions ${direction} ${Math.abs(Math.round(wow))}% WoW`,
        body: `${weekMentions.toLocaleString("en-IN")} this week vs ${lastWeekMentions.toLocaleString("en-IN")} last week. ${wow > 0 ? "Momentum building — keep the outreach steady." : "Watch for the cause: bot health, group activity, or upstream noise."}`,
      });
    }
  }

  // Rule 2b: Map plots WoW
  if (lastWeekMapPlots > 5) {
    const wowPlots =
      ((weekMapPlots - lastWeekMapPlots) / lastWeekMapPlots) * 100;
    if (Math.abs(wowPlots) > 15) {
      const direction = wowPlots > 0 ? "up" : "down";
      insights.push({
        kind: wowPlots > 0 ? "good" : "watch",
        title: `Map plots ${direction} ${Math.abs(Math.round(wowPlots))}% WoW`,
        body: `${weekMapPlots.toLocaleString("en-IN")} plotted this week vs ${lastWeekMapPlots.toLocaleString("en-IN")} last week. ${wowPlots > 0 ? "Geocode chain holding up." : "Check geocode failures + location-share opt-in rate."}`,
      });
    }
  }

  // Rule 3: Top-group concentration
  if (topGroup && intentTotal > 30) {
    const groupShare = topGroup._count._all / intentTotal;
    if (groupShare > 0.35) {
      insights.push({
        kind: "watch",
        title: "Group concentration risk",
        body: `"${topGroup.groupName ?? "—"}" carries ${Math.round(groupShare * 100)}% of chat volume this week. If this single source goes dark, ${Math.round((1 - groupShare) * 100)}% of the firehose remains.`,
      });
    }
  }

  // Rule 4: Demand-vs-supply (ASKING vs SHARING)
  if (sharing + asking > 20) {
    const askingShare = asking / (sharing + asking);
    if (askingShare > 0.4) {
      insights.push({
        kind: "watch",
        title: "Demand outpacing supply",
        body: `${Math.round(askingShare * 100)}% of actionable mentions are people ASKING for bhandaras, not announcing them. Push organizer outreach + pamphlet shares before next Tuesday.`,
      });
    } else if (askingShare < 0.2) {
      insights.push({
        kind: "good",
        title: "Supply ahead of demand",
        body: `Only ${Math.round(askingShare * 100)}% of mentions are people asking — organizers are advertising proactively. Direct visitors to the map.`,
      });
    }
  }

  // Rule 5: Coverage gap
  if (coverageGap >= 5) {
    insights.push({
      kind: "fire",
      title: `${coverageGap} bhandaras invisible on the map`,
      body: `Approved listings that auto-publish passed through but the geocode chain couldn't resolve. Fix before next Tuesday — visitors won't find them.`,
      action: {
        href: "/admin/bhandaras?status=LIVE",
        label: "Triage now",
      },
    });
  } else if (coverageGap === 0) {
    insights.push({
      kind: "good",
      title: "100% map coverage",
      body: "Every approved bhandara has valid coords. Map renders the full inventory.",
    });
  }

  // Rule 6: Classifier health
  if (intentTotal > 30) {
    const autoApprovalRate = approvedCount / intentTotal;
    if (autoApprovalRate > 0.98) {
      insights.push({
        kind: "good",
        title: "Classifier tuned",
        body: `${(autoApprovalRate * 100).toFixed(1)}% auto-approval rate this week (${approvedCount.toLocaleString("en-IN")} of ${intentTotal.toLocaleString("en-IN")}). Gemini + BM Ingest bypass + auto-publish are calibrated.`,
      });
    } else if (autoApprovalRate < 0.9) {
      insights.push({
        kind: "watch",
        title: "Classifier drift",
        body: `Only ${(autoApprovalRate * 100).toFixed(1)}% auto-approved this week (vs the typical 99%+). Investigate Gemini output quality or threshold drift.`,
      });
    }
  }

  // Rule 7: Spot quality
  if (weekSpotsTotal > 8) {
    const richRate = weekRichSpots / weekSpotsTotal;
    if (richRate > 0.5) {
      insights.push({
        kind: "good",
        title: "Spot quality strong",
        body: `${Math.round(richRate * 100)}% of this week's ${weekSpotsTotal.toLocaleString("en-IN")} spots have both photo AND coords. Camera + GPS flow is healthy.`,
      });
    } else if (richRate < 0.3) {
      insights.push({
        kind: "watch",
        title: "Spot quality dropping",
        body: `Only ${Math.round(richRate * 100)}% of spots this week carry both photo + coords. Investigate the GPS approval step or whether visitors are skipping the camera.`,
      });
    }
  }

  // Rule 8: Sunday silence (intentional, but worth noting)
  if (intentTotal > 50 && sunCount === 0) {
    insights.push({
      kind: "info",
      title: "Sunday is dark",
      body: "Zero mentions on Sunday — consistent with the Tue+Sat live-chat schedule. If you ever want Sunday signal (Diwali / Holi prep), it's a green field.",
    });
  }

  // If absolutely nothing fired, give one default "all quiet" card.
  if (insights.length === 0) {
    insights.push({
      kind: "info",
      title: "Nothing unusual this week",
      body: "No threshold rules tripped. Either the week is mid-cycle quiet or all signals are healthy — scroll down for the raw breakdown.",
    });
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline gap-2 flex-wrap font-mono text-[10.5px] uppercase tracking-[0.18em]">
        <span className="text-cyan-300/85">What we&apos;re seeing</span>
        <span className="text-cream-50/30">·</span>
        <span className="text-cream-50/65">
          {insights.length} insight{insights.length === 1 ? "" : "s"}{" "}
          this week
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {insights.map((ins, i) => (
          <InsightCard key={i} insight={ins} />
        ))}
      </div>
    </section>
  );
}

type Insight = {
  kind: "good" | "watch" | "fire" | "info";
  title: string;
  body: string;
  action?: { href: string; label: string };
};

const INSIGHT_TONE: Record<
  Insight["kind"],
  { border: string; bg: string; pill: string; icon: string; iconColor: string }
> = {
  good: {
    border: "border-leaf-400/40",
    bg: "bg-leaf-400/[0.04]",
    pill: "bg-leaf-400/[0.18] border-leaf-400/40 text-leaf-300",
    icon: "✓",
    iconColor: "text-leaf-300",
  },
  watch: {
    border: "border-saffron-500/40",
    bg: "bg-saffron-500/[0.04]",
    pill: "bg-saffron-500/[0.18] border-saffron-500/40 text-saffron-300",
    icon: "⚠",
    iconColor: "text-saffron-300",
  },
  fire: {
    border: "border-alert-500/45",
    bg: "bg-alert-500/[0.05]",
    pill: "bg-alert-500/[0.18] border-alert-500/45 text-alert-500",
    icon: "🔥",
    iconColor: "text-alert-500",
  },
  info: {
    border: "border-cyan-400/30",
    bg: "bg-cyan-400/[0.03]",
    pill: "bg-cyan-400/[0.15] border-cyan-400/35 text-cyan-200",
    icon: "✦",
    iconColor: "text-cyan-300",
  },
};

const INSIGHT_KIND_LABEL: Record<Insight["kind"], string> = {
  good: "Healthy",
  watch: "Watch",
  fire: "Needs action",
  info: "Observation",
};

function InsightCard({ insight }: { insight: Insight }) {
  const tone = INSIGHT_TONE[insight.kind];
  return (
    <div
      className={[
        "rounded-2xl border backdrop-blur-sm p-4 flex flex-col gap-2",
        tone.border,
        tone.bg,
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <span
          className={[
            "shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-cream-50/[0.06] text-base",
            tone.iconColor,
          ].join(" ")}
        >
          {tone.icon}
        </span>
        <span
          className={[
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[9.5px] uppercase tracking-[0.16em] font-mono font-semibold",
            tone.pill,
          ].join(" ")}
        >
          {INSIGHT_KIND_LABEL[insight.kind]}
        </span>
      </div>
      <div className="font-fraunces text-cream-50 text-[15px] leading-tight">
        {insight.title}
      </div>
      <p className="text-[12px] text-cream-50/70 font-mukta leading-relaxed">
        {insight.body}
      </p>
      {insight.action ? (
        <Link
          href={insight.action.href}
          prefetch={false}
          className="inline-flex items-center gap-1 self-start mt-1 text-[11px] font-mono text-cyan-300 hover:text-cyan-200 transition-colors"
        >
          {insight.action.label} →
        </Link>
      ) : null}
    </div>
  );
}

function InsightsSkeleton() {
  return (
    <section className="mt-8">
      <div className="mb-3">
        <SkeletonLineLocal w="w-56" h="h-3" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-cream-50/10 bg-[#0B0E16]/85 h-[136px] admin-skeleton motion-safe:animate-pulse"
          />
        ))}
      </div>
    </section>
  );
}

/* ───────────────── Live Chat — detailed feature breakdown ────── */

/**
 * Deep dive into the Live Chat feature (BhandaraMention table).
 * Sits between the Weekly Summary (which aggregates across
 * features) and the All-time section (which covers funnels +
 * top movers across the whole platform).
 *
 * Surfaces feature-specific metrics that the other two views
 * don't:
 *   • Hourly heatmap of when the chat fires (peak hour signal)
 *   • Location sources breakdown (whatsapp_share / google_maps_url
 *     / extracted / manual / none) — tells us how the map plots
 *     actually got their coords
 *   • Engagement signals: quoted replies (threading), bhandara
 *     linking rate (chat → listing pipeline), avg message length
 *   • Moderation health: auto-approve % + avg classifier
 *     confidence + rejection trend
 *   • Top contributors (named, anonymized to first name)
 *   • Language split
 *
 * All-time view is the default; an inline "this week" delta
 * column shows the weekly slice for the metrics where it makes
 * sense. Promise.allSettled wraps every query so any rejection
 * degrades to zero in that tile rather than 500-ing the section.
 */
async function LiveChatDeepDive({ since }: { since: Date }) {
  const settled = await Promise.allSettled([
    // 0 — all-time mention count
    prisma.bhandaraMention.count(),
    // 1 — unique groups (DISTINCT groupName, non-null)
    prisma.bhandaraMention.findMany({
      where: { groupName: { not: null } },
      select: { groupName: true },
      distinct: ["groupName"],
    }),
    // 2 — unique senders (DISTINCT senderName, non-null)
    prisma.bhandaraMention.findMany({
      where: { senderName: { not: null } },
      select: { senderName: true },
      distinct: ["senderName"],
    }),
    // 3 — locationSource breakdown (all-time)
    prisma.bhandaraMention.groupBy({
      by: ["locationSource"],
      _count: { _all: true },
      orderBy: { _count: { locationSource: "desc" } },
    }),
    // 4 — language breakdown (all-time)
    prisma.bhandaraMention.groupBy({
      by: ["language"],
      _count: { _all: true },
      orderBy: { _count: { language: "desc" } },
    }),
    // 5 — engagement: quoted-reply count + bhandara-linked count
    //     + APPROVED count + REJECTED count + avg confidence + avg
    //     message length. Single raw-SQL roundtrip is cheaper than
    //     5 Prisma counts.
    prisma.$queryRaw<
      Array<{
        total: bigint | number;
        quoted: bigint | number;
        linked: bigint | number;
        approved: bigint | number;
        rejected: bigint | number;
        avg_conf: number | null;
        avg_len: number | null;
      }>
    >`
      SELECT
        COUNT(*)::int                                       AS total,
        SUM(CASE WHEN "quotedText" IS NOT NULL THEN 1 ELSE 0 END)::int AS quoted,
        SUM(CASE WHEN "bhandaraId" IS NOT NULL THEN 1 ELSE 0 END)::int AS linked,
        SUM(CASE WHEN "status" = 'APPROVED' THEN 1 ELSE 0 END)::int    AS approved,
        SUM(CASE WHEN "status" = 'REJECTED' THEN 1 ELSE 0 END)::int    AS rejected,
        AVG("confidence")::float                            AS avg_conf,
        AVG(LENGTH(COALESCE("cleanedText", "originalText")))::float AS avg_len
      FROM "BhandaraMention"
    `,
    // 6 — hourly heatmap (24 bars, IST hour-of-day, all-time)
    prisma.$queryRaw<Array<{ hour: number; n: bigint | number }>>`
      SELECT
        EXTRACT(HOUR FROM ("createdAt" AT TIME ZONE 'Asia/Kolkata'))::int AS hour,
        COUNT(*)::int AS n
      FROM "BhandaraMention"
      GROUP BY hour
      ORDER BY hour ASC
    `,
    // 7 — top 8 senders all-time (anonymize to first name only)
    prisma.bhandaraMention.groupBy({
      by: ["senderName"],
      where: { senderName: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { senderName: "desc" } },
      take: 8,
    }),
    // 8 — weekly count (for the side-by-side this-week delta)
    prisma.bhandaraMention.count({
      where: { createdAt: { gte: since } },
    }),
    // 9 — weekly quoted/linked/avg-conf for the delta column
    prisma.$queryRaw<
      Array<{
        quoted: bigint | number;
        linked: bigint | number;
        avg_conf: number | null;
      }>
    >`
      SELECT
        SUM(CASE WHEN "quotedText" IS NOT NULL THEN 1 ELSE 0 END)::int AS quoted,
        SUM(CASE WHEN "bhandaraId" IS NOT NULL THEN 1 ELSE 0 END)::int AS linked,
        AVG("confidence")::float                            AS avg_conf
      FROM "BhandaraMention"
      WHERE "createdAt" >= ${since}
    `,
  ]);

  const unwrap = <T,>(i: number, fallback: T): T =>
    settled[i]?.status === "fulfilled"
      ? ((settled[i] as PromiseFulfilledResult<T>).value)
      : fallback;

  const totalAll = unwrap<number>(0, 0);
  const groupRows = unwrap<Array<{ groupName: string | null }>>(1, []);
  const senderRows = unwrap<Array<{ senderName: string | null }>>(2, []);
  const uniqueGroups = groupRows.length;
  const uniqueSenders = senderRows.length;
  const locationRows = unwrap<
    Array<{ locationSource: string; _count: { _all: number } }>
  >(3, []);
  const langRows = unwrap<
    Array<{ language: string; _count: { _all: number } }>
  >(4, []);
  const engagementRows = unwrap<
    Array<{
      total: bigint | number;
      quoted: bigint | number;
      linked: bigint | number;
      approved: bigint | number;
      rejected: bigint | number;
      avg_conf: number | null;
      avg_len: number | null;
    }>
  >(5, []);
  const eng = engagementRows[0];
  const hourlyRows = unwrap<Array<{ hour: number; n: bigint | number }>>(
    6,
    [],
  );
  const topSenderRows = unwrap<
    Array<{ senderName: string | null; _count: { _all: number } }>
  >(7, []);
  const weekTotal = unwrap<number>(8, 0);
  const weekEngagementRows = unwrap<
    Array<{
      quoted: bigint | number;
      linked: bigint | number;
      avg_conf: number | null;
    }>
  >(9, []);
  const weekEng = weekEngagementRows[0];

  // Compose hourly heatmap as a fixed 24-cell array. Hours that
  // never fired stay at zero so the visual reads as a real
  // 24-hour clock.
  const hourly: number[] = Array.from({ length: 24 }, () => 0);
  for (const r of hourlyRows) {
    const h = Number(r.hour);
    if (h >= 0 && h < 24) hourly[h] = Number(r.n);
  }
  const hourlyMax = Math.max(...hourly, 1);
  const peakHour = hourly.indexOf(Math.max(...hourly));

  const totalE = Number(eng?.total ?? 0);
  const quotedE = Number(eng?.quoted ?? 0);
  const linkedE = Number(eng?.linked ?? 0);
  const approvedE = Number(eng?.approved ?? 0);
  const rejectedE = Number(eng?.rejected ?? 0);
  const avgConfE = eng?.avg_conf ?? null;
  const avgLenE = eng?.avg_len ?? null;
  const autoApprovePct = totalE > 0 ? (approvedE / totalE) * 100 : 0;
  const rejectedPct = totalE > 0 ? (rejectedE / totalE) * 100 : 0;
  const quotedPct = totalE > 0 ? (quotedE / totalE) * 100 : 0;
  const linkedPct = totalE > 0 ? (linkedE / totalE) * 100 : 0;

  return (
    <div>
      <p className="text-[12px] text-cream-50/55 mb-4 font-mukta">
        Everything the BhandaraMention table can tell us. All-time
        numbers with this-week deltas where meaningful.
      </p>

      {/* 4 hero tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <WeekTile
          label="Mentions ever"
          value={totalAll}
          sub={`+${weekTotal.toLocaleString("en-IN")} this week`}
          tone="cyan"
        />
        <WeekTile
          label="Unique groups"
          value={uniqueGroups}
          sub="WhatsApp sources"
          tone="violet"
        />
        <WeekTile
          label="Unique senders"
          value={uniqueSenders}
          sub="Distinct contributors"
          tone="leaf"
        />
        <WeekTile
          label="Auto-approval"
          value={Math.round(autoApprovePct)}
          sub={`${rejectedPct.toFixed(1)}% rejected · avg conf ${avgConfE != null ? avgConfE.toFixed(2) : "—"}`}
          tone="saffron"
          isPercentage
        />
      </div>

      {/* Hourly heatmap */}
      <Panel
        title="Hourly heatmap (all-time, IST)"
        subtitle={
          peakHour >= 0
            ? `Peak hour: ${formatHour(peakHour)} (${hourly[peakHour].toLocaleString("en-IN")} mentions)`
            : "No data yet"
        }
      >
        <div className="grid grid-cols-12 sm:grid-cols-24 gap-1 mt-1">
          {hourly.map((n, h) => {
            const heightPct = (n / hourlyMax) * 100;
            const isPeak = h === peakHour && n > 0;
            return (
              <div
                key={h}
                className="flex flex-col items-stretch gap-1"
                title={`${formatHour(h)} · ${n.toLocaleString("en-IN")} mentions`}
              >
                <div className="h-20 flex items-end">
                  <div
                    className={[
                      "w-full rounded-sm transition-all",
                      isPeak
                        ? "bg-saffron-500/85"
                        : n > hourlyMax * 0.5
                          ? "bg-cyan-400/70"
                          : n > hourlyMax * 0.2
                            ? "bg-cyan-400/40"
                            : "bg-cyan-400/15",
                    ].join(" ")}
                    style={{ height: `${Math.max(heightPct, n > 0 ? 6 : 0)}%` }}
                  />
                </div>
                <div
                  className={[
                    "text-[8.5px] text-center font-mono tabular-nums",
                    isPeak ? "text-saffron-300" : "text-cream-50/45",
                  ].join(" ")}
                >
                  {h.toString().padStart(2, "0")}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Location sources + Engagement signals side by side */}
      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Panel
          title="How map plots get their coordinates"
          subtitle="Mention.locationSource breakdown, all-time"
        >
          {locationRows.length === 0 ? (
            <EmptyHint text="No mentions logged yet." />
          ) : (
            <ul className="space-y-2">
              {locationRows.map((r) => {
                const pct = totalAll > 0 ? (r._count._all / totalAll) * 100 : 0;
                const label = LOCATION_SOURCE_LABELS[r.locationSource] ?? r.locationSource;
                return (
                  <li key={r.locationSource} className="text-[12px]">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-cream-50/85 font-mono">
                        {label}
                      </span>
                      <span className="text-cream-50/65 font-mono tabular-nums">
                        {r._count._all.toLocaleString("en-IN")}{" "}
                        <span className="text-cream-50/45">
                          ({pct.toFixed(1)}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2 bg-cream-50/[0.04] rounded overflow-hidden">
                      <div
                        className="h-full bg-cyan-400/65"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          title="Engagement signals"
          subtitle="Replies, listing-linked, message length, moderation health"
        >
          <dl className="space-y-2.5 text-[12.5px]">
            <EngagementRow
              label="Quoted replies"
              value={`${quotedE.toLocaleString("en-IN")} (${quotedPct.toFixed(1)}%)`}
              weekValue={
                weekEng
                  ? `+${Number(weekEng.quoted ?? 0).toLocaleString("en-IN")} this wk`
                  : null
              }
              hint="Chat threading — someone replied to a quoted message"
            />
            <EngagementRow
              label="Linked to a Bhandara"
              value={`${linkedE.toLocaleString("en-IN")} (${linkedPct.toFixed(1)}%)`}
              weekValue={
                weekEng
                  ? `+${Number(weekEng.linked ?? 0).toLocaleString("en-IN")} this wk`
                  : null
              }
              hint="The mention-to-listing pipeline working"
            />
            <EngagementRow
              label="Approved"
              value={`${approvedE.toLocaleString("en-IN")} (${autoApprovePct.toFixed(1)}%)`}
              weekValue={null}
              hint="Including auto-approved bot ingests"
            />
            <EngagementRow
              label="Rejected"
              value={`${rejectedE.toLocaleString("en-IN")} (${rejectedPct.toFixed(1)}%)`}
              weekValue={null}
              hint="Classifier or admin moderation"
            />
            <EngagementRow
              label="Avg classifier confidence"
              value={avgConfE != null ? avgConfE.toFixed(3) : "—"}
              weekValue={
                weekEng?.avg_conf != null
                  ? `${weekEng.avg_conf.toFixed(3)} this wk`
                  : null
              }
              hint="Gemini's self-reported 0-1 score"
            />
            <EngagementRow
              label="Avg message length"
              value={
                avgLenE != null
                  ? `${Math.round(avgLenE).toLocaleString("en-IN")} chars`
                  : "—"
              }
              weekValue={null}
              hint="cleanedText (or originalText if cleaned is null)"
            />
          </dl>
        </Panel>
      </div>

      {/* Top senders + language split */}
      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Panel
          title="Top 8 contributors"
          subtitle="Senders by mention volume — first names only for privacy"
        >
          {topSenderRows.length === 0 ? (
            <EmptyHint text="No named senders yet." />
          ) : (
            <ul className="space-y-1.5">
              {topSenderRows.map((s) => {
                const display = anonymizeSender(s.senderName);
                const pct =
                  totalAll > 0 ? (s._count._all / totalAll) * 100 : 0;
                return (
                  <li
                    key={s.senderName ?? "—"}
                    className="flex items-center justify-between gap-2 text-[12.5px]"
                  >
                    <span className="text-cream-50/85 truncate">{display}</span>
                    <span className="text-cream-50/70 font-mono tabular-nums shrink-0">
                      {s._count._all.toLocaleString("en-IN")}{" "}
                      <span className="text-cream-50/45">
                        ({pct.toFixed(1)}%)
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          title="Language mix"
          subtitle="Gemini-detected language of each mention"
        >
          {langRows.length === 0 ? (
            <EmptyHint text="No language signal yet." />
          ) : (
            <ul className="space-y-2">
              {langRows.map((l) => {
                const pct =
                  totalAll > 0 ? (l._count._all / totalAll) * 100 : 0;
                const label = LANGUAGE_LABELS[l.language] ?? l.language;
                return (
                  <li key={l.language} className="text-[12px]">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-cream-50/85 font-mono">
                        {label}
                      </span>
                      <span className="text-cream-50/65 font-mono tabular-nums">
                        {l._count._all.toLocaleString("en-IN")}{" "}
                        <span className="text-cream-50/45">
                          ({pct.toFixed(1)}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2 bg-cream-50/[0.04] rounded overflow-hidden">
                      <div
                        className="h-full bg-violet-400/65"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ───────────── Live Map deep-dive ─────────────────────────────── */

/**
 * What's actually plottable on the homepage map + how well the
 * geocode pipeline is doing. Bhandara coords arrive either from
 * the organizer's form, a Google-Maps URL paste, or Gemini's
 * address extraction; spot coords arrive from the visitor's
 * browser-native GPS. This panel tells you whether either of
 * those channels is leaking quality.
 */
async function LiveMapDeepDive() {
  const settled = await Promise.allSettled([
    // 0 — approved bhandaras with valid coords (plottable)
    prisma.bhandara.count({
      where: {
        status: "APPROVED",
        AND: [{ lat: { not: 0 } }, { lng: { not: 0 } }],
      },
    }),
    // 1 — approved bhandaras with no/zero coords (NOT plottable)
    prisma.bhandara.count({
      where: {
        status: "APPROVED",
        OR: [{ lat: 0 }, { lng: 0 }],
      },
    }),
    // 2 — approved non-expired spots with valid coords
    prisma.spot.count({
      where: {
        status: "APPROVED",
        expiresAt: { gt: new Date() },
        AND: [{ lat: { not: 0 } }, { lng: { not: 0 } }],
      },
    }),
    // 3 — approved non-expired spots with NO coords
    prisma.spot.count({
      where: {
        status: "APPROVED",
        expiresAt: { gt: new Date() },
        OR: [{ lat: 0 }, { lng: 0 }],
      },
    }),
    // 4 — mentions with coords (chat overlay plots)
    prisma.bhandaraMention.count({
      where: { status: "APPROVED", lat: { not: null } },
    }),
    // 5 — distinct areas (bhandara)
    prisma.bhandara.findMany({
      where: { status: "APPROVED" },
      select: { area: true },
      distinct: ["area"],
    }),
    // 6 — top 10 areas by combined (bhandaras + spots) approved volume
    prisma.bhandara.groupBy({
      by: ["area"],
      where: { status: "APPROVED" },
      _count: { _all: true },
      orderBy: { _count: { area: "desc" } },
      take: 15,
    }),
    prisma.spot.groupBy({
      by: ["area"],
      where: { status: "APPROVED" },
      _count: { _all: true },
      orderBy: { _count: { area: "desc" } },
      take: 15,
    }),
  ]);
  const unwrap = <T,>(i: number, fallback: T): T =>
    settled[i]?.status === "fulfilled"
      ? ((settled[i] as PromiseFulfilledResult<T>).value)
      : fallback;

  const bhPlottable = unwrap<number>(0, 0);
  const bhUnplottable = unwrap<number>(1, 0);
  const spPlottable = unwrap<number>(2, 0);
  const spUnplottable = unwrap<number>(3, 0);
  const mentionPlots = unwrap<number>(4, 0);
  const areaRows = unwrap<Array<{ area: string | null }>>(5, []);
  const distinctAreas = new Set(areaRows.map((r) => r.area).filter(Boolean))
    .size;
  const bhAreas = unwrap<
    Array<{ area: string | null; _count: { _all: number } }>
  >(6, []);
  const spAreas = unwrap<
    Array<{ area: string | null; _count: { _all: number } }>
  >(7, []);

  const totalLivePoints = bhPlottable + spPlottable + mentionPlots;
  const bhCoverage =
    bhPlottable + bhUnplottable > 0
      ? Math.round((bhPlottable / (bhPlottable + bhUnplottable)) * 100)
      : 0;
  const spCoverage =
    spPlottable + spUnplottable > 0
      ? Math.round((spPlottable / (spPlottable + spUnplottable)) * 100)
      : 0;

  // Merge top areas across both sources, rank by combined volume
  const areaMap = new Map<string, { bh: number; sp: number }>();
  for (const r of bhAreas) {
    if (!r.area) continue;
    const e = areaMap.get(r.area) ?? { bh: 0, sp: 0 };
    e.bh = r._count._all;
    areaMap.set(r.area, e);
  }
  for (const r of spAreas) {
    if (!r.area) continue;
    const e = areaMap.get(r.area) ?? { bh: 0, sp: 0 };
    e.sp = r._count._all;
    areaMap.set(r.area, e);
  }
  const rankedAreas = Array.from(areaMap.entries())
    .map(([area, v]) => ({ area, ...v, total: v.bh + v.sp }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
  const areaMaxTotal = Math.max(...rankedAreas.map((a) => a.total), 1);

  return (
    <div>
      <p className="text-[12px] text-cream-50/55 mb-4 font-mukta">
        How saturated the homepage map is and where the dead zones
        are. Plottable means lat / lng are both non-zero.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <WeekTile
          label="Live points now"
          value={totalLivePoints}
          sub={`${bhPlottable} bhandaras · ${spPlottable} spots · ${mentionPlots} chat`}
          tone="cyan"
          emphasis
        />
        <WeekTile
          label="Bhandara coverage"
          value={bhCoverage}
          sub={`${bhPlottable} mapped · ${bhUnplottable} missing coords`}
          tone="saffron"
          isPercentage
        />
        <WeekTile
          label="Spot coverage"
          value={spCoverage}
          sub={`${spPlottable} mapped · ${spUnplottable} missing coords`}
          tone="violet"
          isPercentage
        />
        <WeekTile
          label="Distinct areas"
          value={distinctAreas}
          sub="Curated area tags covered"
          tone="leaf"
        />
      </div>

      <Panel
        title="Top 10 areas by map plot density"
        subtitle="Combined approved bhandaras + spots per area, ranked"
      >
        {rankedAreas.length === 0 ? (
          <EmptyHint text="No approved rows with area tags yet." />
        ) : (
          <ul className="space-y-1.5">
            {rankedAreas.map((a) => {
              const widthPct = (a.total / areaMaxTotal) * 100;
              return (
                <li key={a.area} className="text-[12px]">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-cream-50/85">{a.area}</span>
                    <span className="text-cream-50/65 font-mono tabular-nums">
                      <span className="text-saffron-300">{a.bh}</span>
                      {" + "}
                      <span className="text-violet-300">{a.sp}</span>
                      {" = "}
                      <span className="text-cream-50">{a.total}</span>
                    </span>
                  </div>
                  <div className="h-2 bg-cream-50/[0.04] rounded overflow-hidden flex">
                    <div
                      className="bg-saffron-500/65 h-full"
                      style={{ width: `${(a.bh / areaMaxTotal) * 100}%` }}
                    />
                    <div
                      className="bg-violet-400/65 h-full"
                      style={{ width: `${(a.sp / areaMaxTotal) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 flex items-center gap-4 text-[10px] font-mono text-cream-50/55">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-saffron-500/65" />
            bhandaras
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-violet-400/65" />
            spots
          </span>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Panel
          title="Coverage gap — bhandaras without coords"
          subtitle="Approved listings that DON'T appear on the map (lat=0 or lng=0)"
        >
          {bhUnplottable === 0 ? (
            <div className="text-[12px] text-leaf-400 font-mono">
              ✓ Every approved bhandara is plottable.
            </div>
          ) : (
            <>
              <div className="text-cream-50 text-2xl font-fraunces mb-1 tabular-nums">
                {bhUnplottable.toLocaleString("en-IN")}
              </div>
              <p className="text-[12px] text-cream-50/65 font-mukta leading-relaxed">
                These rows pass the auto-publish gate but the
                geocode pipeline couldn&apos;t resolve coords. Fix
                them by visiting{" "}
                <Link
                  href="/admin/bhandaras?status=LIVE&hasCoords=false"
                  className="text-cyan-300 hover:underline"
                >
                  /admin/bhandaras with the &ldquo;no coords&rdquo; filter
                </Link>{" "}
                and pasting a Google Maps URL or pinning manually.
              </p>
            </>
          )}
        </Panel>
        <Panel
          title="Map composition right now"
          subtitle="Source split of live points currently rendered"
        >
          <div className="space-y-2 text-[12.5px]">
            <CompositionRow
              label="Listed bhandaras"
              value={bhPlottable}
              total={totalLivePoints}
              tone="saffron"
            />
            <CompositionRow
              label="Live spots"
              value={spPlottable}
              total={totalLivePoints}
              tone="violet"
            />
            <CompositionRow
              label="Chat mentions"
              value={mentionPlots}
              total={totalLivePoints}
              tone="cyan"
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function CompositionRow({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: "saffron" | "violet" | "cyan";
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const bar =
    tone === "saffron"
      ? "bg-saffron-500/65"
      : tone === "violet"
        ? "bg-violet-400/65"
        : "bg-cyan-400/65";
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-cream-50/85 font-mono">{label}</span>
        <span className="text-cream-50/65 font-mono tabular-nums">
          {value.toLocaleString("en-IN")}{" "}
          <span className="text-cream-50/45">({pct.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="h-2 bg-cream-50/[0.04] rounded overflow-hidden">
        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ───────────── Spots deep-dive ────────────────────────────────── */

/**
 * The visitor camera + GPS contribution flow. Quality matrix
 * (photo × coords), temporal distribution (when do walkers
 * report), top anonymized reporters, bhandara-linking rate.
 */
async function SpotsDeepDive({ since }: { since: Date }) {
  const settled = await Promise.allSettled([
    // 0 — total all-time
    prisma.spot.count(),
    // 1 — this week
    prisma.spot.count({ where: { createdAt: { gte: since } } }),
    // 2 — currently live
    prisma.spot.count({
      where: { status: "APPROVED", expiresAt: { gt: new Date() } },
    }),
    // 3 — quality matrix via raw SQL (4 buckets in one round-trip)
    prisma.$queryRaw<
      Array<{
        photo_coords: bigint | number;
        photo_only: bigint | number;
        coords_only: bigint | number;
        neither: bigint | number;
        linked: bigint | number;
        with_caption: bigint | number;
      }>
    >`
      SELECT
        SUM(CASE
          WHEN "photoUrl" IS NOT NULL
            AND "lat" <> 0 AND "lng" <> 0 THEN 1 ELSE 0
        END)::int AS photo_coords,
        SUM(CASE
          WHEN "photoUrl" IS NOT NULL
            AND ("lat" = 0 OR "lng" = 0) THEN 1 ELSE 0
        END)::int AS photo_only,
        SUM(CASE
          WHEN "photoUrl" IS NULL
            AND "lat" <> 0 AND "lng" <> 0 THEN 1 ELSE 0
        END)::int AS coords_only,
        SUM(CASE
          WHEN "photoUrl" IS NULL
            AND ("lat" = 0 OR "lng" = 0) THEN 1 ELSE 0
        END)::int AS neither,
        SUM(CASE WHEN "bhandaraId" IS NOT NULL THEN 1 ELSE 0 END)::int AS linked,
        SUM(CASE WHEN "caption" IS NOT NULL AND LENGTH("caption") > 0 THEN 1 ELSE 0 END)::int AS with_caption
      FROM "Spot"
    `,
    // 4 — hourly heatmap (IST hour-of-day, all-time)
    prisma.$queryRaw<Array<{ hour: number; n: bigint | number }>>`
      SELECT
        EXTRACT(HOUR FROM ("createdAt" AT TIME ZONE 'Asia/Kolkata'))::int AS hour,
        COUNT(*)::int AS n
      FROM "Spot"
      GROUP BY hour
      ORDER BY hour ASC
    `,
    // 5 — top 8 reporters (anonymized first names)
    prisma.spot.groupBy({
      by: ["reporterName"],
      where: { reporterName: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { reporterName: "desc" } },
      take: 8,
    }),
  ]);
  const unwrap = <T,>(i: number, fallback: T): T =>
    settled[i]?.status === "fulfilled"
      ? ((settled[i] as PromiseFulfilledResult<T>).value)
      : fallback;

  const totalAll = unwrap<number>(0, 0);
  const weekTotal = unwrap<number>(1, 0);
  const liveNow = unwrap<number>(2, 0);
  const qualityRows = unwrap<
    Array<{
      photo_coords: bigint | number;
      photo_only: bigint | number;
      coords_only: bigint | number;
      neither: bigint | number;
      linked: bigint | number;
      with_caption: bigint | number;
    }>
  >(3, []);
  const q = qualityRows[0];
  const photoCoords = Number(q?.photo_coords ?? 0);
  const photoOnly = Number(q?.photo_only ?? 0);
  const coordsOnly = Number(q?.coords_only ?? 0);
  const neither = Number(q?.neither ?? 0);
  const linked = Number(q?.linked ?? 0);
  const withCaption = Number(q?.with_caption ?? 0);
  const linkedPct = totalAll > 0 ? (linked / totalAll) * 100 : 0;
  const captionPct = totalAll > 0 ? (withCaption / totalAll) * 100 : 0;
  const richPct = totalAll > 0 ? (photoCoords / totalAll) * 100 : 0;
  const hourlyRows = unwrap<Array<{ hour: number; n: bigint | number }>>(
    4,
    [],
  );
  const topReporters = unwrap<
    Array<{ reporterName: string | null; _count: { _all: number } }>
  >(5, []);

  const hourly: number[] = Array.from({ length: 24 }, () => 0);
  for (const r of hourlyRows) {
    const h = Number(r.hour);
    if (h >= 0 && h < 24) hourly[h] = Number(r.n);
  }
  const hourlyMax = Math.max(...hourly, 1);
  const peakHour = hourly.indexOf(Math.max(...hourly));

  return (
    <div>
      <p className="text-[12px] text-cream-50/55 mb-4 font-mukta">
        Walkers reporting bhandaras via the camera + GPS flow.
        Quality is photo + coords together (&ldquo;rich&rdquo;);
        anything less is partial signal.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <WeekTile
          label="Spots ever"
          value={totalAll}
          sub={`+${weekTotal.toLocaleString("en-IN")} this week`}
          tone="violet"
        />
        <WeekTile
          label="Rich spots"
          value={Math.round(richPct)}
          sub={`${photoCoords.toLocaleString("en-IN")} have photo + coords`}
          tone="leaf"
          isPercentage
        />
        <WeekTile
          label="Currently live"
          value={liveNow}
          sub="Within 8h TTL"
          tone="cyan"
          emphasis
        />
        <WeekTile
          label="Linked to bhandara"
          value={Math.round(linkedPct)}
          sub={`${linked.toLocaleString("en-IN")} auto-matched to a listing`}
          tone="saffron"
          isPercentage
        />
      </div>

      <Panel
        title="Quality matrix"
        subtitle="Every spot ever, bucketed by what it carries"
      >
        <div className="grid grid-cols-2 gap-3">
          <QualityBucket
            label="Photo + coords (rich)"
            value={photoCoords}
            total={totalAll}
            tone="leaf"
          />
          <QualityBucket
            label="Photo only (no map plot)"
            value={photoOnly}
            total={totalAll}
            tone="saffron"
          />
          <QualityBucket
            label="Coords only (no photo)"
            value={coordsOnly}
            total={totalAll}
            tone="cyan"
          />
          <QualityBucket
            label="Caption-only (neither)"
            value={neither}
            total={totalAll}
            tone="alert"
          />
        </div>
        <div className="mt-3 text-[11px] text-cream-50/55 font-mukta leading-relaxed">
          {captionPct.toFixed(0)}% of spots include a written
          caption ({withCaption.toLocaleString("en-IN")} of{" "}
          {totalAll.toLocaleString("en-IN")}).
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Panel
          title="Hourly heatmap (all-time, IST)"
          subtitle={
            peakHour >= 0
              ? `Peak hour: ${formatHour(peakHour)} (${hourly[peakHour].toLocaleString("en-IN")} spots)`
              : "No data yet"
          }
        >
          <div className="grid grid-cols-12 sm:grid-cols-24 gap-1">
            {hourly.map((n, h) => {
              const heightPct = (n / hourlyMax) * 100;
              const isPeak = h === peakHour && n > 0;
              return (
                <div
                  key={h}
                  className="flex flex-col items-stretch gap-1"
                  title={`${formatHour(h)} · ${n.toLocaleString("en-IN")} spots`}
                >
                  <div className="h-20 flex items-end">
                    <div
                      className={[
                        "w-full rounded-sm",
                        isPeak
                          ? "bg-saffron-500/85"
                          : n > hourlyMax * 0.5
                            ? "bg-violet-400/70"
                            : n > hourlyMax * 0.2
                              ? "bg-violet-400/40"
                              : "bg-violet-400/15",
                      ].join(" ")}
                      style={{ height: `${Math.max(heightPct, n > 0 ? 6 : 0)}%` }}
                    />
                  </div>
                  <div
                    className={[
                      "text-[8.5px] text-center font-mono tabular-nums",
                      isPeak ? "text-saffron-300" : "text-cream-50/45",
                    ].join(" ")}
                  >
                    {h.toString().padStart(2, "0")}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel
          title="Top 8 reporters"
          subtitle="Spotters by volume — first names only for privacy"
        >
          {topReporters.length === 0 ? (
            <EmptyHint text="No named reporters yet." />
          ) : (
            <ul className="space-y-1.5">
              {topReporters.map((r) => {
                const pct =
                  totalAll > 0 ? (r._count._all / totalAll) * 100 : 0;
                return (
                  <li
                    key={r.reporterName ?? "—"}
                    className="flex items-center justify-between gap-2 text-[12.5px]"
                  >
                    <span className="text-cream-50/85 truncate">
                      {anonymizeSender(r.reporterName)}
                    </span>
                    <span className="text-cream-50/70 font-mono tabular-nums shrink-0">
                      {r._count._all.toLocaleString("en-IN")}{" "}
                      <span className="text-cream-50/45">
                        ({pct.toFixed(1)}%)
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function QualityBucket({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: "leaf" | "saffron" | "cyan" | "alert";
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const styles =
    tone === "leaf"
      ? "border-leaf-400/35 bg-leaf-400/[0.06] text-leaf-300"
      : tone === "saffron"
        ? "border-saffron-500/35 bg-saffron-500/[0.06] text-saffron-300"
        : tone === "cyan"
          ? "border-cyan-400/30 bg-cyan-400/[0.06] text-cyan-200"
          : "border-alert-500/35 bg-alert-500/[0.06] text-alert-500";
  return (
    <div className={`rounded-xl border px-3.5 py-3 ${styles}`}>
      <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-cream-50/55">
        {label}
      </div>
      <div className="mt-1 font-fraunces text-[1.6rem] leading-none tabular-nums">
        {value.toLocaleString("en-IN")}
      </div>
      <div className="mt-1 text-[11px] font-mono text-cream-50/55 tabular-nums">
        {pct.toFixed(1)}% of all spots
      </div>
    </div>
  );
}

/* ───────────── Listings deep-dive ─────────────────────────────── */

/**
 * Bhandara creation flow — bot vs human, auto-publish quality,
 * Tuesday-dates distribution, repeat organizers, completeness.
 */
async function ListingsDeepDive() {
  const settled = await Promise.allSettled([
    // 0 — total all-time
    prisma.bhandara.count(),
    // 1 — bot-ingested (description contains "[bot:")
    prisma.bhandara.count({ where: { description: { contains: "[bot:" } } }),
    // 2 — auto-published (description contains "auto-publish")
    prisma.bhandara.count({
      where: { description: { contains: "auto-publish" } },
    }),
    // 3 — approved count
    prisma.bhandara.count({ where: { status: "APPROVED" } }),
    // 4 — verified
    prisma.bhandara.count({
      where: { status: "APPROVED", isVerified: true },
    }),
    // 5 — quality: has photo / has phone / has time / has menu
    prisma.$queryRaw<
      Array<{
        with_photo: bigint | number;
        with_phone: bigint | number;
        with_organizer: bigint | number;
      }>
    >`
      SELECT
        SUM(CASE WHEN "photoUrl" IS NOT NULL THEN 1 ELSE 0 END)::int AS with_photo,
        SUM(CASE WHEN "organizerPhone" IS NOT NULL AND LENGTH("organizerPhone") > 0 THEN 1 ELSE 0 END)::int AS with_phone,
        SUM(CASE WHEN "organizerName" IS NOT NULL AND LENGTH("organizerName") > 0 THEN 1 ELSE 0 END)::int AS with_organizer
      FROM "Bhandara"
      WHERE "status" = 'APPROVED'
    `,
    // 6 — organizer name groupBy (for repeat-organizer count).
    //     organizerName is a required String column (not nullable),
    //     so we filter against empty string rather than null.
    prisma.bhandara.groupBy({
      by: ["organizerName"],
      where: { status: "APPROVED", organizerName: { not: "" } },
      _count: { _all: true },
      having: { organizerName: { _count: { gt: 1 } } },
    }),
    // 7 — sample of tuesdayDates JSON strings to analyse multi-Tuesday
    //     coverage. Cheap: only need the column.
    prisma.bhandara.findMany({
      where: { status: "APPROVED" },
      select: { tuesdayDates: true },
    }),
  ]);
  const unwrap = <T,>(i: number, fallback: T): T =>
    settled[i]?.status === "fulfilled"
      ? ((settled[i] as PromiseFulfilledResult<T>).value)
      : fallback;

  const totalAll = unwrap<number>(0, 0);
  const fromBot = unwrap<number>(1, 0);
  const autoPub = unwrap<number>(2, 0);
  const approved = unwrap<number>(3, 0);
  const verified = unwrap<number>(4, 0);
  const qualityRows = unwrap<
    Array<{
      with_photo: bigint | number;
      with_phone: bigint | number;
      with_organizer: bigint | number;
    }>
  >(5, []);
  const qq = qualityRows[0];
  const withPhoto = Number(qq?.with_photo ?? 0);
  const withPhone = Number(qq?.with_phone ?? 0);
  const withOrganizer = Number(qq?.with_organizer ?? 0);
  const repeatOrgs = unwrap<
    Array<{ organizerName: string | null; _count: { _all: number } }>
  >(6, []);
  const tuesdayDatesRows = unwrap<Array<{ tuesdayDates: string }>>(7, []);

  // Compute Tuesday-count histogram: how many bhandaras serve N
  // Tuesdays? Buckets 1, 2-3, 4-5, 6-8, 0.
  const tuesdayCountHistogram = new Map<string, number>([
    ["0", 0],
    ["1", 0],
    ["2-3", 0],
    ["4-5", 0],
    ["6-8", 0],
  ]);
  for (const r of tuesdayDatesRows) {
    let n = 0;
    try {
      const parsed = JSON.parse(r.tuesdayDates || "[]");
      if (Array.isArray(parsed)) n = parsed.length;
    } catch {
      n = 0;
    }
    const bucket =
      n === 0
        ? "0"
        : n === 1
          ? "1"
          : n <= 3
            ? "2-3"
            : n <= 5
              ? "4-5"
              : "6-8";
    tuesdayCountHistogram.set(bucket, (tuesdayCountHistogram.get(bucket) ?? 0) + 1);
  }
  const tuesdayBucketMax = Math.max(
    ...Array.from(tuesdayCountHistogram.values()),
    1,
  );

  const humanCount = totalAll - fromBot;
  const botPct = totalAll > 0 ? (fromBot / totalAll) * 100 : 0;
  const autoPubPct = fromBot > 0 ? (autoPub / fromBot) * 100 : 0;
  const verifiedPct = approved > 0 ? (verified / approved) * 100 : 0;
  const photoPct = approved > 0 ? (withPhoto / approved) * 100 : 0;
  const phonePct = approved > 0 ? (withPhone / approved) * 100 : 0;

  return (
    <div>
      <p className="text-[12px] text-cream-50/55 mb-4 font-mukta">
        Where bhandaras come from + the completeness of the
        resulting listing. Bot ingest is the dominant pipeline; the
        rest is /organise form + admin scan.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <WeekTile
          label="Bhandaras ever"
          value={totalAll}
          sub={`${approved.toLocaleString("en-IN")} approved`}
          tone="saffron"
        />
        <WeekTile
          label="From bot"
          value={Math.round(botPct)}
          sub={`${fromBot} bot · ${humanCount} human`}
          tone="violet"
          isPercentage
        />
        <WeekTile
          label="Auto-published"
          value={autoPub}
          sub={`${autoPubPct.toFixed(0)}% of bot ingests skip review`}
          tone="cyan"
        />
        <WeekTile
          label="Repeat organisers"
          value={repeatOrgs.length}
          sub="Names with 2+ approved listings"
          tone="leaf"
        />
      </div>

      <Panel
        title="Tuesday-dates coverage"
        subtitle="How many service-days each approved bhandara claims (max 8 in the 2026 double-season)"
      >
        <ul className="space-y-1.5">
          {Array.from(tuesdayCountHistogram.entries()).map(([bucket, n]) => {
            const widthPct = (n / tuesdayBucketMax) * 100;
            const isFull = bucket === "6-8";
            return (
              <li key={bucket} className="text-[12.5px]">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-cream-50/85 font-mono">
                    {bucket} Tuesdays
                    {isFull ? (
                      <span className="ml-2 text-leaf-400/85 text-[10px]">
                        ★ committed for full season
                      </span>
                    ) : null}
                  </span>
                  <span className="text-cream-50/70 font-mono tabular-nums">
                    {n.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="h-2 bg-cream-50/[0.04] rounded overflow-hidden">
                  <div
                    className={`h-full ${isFull ? "bg-leaf-400/70" : "bg-saffron-500/65"}`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Panel
          title="Listing quality"
          subtitle="Completeness of approved bhandara rows"
        >
          <div className="space-y-2.5 text-[12.5px]">
            <EngagementRow
              label="Has photo"
              value={`${withPhoto.toLocaleString("en-IN")} (${photoPct.toFixed(1)}%)`}
              weekValue={null}
              hint="Bhandara card shows a real image, not just an icon"
            />
            <EngagementRow
              label="Has organizer phone"
              value={`${withPhone.toLocaleString("en-IN")} (${phonePct.toFixed(1)}%)`}
              weekValue={null}
              hint="Visitors can call/WhatsApp the organizer directly"
            />
            <EngagementRow
              label="Has organizer name"
              value={`${withOrganizer.toLocaleString("en-IN")} (${approved > 0 ? ((withOrganizer / approved) * 100).toFixed(1) : "0.0"}%)`}
              weekValue={null}
              hint="Even when there's no phone, attribution helps"
            />
            <EngagementRow
              label="Verified by admin"
              value={`${verified.toLocaleString("en-IN")} (${verifiedPct.toFixed(1)}%)`}
              weekValue={null}
              hint="Manually marked trustworthy; shows green check on card"
            />
          </div>
        </Panel>

        <Panel
          title="Repeat organisers"
          subtitle={`${repeatOrgs.length} names with 2+ approved listings — top 8`}
        >
          {repeatOrgs.length === 0 ? (
            <EmptyHint text="No repeat organisers yet." />
          ) : (
            <ul className="space-y-1.5">
              {repeatOrgs
                .sort((a, b) => b._count._all - a._count._all)
                .slice(0, 8)
                .map((r) => (
                  <li
                    key={r.organizerName ?? "—"}
                    className="flex items-center justify-between gap-2 text-[12.5px]"
                  >
                    <span className="text-cream-50/85 truncate">
                      {r.organizerName ?? "—"}
                    </span>
                    <span className="text-cream-50/70 font-mono tabular-nums">
                      {r._count._all.toLocaleString("en-IN")} listings
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ───────────── Volunteers deep-dive ───────────────────────────── */

/**
 * The volunteer-signup funnel. Whose phones did we collect, what
 * status are they in, where do they want to help.
 */
async function VolunteersDeepDive({ since }: { since: Date }) {
  const settled = await Promise.allSettled([
    prisma.volunteer.count(),
    prisma.volunteer.count({ where: { createdAt: { gte: since } } }),
    prisma.volunteer.groupBy({
      by: ["status"],
      _count: { _all: true },
      orderBy: { _count: { status: "desc" } },
    }),
    prisma.volunteer.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        phone: true,
        areas: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);
  const unwrap = <T,>(i: number, fallback: T): T =>
    settled[i]?.status === "fulfilled"
      ? ((settled[i] as PromiseFulfilledResult<T>).value)
      : fallback;

  const totalAll = unwrap<number>(0, 0);
  const weekTotal = unwrap<number>(1, 0);
  const statusRows = unwrap<
    Array<{ status: string; _count: { _all: number } }>
  >(2, []);
  type VolunteerRow = {
    id: string;
    name: string;
    phone: string;
    areas: string;
    status: string;
    createdAt: Date;
  };
  const recentRows = unwrap<VolunteerRow[]>(3, []);

  // Tally areas across all 10 recent volunteers (and total
  // volunteers for the popular-area panel). Better would be a
  // separate query on all volunteers — but areas is a JSON column,
  // so a Prisma groupBy can't reach inside it. Keep this scoped
  // to recent for now.
  const areaTally = new Map<string, number>();
  for (const v of recentRows) {
    try {
      const list = JSON.parse(v.areas || "[]");
      if (Array.isArray(list)) {
        for (const a of list) {
          if (typeof a === "string" && a.trim()) {
            const k = a.trim();
            areaTally.set(k, (areaTally.get(k) ?? 0) + 1);
          }
        }
      }
    } catch {
      /* malformed JSON, skip */
    }
  }
  const topAreas = Array.from(areaTally.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const pending = statusRows.find((r) => r.status === "PENDING")?._count._all ?? 0;
  const probationary =
    statusRows.find((r) => r.status === "PROBATIONARY")?._count._all ?? 0;
  const active = statusRows.find((r) => r.status === "ACTIVE")?._count._all ?? 0;

  return (
    <div>
      <p className="text-[12px] text-cream-50/55 mb-4 font-mukta">
        Volunteer signup funnel. Pending = awaiting your verify
        click; Probationary = first task assigned; Active = vetted.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <WeekTile
          label="Signups ever"
          value={totalAll}
          sub={`+${weekTotal.toLocaleString("en-IN")} this week`}
          tone="leaf"
        />
        <WeekTile
          label="Pending"
          value={pending}
          sub="Awaiting your WhatsApp verify"
          tone="saffron"
          emphasis={pending > 0}
        />
        <WeekTile
          label="Probationary"
          value={probationary}
          sub="First task assigned"
          tone="cyan"
        />
        <WeekTile
          label="Active"
          value={active}
          sub="Vetted, recurring contributors"
          tone="violet"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Status breakdown"
          subtitle="Full distribution across the volunteer pipeline"
        >
          {statusRows.length === 0 ? (
            <EmptyHint text="No volunteer signups yet." />
          ) : (
            <ul className="space-y-2">
              {statusRows.map((r) => {
                const pct =
                  totalAll > 0 ? (r._count._all / totalAll) * 100 : 0;
                return (
                  <li key={r.status} className="text-[12.5px]">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-cream-50/85 font-mono">
                        {r.status}
                      </span>
                      <span className="text-cream-50/65 font-mono tabular-nums">
                        {r._count._all.toLocaleString("en-IN")}{" "}
                        <span className="text-cream-50/45">
                          ({pct.toFixed(1)}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2 bg-cream-50/[0.04] rounded overflow-hidden">
                      <div
                        className="h-full bg-leaf-400/65"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          title="Popular volunteer areas"
          subtitle="From the most recent 10 signups (areas JSON tally)"
        >
          {topAreas.length === 0 ? (
            <EmptyHint text="No area preferences logged yet." />
          ) : (
            <ul className="space-y-1.5">
              {topAreas.map(([area, n]) => (
                <li
                  key={area}
                  className="flex items-center justify-between gap-2 text-[12.5px]"
                >
                  <span className="text-cream-50/85">{area}</span>
                  <span className="text-cream-50/70 font-mono tabular-nums">
                    {n}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="Recent signups"
        subtitle="Last 10 volunteers, freshest first"
      >
        {recentRows.length === 0 ? (
          <EmptyHint text="No volunteers yet." />
        ) : (
          <table className="w-full text-[12.5px]">
            <thead className="text-cream-50/55 font-mono text-[10px] uppercase tracking-[0.14em]">
              <tr className="border-b border-cream-50/10">
                <th className="text-left py-2 px-1">Name</th>
                <th className="text-left py-2 px-1">Phone</th>
                <th className="text-left py-2 px-1">Status</th>
                <th className="text-right py-2 px-1">Signed up</th>
              </tr>
            </thead>
            <tbody>
              {recentRows.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-cream-50/[0.06]"
                >
                  <td className="py-2 px-1 text-cream-50/85">{v.name}</td>
                  <td className="py-2 px-1 text-cream-50/55 font-mono text-[11px]">
                    {v.phone}
                  </td>
                  <td className="py-2 px-1 font-mono text-[10.5px]">
                    <span
                      className={[
                        "inline-block rounded px-1.5 py-0.5",
                        v.status === "ACTIVE"
                          ? "bg-leaf-400/15 text-leaf-300"
                          : v.status === "PROBATIONARY"
                            ? "bg-cyan-400/15 text-cyan-200"
                            : "bg-saffron-500/15 text-saffron-300",
                      ].join(" ")}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="py-2 px-1 text-right text-cream-50/55 font-mono">
                    {v.createdAt.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      timeZone: "Asia/Kolkata",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

const LOCATION_SOURCE_LABELS: Record<string, string> = {
  whatsapp_share: "WhatsApp location share",
  google_maps_url: "Google Maps URL in message",
  extracted_address: "Address extracted by Gemini",
  manual: "Manually pinned by admin",
  none: "No coordinates (chat-only)",
};

const LANGUAGE_LABELS: Record<string, string> = {
  mixed: "Hinglish (mixed)",
  en: "English",
  hi: "Hindi",
};

/** Format a 0-23 hour as "12 AM", "1 AM", … "11 PM". Used by the
 *  hourly heatmap's peak-hour subtitle. */
function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

/** Anonymize a sender name to first name + last-name initial.
 *  "Vimla Mishra" → "Vimla M." | "Akanksha" → "Akanksha". WhatsApp
 *  display names are user-set and not strictly private, but
 *  collapsing to first-name-only matches the public-facing chat
 *  feed's posture (we never publish full names without consent). */
function anonymizeSender(name: string | null): string {
  if (!name) return "—";
  const trimmed = name.trim();
  if (!trimmed) return "—";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.`;
}

function EngagementRow({
  label,
  value,
  weekValue,
  hint,
}: {
  label: string;
  value: string;
  weekValue: string | null;
  hint: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 pb-2 border-b border-cream-50/[0.06] last:border-b-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-cream-50/85 font-mono leading-tight">{label}</div>
        <div className="text-[10.5px] text-cream-50/45 mt-0.5 font-mukta">
          {hint}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-cream-50 tabular-nums font-mono">{value}</div>
        {weekValue ? (
          <div className="text-[10.5px] text-cyan-300/70 font-mono mt-0.5">
            {weekValue}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FeatureBreakdownSkeleton() {
  return (
    <section className="mt-10">
      <div className="space-y-3 mb-4">
        <SkeletonLineLocal w="w-48" h="h-3" />
        <SkeletonLineLocal w="w-72" h="h-6" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-cream-50/10 bg-[#0B0E16]/85 h-[88px] admin-skeleton motion-safe:animate-pulse"
          />
        ))}
      </div>
      <div className="rounded-2xl border border-cream-50/10 bg-[#0B0E16]/85 h-48 admin-skeleton motion-safe:animate-pulse mb-4" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-cream-50/10 bg-[#0B0E16]/85 h-56 admin-skeleton motion-safe:animate-pulse" />
        <div className="rounded-2xl border border-cream-50/10 bg-[#0B0E16]/85 h-56 admin-skeleton motion-safe:animate-pulse" />
      </div>
    </section>
  );
}

/** Inline tiny skeleton-line used only by FeatureBreakdownSkeleton. */
function SkeletonLineLocal({ w, h }: { w: string; h: string }) {
  return (
    <div
      className={`rounded-md admin-skeleton motion-safe:animate-pulse ${w} ${h}`}
    />
  );
}

/* ───────────────────── Reusable atoms ─────────────────────────── */

type Tone = "cyan" | "leaf" | "violet" | "saffron" | "ink";

const TONE_TILE: Record<
  Tone,
  { ring: string; valueText: string; subText: string; bg: string }
> = {
  cyan: {
    ring: "border-cyan-400/30",
    valueText: "text-cyan-200",
    subText: "text-cyan-300/65",
    bg: "from-cyan-400/[0.06] to-transparent",
  },
  leaf: {
    ring: "border-leaf-400/40",
    valueText: "text-leaf-300",
    subText: "text-leaf-400/75",
    bg: "from-leaf-400/[0.08] to-transparent",
  },
  violet: {
    ring: "border-violet-400/30",
    valueText: "text-violet-200",
    subText: "text-violet-300/65",
    bg: "from-violet-400/[0.06] to-transparent",
  },
  saffron: {
    ring: "border-saffron-500/35",
    valueText: "text-saffron-300",
    subText: "text-saffron-300/65",
    bg: "from-saffron-500/[0.06] to-transparent",
  },
  ink: {
    ring: "border-cream-50/15",
    valueText: "text-cream-50",
    subText: "text-cream-50/55",
    bg: "from-cream-50/[0.03] to-transparent",
  },
};

function WeekTile({
  label,
  value,
  sub,
  tone,
  emphasis = false,
  isAttemptCount = false,
  isPercentage = false,
}: {
  label: string;
  value: number;
  sub: string;
  tone: Tone;
  emphasis?: boolean;
  isAttemptCount?: boolean;
  isPercentage?: boolean;
}) {
  const t = TONE_TILE[tone];
  return (
    <div
      className={[
        "relative rounded-xl border bg-gradient-to-br to-transparent backdrop-blur-sm px-3.5 py-3",
        t.ring,
        t.bg,
        emphasis ? "lg:scale-[1.02]" : "",
      ].join(" ")}
    >
      <div className="text-[9.5px] uppercase tracking-[0.16em] font-mono text-cream-50/55 leading-none">
        {label}
      </div>
      <div
        className={[
          "mt-2 font-fraunces text-[1.75rem] sm:text-[1.95rem] leading-none tabular-nums",
          t.valueText,
        ].join(" ")}
      >
        {value.toLocaleString("en-IN")}
        {isPercentage ? (
          <span className="text-[16px] text-cream-50/55 ml-0.5 font-mukta">
            %
          </span>
        ) : null}
        {isAttemptCount ? (
          <span className="text-[12px] text-cream-50/45 ml-1.5 font-mukta">
            attempts
          </span>
        ) : null}
      </div>
      <div
        className={[
          "mt-1.5 text-[10.5px] font-mono leading-tight",
          t.subText,
        ].join(" ")}
      >
        {sub}
      </div>
    </div>
  );
}

function IntentBar({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: "leaf" | "saffron" | "violet";
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const bar =
    tone === "leaf"
      ? "bg-leaf-400/70"
      : tone === "saffron"
        ? "bg-saffron-500/70"
        : "bg-violet-400/70";
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-baseline justify-between text-[12px] mb-1">
        <span className="text-cream-50/85 font-mono">{label}</span>
        <span className="text-cream-50/65 tabular-nums font-mono">
          {value}{" "}
          <span className="text-cream-50/45">({pct.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="h-2 bg-cream-50/[0.04] rounded overflow-hidden">
        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm p-4 sm:p-5">
      <div className="font-fraunces text-cream-50 text-[15px] leading-tight">
        {title}
      </div>
      <div className="text-[11px] text-cream-50/55 mt-0.5 mb-3 font-mukta">
        {subtitle}
      </div>
      {children}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="text-[12px] text-cream-50/45 italic py-3 font-mukta">
      {text}
    </div>
  );
}

type FunnelStage = {
  label: string;
  count: number;
  pct?: number;
  tone: "neutral" | "green" | "amber" | "red";
};

function FunnelCard({
  title,
  subtitle,
  stages,
  footer,
}: {
  title: string;
  subtitle: string;
  stages: FunnelStage[];
  footer: string;
}) {
  const maxCount = Math.max(...stages.map((s) => s.count), 1);
  return (
    <div className="rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm p-4 sm:p-5">
      <div className="font-fraunces text-cream-50 text-[15px] leading-tight">
        {title}
      </div>
      <div className="text-[11px] text-cream-50/55 mt-0.5 mb-3 font-mukta">
        {subtitle}
      </div>
      <div className="space-y-2.5">
        {stages.map((s) => {
          const widthPct = (s.count / maxCount) * 100;
          const barColor =
            s.tone === "green"
              ? "bg-leaf-400/70"
              : s.tone === "amber"
                ? "bg-saffron-500/70"
                : s.tone === "red"
                  ? "bg-sindoor-700/70"
                  : "bg-cream-50/25";
          return (
            <div key={s.label} className="text-[12px]">
              <div className="flex items-baseline justify-between">
                <div className="text-cream-50/85 font-mono">{s.label}</div>
                <div className="text-cream-50 tabular-nums font-mono">
                  {s.count}
                  {s.pct != null && (
                    <span className="ml-2 text-cream-50/45">
                      ({s.pct.toFixed(1)}%)
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-1 h-2 bg-cream-50/[0.04] rounded overflow-hidden">
                <div
                  className={`h-full ${barColor}`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3.5 text-[11px] text-cream-50/55 font-mono">
        {footer}
      </div>
    </div>
  );
}

/* ───────────────────── Skeletons ──────────────────────────────── */

function WeeklySummarySkeleton({ sinceLabel }: { sinceLabel: string }) {
  return (
    <>
      <div className="mb-3 flex items-baseline gap-2 flex-wrap font-mono text-[10.5px] uppercase tracking-[0.18em]">
        <span className="text-saffron-300">This week</span>
        <span className="text-cream-50/30">·</span>
        <span className="text-cream-50/65">Since {sinceLabel}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-cream-50/10 bg-[#0B0E16]/85 px-3.5 py-3 admin-skeleton motion-safe:animate-pulse h-[88px]"
          />
        ))}
      </div>
      <div className="rounded-2xl border border-cream-50/10 bg-[#0B0E16]/85 h-48 admin-skeleton motion-safe:animate-pulse mb-4" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-cream-50/10 bg-[#0B0E16]/85 h-44 admin-skeleton motion-safe:animate-pulse" />
        <div className="rounded-2xl border border-cream-50/10 bg-[#0B0E16]/85 h-44 admin-skeleton motion-safe:animate-pulse" />
      </div>
    </>
  );
}

function AllTimeSkeleton() {
  return (
    <section className="mt-10">
      <div className="h-5 w-32 rounded admin-skeleton motion-safe:animate-pulse mb-3" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-cream-50/10 bg-[#0B0E16]/85 h-56 admin-skeleton motion-safe:animate-pulse" />
        <div className="rounded-2xl border border-cream-50/10 bg-[#0B0E16]/85 h-56 admin-skeleton motion-safe:animate-pulse" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <div className="rounded-2xl border border-cream-50/10 bg-[#0B0E16]/85 h-72 admin-skeleton motion-safe:animate-pulse" />
        <div className="rounded-2xl border border-cream-50/10 bg-[#0B0E16]/85 h-72 admin-skeleton motion-safe:animate-pulse" />
      </div>
    </section>
  );
}

// Suppress unused-import warning for istTodayIso while still keeping
// the import handy for future timezone-derived stats.
void istTodayIso;
