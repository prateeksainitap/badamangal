import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminNavCounts } from "@/lib/admin-nav-counts";
import BotHeartbeat from "@/components/admin/BotHeartbeat";
import SubmitButton from "@/components/admin/SubmitButton";
import {
  importNotesAction,
} from "./actions";
import MissionStrip from "./MissionStrip";
import PitchesTab from "./PitchesTab";
import TemplatesTab from "./TemplatesTab";
import StrategyTab from "./StrategyTab";
import ImagesTab from "./ImagesTab";
import PromptsTab from "./PromptsTab";
import ContentTabSkeleton from "./ContentTabSkeleton";

export const metadata: Metadata = {
  title: "Content Hub · Admin · Bada Mangal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * /admin/content, the Content Hub.
 *
 * On off-days (every day except Tuesday during the Adhik Mas
 * season) this is the most-used admin page — the operator's
 * outreach cockpit. The redesigned header surfaces three things
 * that matter:
 *
 *   1. Where we are in the season ("Tue 2 Jun in 6 days")
 *   2. What needs attention right now (Ready / Drafts / Sent 7d /
 *      Awaiting reply tiles)
 *   3. One-click drilldowns from each tile into the matching
 *      filtered Pitches view
 *
 * Tabs (Pitches / Templates / Strategy / Images / Prompts) get a
 * coloured dot when they have work waiting — green = ready,
 * saffron = needs follow-up. So the operator can scan the strip
 * and triage without expanding anything.
 *
 * Each tab pulls from its own DB table (or filters GalleryPhoto
 * for Images); selection is by `?tab=` query param so deep links
 * survive a refresh and prefetch works.
 *
 * Auth is gated server-side at the top; the layout already gates
 * too, but the redirect here is defense-in-depth.
 */

type Tab = "pitches" | "templates" | "strategy" | "images" | "prompts";
const TAB_ORDER: Tab[] = [
  "pitches",
  "templates",
  "strategy",
  "images",
  "prompts",
];

const TAB_META: Record<Tab, { label: string }> = {
  pitches: { label: "Pitches" },
  templates: { label: "Templates" },
  strategy: { label: "Strategy" },
  images: { label: "Images" },
  prompts: { label: "Prompts" },
};

export default async function ContentHubPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    aud?: string;
    channel?: string;
    q?: string;
    filter?: string;
  }>;
}) {
  if (!(await isAdmin())) redirect("/admin");
  const sp = await searchParams;
  const tab: Tab = TAB_ORDER.includes(sp.tab as Tab)
    ? (sp.tab as Tab)
    : "pitches";

  // Window for the "Sent 7d" tile and the "sent recently" pill
  // logic downstream. Computed once at request time so every tile +
  // tab counts agree on the same cutoff.
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Tab counts + Mission Strip counts in a single parallel batch.
  //
  //   Tab counts (5):
  //     0 — pitches ACTIVE count
  //     1 — templates ACTIVE count
  //     2 — strategy ACTIVE count
  //     3 — gallery photos (tagged for Content Hub) count
  //     4 — active prompts count
  //
  //   Mission Strip counts (4), each filtered to PITCH so the strip
  //   reflects outbound pitch work specifically (templates are
  //   internal-org-facing, not "what did I send to a journalist"):
  //     5 — ready: ACTIVE pitches with no recent send
  //     6 — drafts: DRAFT pitches
  //     7 — sent 7d: pitches lastSentAt > now - 7d
  //     8 — awaiting reply: pitches awaitingReply = true
  //
  // Promise.allSettled so any single transient EMAXCONN renders as
  // a zero in that tile rather than 500ing the whole page.
  const settled = await Promise.allSettled([
    prisma.content.count({ where: { status: "ACTIVE", kind: "PITCH" } }),
    prisma.content.count({ where: { status: "ACTIVE", kind: "TEMPLATE" } }),
    prisma.content.count({ where: { status: "ACTIVE", kind: "STRATEGY" } }),
    prisma.galleryPhoto.count({ where: { tags: { isEmpty: false } } }),
    prisma.prompt.count({ where: { status: "ACTIVE" } }),
    // Ready = ACTIVE pitches that haven't been sent in the last 7d
    // (so "stale-sent" or "never sent" rows both count as ready
    // for the next outreach cycle).
    prisma.content.count({
      where: {
        kind: "PITCH",
        status: "ACTIVE",
        OR: [
          { lastSentAt: null },
          { lastSentAt: { lt: sevenDaysAgo } },
        ],
      },
    }),
    prisma.content.count({ where: { kind: "PITCH", status: "DRAFT" } }),
    prisma.content.count({
      where: { kind: "PITCH", lastSentAt: { gte: sevenDaysAgo } },
    }),
    prisma.content.count({
      where: { kind: "PITCH", awaitingReply: true },
    }),
  ]);
  const unwrap = (idx: number): number => {
    const r = settled[idx];
    return r && r.status === "fulfilled" ? (r.value as number) : 0;
  };
  const pitchesCount = unwrap(0);
  const templatesCount = unwrap(1);
  const strategyCount = unwrap(2);
  const imagesCount = unwrap(3);
  const promptsCount = unwrap(4);
  const readyCount = unwrap(5);
  const draftsCount = unwrap(6);
  const sentWeekCount = unwrap(7);
  const awaitingReplyCount = unwrap(8);

  const counts: Record<Tab, number> = {
    pitches: pitchesCount,
    templates: templatesCount,
    strategy: strategyCount,
    images: imagesCount,
    prompts: promptsCount,
  };

  // Per-tab "needs attention" status dot. Green = has ready-to-send
  // rows. Saffron = has awaiting-reply follow-ups. Both = saffron
  // wins (follow-up is more urgent). Null = nothing pending.
  //
  // Today only the Pitches tab participates (the others don't have
  // send-tracking yet). When templates get the same data model
  // next, just add a `templates: …` entry here.
  const tabStatus: Partial<Record<Tab, "ready" | "followup">> = {
    pitches:
      awaitingReplyCount > 0
        ? "followup"
        : readyCount > 0
          ? "ready"
          : undefined,
  };

  // First-time empty-state seed CTA: if the DB has ZERO Content
  // rows total, surface a one-click "Import from /notes/" button
  // so the operator doesn't stare at four empty tabs.
  const totalContent = pitchesCount + templatesCount + strategyCount;
  const showImportBanner = totalContent === 0;

  return (
    <AdminShell navCounts={await getAdminNavCounts()} botHeartbeat={<BotHeartbeat />}>
      <div className="max-w-7xl mx-auto">
        {/* Tight top row, brand chip + back link. The full
            mission-control hero used to sit here, replaced by the
            MissionStrip below which carries the page's identity AND
            the operator's status in a single block. */}
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <h1 className="font-fraunces text-xl sm:text-[1.4rem] text-cream-50 leading-tight flex items-center gap-2.5">
            <span
              aria-hidden
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-saffron-500/20 via-cyan-500/20 to-violet-500/20 border border-cyan-400/30 text-saffron-300"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 3 L13.8 9.2 L20 11 L13.8 12.8 L12 19 L10.2 12.8 L4 11 L10.2 9.2 Z" />
              </svg>
            </span>
            <span>Outbound</span>
          </h1>
          <Link
            href="/admin/home"
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-3 py-1.5 text-xs transition-colors font-mono font-medium"
          >
            ← Dashboard
          </Link>
        </div>

        {/* Mission Strip: Tuesday countdown + 4 status tiles + CTA.
            Replaces the old static "Everything you send outbound"
            hero with something actionable. */}
        <MissionStrip
          ready={readyCount}
          drafts={draftsCount}
          sent7d={sentWeekCount}
          awaitingReply={awaitingReplyCount}
        />

        {/* First-run import banner, vanishes once any Content row
            exists. Calls importNotesAction which idempotent-seeds
            the seven /notes/*.md files. */}
        {showImportBanner ? (
          <div className="mb-6 rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/[0.08] via-[#0B0E16] to-violet-500/[0.08] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300/85 mb-1.5">
                  First-run setup
                </div>
                <h2 className="font-fraunces text-xl text-cream-50">
                  Import your existing pitch + strategy notes
                </h2>
                <p className="text-sm text-cream-50/65 mt-1.5 font-mono">
                  Loads the seven markdown files from <code>/notes/</code>
                  into the hub: sponsor pitch, influencer pitch, press
                  pitch, visitor personas, off-season strategy, marketing
                  strategy, and the overnight review. Idempotent, safe
                  to re-run.
                </p>
              </div>
              <form action={importNotesAction}>
                <SubmitButton variant="primary-saffron" size="md" pendingLabel="Importing…">
                  ⤓ Import from /notes/
                </SubmitButton>
              </form>
            </div>
          </div>
        ) : null}

        {/* Tab strip: section pill control with status dots. The
            dot tells the operator "this tab has work" without
            them clicking in. Mirrors the dot system on the
            MissionStrip tiles for visual consistency. */}
        <div
          role="tablist"
          aria-label="Content hub sections"
          className="mb-6 inline-flex flex-wrap items-center gap-1 rounded-2xl border border-cyan-400/20 bg-[#0B0E16]/85 backdrop-blur-sm p-1 font-mono"
        >
          {TAB_ORDER.map((t) => {
            const active = tab === t;
            const status = tabStatus[t];
            return (
              <Link
                key={t}
                href={`/admin/content?tab=${t}`}
                role="tab"
                aria-selected={active}
                prefetch={false}
                scroll={false}
                className={[
                  "relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors",
                  active
                    ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-cream-50 shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)]"
                    : "text-cream-50/65 hover:text-cream-50 hover:bg-cyan-400/[0.06]",
                ].join(" ")}
              >
                <span>{TAB_META[t].label}</span>
                {counts[t] > 0 ? (
                  <span
                    className={[
                      "rounded-full font-mono tabular-nums px-1.5 min-w-[1.25rem] text-center text-[10px] leading-[1.1rem]",
                      active
                        ? "bg-cream-50/25 text-cream-50"
                        : "bg-cream-50/[0.08] text-cream-50/70",
                    ].join(" ")}
                  >
                    {counts[t]}
                  </span>
                ) : null}
                {/* Status dot. Sits to the right of the count when
                    a tab has work pending — saffron for follow-up,
                    cyan for ready. */}
                {status ? (
                  <span
                    aria-hidden
                    title={
                      status === "followup"
                        ? "Has follow-ups awaiting reply"
                        : "Has ready-to-send rows"
                    }
                    className={[
                      "ml-0.5 inline-block w-1.5 h-1.5 rounded-full",
                      status === "followup"
                        ? "bg-saffron-500 motion-safe:animate-pulse"
                        : "bg-cyan-400 motion-safe:animate-pulse",
                    ].join(" ")}
                  />
                ) : null}
              </Link>
            );
          })}
        </div>

        {/* Active tab body. Filter / search / audience nav lives
            inside each tab now so it can specialise per kind.
            Each tab is wrapped in its own <Suspense> boundary so
            when the operator switches tabs (or lands cold on the
            page), the chrome above stays mounted while only the
            body shows a skeleton fallback. Without this, the
            entire route awaits the tab's findMany before any
            of the page paints — operator stares at blank space
            for ~500-1500 ms per nav. The Suspense key on each
            includes the searchParams that drive that tab's
            query, so flipping audience / channel / q / filter
            also fires the skeleton (otherwise React would
            reuse the suspended tree). */}
        {tab === "pitches" ? (
          <Suspense
            key={`pitches:${sp.aud ?? ""}:${sp.channel ?? ""}:${sp.q ?? ""}:${sp.filter ?? ""}`}
            fallback={<ContentTabSkeleton />}
          >
            <PitchesTab
              audience={sp.aud}
              channel={sp.channel}
              q={sp.q}
              filter={sp.filter}
            />
          </Suspense>
        ) : null}
        {tab === "templates" ? (
          <Suspense
            key={`templates:${sp.aud ?? ""}:${sp.channel ?? ""}:${sp.q ?? ""}`}
            fallback={<ContentTabSkeleton />}
          >
            <TemplatesTab
              audience={sp.aud}
              channel={sp.channel}
              q={sp.q}
            />
          </Suspense>
        ) : null}
        {tab === "strategy" ? (
          <Suspense fallback={<ContentTabSkeleton rows={4} />}>
            <StrategyTab />
          </Suspense>
        ) : null}
        {tab === "images" ? (
          <Suspense
            key={`images:${sp.channel ?? ""}`}
            fallback={<ContentTabSkeleton rows={2} />}
          >
            <ImagesTab filterTag={sp.channel} />
          </Suspense>
        ) : null}
        {tab === "prompts" ? (
          <Suspense fallback={<ContentTabSkeleton rows={2} />}>
            <PromptsTab />
          </Suspense>
        ) : null}
      </div>
    </AdminShell>
  );
}
