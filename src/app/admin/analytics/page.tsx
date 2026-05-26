import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import {
  getCachedCommunityMembers,
  getCachedVisitorCount,
} from "@/lib/admin-cache";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminNavCounts } from "@/lib/admin-nav-counts";
import AdminPageHero from "@/components/admin/AdminPageHero";

export const metadata: Metadata = {
  title: "Analytics · Admin · Bada Mangal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Admin Analytics page.
 *
 * The goal is to give Prateek the "what's happening on the site right
 * now" view without forcing a trip to GA4. Everything on this page is
 * computable directly from our own Postgres tables, so the page works
 * the instant it's deployed, no Google credentials, no service-account
 * JSON, no GA Reporting API client to install.
 *
 * The page covers:
 *   1. KPI strip           , headline counts (members, visits, bhandaras, spots)
 *   2. Listed-bhandara     , PENDING → APPROVED conversion funnel
 *      submission funnel
 *   3. Spot funnel         , same shape, for /spot reports
 *   4. Bot ingestion       , BotIngestionLog outcomes (ACCEPTED/DUPLICATE/etc.)
 *   5. Live chat intent    , SHARING vs ASKING vs MENTIONING split
 *   6. Top areas           , bhandaras + spots per area, ranked
 *   7. Top organisers      , the people listing 2+ bhandaras
 *   8. Approval velocity   , average lag from PENDING → APPROVED
 *   9. Recent activity     , submissions per day over the last 14 days
 *  10. GA setup CTA        , what env-vars to add to enable the
 *                             "top pages / CTR / bounce / engagement"
 *                             GA-derived section (placeholder until set)
 *
 * Intentionally NOT committed yet, staying out of git until Prateek
 * reviews. To remove: `git restore` or just `rm -rf src/app/admin/analytics`.
 */

type FunnelStage = {
  label: string;
  count: number;
  pct?: number;
  tone: "neutral" | "green" | "amber" | "red";
};

export default async function AnalyticsPage() {
  if (!(await isAdmin())) redirect("/admin");

  const navCounts = await getAdminNavCounts();
  const [
    visitorNumber,
    communityMembers,
    bhandaraByStatus,
    spotByStatus,
    botByOutcome,
    mentionByIntent,
    bhandaraByArea,
    spotByArea,
    organiserCounts,
    approvalLag,
    recentDays,
  ] = await Promise.all([
    getCachedVisitorCount(),
    getCachedCommunityMembers(),
    prisma.bhandara.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.spot.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    // Cast to a concrete shape so the consumer's reduce/sort works
    // without TS inferring the union with the catch fallback. The
    // catch covers the freshly-deployed window where the table exists
    // but the bot hasn't logged a single row yet.
    (prisma.botIngestionLog
      .groupBy({ by: ["outcome"], _count: { _all: true } })
      .catch(() => [])) as Promise<Array<{ outcome: string; _count: { _all: number } }>>,
    prisma.bhandaraMention.groupBy({
      by: ["intent", "status"],
      _count: { _all: true },
    }),
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
    // Approval lag, avg seconds between createdAt and updatedAt for rows
    // that ended up APPROVED. We use updatedAt as a proxy for the moment
    // status flipped (the row hasn't been edited since approval in most
    // cases). Not perfect but cheap.
    prisma.$queryRaw<{ avg_minutes: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) / 60)::float AS avg_minutes
      FROM "Bhandara"
      WHERE status = 'APPROVED' AND "updatedAt" > "createdAt"
    `,
    // Last 14 days of submissions across Bhandara + Spot.
    prisma.$queryRaw<{ day: string; bhandaras: number; spots: number }[]>`
      SELECT
        TO_CHAR(d.day, 'YYYY-MM-DD') AS day,
        COALESCE(b.n, 0)::int AS bhandaras,
        COALESCE(s.n, 0)::int AS spots
      FROM generate_series(
        (CURRENT_DATE - INTERVAL '13 days')::date,
        CURRENT_DATE::date,
        '1 day'
      ) AS d(day)
      LEFT JOIN (
        SELECT DATE("createdAt") AS day, COUNT(*) AS n
        FROM "Bhandara" GROUP BY DATE("createdAt")
      ) b ON b.day = d.day
      LEFT JOIN (
        SELECT DATE("createdAt") AS day, COUNT(*) AS n
        FROM "Spot" GROUP BY DATE("createdAt")
      ) s ON s.day = d.day
      ORDER BY d.day ASC
    `,
  ]);

  // ── derived: bhandara + spot funnel stages ────────────────────────
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

  // ── derived: top areas (merged bhandara + spot) ───────────────────
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

  // ── derived: organisers with 2+ approved bhandaras ────────────────
  const organiserMap = new Map<string, { name: string; phone: string | null; count: number; slugs: string[] }>();
  for (const r of organiserCounts) {
    const key = (r.organizerName ?? "").trim().toLowerCase();
    if (!key) continue;
    const e = organiserMap.get(key) ?? {
      name: r.organizerName ?? "(unknown)",
      phone: r.organizerPhone,
      count: 0,
      slugs: [],
    };
    e.count++;
    e.slugs.push(r.slug);
    organiserMap.set(key, e);
  }
  const topOrganisers = Array.from(organiserMap.values())
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.count - a.count);

  // ── derived: mention intent split ─────────────────────────────────
  const intentMap = new Map<string, { approved: number; rejected: number }>();
  for (const r of mentionByIntent) {
    const e = intentMap.get(r.intent ?? "OTHER") ?? { approved: 0, rejected: 0 };
    if (r.status === "APPROVED") e.approved = r._count._all;
    if (r.status === "REJECTED") e.rejected = r._count._all;
    intentMap.set(r.intent ?? "OTHER", e);
  }
  const intentRows = Array.from(intentMap.entries()).sort(
    (a, b) => b[1].approved + b[1].rejected - (a[1].approved + a[1].rejected),
  );

  const avgApprovalMinutes = approvalLag[0]?.avg_minutes ?? null;

  // ── derived: 14-day timeseries totals ─────────────────────────────
  const submissionsByDayMax = Math.max(
    ...recentDays.map((d) => d.bhandaras + d.spots),
    1,
  );

  return (
    <AdminShell navCounts={navCounts}>
      <AdminPageHero
        subject="dashboard"
        eyebrow="Operator analytics"
        title="What's happening on the site"
        subtitle="Funnels, top areas, top organisers, and intent breakdown. All numbers pulled live from the database every time this page loads, no GA round-trip."
      />

      {/* ── KPI strip ─────────────────────────────────────────────── */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Website visits" value={visitorNumber.toLocaleString("en-IN")} sub="all-time, includes today" tone="cyan" />
        <KpiCard label="WhatsApp members" value={communityMembers.toLocaleString("en-IN")} sub="across 4 community circles" tone="green" />
        <KpiCard label="Bhandaras listed" value={bhApproved.toLocaleString("en-IN")} sub={`${bhPending} pending, ${bhRejected} rejected`} tone="amber" />
        <KpiCard label="Spots reported" value={spApproved.toLocaleString("en-IN")} sub={`${spPending} pending, ${spRejected} rejected`} tone="violet" />
      </section>

      {/* ── Funnels (Listed + Spot side by side) ──────────────────── */}
      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <FunnelCard
          title="Listed bhandara funnel"
          subtitle="Organisers submitting bhandaras via /organise or the admin scan flow"
          stages={[
            { label: "Submitted (all-time)", count: bhTotal, tone: "neutral" },
            { label: "Pending review",      count: bhPending, tone: "amber" },
            { label: "Approved → live",     count: bhApproved, tone: "green",
              pct: bhTotal > 0 ? (bhApproved / bhTotal) * 100 : 0 },
            { label: "Rejected",            count: bhRejected, tone: "red",
              pct: bhTotal > 0 ? (bhRejected / bhTotal) * 100 : 0 },
          ]}
          footer={`Approval rate: ${bhApprovalRate.toFixed(1)}%${avgApprovalMinutes != null ? ` · avg time-to-approve ${formatLag(avgApprovalMinutes)}` : ""}`}
        />
        <FunnelCard
          title="Spot funnel"
          subtitle="Walkers reporting bhandaras via the 'Spot a bhandara' button"
          stages={[
            { label: "Submitted (all-time)", count: spTotal, tone: "neutral" },
            { label: "Pending review",       count: spPending, tone: "amber" },
            { label: "Approved → live",      count: spApproved, tone: "green",
              pct: spTotal > 0 ? (spApproved / spTotal) * 100 : 0 },
            { label: "Rejected",             count: spRejected, tone: "red",
              pct: spTotal > 0 ? (spRejected / spTotal) * 100 : 0 },
          ]}
          footer={`Approval rate: ${spApprovalRate.toFixed(1)}%`}
        />
      </section>

      {/* ── Live chat intent ──────────────────────────────────────── */}
      <section className="mt-8">
        <Panel title="Live chat, what people came to do" subtitle="Intent split from BhandaraMention table">
          {intentRows.length === 0 ? (
            <EmptyHint text="No mentions ingested yet." />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-zinc-400">
                <tr className="border-b border-zinc-800/80">
                  <th className="text-left py-2 px-2">Intent</th>
                  <th className="text-right py-2 px-2">Approved</th>
                  <th className="text-right py-2 px-2">Rejected</th>
                  <th className="text-right py-2 px-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {intentRows.map(([intent, v]) => (
                  <tr key={intent} className="border-b border-zinc-900/60">
                    <td className="py-2 px-2 text-zinc-100">{intent}</td>
                    <td className="py-2 px-2 text-right text-emerald-300 tabular-nums">{v.approved}</td>
                    <td className="py-2 px-2 text-right text-rose-300 tabular-nums">{v.rejected}</td>
                    <td className="py-2 px-2 text-right text-zinc-200 tabular-nums">{v.approved + v.rejected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </section>

      {/* ── Bot ingestion outcomes ───────────────────────────────── */}
      <section className="mt-8">
        <Panel
          title="Bot ingestion, what the WhatsApp bot did"
          subtitle="Outcome breakdown from BotIngestionLog"
        >
          {botByOutcome.length === 0 ? (
            <div className="rounded-lg border border-amber-700/30 bg-amber-900/10 p-3 text-sm text-amber-200">
              No rows in <code className="font-mono text-xs">BotIngestionLog</code> yet. Either the bot
              hasn&apos;t POSTed to /api/bot/ingest since the table was created, or the endpoint
              isn&apos;t writing to it. Verify by sending a test message through one of the WhatsApp
              circles and re-loading this page.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-zinc-400">
                <tr className="border-b border-zinc-800/80">
                  <th className="text-left py-2 px-2">Outcome</th>
                  <th className="text-right py-2 px-2">Count</th>
                  <th className="text-right py-2 px-2">% of ingests</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const total = botByOutcome.reduce((s, r) => s + r._count._all, 0);
                  return botByOutcome
                    .sort((a, b) => b._count._all - a._count._all)
                    .map((r) => (
                      <tr key={r.outcome} className="border-b border-zinc-900/60">
                        <td className="py-2 px-2 text-zinc-100 font-mono text-xs">{r.outcome}</td>
                        <td className="py-2 px-2 text-right text-zinc-200 tabular-nums">{r._count._all}</td>
                        <td className="py-2 px-2 text-right text-zinc-400 tabular-nums">
                          {total > 0 ? ((r._count._all / total) * 100).toFixed(1) : "0.0"}%
                        </td>
                      </tr>
                    ));
                })()}
              </tbody>
            </table>
          )}
        </Panel>
      </section>

      {/* ── Top areas ─────────────────────────────────────────────── */}
      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Top 10 areas by activity"
          subtitle="Combined APPROVED bhandaras + spots per area"
        >
          {topAreas.length === 0 ? (
            <EmptyHint text="No approved rows yet." />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-zinc-400">
                <tr className="border-b border-zinc-800/80">
                  <th className="text-left py-2 px-2">Area</th>
                  <th className="text-right py-2 px-2">Bhandaras</th>
                  <th className="text-right py-2 px-2">Spots</th>
                  <th className="text-right py-2 px-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {topAreas.map((a) => (
                  <tr key={a.area} className="border-b border-zinc-900/60">
                    <td className="py-2 px-2 text-zinc-100">{a.area}</td>
                    <td className="py-2 px-2 text-right text-amber-300 tabular-nums">{a.bhandaras}</td>
                    <td className="py-2 px-2 text-right text-violet-300 tabular-nums">{a.spots}</td>
                    <td className="py-2 px-2 text-right text-zinc-200 tabular-nums font-medium">{a.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        {/* ── Top organisers ──────────────────────────────────────── */}
        <Panel
          title="Top organisers (2+ approved bhandaras)"
          subtitle="The community's most active contributors, worth a thank-you outreach"
        >
          {topOrganisers.length === 0 ? (
            <EmptyHint text="No organisers with multiple listings yet." />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-zinc-400">
                <tr className="border-b border-zinc-800/80">
                  <th className="text-left py-2 px-2">Organiser</th>
                  <th className="text-left py-2 px-2">Phone</th>
                  <th className="text-right py-2 px-2">Bhandaras</th>
                </tr>
              </thead>
              <tbody>
                {topOrganisers.map((o) => (
                  <tr key={o.name} className="border-b border-zinc-900/60">
                    <td className="py-2 px-2 text-zinc-100">{o.name}</td>
                    <td className="py-2 px-2 text-zinc-400 font-mono text-xs">{o.phone ?? ", "}</td>
                    <td className="py-2 px-2 text-right text-amber-300 tabular-nums font-medium">{o.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </section>

      {/* ── 14-day submission timeseries ──────────────────────────── */}
      <section className="mt-8">
        <Panel
          title="Submissions, last 14 days"
          subtitle="New bhandaras + spots, grouped by day (IST)"
        >
          <div className="space-y-1.5">
            {recentDays.map((d) => {
              const total = d.bhandaras + d.spots;
              const widthPct = (total / submissionsByDayMax) * 100;
              return (
                <div key={d.day} className="flex items-center gap-3 text-xs">
                  <div className="w-20 font-mono text-zinc-500 tabular-nums">{d.day.slice(5)}</div>
                  <div className="flex-1 h-5 bg-zinc-900/40 rounded overflow-hidden flex">
                    {d.bhandaras > 0 && (
                      <div
                        className="bg-amber-500/70 h-full"
                        style={{ width: `${(d.bhandaras / submissionsByDayMax) * 100}%` }}
                        title={`${d.bhandaras} bhandaras`}
                      />
                    )}
                    {d.spots > 0 && (
                      <div
                        className="bg-violet-500/70 h-full"
                        style={{ width: `${(d.spots / submissionsByDayMax) * 100}%` }}
                        title={`${d.spots} spots`}
                      />
                    )}
                  </div>
                  <div className="w-16 text-right text-zinc-300 tabular-nums">
                    {total > 0 ? total : <span className="text-zinc-700">, </span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-amber-500/70" />
              <span>bhandaras</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-violet-500/70" />
              <span>spots</span>
            </div>
          </div>
        </Panel>
      </section>

      {/* ── GA setup CTA ──────────────────────────────────────────── */}
      <section className="mt-8 mb-12">
        <Panel
          title="Connect Google Analytics to fill in this section"
          subtitle="The data above is from our own DB. To see top pages, CTR, engagement time, and bounce rate, wire up GA4."
        >
          <div className="text-sm text-zinc-300 space-y-3">
            <p>
              The blocks we can&apos;t answer from our own tables (top-visited pages, click-through
              rate, average engagement time per page, bounce rate, referrer breakdown, device split,
              landing pages) live inside GA4. Once you add the two env vars below to Vercel +
              local, this page will fetch them on the next reload.
            </p>
            <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-3 font-mono text-xs space-y-1.5">
              <div>
                <span className="text-amber-300">GA_PROPERTY_ID</span>
                <span className="text-zinc-500"> = your GA4 property numeric id (e.g. 412345678)</span>
              </div>
              <div>
                <span className="text-amber-300">GOOGLE_APPLICATION_CREDENTIALS_JSON</span>
                <span className="text-zinc-500"> = full service-account JSON (base64-encoded)</span>
              </div>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-zinc-400 text-xs">
              <li>Google Cloud → IAM → create a service account, grant <code>BigQuery / GA Reporting Viewer</code></li>
              <li>Download JSON key, base64 it: <code>base64 -i key.json | pbcopy</code></li>
              <li>GA4 → Admin → Property Access → add the service-account email as Viewer</li>
              <li>Paste the GA4 numeric property id (Admin → Property Settings) into <code>GA_PROPERTY_ID</code></li>
              <li>npm install <code>@google-analytics/data</code></li>
              <li>Add the fetch helper at <code>src/lib/analytics-ga.ts</code> and wire it into this page</li>
            </ol>
            <p className="text-zinc-500 text-xs">
              I&apos;ve scaffolded the page so adding GA later is a swap-in: replace the placeholder
              section with a server-fetched block. Until then, the funnel + organiser + area
              sections above cover the operator-essential view.
            </p>
          </div>
        </Panel>
      </section>
    </AdminShell>
  );
}

/* ────────────────────── helpers ────────────────────── */

function formatLag(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} hr`;
  return `${(hours / 24).toFixed(1)} days`;
}

function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "cyan" | "green" | "amber" | "violet";
}) {
  const toneColor =
    tone === "cyan"
      ? "text-cyan-300"
      : tone === "green"
        ? "text-emerald-300"
        : tone === "amber"
          ? "text-amber-300"
          : "text-violet-300";
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold tabular-nums ${toneColor}`}>{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{sub}</div>
    </div>
  );
}

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
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4">
      <div className="text-sm font-semibold text-zinc-100">{title}</div>
      <div className="text-xs text-zinc-500 mt-0.5">{subtitle}</div>
      <div className="mt-4 space-y-2">
        {stages.map((s) => {
          const widthPct = (s.count / maxCount) * 100;
          const barColor =
            s.tone === "green"
              ? "bg-emerald-500/70"
              : s.tone === "amber"
                ? "bg-amber-500/70"
                : s.tone === "red"
                  ? "bg-rose-500/70"
                  : "bg-zinc-600/70";
          return (
            <div key={s.label} className="text-xs">
              <div className="flex items-baseline justify-between">
                <div className="text-zinc-300">{s.label}</div>
                <div className="text-zinc-100 tabular-nums">
                  {s.count}
                  {s.pct != null && (
                    <span className="ml-2 text-zinc-500">({s.pct.toFixed(1)}%)</span>
                  )}
                </div>
              </div>
              <div className="mt-1 h-2 bg-zinc-900/40 rounded overflow-hidden">
                <div className={`h-full ${barColor}`} style={{ width: `${widthPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 text-xs text-zinc-500">{footer}</div>
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
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4">
      <div className="text-sm font-semibold text-zinc-100">{title}</div>
      <div className="text-xs text-zinc-500 mt-0.5 mb-3">{subtitle}</div>
      {children}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <div className="text-sm text-zinc-500 italic py-3">{text}</div>;
}
