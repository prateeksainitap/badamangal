import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminNavCounts } from "@/lib/admin-nav-counts";
import BotHeartbeat from "@/components/admin/BotHeartbeat";
import { IconCheck } from "@/components/admin/AdminIcons";

/**
 * /admin/bot-log — recent /api/bot/ingest audit rows.
 *
 * Read-only view of BotIngestionLog. Lets the operator answer
 * questions like "I forwarded that poster from the Jai Sree Ram
 * channel but it didn't show up in the queue — what happened?".
 * Every ingest attempt writes a row here, regardless of outcome
 * (success / duplicate / ignored / failed), so the trail never
 * goes cold.
 *
 * Filter by outcome via `?outcome=`. Default view shows the most
 * useful slice: anything that did NOT result in a created row
 * (so the operator can scan the failures + ignored + duplicates
 * without the daily firehose of successes).
 */

export const metadata: Metadata = {
  title: "Bot log · Admin · Bada Mangal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const OUTCOME_KEYS = [
  "ALL",
  "PROBLEMS",
  "SUCCESS_BHANDARA",
  "SUCCESS_SPOT",
  "DUPLICATE_HASH",
  "DUPLICATE_CONTENT",
  "IGNORED_NON_BHANDARA",
  "FAILED_CLASSIFY",
  "FAILED_EXTRACT",
  "FAILED_UPLOAD",
  "FAILED_OTHER",
] as const;
type OutcomeKey = (typeof OUTCOME_KEYS)[number];

/** Outcomes the operator usually cares about — anything that did
 *  NOT cleanly create a row. The "PROBLEMS" virtual tab is shorthand
 *  for this set. */
const PROBLEM_OUTCOMES = [
  "DUPLICATE_HASH",
  "DUPLICATE_CONTENT",
  "IGNORED_NON_BHANDARA",
  "FAILED_CLASSIFY",
  "FAILED_EXTRACT",
  "FAILED_UPLOAD",
  "FAILED_OTHER",
];

const TONE: Record<
  string,
  { dot: string; pill: string; label: string }
> = {
  SUCCESS_BHANDARA: {
    dot: "bg-leaf-400",
    pill: "bg-leaf-400/[0.14] border-leaf-400/35 text-leaf-300",
    label: "Bhandara",
  },
  SUCCESS_SPOT: {
    dot: "bg-leaf-400",
    pill: "bg-leaf-400/[0.14] border-leaf-400/35 text-leaf-300",
    label: "Spot",
  },
  DUPLICATE_HASH: {
    dot: "bg-cream-50/50",
    pill: "bg-cream-50/[0.06] border-cream-50/20 text-cream-50/75",
    label: "Dup · hash",
  },
  DUPLICATE_CONTENT: {
    dot: "bg-cyan-400",
    pill: "bg-cyan-400/[0.12] border-cyan-400/35 text-cyan-200",
    label: "Dup · content",
  },
  IGNORED_NON_BHANDARA: {
    dot: "bg-saffron-500",
    pill: "bg-saffron-500/[0.14] border-saffron-500/40 text-saffron-300",
    label: "Ignored",
  },
  FAILED_CLASSIFY: {
    dot: "bg-alert-500",
    pill: "bg-alert-500/[0.12] border-alert-500/40 text-alert-400",
    label: "Fail · classify",
  },
  FAILED_EXTRACT: {
    dot: "bg-alert-500",
    pill: "bg-alert-500/[0.12] border-alert-500/40 text-alert-400",
    label: "Fail · extract",
  },
  FAILED_UPLOAD: {
    dot: "bg-alert-500",
    pill: "bg-alert-500/[0.12] border-alert-500/40 text-alert-400",
    label: "Fail · upload",
  },
  FAILED_OTHER: {
    dot: "bg-alert-500",
    pill: "bg-alert-500/[0.12] border-alert-500/40 text-alert-400",
    label: "Fail · other",
  },
};

function relTime(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toISOString().slice(0, 10);
}

export default async function AdminBotLogPage({
  searchParams,
}: {
  searchParams: Promise<{ outcome?: string; group?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin");
  const sp = await searchParams;
  const filter: OutcomeKey = (OUTCOME_KEYS as readonly string[]).includes(
    sp.outcome ?? "PROBLEMS",
  )
    ? ((sp.outcome ?? "PROBLEMS") as OutcomeKey)
    : "PROBLEMS";
  // Optional group-name search. Powers "show me everything from the
  // Jai Sri Ram channel" — operator types the channel name (or a
  // fragment of it) and the row list narrows to forwards whose
  // recorded groupName contains the query. Case-insensitive.
  const groupQuery = (sp.group ?? "").trim();

  const whereOutcome =
    filter === "ALL"
      ? {}
      : filter === "PROBLEMS"
        ? { outcome: { in: PROBLEM_OUTCOMES } }
        : { outcome: filter };
  const whereGroup = groupQuery
    ? {
        groupName: {
          contains: groupQuery,
          mode: "insensitive" as const,
        },
      }
    : {};
  const whereCombined = { AND: [whereOutcome, whereGroup] };

  // Counts by outcome (single groupBy) + filtered rows (latest 200).
  // Outcome tab counts intentionally IGNORE the group filter — the
  // tab strip is the global "what's happening overall" view; the
  // group search narrows the list inside the active tab.
  const [counts, rows] = await Promise.all([
    prisma.botIngestionLog.groupBy({
      by: ["outcome"],
      _count: { _all: true },
    }),
    prisma.botIngestionLog.findMany({
      where: whereCombined,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const countByOutcome: Record<string, number> = {};
  let total = 0;
  let problemTotal = 0;
  for (const c of counts) {
    countByOutcome[c.outcome] = c._count._all;
    total += c._count._all;
    if (PROBLEM_OUTCOMES.includes(c.outcome)) problemTotal += c._count._all;
  }

  return (
    <AdminShell navCounts={await getAdminNavCounts()} botHeartbeat={<BotHeartbeat />}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-5 flex items-end justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 font-mono text-[10px]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400/[0.06] border border-cyan-400/20 px-2.5 py-1 uppercase tracking-[0.18em] text-cyan-300/85">
                <span aria-hidden className="relative inline-flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-cyan-400/70 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
                </span>
                Audit
              </span>
            </div>
            <h1 className="font-fraunces text-2xl sm:text-3xl text-cream-50 leading-[1.05] tracking-tight">
              Bot ingestion{" "}
              <span className="bg-gradient-to-r from-cyan-300 via-cyan-200 to-violet-300 bg-clip-text text-transparent">
                log
              </span>
            </h1>
            <p className="text-[13px] text-cream-50/55 mt-1 font-mono">
              {total} total · {problemTotal} need attention. Every image the
              bot POSTs to <code>/api/bot/ingest</code> writes a row here.
            </p>
          </div>
          <Link
            href="/admin/home"
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-4 py-2 text-sm transition-colors font-mono font-medium"
          >
            ← Dashboard
          </Link>
        </div>

        {/* Tab strip */}
        <div
          role="tablist"
          aria-label="Outcome filter"
          className="mb-5 inline-flex flex-wrap items-center gap-1 rounded-2xl border border-cyan-400/20 bg-[#0B0E16]/85 backdrop-blur-sm p-1 font-mono"
        >
          {OUTCOME_KEYS.map((k) => {
            const active = filter === k;
            const count =
              k === "ALL"
                ? total
                : k === "PROBLEMS"
                  ? problemTotal
                  : (countByOutcome[k] ?? 0);
            const label =
              k === "ALL"
                ? "All"
                : k === "PROBLEMS"
                  ? "Problems"
                  : (TONE[k]?.label ?? k);
            const href =
              `/admin/bot-log?outcome=${k}` +
              (groupQuery ? `&group=${encodeURIComponent(groupQuery)}` : "");
            return (
              <Link
                key={k}
                href={href}
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
                <span>{label}</span>
                {count > 0 ? (
                  <span
                    className={[
                      "rounded-full font-mono tabular-nums px-1.5 min-w-[1.25rem] text-center text-[10px] leading-[1.1rem]",
                      active
                        ? "bg-cream-50/25 text-cream-50"
                        : "bg-cream-50/[0.08] text-cream-50/70",
                    ].join(" ")}
                  >
                    {count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>

        {/* Group-name search — narrows the active tab's rows to forwards
            whose recorded groupName contains the query. GET form so the
            URL stays shareable (?group=Jai+Sri+Ram). Hidden `outcome`
            input preserves the active tab on submit. */}
        <form
          method="GET"
          action="/admin/bot-log"
          className="mb-5 flex items-center gap-2 flex-wrap"
        >
          <input type="hidden" name="outcome" value={filter} />
          <label className="relative flex-1 max-w-md">
            <span className="sr-only">Filter by group</span>
            <input
              type="search"
              name="group"
              defaultValue={groupQuery}
              placeholder="Filter by WhatsApp group / channel — e.g. Jai Sri Ram"
              className="w-full rounded-xl border border-cyan-400/20 bg-[#0B0E16]/85 backdrop-blur-sm px-3.5 py-2 text-sm text-cream-50 font-mono placeholder:text-cream-50/35 focus:outline-none focus:ring-2 focus:ring-cyan-400/45 focus:border-cyan-400/55 transition-colors"
            />
          </label>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-3.5 py-2 text-xs font-mono font-medium transition-colors"
          >
            Filter
          </button>
          {groupQuery ? (
            <Link
              href={`/admin/bot-log?outcome=${filter}`}
              prefetch={false}
              className="text-[11px] text-cream-50/55 hover:text-cream-50/85 font-mono underline decoration-dotted underline-offset-4"
            >
              clear
            </Link>
          ) : null}
        </form>

        {/* Log rows */}
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm p-10 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-leaf-500/[0.10] border border-leaf-400/30 mb-3 text-leaf-300">
              <IconCheck size={22} />
            </div>
            <div className="font-fraunces text-cream-50 text-lg">
              {filter === "PROBLEMS"
                ? "No problems in the log"
                : "No matching log rows"}
            </div>
            <div className="text-[12px] text-cream-50/55 mt-1 font-mono">
              {filter === "PROBLEMS"
                ? "Every bot ingest cleanly created a row."
                : "Switch to a different filter to find the row."}
            </div>
          </div>
        ) : (
          <ul className="grid gap-2">
            {rows.map((r) => {
              const tone = TONE[r.outcome] ?? TONE.FAILED_OTHER;
              const isSuccess = r.outcome.startsWith("SUCCESS_");
              const isDup = r.outcome.startsWith("DUPLICATE_");
              const linkTarget = r.resultRowId
                ? r.resultRowKind === "spot"
                  ? `/admin/spots`
                  : `/admin/bhandaras`
                : null;
              return (
                <li
                  key={r.id}
                  className="rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm p-4"
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className={`shrink-0 inline-block w-2 h-2 rounded-full mt-1.5 ${tone.dot}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={[
                            "inline-flex items-center rounded-md border text-[10px] font-semibold uppercase tracking-[0.12em] px-1.5 py-0.5 font-mono",
                            tone.pill,
                          ].join(" ")}
                        >
                          {tone.label}
                        </span>
                        {r.senderName ? (
                          <span className="text-sm text-cream-50 font-medium">
                            {r.senderName}
                          </span>
                        ) : (
                          <span className="text-sm text-cream-50/55 italic">
                            (no sender)
                          </span>
                        )}
                        {r.groupName ? (
                          // Channel chip — clickable so the operator can
                          // pivot from "this row came from X" to "show
                          // me everything from X". Saffron tone keeps
                          // it visually distinct from the outcome pill.
                          <Link
                            href={`/admin/bot-log?outcome=${filter}&group=${encodeURIComponent(
                              r.groupName,
                            )}`}
                            prefetch={false}
                            className="inline-flex items-center rounded-md border border-saffron-500/35 bg-saffron-500/[0.08] text-saffron-200 hover:bg-saffron-500/[0.16] hover:border-saffron-500/55 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] font-mono font-semibold transition-colors"
                            title={`Filter by ${r.groupName}`}
                          >
                            in {r.groupName.slice(0, 24)}
                            {r.groupName.length > 24 ? "…" : ""}
                          </Link>
                        ) : null}
                        {r.extractedName ? (
                          <span className="text-[12px] text-cream-50/65 font-mono">
                            · {r.extractedName}
                          </span>
                        ) : null}
                        <span className="ml-auto text-[10.5px] text-cream-50/45 font-mono tabular-nums">
                          {relTime(r.createdAt)}
                        </span>
                      </div>
                      {r.reason ? (
                        <p className="mt-1 text-[12.5px] text-cream-50/75 font-mono leading-relaxed">
                          {r.reason}
                        </p>
                      ) : null}
                      <div className="mt-1.5 flex items-center gap-3 flex-wrap text-[11px] font-mono text-cream-50/45">
                        {r.imageHash ? (
                          <span>
                            hash:
                            <span className="text-cyan-300/75 ml-1">
                              {r.imageHash}
                            </span>
                          </span>
                        ) : null}
                        {r.msgId ? (
                          <span>
                            msg:
                            <span className="text-cream-50/65 ml-1">
                              {r.msgId.slice(0, 24)}
                            </span>
                          </span>
                        ) : null}
                        {(isSuccess || isDup) && linkTarget ? (
                          <Link
                            href={linkTarget}
                            prefetch={false}
                            className="text-cyan-300 hover:text-cyan-200"
                          >
                            view row →
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
