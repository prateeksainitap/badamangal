import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { bulkDelistSpotsAction } from "@/app/admin/actions";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminNavCounts } from "@/lib/admin-nav-counts";
import BotHeartbeat from "@/components/admin/BotHeartbeat";
import ModerationQueue, {
  type QueueTab,
} from "@/components/admin/ModerationQueue";
import SourceFilter, {
  type SourceFilterValue,
} from "@/components/admin/SourceFilter";
import KpiStrip from "@/components/admin/KpiStrip";
import AdminPageHero from "@/components/admin/AdminPageHero";
import {
  IconSpot,
  IconClock,
  IconFlame,
  IconX,
} from "@/components/admin/AdminIcons";
import SpotRow, { type SpotQueueRow } from "@/components/admin/SpotRow";
import {
  QueueSelectionProvider,
  BulkActionBar,
} from "@/components/admin/QueueSelection";

/**
 * Spots moderation queue — sibling of /admin/bhandaras.
 *
 * Active vs Past:
 *   Spots auto-expire 8h after creation. A row is "Past" once
 *   `expiresAt <= now` regardless of approval status — that's the
 *   archive view. Every other tab (All / Live / Rejected) excludes
 *   past rows so the operator's working surface stays free of stale
 *   items the way the bhandaras queue does. PAST shows everything
 *   that's expired, regardless of approval state; source filter
 *   still works within it.
 *
 * Computing "now" ONCE per request (vs per row) keeps every row's
 * expiry math consistent.
 */

export const metadata: Metadata = {
  title: "Spots · Admin · Bada Mangal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  status?: string;
  q?: string;
  source?: string;
}>;

/** Bot-ingested spots carry the `[bot:…]` provenance tag inside
 *  the caption column. Matched as a substring; the bot may write
 *  different bot-ID suffixes over time. */
const BOT_TAG = "[bot:";

function sourceWhere(source: SourceFilterValue): Prisma.SpotWhereInput {
  if (source === "bot") {
    return { caption: { contains: BOT_TAG } };
  }
  if (source === "human") {
    return { NOT: { caption: { contains: BOT_TAG } } };
  }
  return {};
}

// Tabs: PAST is status-agnostic ("anything with expiresAt <= now"),
// every other tab implicitly excludes past rows. Legacy `?status=EXPIRED`
// links redirect to `?status=PAST` via the param-normalisation below
// so old bookmarks + the legacy KpiStrip href stay working.
const TAB_KEYS = ["ALL", "LIVE", "REJECTED", "PAST"] as const;
type TabKey = (typeof TAB_KEYS)[number];

function whereForTab(tab: TabKey, now: Date): Prisma.SpotWhereInput {
  switch (tab) {
    case "LIVE":
      return { status: "APPROVED", expiresAt: { gt: now } };
    case "REJECTED":
      // Past rejected rows go to PAST, not REJECTED — keep this tab
      // focused on currently-relevant rejections.
      return { status: "REJECTED", expiresAt: { gt: now } };
    case "PAST":
      return { expiresAt: { lte: now } };
    case "ALL":
    default:
      // ALL now means "everything currently active" — past items live
      // in their own bucket.
      return { expiresAt: { gt: now } };
  }
}

export default async function AdminSpotsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (!(await isAdmin())) redirect("/admin");

  const sp = await searchParams;
  // Legacy `?status=EXPIRED` → PAST so old bookmarks + the legacy
  // KpiStrip href stay working without throwing.
  const rawStatus = (sp.status ?? "").toUpperCase();
  const normalisedStatus = rawStatus === "EXPIRED" ? "PAST" : rawStatus;
  const tab: TabKey = (TAB_KEYS as readonly string[]).includes(normalisedStatus)
    ? (normalisedStatus as TabKey)
    : "ALL";
  const q = (sp.q ?? "").trim();
  const source: SourceFilterValue =
    sp.source === "bot" || sp.source === "human" ? sp.source : "all";
  const now = new Date();

  // Same search fields as the legacy SpotsView: caption, area,
  // address, reporter. Phone is a hash so we deliberately skip it.
  const searchWhere: Prisma.SpotWhereInput = q
    ? {
        OR: [
          { caption: { contains: q, mode: "insensitive" } },
          { area: { contains: q, mode: "insensitive" } },
          { address: { contains: q, mode: "insensitive" } },
          { reporterName: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const where: Prisma.SpotWhereInput = {
    AND: [whereForTab(tab, now), searchWhere, sourceWhere(source)],
  };

  // ── Count derivation under the source-primary IA ─────────────────
  //
  // KpiStrip (all-time, no filter):
  //   • totalEver  = active + past
  //   • humanEver  = caption does NOT contain [bot:
  //   • botEver    = caption contains [bot:
  //   • pastEver   = expiresAt <= now
  //
  // Source tabs (active-only, exclude past — "what's currently in
  // my working surface, split by who created it"):
  //   • activeAll, activeHuman, activeBot
  //
  // Status tabs (within the current source):
  //   • countActiveInSource, countLiveInSource, countRejectedInSource,
  //     countPastInSource
  //
  // Implementation: every count is computed unconditionally for both
  // sources, then the page picks the right pair based on the active
  // source filter. ~11 parallel COUNT queries; Postgres handles this
  // in one parallel burst, well under the page's time-to-paint.
  const botCaption = { caption: { contains: BOT_TAG } };
  const humanCaption = { NOT: { caption: { contains: BOT_TAG } } };
  const activeWhere: Prisma.SpotWhereInput = { expiresAt: { gt: now } };
  const pastWhere: Prisma.SpotWhereInput = { expiresAt: { lte: now } };

  const [
    spots,
    activeAll,
    activeBot,
    pastEver,
    pastBot,
    botEver,
    countLive, // active + APPROVED, all sources
    countLiveBot,
    countRejected, // active + REJECTED, all sources
    countRejectedBot,
  ] = await Promise.all([
    prisma.spot.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        bhandara: { select: { slug: true, name: true, nameHi: true } },
      },
    }),
    // active counts
    prisma.spot.count({ where: activeWhere }),
    prisma.spot.count({ where: { AND: [activeWhere, botCaption] } }),
    // past counts
    prisma.spot.count({ where: pastWhere }),
    prisma.spot.count({ where: { AND: [pastWhere, botCaption] } }),
    // ever bot count (used to derive humanEver)
    prisma.spot.count({ where: botCaption }),
    // status counts × source — needed only for the source the user
    // has selected, but it's cheaper to compute both than to branch
    // the query plan. The page reads the right pair below.
    prisma.spot.count({
      where: { status: "APPROVED", expiresAt: { gt: now } },
    }),
    prisma.spot.count({
      where: {
        AND: [
          { status: "APPROVED", expiresAt: { gt: now } },
          botCaption,
        ],
      },
    }),
    prisma.spot.count({
      where: { status: "REJECTED", expiresAt: { gt: now } },
    }),
    prisma.spot.count({
      where: {
        AND: [
          { status: "REJECTED", expiresAt: { gt: now } },
          botCaption,
        ],
      },
    }),
  ]);
  const totalEver = activeAll + pastEver;
  const humanEver = totalEver - botEver;
  const activeHuman = activeAll - activeBot;
  const countLiveHuman = countLive - countLiveBot;
  const countRejectedHuman = countRejected - countRejectedBot;
  const countPastHuman = pastEver - pastBot;

  // Resolve the status-tab count set for the CURRENT source.
  const inSourceActive =
    source === "human"
      ? activeHuman
      : source === "bot"
        ? activeBot
        : activeAll;
  const inSourceLive =
    source === "human"
      ? countLiveHuman
      : source === "bot"
        ? countLiveBot
        : countLive;
  const inSourceRejected =
    source === "human"
      ? countRejectedHuman
      : source === "bot"
        ? countRejectedBot
        : countRejected;
  const inSourcePast =
    source === "human"
      ? countPastHuman
      : source === "bot"
        ? pastBot
        : pastEver;

  const tabs: QueueTab[] = [
    { key: "ALL", label: "All", count: inSourceActive },
    { key: "LIVE", label: "Live now", count: inSourceLive },
    { key: "REJECTED", label: "Rejected", count: inSourceRejected },
    { key: "PAST", label: "Past", count: inSourcePast },
  ];

  const totalInTab =
    tab === "LIVE"
      ? inSourceLive
      : tab === "REJECTED"
        ? inSourceRejected
        : tab === "PAST"
          ? inSourcePast
          : inSourceActive;

  return (
    <AdminShell navCounts={await getAdminNavCounts()} botHeartbeat={<BotHeartbeat />}>
      <div className="max-w-7xl mx-auto">
        <AdminPageHero
          subject="spots"
          eyebrow="Moderation"
          title="Spots"
          subtitle="Live photos from the city. Auto-expire after 8 hours. Delist, extend, or re-approve."
          primaryAction={
            <>
              <Link
                href="/admin/home"
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-4 py-2 text-sm transition-colors font-mono font-medium"
              >
                ← Dashboard
              </Link>
              <Link
                href="/admin/new?kind=spot"
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-4 py-2 text-sm transition-colors font-mono font-medium"
              >
                <span aria-hidden className="text-base leading-none">+</span>{" "}
                Add manually
              </Link>
              <Link
                href="/admin/scan"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 text-cream-50 border border-cyan-300/40 px-4 py-2 text-sm font-semibold shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)] hover:from-cyan-400 hover:to-violet-400 transition-all"
              >
                <span aria-hidden className="text-base leading-none">+</span>{" "}
                Scan &amp; publish
              </Link>
            </>
          }
        />
        <KpiStrip
          items={[
            {
              label: "Total",
              value: totalEver.toLocaleString("en-IN"),
              accent: "cyan",
              icon: <IconSpot />,
              delta: `${activeAll} active · ${pastEver} past`,
            },
            {
              label: "Human",
              value: humanEver.toLocaleString("en-IN"),
              accent: "leaf",
              icon: <IconFlame />,
              href: "?source=human",
              delta: "Reporter photos",
            },
            {
              label: "Bot",
              value: botEver.toLocaleString("en-IN"),
              accent: "violet",
              icon: <IconX />,
              href: "?source=bot",
              delta: "WhatsApp captures",
            },
            {
              label: "Past",
              value: pastEver.toLocaleString("en-IN"),
              accent: "sindoor",
              icon: <IconClock />,
              href: "?status=PAST",
              delta: pastEver > 0 ? "Archived by expiry" : "No archived spots",
            },
          ]}
        />
      </div>
      <ModerationQueue
        tabs={tabs}
        activeTab={tab}
        searchPlaceholder="Search caption, area, address, reporter…"
        searchValue={q || undefined}
        shownCount={spots.length}
        totalInTab={totalInTab}
        preserveParams={{
          // So clicking a status tab doesn't drop the active source
          // or search — the operator's primary cut (Human / Bot)
          // and any in-flight query stay intact.
          source: source !== "all" ? source : undefined,
          q: q || undefined,
        }}
        primaryFilter={
          <SourceFilter
            current={source}
            variant="primary"
            counts={{
              // Active-only — source strip is the working-surface
              // primary cut. Past rows remain reachable via Status·Past.
              all: activeAll,
              human: activeHuman,
              bot: activeBot,
            }}
            preserveParams={{
              status: tab !== "ALL" ? tab : undefined,
              q: q || undefined,
            }}
          />
        }
      >
        {spots.length === 0 ? (
          <EmptyState tab={tab} query={q} />
        ) : (
          <QueueSelectionProvider total={spots.length}>
            {spots.map((s, idx) => (
              <SpotRow
                key={s.id}
                spot={s as SpotQueueRow}
                now={now}
                index={idx}
              />
            ))}
            <BulkActionBar
              allRowIds={spots.map((s) => s.id)}
              actions={[
                {
                  key: "delist",
                  label: "Delist {n}",
                  variant: "outline-alert",
                  pendingLabel: "Delisting…",
                  confirm: "Delist {n} spot(s) from the public map?",
                  action: bulkDelistSpotsAction,
                },
              ]}
            />
          </QueueSelectionProvider>
        )}
      </ModerationQueue>
    </AdminShell>
  );
}

function EmptyState({ tab, query }: { tab: TabKey; query: string }) {
  const message = query
    ? `No spots match “${query}” in the ${tab.toLowerCase()} tab.`
    : tab === "LIVE"
      ? "Nothing live right now."
      : tab === "REJECTED"
        ? "Nothing currently rejected."
        : tab === "PAST"
          ? "No expired spots — the archive is empty."
          : "No active spots right now.";

  return (
    <div className="rounded-2xl border border-cream-50/10 bg-cream-50/[0.03] p-12 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cream-50/[0.05] mb-4 text-3xl">
        📸
      </div>
      <div className="font-fraunces text-cream-50 text-lg">{message}</div>
      <div className="text-xs text-cream-50/55 mt-2">
        Spots auto-expire 8 hours after they&apos;re posted and drop into Past.
      </div>
    </div>
  );
}
