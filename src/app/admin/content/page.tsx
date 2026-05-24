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
import PitchesTab from "./PitchesTab";
import TemplatesTab from "./TemplatesTab";
import StrategyTab from "./StrategyTab";
import ImagesTab from "./ImagesTab";
import PromptsTab from "./PromptsTab";

export const metadata: Metadata = {
  title: "Content Hub · Admin · Bada Mangal",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * /admin/content — the Content Hub.
 *
 * One stop for everything outbound: pitches, templates, strategy docs,
 * AI-generated images for IG/WA, and a runnable prompt library. Each
 * tab pulls from its own DB table (or filters GalleryPhoto for the
 * Images tab); selection is by `?tab=` query param so deep links
 * survive a refresh and prefetch works.
 *
 * Auth is gated server-side at the top; the layout already gates too,
 * but the redirect here is defense-in-depth (matches every other
 * admin page).
 */

type Tab = "pitches" | "templates" | "strategy" | "images" | "prompts";
const TAB_ORDER: Tab[] = [
  "pitches",
  "templates",
  "strategy",
  "images",
  "prompts",
];

const TAB_META: Record<
  Tab,
  { label: string; sublabel: string; eyebrow: string }
> = {
  pitches: {
    label: "Pitches",
    sublabel: "Sponsor · Influencer · Press",
    eyebrow: "Outreach",
  },
  templates: {
    label: "Templates",
    sublabel: "WhatsApp · Email · Instagram",
    eyebrow: "Copy",
  },
  strategy: {
    label: "Strategy",
    sublabel: "Personas · Calendar · Off-season",
    eyebrow: "Planning",
  },
  images: {
    label: "Images",
    sublabel: "AI + curated for IG / WA / pamphlet",
    eyebrow: "Assets",
  },
  prompts: {
    label: "Prompts",
    sublabel: "Saved prompts · Run with ChatGPT",
    eyebrow: "AI runner",
  },
};

export default async function ContentHubPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; aud?: string; channel?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin");
  const sp = await searchParams;
  const tab: Tab = TAB_ORDER.includes(sp.tab as Tab)
    ? (sp.tab as Tab)
    : "pitches";

  // Counts for the tab pills — drives the small badge next to each
  // label so the operator sees "5 pitches" at a glance. All 5 counts
  // resolved in parallel so the tab strip doesn't wait per tab.
  const [
    pitchesCount,
    templatesCount,
    strategyCount,
    imagesCount,
    promptsCount,
  ] = await Promise.all([
    prisma.content.count({ where: { status: "ACTIVE", kind: "PITCH" } }),
    prisma.content.count({ where: { status: "ACTIVE", kind: "TEMPLATE" } }),
    prisma.content.count({ where: { status: "ACTIVE", kind: "STRATEGY" } }),
    prisma.galleryPhoto.count({ where: { tags: { isEmpty: false } } }),
    prisma.prompt.count({ where: { status: "ACTIVE" } }),
  ]);

  const counts: Record<Tab, number> = {
    pitches: pitchesCount,
    templates: templatesCount,
    strategy: strategyCount,
    images: imagesCount,
    prompts: promptsCount,
  };

  // First-time empty-state seed CTA: if the DB has ZERO Content rows
  // total, surface a one-click "Import from /notes/" button so the
  // operator doesn't stare at four empty tabs.
  const totalContent = pitchesCount + templatesCount + strategyCount;
  const showImportBanner = totalContent === 0;

  return (
    <AdminShell navCounts={await getAdminNavCounts()} botHeartbeat={<BotHeartbeat />}>
      <div className="max-w-7xl mx-auto">
        {/* Compact page header — used to be a big illustrated hero
            (~280px tall) that pushed real content way below the
            fold. Now it's a single-row chip+title+backlink strip
            that fits in ~80px, leaving the tabs + cards as the
            visual focus. Dashboard hero stays for /admin/home;
            sub-pages don't need to re-introduce themselves. */}
        <div className="mb-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex items-center gap-3">
            <span
              aria-hidden
              className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-saffron-500/20 via-cyan-500/20 to-violet-500/20 border border-cyan-400/35 text-saffron-300"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 3 L13.8 9.2 L20 11 L13.8 12.8 L12 19 L10.2 12.8 L4 11 L10.2 9.2 Z" />
                <path d="M19 4 L19.6 5.8 L21.5 6.5 L19.6 7.2 L19 9 L18.4 7.2 L16.5 6.5 L18.4 5.8 Z" opacity="0.85" />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300/85">
                Content hub
              </div>
              <h1 className="font-fraunces text-xl sm:text-2xl text-cream-50 leading-tight">
                Everything you send{" "}
                <span className="bg-gradient-to-r from-cyan-300 via-cyan-200 to-violet-300 bg-clip-text text-transparent">
                  outbound
                </span>
              </h1>
            </div>
          </div>
          <Link
            href="/admin/home"
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-4 py-2 text-sm transition-colors font-mono font-medium"
          >
            ← Dashboard
          </Link>
        </div>

        {/* First-run import banner — vanishes once any Content row
            exists. Calls importNotesAction which idempotent-seeds the
            seven /notes/*.md files. */}
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
                  Loads the seven markdown files from <code>/notes/</code> into
                  the hub: sponsor pitch, influencer pitch, press pitch,
                  visitor personas, off-season strategy, marketing strategy,
                  and the overnight review. Idempotent — safe to re-run.
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

        {/* Tab strip — segmented pill control matching the rest of the
            admin's queue tabs. Each tab is a Link so deep-links survive. */}
        <div
          role="tablist"
          aria-label="Content hub sections"
          className="mb-6 inline-flex flex-wrap items-center gap-1 rounded-2xl border border-cyan-400/20 bg-[#0B0E16]/85 backdrop-blur-sm p-1 font-mono"
        >
          {TAB_ORDER.map((t) => {
            const active = tab === t;
            return (
              <Link
                key={t}
                href={`/admin/content?tab=${t}`}
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
              </Link>
            );
          })}
        </div>

        {/* Section subtitle for the active tab — sets context without
            needing the operator to recall what each tab covers. */}
        <div className="mb-5 flex items-center gap-3">
          <h2 className="font-fraunces text-cream-50 text-xl">
            {TAB_META[tab].label}
          </h2>
          <span className="text-xs text-cream-50/45 font-mono">
            · {TAB_META[tab].sublabel}
          </span>
        </div>

        {/* Active tab body */}
        {tab === "pitches" ? (
          <PitchesTab audience={sp.aud} channel={sp.channel} />
        ) : null}
        {tab === "templates" ? (
          <TemplatesTab audience={sp.aud} channel={sp.channel} />
        ) : null}
        {tab === "strategy" ? <StrategyTab /> : null}
        {tab === "images" ? <ImagesTab filterTag={sp.channel} /> : null}
        {tab === "prompts" ? <PromptsTab /> : null}
      </div>
    </AdminShell>
  );
}
