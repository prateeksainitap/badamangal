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

export default async function AnalyticsPage() {
  if (!(await isAdmin())) redirect("/admin");

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
}: {
  label: string;
  value: number;
  sub: string;
  tone: Tone;
  emphasis?: boolean;
  isAttemptCount?: boolean;
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
