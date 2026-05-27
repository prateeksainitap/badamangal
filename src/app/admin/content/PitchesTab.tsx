import Link from "next/link";
import ContentCard from "./ContentCard";
import ContentEditor from "./ContentEditor";
import { safeContentFindMany } from "./contentQuery";

/**
 * Pitches tab - outbound pitch decks (sponsor, influencer, press).
 * The most-used surface on off-days.
 *
 * Redesigned 2026-05-27: single-row audience nav, channel as a
 * compact inline dropdown, search input promoted, and a new
 * `filter=ready|drafts|sent|followup` searchparam that the Mission
 * Strip tiles deep-link into.
 *
 * Filters compose: audience × channel × search × filter. Empty
 * audience / channel means "all"; empty search means "no text
 * filter"; empty filter means "all rows".
 */

const AUDIENCE_OPTIONS = [
  { key: "", label: "All" },
  { key: "SPONSOR", label: "Sponsor" },
  { key: "INFLUENCER", label: "Influencer" },
  { key: "PRESS", label: "Press" },
  { key: "ORGANISER", label: "Organiser" },
  { key: "DONOR", label: "Donor" },
];

const CHANNEL_OPTIONS = [
  { key: "", label: "Any channel" },
  { key: "EMAIL", label: "Email" },
  { key: "WHATSAPP", label: "WhatsApp" },
  { key: "INSTAGRAM", label: "Instagram" },
  { key: "PRESS", label: "Press" },
];

const FILTER_OPTIONS = [
  { key: "", label: "All", hint: "Every pitch in the library" },
  { key: "ready", label: "Ready", hint: "Approved · not sent in 7d" },
  { key: "drafts", label: "Drafts", hint: "Still being written" },
  { key: "sent", label: "Sent 7d", hint: "Outbound this week" },
  { key: "followup", label: "Awaiting", hint: "Reply pending" },
];

export default async function PitchesTab({
  audience,
  channel,
  q,
  filter,
}: {
  audience?: string;
  channel?: string;
  q?: string;
  filter?: string;
}) {
  const trimmedQ = (q ?? "").trim().slice(0, 200);
  const activeFilter = FILTER_OPTIONS.some((f) => f.key === filter)
    ? filter
    : "";

  // Compose the where clause one decision at a time so each filter
  // is independently testable + reorderable.
  const where: {
    kind: string;
    status?: string | { in: string[] } | { not: string };
    audience?: string;
    channel?: string;
    lastSentAt?: { gte?: Date; lt?: Date } | null;
    awaitingReply?: boolean;
    OR?: Array<Record<string, unknown>>;
  } = { kind: "PITCH" };

  // Filter wiring. "Ready" / "Drafts" / "Sent 7d" / "Awaiting"
  // each impose specific status + send-tracking constraints.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (activeFilter === "ready") {
    where.status = "ACTIVE";
    // OR clause for "never sent OR stale-sent". Note this collides
    // with the search OR below - both end up in the same property,
    // so when search is also active we fold the conditions into AND
    // shape downstream.
    where.OR = [
      { lastSentAt: null },
      { lastSentAt: { lt: sevenDaysAgo } },
    ];
  } else if (activeFilter === "drafts") {
    where.status = "DRAFT";
  } else if (activeFilter === "sent") {
    where.lastSentAt = { gte: sevenDaysAgo };
  } else if (activeFilter === "followup") {
    where.awaitingReply = true;
  } else {
    // Default: hide ARCHIVED but show DRAFT + ACTIVE both.
    where.status = { not: "ARCHIVED" };
  }

  if (audience && AUDIENCE_OPTIONS.some((a) => a.key === audience))
    where.audience = audience;
  if (channel && CHANNEL_OPTIONS.some((c) => c.key === channel))
    where.channel = channel;

  // Search: matches title / body / summary case-insensitively. We
  // build a separate OR list and AND it onto the where, which means
  // the existing OR (used by "ready") gets folded into an AND group.
  // For the simple case (only search active, no "ready" filter) the
  // where ends with a single OR clause.
  let finalWhere: Record<string, unknown>;
  if (trimmedQ) {
    const searchOr = [
      { title: { contains: trimmedQ, mode: "insensitive" } },
      { body: { contains: trimmedQ, mode: "insensitive" } },
      { summary: { contains: trimmedQ, mode: "insensitive" } },
      { tags: { has: trimmedQ.toLowerCase() } },
    ];
    if (where.OR) {
      // Merge: AND together (existing OR) AND (searchOr). Lift the
      // existing where.OR into a separate group via AND.
      const existingOr = where.OR;
      delete where.OR;
      finalWhere = {
        ...where,
        AND: [{ OR: existingOr }, { OR: searchOr }],
      };
    } else {
      finalWhere = { ...where, OR: searchOr };
    }
  } else {
    finalWhere = where as Record<string, unknown>;
  }

  // Defensive query via the shared helper. The helper tries the
  // full-fat findMany (with send-tracking orderBy + filters) first;
  // if Postgres rejects (typically because the manual SQL migration
  // hasn't been applied yet, see
  // prisma/migrations/manual/add_content_send_tracking.sql), it
  // falls back to an explicit-select query that doesn't touch the
  // new columns. Once the migration runs this is a no-op.
  const rows = await safeContentFindMany({
    where: finalWhere,
    orderBy: [
      // Awaiting-reply rows first when no specific filter, so the
      // operator sees follow-ups before "everything else". Then
      // most-recently-updated.
      { awaitingReply: "desc" },
      { updatedAt: "desc" },
    ],
  });

  const hasActiveFilters =
    Boolean(audience) || Boolean(channel) || Boolean(trimmedQ) || Boolean(activeFilter);

  return (
    <div className="space-y-4">
      <FilterBar
        audience={audience ?? ""}
        channel={channel ?? ""}
        q={trimmedQ}
        filter={activeFilter ?? ""}
        kind="pitches"
      />
      <ContentEditor defaultKind="PITCH" defaultAudience="SPONSOR" defaultChannel="EMAIL" />
      {rows.length === 0 ? (
        <EmptyState
          title={
            hasActiveFilters
              ? "No pitches match the current filters"
              : "No pitches yet"
          }
          hint={
            hasActiveFilters
              ? "Clear filters above or draft a new pitch."
              : "Use “+ Draft new” in the Mission Strip above, or click the import banner to load /notes/ pitches."
          }
        />
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <ContentCard key={r.id} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── FilterBar ──────────────────────────── */

/**
 * Compact filter bar: status row (ready/drafts/sent/followup),
 * audience row, then a single inline strip with [Channel ▾] [🔎].
 * Replaces the previous two-row stack of chip groups.
 */
export function FilterBar({
  audience,
  channel,
  q,
  filter,
  kind,
}: {
  audience: string;
  channel: string;
  q: string;
  filter: string;
  kind: "pitches" | "templates";
}) {
  const audOpts = kind === "pitches" ? AUDIENCE_OPTIONS : TEMPLATE_AUDIENCE_OPTIONS;
  const showStatusRow = kind === "pitches";

  // Href builder, preserves whichever filters aren't being changed
  // so each chip click is additive (or replaces just its own axis).
  function hrefFor(overrides: {
    aud?: string;
    ch?: string;
    flt?: string;
    qq?: string;
  }): string {
    const params = new URLSearchParams();
    params.set("tab", kind);
    const aud = overrides.aud !== undefined ? overrides.aud : audience;
    const ch = overrides.ch !== undefined ? overrides.ch : channel;
    const flt = overrides.flt !== undefined ? overrides.flt : filter;
    const qq = overrides.qq !== undefined ? overrides.qq : q;
    if (aud) params.set("aud", aud);
    if (ch) params.set("channel", ch);
    if (flt) params.set("filter", flt);
    if (qq) params.set("q", qq);
    return `/admin/content?${params.toString()}`;
  }

  return (
    <div className="rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm p-3 sm:p-4 space-y-3">
      {/* Status filter row - Pitches only. Mirrors the Mission
          Strip's four tiles so the operator can pivot between
          tiles + chips and feel oriented. */}
      {showStatusRow ? (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.16em] font-mono text-cream-50/45 mr-1">
            Status
          </span>
          {FILTER_OPTIONS.map((o) => {
            const active = (filter || "") === o.key;
            return (
              <Link
                key={o.key || "all"}
                href={hrefFor({ flt: o.key })}
                prefetch={false}
                scroll={false}
                title={o.hint}
                className={[
                  "inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-mono transition-colors",
                  active
                    ? "bg-saffron-500/[0.18] border border-saffron-500/45 text-saffron-200"
                    : "bg-cream-50/[0.04] border border-cream-50/12 text-cream-50/65 hover:bg-cream-50/[0.08] hover:text-cream-50",
                ].join(" ")}
              >
                {o.label}
              </Link>
            );
          })}
        </div>
      ) : null}

      {/* Audience row - primary horizontal nav. */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-[0.16em] font-mono text-cream-50/45 mr-1">
          Audience
        </span>
        {audOpts.map((o) => {
          const active = (audience || "") === o.key;
          return (
            <Link
              key={o.key || "all"}
              href={hrefFor({ aud: o.key })}
              prefetch={false}
              scroll={false}
              className={[
                "inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-mono transition-colors",
                active
                  ? "bg-cyan-400/[0.16] border border-cyan-400/45 text-cyan-100"
                  : "bg-cyan-400/[0.04] border border-cyan-400/15 text-cream-50/70 hover:bg-cyan-400/[0.10] hover:text-cream-50",
              ].join(" ")}
            >
              {o.label}
            </Link>
          );
        })}
      </div>

      {/* Channel + search row. Channel is a native <select> styled
          to match, saves a row over the previous chip rendering
          and reduces the cognitive load of two horizontal chip
          stacks competing for attention. */}
      <form
        method="get"
        action="/admin/content"
        className="flex items-center gap-2 flex-wrap"
      >
        {/* Preserve current tab + audience + filter via hidden
            inputs so the GET form submission doesn't drop them.
            Channel + q are the form's own inputs. */}
        <input type="hidden" name="tab" value={kind} />
        {audience ? <input type="hidden" name="aud" value={audience} /> : null}
        {filter ? <input type="hidden" name="filter" value={filter} /> : null}

        <div className="inline-flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.16em] font-mono text-cream-50/45">
            Channel
          </span>
          <div className="relative">
            <select
              name="channel"
              defaultValue={channel}
              className="appearance-none rounded-md border border-violet-400/30 bg-violet-400/[0.06] text-cream-50/85 hover:text-cream-50 hover:bg-violet-400/[0.12] hover:border-violet-400/50 pr-7 pl-2.5 py-1 text-[11px] font-mono cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-violet-400/40"
            >
              {CHANNEL_OPTIONS.map((o) => (
                <option key={o.key || "any"} value={o.key} className="bg-[#0B0E16] text-cream-50">
                  {o.label}
                </option>
              ))}
            </select>
            <span
              aria-hidden
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-cream-50/55 pointer-events-none text-[9px]"
            >
              ▾
            </span>
          </div>
        </div>

        {/* Search input. Submits on Enter via the surrounding form;
            no client JS needed. */}
        <label className="flex-1 min-w-[200px] inline-flex items-center gap-1.5 rounded-md border border-cream-50/15 bg-cream-50/[0.04] focus-within:border-cyan-400/55 focus-within:bg-cream-50/[0.08] transition-colors px-2.5">
          <svg
            aria-hidden
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-cream-50/45"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21 L16.65 16.65" />
          </svg>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search title, body, tag…"
            className="bg-transparent border-0 outline-none py-1 text-[12px] text-cream-50 placeholder:text-cream-50/40 w-full"
            maxLength={200}
          />
        </label>

        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-md bg-cyan-400/[0.12] border border-cyan-400/35 hover:bg-cyan-400/[0.22] hover:border-cyan-400/60 text-cyan-100 px-2.5 py-1 text-[11px] font-mono transition-colors"
        >
          Apply
        </button>

        {/* Reset shortcut, only shown when any filter is active. */}
        {audience || channel || q || filter ? (
          <Link
            href={`/admin/content?tab=${kind}`}
            prefetch={false}
            scroll={false}
            className="inline-flex items-center gap-1 rounded-md text-[11px] font-mono text-cream-50/55 hover:text-cream-50 px-2 py-1 transition-colors"
          >
            ✕ Clear
          </Link>
        ) : null}
      </form>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-cyan-400/15 bg-[#0B0E16]/85 backdrop-blur-sm p-10 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-400/[0.08] border border-cyan-400/20 mb-3 text-2xl">
        ✦
      </div>
      <div className="font-fraunces text-cream-50 text-lg">{title}</div>
      <div className="text-xs text-cream-50/55 mt-1 font-mono">{hint}</div>
    </div>
  );
}

// Templates use a slightly different audience set (organiser,
// volunteer, donor are the main ones, not sponsor/press).
export const TEMPLATE_AUDIENCE_OPTIONS = [
  { key: "", label: "All" },
  { key: "ORGANISER", label: "Organiser" },
  { key: "VOLUNTEER", label: "Volunteer" },
  { key: "DONOR", label: "Donor" },
  { key: "SPONSOR", label: "Sponsor" },
  { key: "COMMUNITY", label: "Community" },
];

// Legacy export - TemplatesTab still imports `FilterStrip` from
// here. Aliased to the new FilterBar so we don't have to touch
// TemplatesTab unless its UX also needs the redesign.
export { FilterBar as FilterStrip };
