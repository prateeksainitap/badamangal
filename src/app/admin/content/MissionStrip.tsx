import Link from "next/link";
import { nextBadaMangalAfterToday } from "@/lib/dates";

/**
 * Content Hub Mission Strip.
 *
 * Replaces the old static "Everything you send outbound" hero
 * with a contextual status header - the operator opens this page
 * on off-days and the first question is always "what should I
 * send today?", not "what is this page".
 *
 * Two-row layout:
 *
 *   Row 1: Eyebrow with the next Bada Mangal Tuesday countdown.
 *          Reads like "TUE 2 JUN · 6 days" so every off-day
 *          decision sits in season context.
 *
 *   Row 2: Four status tiles + the "+ Draft" CTA pinned right.
 *
 *     Ready          Drafts           Sent 7d         Awaiting
 *     ACTIVE rows    DRAFT rows       lastSentAt      awaitingReply
 *     never sent     (work in         > now - 7d      = true
 *     (or stale)     progress)
 *
 *     Each tile links to a pre-filtered Pitches view so the
 *     operator can click "Awaiting reply 3" and land on exactly
 *     those rows.
 *
 * All counts come from the parent's Promise.allSettled so a single
 * EMAXCONN doesn't blank the strip - defensive zeros render
 * cleanly.
 */
export default function MissionStrip({
  ready,
  drafts,
  sent7d,
  awaitingReply,
}: {
  ready: number;
  drafts: number;
  sent7d: number;
  awaitingReply: number;
}) {
  const next = nextBadaMangalAfterToday();
  const countdown = next ? formatCountdown(next) : null;

  return (
    <section className="mb-6">
      {/* Row 1: eyebrow + countdown. Mono caps for the "ops
          console" register that runs through the rest of the
          admin chrome. */}
      <div className="flex items-center gap-2 mb-3 flex-wrap font-mono text-[10.5px] uppercase tracking-[0.18em]">
        <span className="text-cyan-300/85">Content hub</span>
        {countdown ? (
          <>
            <span aria-hidden className="text-cream-50/25">·</span>
            <span className="text-cream-50/65">
              Next Bada Mangal{" "}
              <span className="text-saffron-300">{countdown.dateLabel}</span>
              <span aria-hidden className="text-cream-50/25 px-1">
                ·
              </span>
              <span
                className={
                  countdown.daysLeft <= 7
                    ? "text-saffron-300"
                    : "text-cream-50/75"
                }
              >
                {countdown.daysLeft <= 0
                  ? "today"
                  : countdown.daysLeft === 1
                    ? "tomorrow"
                    : `in ${countdown.daysLeft} days`}
              </span>
            </span>
          </>
        ) : null}
      </div>

      {/* Row 2: four tiles + CTA. Tile grid grows from 2 columns
          on phones to 4 across at lg+ so the strip never crushes
          the numbers. */}
      <div className="grid grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] gap-2.5 sm:gap-3 items-stretch">
        <StatTile
          label="Ready to send"
          value={ready}
          tone="ready"
          href="/admin/content?tab=pitches&filter=ready"
          hint={
            ready > 0
              ? "Approved · never sent"
              : "Nothing queued"
          }
        />
        <StatTile
          label="Drafts"
          value={drafts}
          tone="draft"
          href="/admin/content?tab=pitches&filter=drafts"
          hint={
            drafts > 0
              ? "Work in progress"
              : "All polished"
          }
        />
        <StatTile
          label="Sent this week"
          value={sent7d}
          tone="sent"
          href="/admin/content?tab=pitches&filter=sent"
          hint={
            sent7d > 0
              ? "Last 7 days outbound"
              : "Nothing sent this week"
          }
        />
        <StatTile
          label="Awaiting reply"
          value={awaitingReply}
          tone="followup"
          href="/admin/content?tab=pitches&filter=followup"
          hint={
            awaitingReply > 0
              ? "Follow-up overdue"
              : "Inbox clean"
          }
        />
        {/* CTA, full-width on phones (spans both columns of the
            mobile grid) so it doesn't squish next to a tile. */}
        <Link
          href="/admin/content?tab=pitches&new=1"
          prefetch={false}
          className="col-span-2 lg:col-span-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-cream-50 px-4 py-3 text-sm font-semibold shadow-[0_6px_20px_-6px_rgba(34,211,238,0.55)] transition-colors"
        >
          <span aria-hidden>＋</span>
          <span>Draft new</span>
        </Link>
      </div>
    </section>
  );
}

/* ─────────────────────── Subcomponents ─────────────────────────── */

type Tone = "ready" | "draft" | "sent" | "followup";

const TONE_STYLES: Record<
  Tone,
  { dot: string; ring: string; valueText: string }
> = {
  // Ready = bright cyan, "go" signal
  ready: {
    dot: "bg-cyan-400 motion-safe:animate-pulse",
    ring: "border-cyan-400/30 hover:border-cyan-400/55",
    valueText: "text-cyan-200",
  },
  // Drafts = muted violet, "in progress"
  draft: {
    dot: "bg-violet-400/85",
    ring: "border-violet-400/25 hover:border-violet-400/45",
    valueText: "text-violet-200",
  },
  // Sent this week = leaf-green, "done" / momentum
  sent: {
    dot: "bg-leaf-400",
    ring: "border-leaf-400/30 hover:border-leaf-400/50",
    valueText: "text-leaf-300",
  },
  // Awaiting reply = saffron, "needs attention"
  followup: {
    dot: "bg-saffron-500 motion-safe:animate-pulse",
    ring: "border-saffron-500/35 hover:border-saffron-500/60",
    valueText: "text-saffron-300",
  },
};

function StatTile({
  label,
  value,
  tone,
  href,
  hint,
}: {
  label: string;
  value: number;
  tone: Tone;
  href: string;
  hint: string;
}) {
  const s = TONE_STYLES[tone];
  return (
    <Link
      href={href}
      prefetch={false}
      className={[
        "group relative rounded-xl border bg-[#0B0E16]/85 backdrop-blur-sm",
        "px-3.5 py-3 transition-colors",
        s.ring,
      ].join(" ")}
    >
      {/* Tone dot, top-right corner - same dot that surfaces on
          the tab strip when this tile has work to do. */}
      <span
        aria-hidden
        className={[
          "absolute top-2.5 right-2.5 block w-1.5 h-1.5 rounded-full",
          s.dot,
        ].join(" ")}
      />
      <div className="text-[9.5px] uppercase tracking-[0.16em] font-mono text-cream-50/55 leading-none">
        {label}
      </div>
      <div
        className={[
          "mt-1.5 font-fraunces text-[1.65rem] sm:text-[1.85rem] leading-none tabular-nums",
          s.valueText,
        ].join(" ")}
      >
        {value.toLocaleString("en-IN")}
      </div>
      <div className="mt-1 text-[10.5px] text-cream-50/55 font-mono leading-tight truncate">
        {hint}
      </div>
    </Link>
  );
}

/* ─────────────────────── Countdown helper ──────────────────────── */

function formatCountdown(next: Date): { dateLabel: string; daysLeft: number } {
  // Days until `next` in IST. We compute by converting both to
  // YYYY-MM-DD strings in IST and diffing the calendar dates so a
  // Tuesday 5am visit and a Tuesday 11pm visit both say "today"
  // rather than 0.5 vs 0 days.
  const istToday = istDateString(new Date());
  const istNext = istDateString(next);
  const ms = msBetweenIstDates(istToday, istNext);
  const daysLeft = Math.round(ms / (24 * 60 * 60 * 1000));

  // "Tue 2 Jun" - short, scannable, no year (every Bada Mangal in
  // the season is current-year).
  const dateLabel = next.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });

  return { dateLabel, daysLeft };
}

function istDateString(d: Date): string {
  // Shift to IST, then take the ISO date prefix. Same pattern the
  // BhandaraRow date strip uses for "today in Asia/Kolkata".
  return new Date(d.getTime() + 5.5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function msBetweenIstDates(a: string, b: string): number {
  // a, b are YYYY-MM-DD strings already in IST. Parse them back to
  // midnight-UTC dates and diff - the resulting ms is exactly the
  // number of calendar days between them × 86_400_000.
  const aDate = new Date(`${a}T00:00:00Z`);
  const bDate = new Date(`${b}T00:00:00Z`);
  return bDate.getTime() - aDate.getTime();
}
