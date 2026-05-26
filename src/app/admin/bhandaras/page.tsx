import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { istTodayIso } from "@/lib/dates";
import {
  bulkVerifyBhandarasAction,
  bulkApproveBhandarasAction,
  bulkRejectBhandarasAction,
  bulkDeleteBhandarasAction,
} from "@/app/admin/actions";
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
  IconBhandara,
  IconCheck,
  IconClock,
  IconPending,
  IconX,
} from "@/components/admin/AdminIcons";
import BhandaraRow, {
  type BhandaraQueueRow,
} from "@/components/admin/BhandaraRow";
import {
  QueueSelectionProvider,
  BulkActionBar,
  type BulkActionDef,
} from "@/components/admin/QueueSelection";

/**
 * Bhandaras moderation queue — replaces the legacy `/admin?type=bhandara`.
 *
 * Active vs Past:
 *   `tuesdayDates` is a JSON string[] of ISO dates (the "service days"
 *   for this bhandara — Tuesday + occasional Bade Shanivar). A row is
 *   "Past" once EVERY date in that array is strictly before today (in
 *   IST). At least one date today-or-future = "Active".
 *
 *   Past rows clutter the operator's queue (especially Pending — a
 *   pending request for a date that already passed is meaningless) so
 *   we surface a PAST tab and exclude past items from every other tab.
 *   The PAST tab is status-agnostic — it's the archive view.
 *
 * Why JS-side partition (vs SQL):
 *   Prisma can't query into a JSON-encoded string column (the
 *   tuesdayDates schema is `String`, not `Json`). Postgres `LIKE`
 *   tricks would be brittle. The set is small (low hundreds), so we
 *   fetch all rows that match search + classify in JS. The counts for
 *   each tab + the source-filter chips are derived from the same
 *   classified set — one DB round-trip total, vs the 8 we had before.
 *
 * Search + filter routing is URL-driven via `?status=`, `?q=`,
 * `?source=` so this stays a pure server component — no client state.
 */

export const metadata: Metadata = {
  title: "Bhandaras · Admin · Bada Mangal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  status?: string;
  q?: string;
  source?: string;
}>;

/** Bot-ingested bhandaras carry a `[bot:…]` provenance tag in the
 *  description column. The exact source string the WhatsApp bot
 *  writes; matched as a substring so future variants (e.g.
 *  `[bot:gemini-2.5]`) still classify correctly. */
const BOT_TAG = "[bot:";

/** Auto-published bhandaras (since 2026-05-26) carry an additional
 *  `· auto-publish]` token inside their `[bot:…]` tag. We detect
 *  the subset via plain substring match so the filter chip can
 *  pivot to "rows the bot pushed live without manual review". */
const AUTO_PUBLISH_TAG = "auto-publish";

// Status tabs now include PAST. The five active tabs (All, Pending,
// Live, Verified, Rejected) only ever show ACTIVE items (an upcoming
// service date). PAST is its own bucket holding past-dated rows
// across every status.
//
// LIVE semantic: "anything currently visible on the public site",
// which is APPROVED + has-upcoming-date — regardless of isVerified.
// Verified bhandaras are a refinement of Live (still publicly live,
// just with an extra trust pill) so they also surface under the LIVE
// tab. Operator question — "show me everything live right now" — gets
// the answer it expects, and the VERIFIED tab stays as the narrower
// "manually trust-stamped" subset.
//
// (Earlier this tab keyed off the internal statusGroup "UNVERIFIED",
// which made verified rows vanish from "Live" even though they were,
// in fact, live publicly. /admin/spots already uses LIVE; this brings
// bhandaras in line.)
const TAB_KEYS = [
  "ALL",
  "PENDING",
  "LIVE",
  "VERIFIED",
  "REJECTED",
  "PAST",
] as const;
type TabKey = (typeof TAB_KEYS)[number];

type StatusGroup = "PENDING" | "UNVERIFIED" | "VERIFIED" | "REJECTED";

function statusGroupOf(b: {
  status: string;
  isVerified: boolean;
}): StatusGroup {
  if (b.status === "PENDING") return "PENDING";
  if (b.status === "REJECTED") return "REJECTED";
  return b.isVerified ? "VERIFIED" : "UNVERIFIED";
}

function isPastBhandara(tuesdayDates: string, todayIso: string): boolean {
  // tuesdayDates is JSON-encoded `string[]`. We treat empty / malformed
  // as "past" so the row drops into the archive rather than lingering
  // in active queues forever.
  try {
    const dates = JSON.parse(tuesdayDates);
    if (!Array.isArray(dates) || dates.length === 0) return true;
    // ISO yyyy-mm-dd strings compare lexicographically the same as
    // chronologically, so we can avoid Date parsing per element.
    return dates.every((d) => typeof d === "string" && d < todayIso);
  } catch {
    return true;
  }
}

export default async function AdminBhandarasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (!(await isAdmin())) redirect("/admin");

  const sp = await searchParams;
  // Back-compat: the LIVE tab key used to be UNVERIFIED. Old bookmarks
  // (and the sidebar nav before the rename rolled out) may still link
  // to ?status=UNVERIFIED — silently normalise so we don't 404 the
  // operator into the ALL tab.
  const rawStatus = (sp.status ?? "").toUpperCase();
  const normalisedStatus = rawStatus === "UNVERIFIED" ? "LIVE" : rawStatus;
  const tab: TabKey = (TAB_KEYS as readonly string[]).includes(normalisedStatus)
    ? (normalisedStatus as TabKey)
    : "ALL";
  const q = (sp.q ?? "").trim();
  const source: SourceFilterValue =
    sp.source === "bot" ||
    sp.source === "human" ||
    sp.source === "auto"
      ? sp.source
      : "all";

  const todayIso = istTodayIso();

  // Search filter — same field set the legacy queue used. `mode:
  // "insensitive"` on every text column so search is case-blind.
  const searchWhere: Prisma.BhandaraWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { nameHi: { contains: q, mode: "insensitive" } },
          { area: { contains: q, mode: "insensitive" } },
          { address: { contains: q, mode: "insensitive" } },
          { addressHi: { contains: q, mode: "insensitive" } },
          { landmark: { contains: q, mode: "insensitive" } },
          { organizerName: { contains: q, mode: "insensitive" } },
          { organizerPhone: { contains: q } },
          { slug: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  // One round-trip: every row matching search (no status/source/date
  // filter yet — those are derived in JS). Selects only the columns
  // the queue + BhandaraRow + classifier need.
  const allMatching = await prisma.bhandara.findMany({
    where: searchWhere,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      nameHi: true,
      area: true,
      landmark: true,
      address: true,
      timeStart: true,
      timeEnd: true,
      tuesdayDates: true,
      status: true,
      isVerified: true,
      organizerName: true,
      organizerPhone: true,
      photoUrl: true,
      menu: true,
      description: true,
      createdAt: true,
    },
  });

  // Classify each row once: past flag, status group, source.
  // `isAuto` is the auto-published subset of `isBot` — bot rows whose
  // provenance tag carries the `auto-publish` flag added 2026-05-26.
  // Older bot rows ingested before auto-publish (back when every
  // forward landed PENDING) are bot-but-not-auto.
  type Classified = {
    row: (typeof allMatching)[number];
    isPast: boolean;
    statusGroup: StatusGroup;
    isBot: boolean;
    isAuto: boolean;
  };
  const classified: Classified[] = allMatching.map((b) => {
    const desc = b.description ?? "";
    const isBot = desc.includes(BOT_TAG);
    return {
      row: b,
      isPast: isPastBhandara(b.tuesdayDates, todayIso),
      statusGroup: statusGroupOf(b),
      isBot,
      isAuto: isBot && desc.includes(AUTO_PUBLISH_TAG),
    };
  });

  // ── Count derivation under the new source-primary IA ────────────
  //
  // KpiStrip tiles (all-time, independent of any filter):
  //   • totalEver  = every row (active + past)
  //   • humanEver  = every row where !isBot
  //   • botEver    = every row where isBot
  //   • pastEver   = every row where isPast
  //
  // Source tabs (primary filter — counts are ACTIVE only, i.e. exclude
  // past so the source strip is a "what's in my working surface"
  // view, not an all-time tally):
  //   • activeAll   = !isPast
  //   • activeHuman = !isPast && !isBot
  //   • activeBot   = !isPast && isBot
  //
  // Status tabs (secondary filter — counts scoped to the current
  // source selection so switching source re-derives every status
  // chip): pending / unverified / verified / rejected within active
  // rows, plus past within the selected source.
  //
  // One pass through `classified` populates them all.
  let totalEver = 0;
  let humanEver = 0;
  let botEver = 0;
  let pastEver = 0;
  let activeAll = 0;
  let activeHuman = 0;
  let activeBot = 0;
  // `activeAuto` is the count of currently-active rows that were
  // auto-published by the bot. Drives the new "Auto posted" chip
  // count + the active-tab review filter.
  let activeAuto = 0;
  // Status counts, scoped to current source selection.
  //
  // `countLive` is the union of UNVERIFIED + VERIFIED (anything
  // currently visible on the public site). VERIFIED is a refinement
  // of LIVE; verified rows are counted in both buckets on purpose so
  // the operator question "how many bhandaras are live right now?"
  // gets a count that doesn't shrink the moment we click Verify on
  // one.
  let countAll = 0;
  let countPending = 0;
  let countLive = 0;
  let countVerified = 0;
  let countRejected = 0;
  let countPast = 0;

  function matchesSource(c: Classified): boolean {
    if (source === "all") return true;
    if (source === "human") return !c.isBot;
    if (source === "auto") return c.isAuto;
    return c.isBot;
  }

  for (const c of classified) {
    totalEver++;
    if (c.isBot) botEver++;
    else humanEver++;
    if (c.isPast) pastEver++;
    if (!c.isPast) {
      activeAll++;
      if (c.isBot) activeBot++;
      else activeHuman++;
      if (c.isAuto) activeAuto++;
    }
    // Status-tab counts scoped to current source.
    if (!matchesSource(c)) continue;
    if (c.isPast) {
      countPast++;
      continue;
    }
    countAll++;
    switch (c.statusGroup) {
      case "PENDING":
        countPending++;
        break;
      case "UNVERIFIED":
        // Live but not yet trust-stamped.
        countLive++;
        break;
      case "VERIFIED":
        // Verified rows are ALSO live publicly, so they bump both
        // counts. The VERIFIED tab is the narrower "trust-stamped"
        // refinement; the LIVE tab is the broader "visible right now"
        // view.
        countVerified++;
        countLive++;
        break;
      case "REJECTED":
        countRejected++;
        break;
    }
  }

  // Predicate the active status tab applies. PAST is the only tab
  // that lets past rows through; everything else excludes them.
  function tabMatches(c: Classified): boolean {
    if (tab === "PAST") return c.isPast;
    if (c.isPast) return false;
    switch (tab) {
      case "ALL":
        return true;
      case "PENDING":
        return c.statusGroup === "PENDING";
      case "LIVE":
        // Live = anything visible on the public site = UNVERIFIED or
        // VERIFIED. Verified rows surface in both LIVE and VERIFIED
        // tabs by design (verified is a refinement, not a sibling).
        return (
          c.statusGroup === "UNVERIFIED" || c.statusGroup === "VERIFIED"
        );
      case "VERIFIED":
        return c.statusGroup === "VERIFIED";
      case "REJECTED":
        return c.statusGroup === "REJECTED";
    }
  }

  // Final list for render: source filter + status tab match.
  const rows = classified
    .filter((c) => matchesSource(c) && tabMatches(c))
    .map((c) => c.row);

  const tabs: QueueTab[] = [
    { key: "ALL", label: "All", count: countAll },
    { key: "PENDING", label: "Pending", count: countPending },
    { key: "LIVE", label: "Live", count: countLive },
    { key: "VERIFIED", label: "Verified", count: countVerified },
    { key: "REJECTED", label: "Rejected", count: countRejected },
    { key: "PAST", label: "Past", count: countPast },
  ];

  const totalInTab =
    tab === "PENDING"
      ? countPending
      : tab === "LIVE"
        ? countLive
        : tab === "VERIFIED"
          ? countVerified
          : tab === "REJECTED"
            ? countRejected
            : tab === "PAST"
              ? countPast
              : countAll;

  return (
    <AdminShell navCounts={await getAdminNavCounts()} botHeartbeat={<BotHeartbeat />}>
      <div className="max-w-7xl mx-auto">
        <AdminPageHero
          subject="bhandaras"
          eyebrow="Moderation"
          title="Bhandaras"
          subtitle="Approve, verify, edit, and publish every Bada Mangal listing. Bot-ingested rows wear a violet border. Past-dated rows sit in the Past tab."
          primaryAction={
            <>
              <Link
                href="/admin/home"
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-4 py-2 text-sm transition-colors font-mono font-medium"
              >
                ← Dashboard
              </Link>
              <Link
                href="/admin/new?kind=bhandara"
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
              // Per the IA spec, Total = active + past (everything ever
              // ingested), so the strip reads as the page's all-time
              // health, not the working-surface size.
              label: "Total",
              value: totalEver.toLocaleString("en-IN"),
              accent: "cyan",
              icon: <IconBhandara />,
              delta: `${activeAll} active · ${pastEver} past`,
            },
            {
              label: "Human",
              value: humanEver.toLocaleString("en-IN"),
              accent: "leaf",
              icon: <IconCheck />,
              href: "?source=human",
              delta: "Form submissions",
            },
            {
              label: "Bot",
              value: botEver.toLocaleString("en-IN"),
              accent: "violet",
              icon: <IconPending />,
              href: "?source=bot",
              delta: "Scraped posters",
            },
            {
              label: "Past",
              value: pastEver.toLocaleString("en-IN"),
              accent: "sindoor",
              icon: <IconClock />,
              href: "?status=PAST",
              delta: pastEver > 0 ? "Archived by date" : "No archived rows",
            },
          ]}
        />
      </div>
      <ModerationQueue
        tabs={tabs}
        activeTab={tab}
        searchPlaceholder="Search name, area, address, organizer, phone…"
        searchValue={q || undefined}
        shownCount={rows.length}
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
              // Source-tab counts are ACTIVE-only (excluding past) so
              // the operator's primary cut is "what's in the working
              // surface right now, split by who created it". Past
              // rows are still reachable via the Status·Past tab.
              all: activeAll,
              human: activeHuman,
              bot: activeBot,
              // `auto` is a subset of `bot` — same active-only scope.
              auto: activeAuto,
            }}
            preserveParams={{
              status: tab !== "ALL" ? tab : undefined,
              q: q || undefined,
            }}
          />
        }
      >
        {rows.length === 0 ? (
          <EmptyState tab={tab} query={q} />
        ) : (
          <QueueSelectionProvider total={rows.length}>
            {rows.map((b, idx) => (
              <BhandaraRow
                key={b.id}
                bhandara={b as BhandaraQueueRow}
                index={idx}
              />
            ))}
            <BulkActionBar
              allRowIds={rows.map((r) => r.id)}
              actions={bulkActionsForTab(tab)}
            />
          </QueueSelectionProvider>
        )}
      </ModerationQueue>
    </AdminShell>
  );
}

/** Bulk-action set varies by tab — Verify + Approve only make sense
 *  on PENDING / REJECTED rows; on LIVE (the union of unverified +
 *  verified) Verify still applies (it's a no-op on already-verified
 *  rows server-side) but Approve doesn't; on the VERIFIED refinement
 *  nothing except Delete is meaningful. PAST is archive — Delete is
 *  the only meaningful bulk action (cleanup). */
function bulkActionsForTab(tab: TabKey): BulkActionDef[] {
  const verify: BulkActionDef = {
    key: "verify",
    label: "Verify {n}",
    variant: "primary-green",
    pendingLabel: "Verifying…",
    action: bulkVerifyBhandarasAction,
  };
  const approve: BulkActionDef = {
    key: "approve",
    label: "Publish {n}",
    variant: "outline-saffron",
    pendingLabel: "Publishing…",
    action: bulkApproveBhandarasAction,
  };
  const reject: BulkActionDef = {
    key: "reject",
    label: "Reject {n}",
    variant: "outline-alert",
    pendingLabel: "Rejecting…",
    confirm: "Reject {n} bhandara(s)?",
    action: bulkRejectBhandarasAction,
  };
  const del: BulkActionDef = {
    key: "delete",
    label: "Delete {n}",
    variant: "outline-alert",
    pendingLabel: "Deleting…",
    confirm: "Permanently delete {n} bhandara(s) and their photos? This cannot be undone.",
    action: bulkDeleteBhandarasAction,
  };
  switch (tab) {
    case "PENDING":
      return [verify, approve, reject, del];
    case "LIVE":
      return [verify, reject, del];
    case "VERIFIED":
      return [reject, del];
    case "REJECTED":
      return [approve, del];
    case "PAST":
      return [del];
    case "ALL":
    default:
      return [verify, reject, del];
  }
}

function EmptyState({ tab, query }: { tab: TabKey; query: string }) {
  const message = query
    ? `No bhandaras match “${query}”.`
    : tab === "PENDING"
      ? "Nothing pending right now. Inbox zero."
      : tab === "LIVE"
        ? "No bhandaras live on the public site right now."
        : tab === "VERIFIED"
          ? "No verified bhandaras yet."
          : tab === "REJECTED"
            ? "Nothing rejected."
            : tab === "PAST"
              ? "Nothing in the archive — every listing has an upcoming date."
              : "No bhandaras in the database yet.";

  return (
    <div className="rounded-2xl border border-cream-50/10 bg-cream-50/[0.03] p-12 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cream-50/[0.05] mb-4 text-3xl">
        🪔
      </div>
      <div className="font-fraunces text-cream-50 text-lg">{message}</div>
      <div className="text-xs text-cream-50/55 mt-2">
        Try a different tab or clear the search to see more.
      </div>
    </div>
  );
}
