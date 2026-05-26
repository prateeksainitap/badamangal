import Link from "next/link";
import { LinkPendingBadge } from "@/components/admin/LinkPending";

/**
 * Source filter, the PRIMARY axis on the Bhandaras + Spots queues.
 *
 * Two visual variants:
 *   • "primary"  , heavier segmented control, sits above the status
 *                   tab strip. This is the new default used by the
 *                   /admin/bhandaras + /admin/spots queues so the
 *                   operator's first mental cut is "human vs bot",
 *                   then status as a sub-filter within that source.
 *   • "secondary", the older lighter pill row (kept for back-compat
 *                   with any caller that still wants the inline look).
 *
 * Four exclusive states:
 *   • "all"  , no filter (default)
 *   • "human", manually listed via form / phone / Prateek
 *   • "bot"  , captured by the WhatsApp ingest bot
 *   • "auto" , bot-ingested AND auto-published (the bot's new default
 *               since 2026-05-26). This is a refinement of "bot", the
 *               same rows minus any pre-auto-publish bot ingests still
 *               sitting in PENDING. Lets the operator review what the
 *               bot pushed live without manual approval.
 *
 * Source is detected upstream by the presence of the `[bot:…]`
 * provenance tag in the row's text column (Bhandara.description,
 * Spot.caption). The `auto-publish` flag inside the same tag marks
 * the auto-published subset. This component is UI only; the page
 * passes the filtered counts in.
 *
 * The chip group preserves any other active query params (`status`,
 * `q`) so flipping source doesn't drop the operator's tab/search.
 */
export type SourceFilterValue = "all" | "human" | "bot" | "auto";

type Props = {
  /** Currently-active source filter. */
  current: SourceFilterValue;
  /** Counts shown as the small badge inside each chip. The page
   *  controls what "all" means, for the source-primary IA it's the
   *  active total (excluding past), so the source strip is the
   *  current-working-surface filter, not an all-time tally. `auto`
   *  is the auto-published subset of `bot`; OMIT it on surfaces
   *  where auto-publish has no distinct meaning (e.g. Spots, where
   *  every row already auto-publishes by default). The Auto chip
   *  hides entirely when this field is undefined. */
  counts: { all: number; human: number; bot: number; auto?: number };
  /** Other query params (status, q) that must be preserved across
   *  source-filter clicks. The component appends `source=…` to this. */
  preserveParams?: Record<string, string | undefined>;
  /** Visual weight. "primary" renders the heavier segmented control
   *  used above the status tabs. "secondary" matches the older inline
   *  pill row. Defaults to "primary". */
  variant?: "primary" | "secondary";
};

const OPTIONS: Array<{
  key: SourceFilterValue;
  label: string;
  /** Tiny icon glyph; intentionally simple so the chip stays compact. */
  icon: string;
}> = [
  { key: "all", label: "All sources", icon: "◍" },
  { key: "human", label: "Human", icon: "✋" },
  { key: "bot", label: "Bot", icon: "🤖" },
  { key: "auto", label: "Auto posted", icon: "⚡" },
];

export default function SourceFilter({
  current,
  counts,
  preserveParams,
  variant = "primary",
}: Props) {
  // Hide the "Auto posted" option on surfaces that don't expose an
  // auto count (Spots, every row auto-publishes by design, so the
  // filter would be a no-op). Bhandaras passes a real number, even
  // 0, and the chip stays visible so the operator's filter set is
  // stable across deploys.
  const options = OPTIONS.filter(
    (opt) => opt.key !== "auto" || counts.auto !== undefined,
  );

  function hrefFor(key: SourceFilterValue): string {
    const params = new URLSearchParams();
    if (preserveParams) {
      for (const [k, v] of Object.entries(preserveParams)) {
        if (v) params.set(k, v);
      }
    }
    if (key !== "all") params.set("source", key);
    const qs = params.toString();
    return qs ? `?${qs}` : "?";
  }

  if (variant === "secondary") {
    return (
      <div
        role="group"
        aria-label="Filter by source"
        className="inline-flex items-center gap-1 p-1 rounded-full bg-[#0B0E16]/85 border border-cyan-400/15 backdrop-blur-sm"
      >
        {options.map((opt) => {
          const active = opt.key === current;
          const count =
            opt.key === "all"
              ? counts.all
              : opt.key === "human"
                ? counts.human
                : opt.key === "bot"
                  ? counts.bot
                  : (counts.auto ?? 0);
          return (
            <Link
              key={opt.key}
              href={hrefFor(opt.key)}
              prefetch={false}
              scroll={false}
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-mono transition-colors",
                active
                  ? "bg-gradient-to-r from-violet-500 to-cyan-500 text-cream-50 shadow-[0_4px_14px_-4px_rgba(139,92,246,0.55)]"
                  : "text-cream-50/65 hover:text-cream-50 hover:bg-cyan-400/[0.06]",
              ].join(" ")}
            >
              <span aria-hidden className="text-[10px]">
                {opt.icon}
              </span>
              <span>{opt.label === "All sources" ? "All" : opt.label}</span>
              <LinkPendingBadge
                count={count}
                className={[
                  "rounded-full font-mono tabular-nums px-1.5 min-w-[1.25rem] text-center text-[10px] leading-[1.1rem] inline-flex items-center justify-center",
                  active
                    ? "bg-cream-50/25 text-cream-50"
                    : "bg-cyan-400/[0.10] text-cyan-300/85",
                ].join(" ")}
              />
            </Link>
          );
        })}
      </div>
    );
  }

  // ── primary variant, segmented control ──────────────────────────
  // Heavier visual treatment than the status pill row below it: a
  // single rounded-xl container, larger padding, gradient on the
  // active segment with a subtle inset shadow so the source choice
  // reads as the primary mental cut on the page.
  return (
    <div
      role="group"
      aria-label="Filter by source"
      className="inline-flex items-stretch rounded-xl border border-cyan-400/25 bg-[#0B0E16]/85 backdrop-blur-sm p-1 gap-0.5"
    >
      {/* Tiny "Source" eyebrow on the left so the operator can tell
          the two filter rows apart at a glance. Hidden on small
          screens where horizontal room is tight. */}
      <span
        aria-hidden
        className="hidden md:inline-flex items-center px-2.5 mr-1 text-[10px] uppercase tracking-[0.18em] font-mono text-cyan-300/65 border-r border-cyan-400/15"
      >
        Source
      </span>
      {options.map((opt) => {
        const active = opt.key === current;
        const count =
          opt.key === "all"
            ? counts.all
            : opt.key === "human"
              ? counts.human
              : counts.bot;
        return (
          <Link
            key={opt.key}
            href={hrefFor(opt.key)}
            prefetch={false}
            scroll={false}
            className={[
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm transition-colors",
              active
                ? "bg-gradient-to-r from-violet-500/95 to-cyan-500/95 text-cream-50 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_6px_18px_-8px_rgba(139,92,246,0.55)]"
                : "text-cream-50/70 hover:text-cream-50 hover:bg-cyan-400/[0.06] font-medium",
            ].join(" ")}
          >
            <span aria-hidden className="text-[13px] leading-none">
              {opt.icon}
            </span>
            <span>{opt.label}</span>
            <LinkPendingBadge
              count={count}
              className={[
                "rounded-full font-mono tabular-nums px-1.5 min-w-[1.4rem] text-center text-[10.5px] leading-[1.15rem] inline-flex items-center justify-center",
                active
                  ? "bg-cream-50/25 text-cream-50"
                  : "bg-cyan-400/[0.10] text-cyan-300/85",
              ].join(" ")}
            />
          </Link>
        );
      })}
    </div>
  );
}
