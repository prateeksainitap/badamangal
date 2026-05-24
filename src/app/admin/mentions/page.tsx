import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import {
  purgeStaleMentionsAction,
  bulkApproveMentionsAction,
  bulkRejectMentionsAction,
} from "@/app/admin/actions";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminNavCounts } from "@/lib/admin-nav-counts";
import BotHeartbeat from "@/components/admin/BotHeartbeat";
import AdminLiveRefresh from "@/components/admin/AdminLiveRefresh";
import ScreenshotIngestPanel from "@/components/admin/ScreenshotIngestPanel";
import SubmitButton from "@/components/admin/SubmitButton";
import ModerationQueue, {
  type QueueTab,
} from "@/components/admin/ModerationQueue";
import MentionRow, {
  type MentionQueueRow,
} from "@/components/admin/MentionRow";
import AdminListbox from "@/components/admin/AdminListbox";
import KpiStrip from "@/components/admin/KpiStrip";
import AdminPageHero from "@/components/admin/AdminPageHero";
import {
  IconMention,
  IconPending,
  IconCheck,
  IconX,
} from "@/components/admin/AdminIcons";
import {
  QueueSelectionProvider,
  BulkActionBar,
} from "@/components/admin/QueueSelection";

/**
 * WhatsApp mentions moderation queue — dark-themed rewrite.
 *
 * Original logic preserved: status tabs (PENDING/APPROVED/REJECTED/ALL),
 * secondary intent + min-confidence filters, AdminLiveRefresh every
 * 10s, ScreenshotIngestPanel for upload-and-classify, purge action
 * for stale PENDING rows.
 *
 * Lands in the new AdminShell so it shares the sidebar + topbar
 * with Dashboard / Bhandaras / Spots.
 */

export const metadata: Metadata = {
  title: "Mentions · Admin · Bada Mangal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  status?: string;
  intent?: string;
  minConf?: string;
  q?: string;
}>;

const STATUS_KEYS = ["PENDING", "APPROVED", "REJECTED", "ALL"] as const;
type StatusKey = (typeof STATUS_KEYS)[number];

const INTENT_OPTIONS = ["ALL", "ASKING", "SHARING", "MENTIONING"] as const;
type IntentKey = (typeof INTENT_OPTIONS)[number];

function parseMinConf(raw: string | undefined): number {
  const n = Number(raw ?? "0");
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export default async function AdminMentionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (!(await isAdmin())) redirect("/admin");

  const sp = await searchParams;
  const status = ((STATUS_KEYS as readonly string[]).includes(
    (sp.status ?? "PENDING").toUpperCase(),
  )
    ? (sp.status ?? "PENDING").toUpperCase()
    : "PENDING") as StatusKey;
  const intent = ((INTENT_OPTIONS as readonly string[]).includes(
    (sp.intent ?? "ALL").toUpperCase(),
  )
    ? (sp.intent ?? "ALL").toUpperCase()
    : "ALL") as IntentKey;
  const minConf = parseMinConf(sp.minConf);

  const [rows, countPending, countApproved, countRejected, countAll] =
    await Promise.all([
      prisma.bhandaraMention.findMany({
        where: {
          ...(status === "ALL" ? {} : { status }),
          ...(intent === "ALL" ? {} : { intent }),
          ...(minConf > 0 ? { confidence: { gte: minConf } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.bhandaraMention.count({ where: { status: "PENDING" } }),
      prisma.bhandaraMention.count({ where: { status: "APPROVED" } }),
      prisma.bhandaraMention.count({ where: { status: "REJECTED" } }),
      prisma.bhandaraMention.count({}),
    ]);

  const tabs: QueueTab[] = [
    { key: "PENDING", label: "Pending", count: countPending },
    { key: "APPROVED", label: "Approved", count: countApproved },
    { key: "REJECTED", label: "Rejected", count: countRejected },
    { key: "ALL", label: "All", count: countAll },
  ];

  const totalInTab =
    status === "PENDING"
      ? countPending
      : status === "APPROVED"
        ? countApproved
        : status === "REJECTED"
          ? countRejected
          : countAll;

  return (
    <AdminShell navCounts={await getAdminNavCounts()} botHeartbeat={<BotHeartbeat />}>
      {/* Auto-refresh every 10s so newly-ingested PENDING mentions
          show up without operator F5. Pure client effect; renders
          nothing. */}
      <AdminLiveRefresh intervalMs={10_000} />

      <div className="max-w-7xl mx-auto">
        <AdminPageHero
          subject="mentions"
          eyebrow="Moderation"
          title="WhatsApp mentions"
          subtitle="Text messages forwarded by the WhatsApp bot, classified by Gemini, awaiting review. Approved mentions appear on the homepage's live chat panel and seed the heatmap for 24 hours."
          primaryAction={
            <Link
              href="/admin/home"
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-4 py-2 text-sm transition-colors font-mono font-medium"
            >
              ← Dashboard
            </Link>
          }
        />
        <KpiStrip
          items={[
            {
              label: "Total · 24h",
              value: countAll.toLocaleString("en-IN"),
              accent: "cyan",
              icon: <IconMention />,
            },
            {
              label: "Pending",
              value: countPending.toLocaleString("en-IN"),
              accent: "violet",
              icon: <IconPending />,
              href: "?status=PENDING",
              delta: countPending > 0 ? "Awaiting review" : "Caught up",
            },
            {
              label: "Approved",
              value: countApproved.toLocaleString("en-IN"),
              accent: "leaf",
              icon: <IconCheck />,
              href: "?status=APPROVED",
            },
            {
              label: "Rejected",
              value: countRejected.toLocaleString("en-IN"),
              accent: "sindoor",
              icon: <IconX />,
              href: "?status=REJECTED",
            },
          ]}
        />
      </div>

      <ModerationQueue
        tabs={tabs}
        activeTab={status}
        showSearch={false}
        shownCount={rows.length}
        totalInTab={totalInTab}
      >
        {/* Screenshot ingest tool — promoted to the TOP of the queue
            (above the row list) because it's an *action* the admin
            visits this page TO USE, not a buried footer. Re-skinned to
            the cyan AI/ops palette and given a stronger callout chip
            so it reads as "this is something you can do right now". */}
        <div className="mb-6 rounded-2xl border border-cyan-400/20 bg-[#0B0E16]/85 backdrop-blur-sm shadow-[0_8px_30px_-12px_rgba(0,0,0,0.55)] p-4">
          <details className="group">
            <summary className="cursor-pointer list-none flex items-center gap-3 flex-wrap">
              <span
                aria-hidden
                className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/30 to-violet-500/30 border border-cyan-400/40 text-cyan-200 group-open:rotate-90 transition-transform"
              >
                ▸
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300/85 inline-flex items-center gap-1.5">
                <span aria-hidden className="relative inline-flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-cyan-400/70 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
                </span>
                Seed action
              </span>
              <span className="font-medium text-cream-50 text-sm">
                Seed from a chat screenshot
              </span>
              <span className="text-xs text-cream-50/60 font-mono">
                · upload a WhatsApp chat image, classify, and seed approved mentions
              </span>
            </summary>
            <div className="mt-4 pt-4 border-t border-cyan-400/15">
              <ScreenshotIngestPanel />
            </div>
          </details>
        </div>

        {/* Secondary filters — intent + confidence floor. Plain GET
            form so navigation re-runs the server query without any
            client JS. */}
        <SecondaryFilters status={status} intent={intent} minConf={minConf} />

        {rows.length === 0 ? (
          <EmptyState status={status} />
        ) : (
          <QueueSelectionProvider total={rows.length}>
            <div className="space-y-3">
              {rows.map((m, idx) => (
                <MentionRow
                  key={m.id}
                  mention={m as MentionQueueRow}
                  index={idx}
                />
              ))}
            </div>
            <BulkActionBar
              allRowIds={rows.map((m) => m.id)}
              actions={[
                {
                  key: "approve",
                  label: "Approve {n}",
                  variant: "primary-green",
                  pendingLabel: "Approving…",
                  action: bulkApproveMentionsAction,
                },
                {
                  key: "reject",
                  label: "Reject {n}",
                  variant: "outline-alert",
                  pendingLabel: "Rejecting…",
                  confirm: "Reject {n} mention(s)?",
                  action: bulkRejectMentionsAction,
                },
              ]}
            />
          </QueueSelectionProvider>
        )}

        {/* Maintenance — purge PENDING rows older than 7 days. */}
        {countPending > 0 ? (
          <form
            action={purgeStaleMentionsAction}
            className="mt-6 pt-6 border-t border-cream-50/10 flex items-center justify-between flex-wrap gap-3"
          >
            <p className="text-xs text-cream-50/55 max-w-md">
              Maintenance: hard-delete every PENDING mention older than 7
              days. Approved + rejected rows are preserved.
            </p>
            <SubmitButton
              variant="outline-alert"
              pendingLabel="Purging…"
              confirm="Purge all PENDING mentions older than 7 days?"
            >
              Purge stale pending
            </SubmitButton>
          </form>
        ) : null}
      </ModerationQueue>
    </AdminShell>
  );
}

/* ────────────────────── SecondaryFilters ──────────────────────── */

function SecondaryFilters({
  status,
  intent,
  minConf,
}: {
  status: string;
  intent: string;
  minConf: number;
}) {
  return (
    <form
      method="get"
      className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto] items-end"
    >
      <input type="hidden" name="status" value={status} />
      <div className="flex items-center gap-2 flex-wrap">
        <AdminListbox
          name="intent"
          label="Intent"
          value={intent}
          options={[
            { value: "ALL", label: "All intents", hint: "Any classification" },
            {
              value: "ASKING",
              label: "Asking",
              hint: "Members searching for a bhandara",
            },
            {
              value: "SHARING",
              label: "Sharing",
              hint: "Live photos / arrivals",
            },
            {
              value: "MENTIONING",
              label: "Mentioning",
              hint: "Indirect references",
            },
          ]}
        />
        <AdminListbox
          name="minConf"
          label="Confidence"
          value={String(minConf)}
          options={[
            { value: "0", label: "Any", hint: "Don't filter" },
            { value: "0.4", label: "≥ 0.4", hint: "Loose match" },
            { value: "0.6", label: "≥ 0.6", hint: "Moderate" },
            { value: "0.8", label: "≥ 0.8", hint: "High confidence only" },
          ]}
        />
      </div>
      <button
        type="submit"
        className="rounded-lg px-4 py-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-cream-50 border border-cyan-300/40 text-sm font-semibold shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)] hover:from-cyan-400 hover:to-violet-400 transition-all font-mono"
      >
        Apply →
      </button>
    </form>
  );
}

/* ────────────────────────── Empty state ───────────────────────── */

function EmptyState({ status }: { status: StatusKey }) {
  const messages: Record<StatusKey, string> = {
    PENDING:
      "Nothing waiting for review. The WhatsApp bot will surface new mentions here as they arrive.",
    APPROVED: "No approved mentions match this filter.",
    REJECTED: "No rejected mentions match this filter.",
    ALL: "No mentions match this filter.",
  };
  return (
    <div className="rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm p-12 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-400/[0.08] border border-cyan-400/20 mb-4 text-3xl">
        💬
      </div>
      <div className="font-fraunces text-cream-50 text-lg">
        {messages[status]}
      </div>
    </div>
  );
}
