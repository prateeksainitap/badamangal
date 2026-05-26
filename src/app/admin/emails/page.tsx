import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminNavCounts } from "@/lib/admin-nav-counts";
import BotHeartbeat from "@/components/admin/BotHeartbeat";
import EmailListItem from "./EmailListItem";
import EmailReader from "./EmailReader";
import { IconEnvelope } from "@/components/admin/AdminIcons";

/**
 * /admin/emails, Gmail/Apple-Mail-style two-pane inbox for the
 * public contact-form messages (ContactMessage table).
 *
 * Layout:
 *   • lg+ screens: list on the left (~22rem), reader on the right.
 *     Selection is URL-driven (`?id=<row>`) so the back button +
 *     deep links work. If no id is set, the first row in the
 *     filtered list is auto-selected so the reader is never empty.
 *   • Below lg: single column. If `?id` is set, the reader takes
 *     the full width and the operator clicks "← Back to inbox" to
 *     return to the list. If no `?id`, the list takes the full
 *     width.
 *
 * Tab filter (`?status=`) lives in the header above the panes and
 * acts on the LIST query. The tab is preserved in every list-row
 * link so clicking one stays in the same filter view.
 *
 * Source rows: `ContactMessage`. Workflow:
 *   NEW → READ → REPLIED   (happy path)
 *       → SPAM             (filtered out / archived)
 *
 * All state transitions live in ./actions.ts; the reader pane on
 * the right hosts the action buttons.
 */

export const metadata: Metadata = {
  title: "Emails · Admin · Bada Mangal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const TAB_KEYS = ["NEW", "READ", "REPLIED", "SPAM", "ALL"] as const;
type TabKey = (typeof TAB_KEYS)[number];

const TAB_META: Record<TabKey, { label: string; helper: string }> = {
  NEW: { label: "New", helper: "Fresh messages waiting for a reply." },
  READ: { label: "Read", helper: "You opened these, reply when you can." },
  REPLIED: { label: "Replied", helper: "Closed-loop conversations." },
  SPAM: { label: "Spam", helper: "Flagged messages. Restore or delete." },
  ALL: { label: "All", helper: "Everything in the inbox, newest first." },
};

export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; id?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin");
  const sp = await searchParams;
  const requested = (sp.status ?? "NEW").toUpperCase();
  const tab: TabKey = (TAB_KEYS as readonly string[]).includes(requested)
    ? (requested as TabKey)
    : "NEW";
  const requestedId = typeof sp.id === "string" ? sp.id : "";

  // Counts + filtered rows in parallel, same data shape the old
  // page used. Counts power tab badges; rows power the list pane.
  const [counts, rows] = await Promise.all([
    prisma.contactMessage.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.contactMessage.findMany({
      where: tab === "ALL" ? {} : { status: tab },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        name: true,
        email: true,
        subject: true,
        message: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  const countByStatus: Record<string, number> = {};
  let total = 0;
  for (const c of counts) {
    countByStatus[c.status] = c._count._all;
    total += c._count._all;
  }
  const newCount = countByStatus.NEW ?? 0;

  // Selection logic, if ?id is set AND present in the current
  // list, use it. Else fall back to the first row so the reader
  // pane is never empty when there's at least one message.
  // Selected row needs the full ContactMessage shape (phone +
  // attachment fields) which we omitted from the list query for
  // wire-size; fetch it separately when needed.
  const candidateId =
    rows.find((r) => r.id === requestedId)?.id ?? rows[0]?.id ?? null;
  const selected = candidateId
    ? await prisma.contactMessage.findUnique({
        where: { id: candidateId },
      })
    : null;

  const showReaderOnly =
    Boolean(requestedId) && Boolean(selected); // mobile single-column mode

  return (
    <AdminShell navCounts={await getAdminNavCounts()} botHeartbeat={<BotHeartbeat />}>
      <div className="max-w-7xl mx-auto">
        {/* Compact page header, no big hero, the inbox itself
            should dominate the surface. */}
        <div className="mb-5 flex items-end justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 font-mono text-[10px]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400/[0.06] border border-cyan-400/20 px-2.5 py-1 uppercase tracking-[0.18em] text-cyan-300/85">
                <span aria-hidden className="relative inline-flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-cyan-400/70 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
                </span>
                Inbox
              </span>
            </div>
            <h1 className="font-fraunces text-2xl sm:text-3xl text-cream-50 leading-[1.05] tracking-tight">
              Incoming{" "}
              <span className="bg-gradient-to-r from-cyan-300 via-cyan-200 to-violet-300 bg-clip-text text-transparent">
                emails
              </span>
            </h1>
            <p className="text-[13px] text-cream-50/55 mt-1 font-mono">
              {newCount > 0
                ? `${newCount} new · ${total} total`
                : `Inbox is clear · ${total} total`}
            </p>
          </div>
          <Link
            href="/admin/home"
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-4 py-2 text-sm transition-colors font-mono font-medium"
          >
            ← Dashboard
          </Link>
        </div>

        {/* Tab strip, drives the LIST query. */}
        <div
          role="tablist"
          aria-label="Inbox status"
          className="mb-5 inline-flex flex-wrap items-center gap-1 rounded-2xl border border-cyan-400/20 bg-[#0B0E16]/85 backdrop-blur-sm p-1 font-mono"
        >
          {TAB_KEYS.map((k) => {
            const active = tab === k;
            const count = k === "ALL" ? total : (countByStatus[k] ?? 0);
            // Switching tabs always resets the selection so we don't
            // try to render an id from the previous tab's results.
            const href = `/admin/emails?status=${k}`;
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
                <span>{TAB_META[k].label}</span>
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

        {/* Two-pane inbox shell. lg+: list (col-span-4) + reader
            (col-span-8). Below lg: shows EITHER the list OR the
            reader depending on whether ?id is set, like a mobile
            mail app. Fixed inner height so the list scrolls in
            place rather than pushing the page taller. */}
        <div className="rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm overflow-hidden lg:grid lg:grid-cols-12 lg:divide-x lg:divide-cyan-400/[0.10] h-[calc(100dvh-16rem)] min-h-[34rem]">
          {/* ── LIST PANE ─────────────────────────────────────── */}
          <aside
            className={[
              "lg:col-span-4 flex flex-col min-h-0",
              showReaderOnly ? "hidden lg:flex" : "flex",
            ].join(" ")}
            aria-label="Inbox list"
          >
            {/* Subhead */}
            <div className="px-4 py-3 border-b border-cyan-400/[0.10] flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] font-mono text-cyan-300/85">
                  {TAB_META[tab].label}
                </div>
                <div className="text-[11px] text-cream-50/45 font-mono mt-0.5">
                  {rows.length} message{rows.length === 1 ? "" : "s"}
                </div>
              </div>
            </div>
            {/* Scrollable list */}
            <ul className="flex-1 overflow-y-auto divide-y divide-cyan-400/[0.06]">
              {rows.length === 0 ? (
                <li className="p-10 text-center text-sm text-cream-50/55">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-cyan-400/[0.08] border border-cyan-400/20 mb-3 text-cyan-300/80">
                    <IconEnvelope size={22} />
                  </div>
                  <div className="font-fraunces text-cream-50 text-base">
                    {tab === "NEW"
                      ? "Inbox zero"
                      : `No ${TAB_META[tab].label.toLowerCase()} messages`}
                  </div>
                  <div className="text-[12px] text-cream-50/45 mt-1 font-mono">
                    {tab === "NEW"
                      ? "Nothing new from the public contact form."
                      : "Switch tabs to see other states."}
                  </div>
                </li>
              ) : (
                rows.map((r) => (
                  <li key={r.id}>
                    <EmailListItem
                      row={r}
                      tab={tab}
                      isActive={r.id === selected?.id}
                    />
                  </li>
                ))
              )}
            </ul>
          </aside>

          {/* ── READER PANE ───────────────────────────────────── */}
          <section
            className={[
              "lg:col-span-8 flex flex-col min-h-0 bg-[#080A10]/40",
              showReaderOnly ? "flex" : "hidden lg:flex",
            ].join(" ")}
            aria-label="Email reader"
          >
            {selected ? (
              <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">
                <EmailReader row={selected} tab={tab} />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-400/[0.08] border border-cyan-400/20 mb-3 text-cream-50/60">
                  <IconEnvelope size={28} />
                </div>
                <div className="font-fraunces text-cream-50 text-lg">
                  Select a message to read
                </div>
                <div className="text-[12.5px] text-cream-50/55 mt-1 font-mono max-w-xs">
                  Pick a row from the list on the left, or switch tabs to find
                  one in a different state.
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
