"use client";

import type { Locale } from "@/content/strings";
import { strings } from "@/content/strings";
import { featuredSeason, seasonForYear } from "@/lib/season";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * Props are kept for backwards compatibility with call sites that still
 * pass a server-resolved locale, but the value is intentionally ignored.
 * Locale resolves entirely from the LocaleProvider context now, so the
 * Hindi toggle swaps every label in this component without waiting on a
 * server-tree refresh.
 */
type Props = {
  locale?: Locale;
  /** Pin a season (the 2026 recap passes 2026). Default: the featured
   *  season, the running one, else the last completed one. */
  year?: number;
};

// Literal class names so Tailwind keeps them. Columns = Tuesdays in the
// season; the connector thread starts and ends at the first and last
// disc centres.
const GRID_COLS: Record<number, string> = {
  4: "grid-cols-4", 5: "grid-cols-5", 6: "grid-cols-6", 7: "grid-cols-7", 8: "grid-cols-8",
};
const THREAD_INSET: Record<number, string> = {
  4: "left-[12%] right-[12%]", 5: "left-[10%] right-[10%]", 6: "left-[8%] right-[8%]",
  7: "left-[7%] right-[7%]", 8: "left-[6%] right-[6%]",
};

const HI_MONTHS_SHORT = [
  "जन", "फ़र", "मार्च", "अप्रै", "मई", "जून",
  "जुल", "अग", "सित", "अक्टू", "नव", "दिस",
];
const EN_MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

type NodeStatus = "past" | "live" | "next" | "future";

export default function SeasonTimeline({ year }: Props) {
  // Cookie-aware locale from context. The `locale` prop is ignored on
  // purpose, keeping it on the type so existing call-sites compile.
  const locale = useLocaleFromContext();
  const t = strings[locale];
  const isHi = locale === "hi";

  // IST today, used to bucket every Tuesday into past/live/next/future
  // automatically. "live" matches when today's IST date *is* a Tuesday in
  // the list; "next" is the first strictly-future Tuesday after today.
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const todayIso = ist.toISOString().slice(0, 10);
  const season = (year ? seasonForYear(year) : null) ?? featuredSeason();
  const is2026 = season.year === 2026;
  const tuesdays = season.tuesdays;
  const nextIso = tuesdays.find((iso) => iso > todayIso);
  const kicker = is2026
    ? t.countdown.timelineKicker
    : isHi
      ? `${season.year} के ${tuesdays.length} बड़े मंगल`
      : `The ${tuesdays.length} Bada Mangals of ${season.year}`;

  const items = tuesdays.map((iso) => {
    const d = new Date(`${iso}T04:30:00Z`);
    const day = d.getUTCDate();
    const month = isHi
      ? HI_MONTHS_SHORT[d.getUTCMonth()]
      : EN_MONTHS_SHORT[d.getUTCMonth()];
    const status: NodeStatus =
      iso === todayIso
        ? "live"
        : iso < todayIso
          ? "past"
          : iso === nextIso
            ? "next"
            : "future";
    const year = d.getUTCFullYear();
    const longLabel = isHi
      ? `${day} ${HI_MONTHS_SHORT[d.getUTCMonth()]} ${year}, मंगलवार`
      : `${day} ${EN_MONTHS_SHORT[d.getUTCMonth()]} ${year}, Tuesday`;
    return { iso, day, month, status, longLabel };
  });

  return (
    <section
      aria-label={kicker}
      className="mt-10 sm:mt-12"
    >
      {/* Header for the timeline: small uppercase kicker on top, then
          a quiet body-text subtitle carrying the "rare cycle"
          framing (Adhik Maas → 8 Tuesdays · last 2007 / next 2045).
          This used to be a separate full-width band above the timer;
          folding it under the timeline kicker keeps the rarity-trivia
          right where the visitor naturally lands while studying the
          eight dots, without making it a focal point of its own. */}
      <div className="text-center mb-6">
        <p className="font-mukta uppercase tracking-[0.32em] text-saffron-600 text-xs font-semibold">
          {kicker}
        </p>
        {is2026 ? (
          <p className="mt-2 text-xs sm:text-sm text-ink-600 max-w-2xl mx-auto leading-relaxed">
            {isHi
              ? "अधिक मास के कारण इस ज्येष्ठ में 8 बड़े मंगल, पिछली बार 2007, अगली बार 2045।"
              : "Adhik Maas brings 8 Bada Mangals this season. Last seen in 2007, next in 2045."}
          </p>
        ) : null}
      </div>

      {/* Single fluid 8-column grid at every breakpoint. The previous
          mobile fallback was a horizontal scroller that visibly cut
          off the last 1–2 nodes; instead the disc + label sizes scale
          down on narrow viewports so all eight Tuesdays always fit
          in one continuous row. The gold connector thread aligns to
          the disc midline at each breakpoint. */}
      <div className="relative px-1 sm:px-2">
        <div
          aria-hidden
          className={`absolute ${THREAD_INSET[tuesdays.length] ?? "left-[6%] right-[6%]"} h-px bg-gold-500/45 top-[18px] sm:top-[24px] md:top-[28px]`}
        />
        <ol className={`grid ${GRID_COLS[tuesdays.length] ?? "grid-cols-8"} gap-1 sm:gap-2 relative`}>
          {items.map((it) => (
            <li
              key={it.iso}
              className="flex flex-col items-center min-w-0"
              aria-label={`${it.longLabel} · ${statusLabel(it.status, t.countdown)}`}
            >
              <Node {...it} statusLabelText={statusLabel(it.status, t.countdown)} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function statusLabel(s: NodeStatus, t: typeof strings.en.countdown): string {
  if (s === "past") return t.timelineLabelPast;
  if (s === "live") return t.timelineLabelLive;
  if (s === "next") return t.timelineLabelNext;
  return t.timelineLabelFuture;
}

type NodeRenderProps = {
  day: number;
  month: string;
  status: NodeStatus;
  statusLabelText: string;
};

function Node({ day, month, status, statusLabelText }: NodeRenderProps) {
  const isPast = status === "past";
  const isLive = status === "live";
  const isNext = status === "next";

  // Disc sizes scale across breakpoints so all eight nodes fit on the
  // narrowest mobile widths without horizontal scroll. The "current"
  // disc (live or next) is one size up to keep its visual emphasis.
  const baseDiscSize = "w-9 h-9 sm:w-11 sm:h-11 md:w-12 md:h-12";
  const emphDiscSize = "w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14";

  return (
    <div className="flex flex-col items-center min-w-0 w-full">
      {/* Disc, solid cream-50 background so the gold thread that runs
          horizontally behind the row is fully hidden where it crosses
          the disc (no semi-transparent backgrounds). */}
      <div
        className={[
          "relative inline-flex items-center justify-center rounded-full font-numerals tabular-nums leading-none bg-cream-50",
          isPast
            ? `${baseDiscSize} border border-leaf-600/55 text-leaf-600`
            : isLive
              ? `${emphDiscSize} border-2 border-saffron-600 text-sindoor-700 shadow-warm ring-4 ring-saffron-500/25`
              : isNext
                ? `${emphDiscSize} bg-saffron-600 text-cream-50 border-2 border-sindoor-700 shadow-warm`
                : `${baseDiscSize} border-2 border-gold-500 text-sindoor-700`,
        ].join(" ")}
      >
        <span
          className={
            isNext || isLive
              ? "font-extrabold text-sm sm:text-lg md:text-xl"
              : "font-bold text-xs sm:text-sm md:text-base"
          }
          aria-hidden
        >
          {day}
        </span>
        {isPast ? (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 inline-flex items-center justify-center w-3.5 h-3.5 sm:w-5 sm:h-5 rounded-full bg-leaf-600 text-cream-50 shadow-warm border-2 border-cream-50"
          >
            <CheckIcon />
          </span>
        ) : null}
        {isLive ? (
          <>
            <span
              aria-hidden
              className="absolute -inset-1.5 rounded-full ring-2 ring-saffron-600/70 motion-safe:animate-ping"
            />
            <span
              aria-hidden
              className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 inline-flex items-center justify-center w-3.5 h-3.5 sm:w-5 sm:h-5 rounded-full bg-saffron-600 text-cream-50 shadow-warm border-2 border-cream-50"
            >
              <span className="block w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-cream-50" />
            </span>
          </>
        ) : null}
        {isNext ? (
          <span
            aria-hidden
            className="absolute -inset-1 rounded-full ring-2 ring-saffron-500/45 motion-safe:animate-pulse"
          />
        ) : null}
      </div>
      {/* Month */}
      <p
        className={[
          "mt-1.5 sm:mt-2 text-[0.55rem] sm:text-[0.65rem] md:text-[0.7rem] uppercase tracking-[0.12em] sm:tracking-[0.18em] font-medium leading-tight",
          isPast ? "text-ink-600/60" : "text-ink-600",
        ].join(" ")}
      >
        {month}
      </p>
      {/* Status pill, hidden on the smallest widths to avoid two
          tiny lines under each disc; reappears at sm+. */}
      <p
        className={[
          "hidden sm:block mt-0.5 text-[8px] sm:text-[9px] uppercase tracking-[0.18em] sm:tracking-[0.22em] leading-tight",
          isLive
            ? "text-saffron-600 font-bold"
            : isNext
              ? "text-sindoor-700 font-semibold"
              : isPast
                ? "text-leaf-600 font-semibold"
                : "text-gold-500",
        ].join(" ")}
      >
        {statusLabelText}
      </p>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
