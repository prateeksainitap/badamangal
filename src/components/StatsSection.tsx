"use client";

import type { Locale } from "@/content/strings";
import { strings } from "@/content/strings";
import type { SiteStats } from "@/lib/stats";
import { JaliCorner } from "@/components/ornaments";
import ScrollNumber from "@/components/ScrollNumber";
import { useLocaleFromContext } from "@/lib/locale-context";

type Props = {
  stats: SiteStats;
  /** Optional: the page passes "en" as the SSR default, but the
   *  component reads the real locale from context so Hindi-cookie
   *  visitors see the section in Hindi after hydration. */
  locale?: Locale;
};

function format(n: number, locale: Locale): string {
  return n.toLocaleString(locale === "hi" ? "en-IN" : "en-IN");
}

export default function StatsSection({ stats }: Props) {
  const locale = useLocaleFromContext();
  const t = strings[locale];
  const isHi = locale === "hi";

  return (
    <section
      aria-label={t.stats.sectionHeading}
      className="relative overflow-hidden"
    >
      {/* Soft saffron radial wash so the panel reads as one unit. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 500px at 50% -10%, rgba(242,148,76,0.16), transparent 70%), linear-gradient(180deg, transparent 0%, rgba(255,247,235,0.85) 40%, transparent 100%)",
        }}
      />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-12">
        <header className="text-center max-w-2xl mx-auto">
          <p className="font-mukta uppercase tracking-[0.32em] text-saffron-600 text-xs font-semibold">
            {t.stats.sectionKicker}
          </p>
          <h2
            className={`mt-2 text-xl sm:text-2xl ${
              isHi
                ? "font-deva font-medium text-sindoor-700"
                : "font-fraunces font-semibold text-sindoor-700"
            }`}
          >
            {t.stats.sectionHeading}
          </h2>
          <p className="mt-2 text-sm text-ink-600 leading-relaxed">{t.stats.sectionBody}</p>
        </header>

        {/* Hero pill row: two summary numbers side-by-side on tablet+,
            stacked on mobile. The visitor pill stays on the left (its
            original treatment, untouched), the new "Total bhandaras"
            pill mirrors it exactly so the row reads as a matched
            pair, then the per-source breakdown tiles below act as
            the supporting detail. Adding a tile to the breakdown
            grid for the total instead would have buried it as a
            peer of "Listed" and "Spotted" rather than as their sum. */}
        <div className="mt-6 mx-auto max-w-3xl flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch">
          <div
            role="region"
            aria-label={t.stats.visitorAria}
            className="relative flex-1 overflow-hidden rounded-full border border-saffron-500/40 bg-cream-50 shadow-warm"
          >
            <JaliCorner position="tl" className="absolute top-1 left-1.5 w-5 h-5 text-saffron-600/50" />
            <JaliCorner position="tr" className="absolute top-1 right-1.5 w-5 h-5 text-saffron-600/50" />
            <JaliCorner position="bl" className="absolute bottom-1 left-1.5 w-5 h-5 text-saffron-600/50" />
            <JaliCorner position="br" className="absolute bottom-1 right-1.5 w-5 h-5 text-saffron-600/50" />
            {/* No "Live" pill, the number is a cumulative running total
                of all visits, not a count of users currently on the site,
                and labelling it "live" misleads readers. */}
            <div className="px-5 sm:px-8 py-3 flex flex-col items-center justify-center gap-1 text-center">
              <ScrollNumber
                value={stats.visitorNumber}
                className="font-numerals font-extrabold text-saffron-600 text-3xl sm:text-4xl leading-none"
                locale={locale === "hi" ? "en-IN" : "en-IN"}
              />
              <p className="text-ink-600 text-[0.6rem] sm:text-[0.65rem] font-mukta uppercase tracking-[0.18em] font-semibold">
                {t.stats.visitorPrefix}
              </p>
            </div>
          </div>

          {/* Total bhandaras pill, identical jaali / scroll / chrome
              to the visitor pill so the two read as one matched pair. */}
          <div
            role="region"
            aria-label={t.stats.bhandarasTotalAria}
            className="relative flex-1 overflow-hidden rounded-full border border-saffron-500/40 bg-cream-50 shadow-warm"
          >
            <JaliCorner position="tl" className="absolute top-1 left-1.5 w-5 h-5 text-saffron-600/50" />
            <JaliCorner position="tr" className="absolute top-1 right-1.5 w-5 h-5 text-saffron-600/50" />
            <JaliCorner position="bl" className="absolute bottom-1 left-1.5 w-5 h-5 text-saffron-600/50" />
            <JaliCorner position="br" className="absolute bottom-1 right-1.5 w-5 h-5 text-saffron-600/50" />
            <div className="px-5 sm:px-8 py-3 flex flex-col items-center justify-center gap-1 text-center">
              <ScrollNumber
                value={stats.bhandarasTotal}
                className="font-numerals font-extrabold text-saffron-600 text-3xl sm:text-4xl leading-none"
                locale={locale === "hi" ? "en-IN" : "en-IN"}
              />
              <p className="text-ink-600 text-[0.6rem] sm:text-[0.65rem] font-mukta uppercase tracking-[0.18em] font-semibold">
                {t.stats.bhandarasTotal}
              </p>
            </div>
          </div>
        </div>

        {/* Stats grid. Tiles whose underlying number is 0 are hidden so
            the panel never reads as "nothing is happening". Six-tile
            roster grouped in two thematic rows:
              Row 1, bhandara sources: Listed · Spotted · Mentioned
              Row 2, community + scale: Community · Areas · Tuesdays
            Community leads row 2 because it's the largest number and
            anchors the scale story; Areas + Tuesdays follow as the
            geographic + temporal scope.

            Responsive grid (rearranged 2026-05-26 from 5-cols which
            left an orphan tile after the Mentioned tile was added):
              • mobile  : 2 cols → 3 rows of 2
              • md      : 3 cols → 2 rows of 3 (balanced)
              • lg      : 3 cols → 2 rows of 3 (same balance, more
                          per-tile breathing room than a 6-wide strip)
              • xl      : 6 cols → 1 row strip (only on wide screens
                          where tiles don't get cramped)
            Auto-rows so the cards align top-to-top. */}
        <ol
          className="mt-6 grid auto-rows-fr gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6"
        >
          {/* ── Row 1, bhandara source breakdown ─────────────────── */}
          {stats.bhandarasListed > 0 ? (
            <StatCard
              icon={<IconBhandara />}
              value={format(stats.bhandarasListed, locale)}
              label={t.stats.bhandarasListed}
            />
          ) : null}
          {stats.bhandarasSpotted > 0 ? (
            <StatCard
              icon={<IconCamera />}
              value={format(stats.bhandarasSpotted, locale)}
              label={t.stats.bhandarasSpotted}
            />
          ) : null}
          {stats.bhandarasMentioned > 0 ? (
            <StatCard
              icon={<IconChat />}
              value={format(stats.bhandarasMentioned, locale)}
              label={t.stats.bhandarasMentioned}
            />
          ) : null}
          {/* ── Row 2, community + scale ─────────────────────────── */}
          {/* WhatsApp community member total. Bot pushes this via
              /api/bot/community-stats; tile is hidden until the bot
              has actually upserted a non-zero count so we don't
              render an empty "0 members" placeholder before the first
              push lands. Moved to lead row 2 so the largest number
              anchors the second row visually. */}
          {stats.communityMembers > 0 ? (
            <StatCard
              icon={<IconCommunity />}
              value={format(stats.communityMembers, locale)}
              label={t.stats.communityMembers}
            />
          ) : null}
          {stats.areasCovered > 0 ? (
            <StatCard
              icon={<IconNeighborhood />}
              value={format(stats.areasCovered, locale)}
              // No "/ 36" denominator. Earlier we mirrored the
              // Tuesdays-served "X of 8" pattern here, but the
              // total-areas number (curated list in lib/lucknow.ts)
              // isn't a meaningful ceiling for visitors, they care
              // how many neighbourhoods are *covered*, not how
              // close we are to filling out a curated dictionary.
              // The bare count reads cleaner. Tuesdays still keeps
              // its denominator because "X of 8 Bada Mangals" is a
              // real, finite season-progress number.
              label={t.stats.areasCovered}
            />
          ) : null}
          {/* Tuesdays-served is calendar-derived, so 0 is a valid value
              early in the season, keep the tile visible regardless. */}
          <StatCard
            icon={<IconMangal />}
            value={format(stats.tuesdaysSoFar, locale)}
            suffix={t.stats.tuesdaysOf}
            label={t.stats.tuesdaysSoFar}
          />
        </ol>
      </div>
    </section>
  );
}

function StatCard({
  icon,
  value,
  suffix,
  label,
  note,
}: {
  icon: React.ReactNode;
  value: string;
  suffix?: string;
  label: string;
  note?: string;
}) {
  return (
    <li className="group relative rounded-2xl border border-saffron-500/30 bg-cream-50 px-4 py-4 shadow-warm transition-transform duration-300 hover:-translate-y-0.5 h-full">
      {/* Icon badge, uniform saffron */}
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-saffron-50 text-saffron-600 border border-saffron-500/40">
        {icon}
      </div>

      {/* Number, bumped a tier brighter + bolder. Was saffron-600 at
          2xl/3xl, now sindoor-700 at 3xl/4xl with a warm drop-shadow.
          On the cream tile this reads as a confident headline number
          rather than a quiet caption. */}
      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="font-numerals font-extrabold text-sindoor-700 text-3xl sm:text-4xl leading-none tabular-nums drop-shadow-[0_1px_0_rgba(156,42,42,0.08)]">
          {value}
        </span>
        {suffix ? (
          <span className="font-numerals font-semibold text-sm text-ink-600 leading-none">
            {suffix}
          </span>
        ) : null}
      </p>

      {/* Label */}
      <p className="mt-2 text-xs sm:text-sm font-medium text-ink-900 leading-tight">{label}</p>
      {note ? (
        <p className="mt-0.5 text-[10px] sm:text-[11px] text-ink-600 leading-snug">{note}</p>
      ) : null}
    </li>
  );
}

/* ── Icons ───────────────────────────────────────────────────────────── */

/** Bhandara tent / pandal, half-circle dome on a base, with a flag spire. */
function IconBhandara() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v3" />
      <path d="M12 3l2 1.6L12 6 10 4.6 12 3z" fill="currentColor" />
      <path d="M4 12a8 8 0 0 1 16 0" />
      <path d="M3 12h18" />
      <path d="M5 12v8" />
      <path d="M19 12v8" />
      <path d="M3 20h18" />
      <path d="M10 20v-4a2 2 0 1 1 4 0v4" />
    </svg>
  );
}

/** Neighborhood, a simple cluster of three pins forming a neighborhood. */
function IconNeighborhood() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 21s-4-4.5-4-8a4 4 0 0 1 8 0c0 3.5-4 8-4 8z" />
      <circle cx="7" cy="13" r="1.4" fill="currentColor" />
      <path d="M17 21s-3-3.5-3-6.2a3 3 0 0 1 6 0C20 17.5 17 21 17 21z" />
      <circle cx="17" cy="14.6" r="1" fill="currentColor" />
    </svg>
  );
}

/** Speech-bubble with two short message dashes, represents a chat
 *  mention (a WhatsApp community member declaring a bhandara location
 *  in text). Same stroke weight + 24×24 viewBox as the other tile
 *  icons so the row reads as one set. The bubble's small tail anchors
 *  it as "speech / chat" vs the rounder map-pin glyph used for
 *  bhandara cards elsewhere. */
function IconChat() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* bubble body */}
      <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8.5l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
      {/* two message dashes inside the bubble */}
      <path d="M7.5 9h9" />
      <path d="M7.5 12.5h6" />
    </svg>
  );
}

/** Camera with a small heart-spark inside, represents a passer-by
 *  spotting a bhandara and snapping a photo. Same stroke weight as the
 *  other tile icons so the row reads as a set. */
function IconCamera() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7h3l2-2h8l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="4" />
      {/* tiny shutter glint dot */}
      <circle cx="17.5" cy="9" r="0.6" fill="currentColor" />
    </svg>
  );
}

/** People-group glyph for the community-members tile. Three silhouettes
 *  (a foreground head + shoulders + two background heads peeking) to
 *  signal "many people", inheriting the same stroke + fill language
 *  as the other tile icons so the row reads as one set. */
function IconCommunity() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* back-left head */}
      <circle cx="6.5" cy="9" r="1.8" />
      <path d="M2.5 16c0-1.7 1.5-3 4-3" />
      {/* back-right head */}
      <circle cx="17.5" cy="9" r="1.8" />
      <path d="M21.5 16c0-1.7-1.5-3-4-3" />
      {/* foreground head */}
      <circle cx="12" cy="8" r="2.4" fill="currentColor" fillOpacity="0.15" />
      <circle cx="12" cy="8" r="2.4" />
      <path d="M6.5 20c0-2.8 2.5-5 5.5-5s5.5 2.2 5.5 5" />
    </svg>
  );
}

/** Mangal calendar, a calendar block with a star/diya glyph in the middle. */
function IconMangal() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9h17" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      {/* small diya inside */}
      <path d="M9 16c0-1.5 1.3-2.5 3-2.5s3 1 3 2.5c0 1-1 1.7-3 1.7s-3-.7-3-1.7z"
        fill="currentColor" fillOpacity="0.18" />
      <path d="M9 16c0-1.5 1.3-2.5 3-2.5s3 1 3 2.5" />
      <path d="M12 12c.7.7 1 1.3 1 1.9a1 1 0 1 1-2 0c0-.6.3-1.2 1-1.9z" fill="currentColor" />
    </svg>
  );
}
