import Link from "next/link";
import AdminSearchInput from "@/components/admin/AdminSearchInput";
import { LinkPendingBadge } from "@/components/admin/LinkPending";

/**
 * Generic moderation-queue layout. Wraps every queue surface in the
 * new admin shell (Bhandaras, Spots, Mentions, Organise, Volunteer
 * submissions) with one consistent header: title + KPI ribbon +
 * filter tabs + search + primary CTA.
 *
 * The shape:
 *
 *   ┌─ Page header ──────────────────────────────────────────────┐
 *   │ Eyebrow                                                    │
 *   │ Title h1                          [CTA cluster]            │
 *   │ Subtitle                                                   │
 *   ├─ Filter ribbon ────────────────────────────────────────────┤
 *   │ [All 92]  [Pending 5]  [Live 80]  [Rejected 7]   [search]  │
 *   ├─ Body ─────────────────────────────────────────────────────┤
 *   │                                                            │
 *   │   { children }   ← page hands in its own list of rows      │
 *   │                                                            │
 *   └────────────────────────────────────────────────────────────┘
 *
 * The component itself is dumb on data: it accepts a list of tab
 * configs + the active tab key + a count of rows currently shown,
 * and renders the chrome. Pages own the actual Prisma queries +
 * row rendering. This keeps the abstraction thin (one component,
 * 200 lines) rather than trying to be a generic "queue framework".
 */

export type QueueTab = {
  /** Tab identifier, used as the `?status=...` URL param value. */
  key: string;
  /** Visible label on the pill. */
  label: string;
  /** Count shown as a badge inside the pill. Pass 0 to hide the
   *  badge entirely (e.g. when count is meaningless for this tab). */
  count: number;
};

type Props = {
  /** Small uppercase eyebrow above the title, e.g. "Moderation".
   *  Pages that pass content to AdminPageHero should NOT pass this
   *  too, the local title block is suppressed when `title` is
   *  undefined. */
  eyebrow?: string;
  /** Main heading. Renders as Fraunces serif on dark. */
  /** When set, ModerationQueue renders its own header block (legacy
   *  fallback). When omitted, the parent page should be using
   *  AdminPageHero to render eyebrow+title+subtitle+primaryAction as
   *  a merged hero, and the local header is skipped. */
  title?: string;
  /** Optional subtitle one line below the title. Accepts ReactNode
   *  so callers can embed inline <Link>s ("requests from /organise-bhandara"). */
  subtitle?: React.ReactNode;
  /** Optional CTA cluster (1-3 buttons) shown right-aligned in the
   *  page header. Pass a React fragment of <Link> / <form> elements. */
  primaryAction?: React.ReactNode;

  /** All available filter tabs. Each renders as a pill linking to
   *  `?status=<key>` on the same pathname. */
  tabs: QueueTab[];
  /** Currently-selected tab key. Drives active-pill styling and
   *  the page's filter query (caller passes this to its Prisma
   *  query already; the queue just highlights). */
  activeTab: string;

  /** When false, the search input is hidden entirely (Mentions
   *  feed doesn't have a search yet). Default true. */
  showSearch?: boolean;
  /** Placeholder text for the search input. Each queue passes its
   *  own ("Search name, area, organizer…", "Search caption…", etc). */
  searchPlaceholder?: string;

  /** Children, the page's row list. Wrap each row in `.admin-row-in`
   *  with a `--i` index for the stagger entry, same convention the
   *  ActivityStream uses. */
  children: React.ReactNode;

  /** Visible-row count for the "Showing N of M" summary above the
   *  list. Pass undefined to hide the summary. */
  shownCount?: number;
  /** Total rows in the active tab (before any search filter). Used
   *  in the summary when `shownCount` is set. */
  totalInTab?: number;
  /** Active search query, when present, the summary shows
   *  "N matches for 'foo'" instead of "Showing N of M". */
  searchValue?: string;

  /** Optional inline filter UI rendered to the right of the status
   *  tab strip (same row as the search input). Light weight, for
   *  small secondary toggles. */
  extraFilters?: React.ReactNode;
  /** PRIMARY filter rendered as its own row ABOVE the status tabs.
   *  Used by Bhandaras + Spots queues for the source segmented
   *  control, the operator's primary mental cut is "human vs bot"
   *  and the status pills become a sub-filter within that source. */
  primaryFilter?: React.ReactNode;
  /** URL params the status tab hrefs must preserve. Without this,
   *  clicking a status tab while a source filter (or search) is
   *  active drops those params and resets the page. Pages pass
   *  `{ source, q }` when their query state is more than just
   *  status. The component appends `?status=…` and merges these
   *  into the resulting URL. */
  preserveParams?: Record<string, string | undefined>;
};

export default function ModerationQueue({
  eyebrow,
  title,
  subtitle,
  primaryAction,
  tabs,
  activeTab,
  showSearch = true,
  searchPlaceholder = "Search…",
  children,
  shownCount,
  totalInTab,
  searchValue,
  extraFilters,
  primaryFilter,
  preserveParams,
}: Props) {
  /** Build a status-tab href that preserves the other active params
   *  (source, search) so flipping status doesn't reset them. The
   *  first tab in the list is the implicit "all", for it we omit
   *  the status param entirely so the URL stays clean. */
  function tabHref(tabKey: string): string {
    const params = new URLSearchParams();
    if (preserveParams) {
      for (const [k, v] of Object.entries(preserveParams)) {
        if (v) params.set(k, v);
      }
    }
    if (tabKey !== tabs[0]?.key) {
      params.set("status", tabKey);
    }
    const qs = params.toString();
    return qs ? `?${qs}` : "?";
  }
  // The page header (eyebrow + title + subtitle + primaryAction) is
  // now rendered by AdminPageHero in the merged-hero layout. We only
  // render the local header block as a fallback for pages that haven't
  // migrated yet, gated on `title` being present. Once every caller
  // moves to AdminPageHero, this branch + the matching props can go.
  const renderLocalHeader = Boolean(title);
  return (
    <div className="max-w-7xl mx-auto">
      {/* ── Page header ─ legacy fallback only ─────────────────── */}
      {renderLocalHeader ? (
        <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            {eyebrow ? (
              <div className="flex items-center gap-2 mb-1.5 font-mono text-[10px]">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400/[0.06] border border-cyan-400/20 px-2.5 py-1 uppercase tracking-[0.18em] text-cyan-300/85">
                  <span aria-hidden className="relative inline-flex h-1.5 w-1.5">
                    <span className="absolute inset-0 rounded-full bg-cyan-400/70 motion-safe:animate-ping" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  </span>
                  {eyebrow}
                </span>
              </div>
            ) : null}
            <h1 className="font-fraunces text-3xl sm:text-4xl text-cream-50 leading-[1.05] tracking-tight">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-sm text-cream-50/55 mt-2 max-w-xl font-mono">
                {subtitle}
              </p>
            ) : null}
          </div>
          {primaryAction ? (
            <div className="flex items-center gap-2 flex-wrap">{primaryAction}</div>
          ) : null}
        </div>
      ) : null}

      {/* ── Sticky filter bar ──────────────────────────────────
          Pins below the AdminShell header (h-14 = 56px) so the
          operator never has to scroll back up to flip a source,
          retry a search, or jump tabs. We wrap BOTH the primary
          filter row and the status-tab strip in one sticky shell
          with a shared frosted background, so the two rows read
          as a single floating control surface.

          z-10 sits under the AdminShell header (z-20) so the
          page-level top bar always wins. The backdrop-blur +
          translucent fill let the scrolling rows show faintly
          through, signalling "this is hovering, content is
          scrolling underneath" without going opaque.

          mb-5 on the wrapper preserves the spacing the status
          tabs row used to provide; the per-row mb-* values are
          dropped because they would compound the sticky height.

          NOTE: position:sticky requires NO ancestor on the
          scrolling path to have overflow!=visible (besides the
          window). AdminShell uses overflow-clip on the shell and
          overflow-x-clip on <main> specifically so this stays
          working, don't change those. */}
      <div className="sticky top-14 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 mb-5 bg-[#080A10]/90 backdrop-blur-md border-b border-cyan-400/[0.08]">
        {primaryFilter ? (
          <div className="pt-3 flex items-center gap-2 flex-wrap">
            {primaryFilter}
          </div>
        ) : null}
        <div className={`${primaryFilter ? "mt-3" : "pt-3"} pb-3 flex items-center gap-3 flex-wrap`}>
        <div
          role="tablist"
          aria-label="Filter"
          className="inline-flex items-center gap-1 p-1 rounded-full bg-[#0B0E16]/85 border border-cyan-400/15 backdrop-blur-sm"
        >
          {tabs.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <Link
                key={tab.key}
                href={tabHref(tab.key)}
                prefetch={false}
                role="tab"
                aria-selected={active}
                scroll={false}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-mono transition-colors",
                  active
                    ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-cream-50 shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)]"
                    : "text-cream-50/65 hover:text-cream-50 hover:bg-cyan-400/[0.06]",
                ].join(" ")}
              >
                <span>{tab.label}</span>
                {/* Always show the count badge, even 0, so the
                    operator can see the full breakdown when a source
                    filter is active. Zero counts render with a
                    dimmer tone so the strip stays calm. */}
                <LinkPendingBadge
                  count={tab.count}
                  className={[
                    "rounded-full font-mono tabular-nums px-1.5 min-w-[1.25rem] text-center text-[10px] leading-[1.1rem] inline-flex items-center justify-center",
                    active
                      ? "bg-cream-50/25 text-cream-50"
                      : tab.count > 0
                        ? "bg-cyan-400/[0.10] text-cyan-300/85"
                        : "bg-cream-50/[0.04] text-cream-50/35",
                  ].join(" ")}
                />
              </Link>
            );
          })}
        </div>
        {extraFilters ? extraFilters : null}
        {showSearch ? <AdminSearchInput placeholder={searchPlaceholder} /> : null}
        </div>
      </div>

      {/* ── Result summary ─────────────────────────────────────── */}
      {typeof shownCount === "number" ? (
        <div className="mb-3 text-xs text-cream-50/55">
          {searchValue ? (
            <>
              <span className="text-cream-50/85 font-medium tabular-nums">
                {shownCount}
              </span>{" "}
              matches for{" "}
              <span className="text-cream-50/85">&ldquo;{searchValue}&rdquo;</span>
            </>
          ) : typeof totalInTab === "number" ? (
            <>
              Showing{" "}
              <span className="text-cream-50/85 font-medium tabular-nums">
                {shownCount}
              </span>{" "}
              of {totalInTab}
            </>
          ) : null}
        </div>
      ) : null}

      {/* ── Row list ───────────────────────────────────────────── */}
      <div className="space-y-3">{children}</div>
    </div>
  );
}
