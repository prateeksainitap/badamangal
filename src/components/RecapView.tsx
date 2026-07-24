"use client";

import Link from "next/link";
import { useLocaleFromContext } from "@/lib/locale-context";
import { RECAP } from "@/content/recap";
import type { SiteStats } from "@/lib/stats";
import ScrollNumber from "@/components/ScrollNumber";
import SeasonTimeline from "@/components/SeasonTimeline";
import {
  JaliCorner,
  SunburstSpark,
  MarigoldDivider,
} from "@/components/ornaments";

type Props = {
  stats: SiteStats;
};

function fmt(n: number): string {
  return n.toLocaleString("en-IN");
}

export default function RecapView({ stats }: Props) {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const r = RECAP;
  const headFont = isHi ? "font-tiro" : "font-fraunces";

  return (
    <main className="overflow-hidden">
      <HeroBand isHi={isHi} />
      <HeadlineNumbers isHi={isHi} stats={stats} headFont={headFont} />
      <GrowthBand isHi={isHi} headFont={headFont} />
      <PressBand isHi={isHi} headFont={headFont} />
      <SocialBand isHi={isHi} headFont={headFont} />
      <GeographyBand isHi={isHi} headFont={headFont} />

      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-20">
        <p className="text-center font-mukta uppercase tracking-[0.32em] text-saffron-600 text-xs font-semibold">
          {isHi ? "आठ मंगलवार" : "The eight Tuesdays"}
        </p>
        <div className="mt-6">
          <SeasonTimeline />
        </div>
      </section>

      <ClosingBand isHi={isHi} headFont={headFont} />
    </main>
  );
}

/* ── 1. Hero ─────────────────────────────────────────────────────────── */

function HeroBand({ isHi }: { isHi: boolean }) {
  const r = RECAP.hero;
  return (
    <section className="textured-ink relative overflow-hidden pt-24 pb-28 sm:pt-32 sm:pb-36 text-cream-50">
      {/* Sunburst mark, the section's decorative anchor. Warmth/glow
          now comes from .textured-ink's own layered gradient + grain,
          this is just the icon on top of it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 opacity-30"
      >
        <SunburstSpark className="h-[260px] w-[260px] text-saffron-500" />
      </div>
      {/* Bottom fade into the cream body. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-cream-50"
      />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-white/10 px-4 py-1.5 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-saffron-500" />
          <span className="font-mukta text-[0.65rem] font-bold uppercase tracking-[0.3em] text-gold-500">
            {isHi ? r.kicker.hi : r.kicker.en}
          </span>
        </span>

        <h1
          className={`mt-6 ${
            isHi ? "font-tiro" : "font-fraunces font-bold"
          } text-4xl sm:text-6xl md:text-7xl leading-[1.05] [text-wrap:balance]`}
        >
          {isHi ? r.headline.hi : r.headline.en}
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-cream-50/80 leading-relaxed">
          {isHi ? r.sub.hi : r.sub.en}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <span className="rounded-full border border-gold-500/40 bg-white/5 px-4 py-2 font-mukta text-xs font-semibold uppercase tracking-[0.2em] text-cream-50/90">
            {isHi ? r.dateRange.hi : r.dateRange.en}
          </span>
          <span className="rounded-full bg-saffron-600 px-4 py-2 font-mukta text-xs font-semibold uppercase tracking-[0.2em] text-cream-50 shadow-warm">
            {isHi ? r.badge.hi : r.badge.en}
          </span>
        </div>
      </div>
    </section>
  );
}

/* ── 2. Headline numbers (live) ─────────────────────────────────────── */

function HeadlineNumbers({
  isHi,
  stats,
  headFont,
}: {
  isHi: boolean;
  stats: SiteStats;
  headFont: string;
}) {
  const r = RECAP.headline;
  const tiles: { value: number; label: Bilingual }[] = [
    { value: stats.bhandarasTotal, label: { hi: "कुल भंडारे दर्ज", en: "Total bhandaras tracked" } },
    { value: stats.bhandarasListed, label: { hi: "सूचीबद्ध भंडारे", en: "Bhandaras listed" } },
    { value: stats.bhandarasSpotted, label: { hi: "स्पॉट किए गए", en: "Bhandaras spotted" } },
    { value: stats.communityMembers, label: { hi: "WhatsApp समुदाय", en: "WhatsApp community" } },
    { value: stats.visitorNumber, label: { hi: "कुल विज़िटर", en: "Total site visitors" } },
    { value: stats.areasCovered, label: { hi: "मोहल्ले शामिल", en: "Neighbourhoods reached" } },
  ];

  return (
    <section className="relative mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20 -mt-1">
      <SectionHeader
        isHi={isHi}
        headFont={headFont}
        kicker={r.kicker}
        heading={r.heading}
        body={r.body}
      />

      <ol className="mt-10 grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5">
        {tiles.map((tile, i) => (
          <li
            key={i}
            className="group relative overflow-hidden rounded-3xl border border-gold-500/40 bg-cream-50 px-5 py-7 sm:px-6 sm:py-9 text-center shadow-warm transition-transform duration-300 hover:-translate-y-1"
          >
            <JaliCorner position="tl" className="absolute top-2 left-2 w-6 h-6 text-gold-500/50" />
            <JaliCorner position="tr" className="absolute top-2 right-2 w-6 h-6 text-gold-500/50" />
            <JaliCorner position="bl" className="absolute bottom-2 left-2 w-6 h-6 text-gold-500/50" />
            <JaliCorner position="br" className="absolute bottom-2 right-2 w-6 h-6 text-gold-500/50" />
            <ScrollNumber
              value={tile.value}
              className="font-numerals font-extrabold text-sindoor-700 text-3xl sm:text-5xl leading-none tabular-nums"
            />
            <p className="mt-3 font-mukta text-[0.65rem] sm:text-xs font-semibold uppercase tracking-[0.16em] text-ink-600">
              {isHi ? tile.label.hi : tile.label.en}
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-center text-xs text-ink-600/70">
        {isHi
          ? "यह सीज़न का लाइव, डेटाबेस-सत्यापित योग है।"
          : "This season's live, database-verified total."}
      </p>
    </section>
  );
}

/* ── 3. Growth / digital reach ──────────────────────────────────────── */

function GrowthBand({ isHi, headFont }: { isHi: boolean; headFont: string }) {
  const r = RECAP.growth;
  const maxUsers = Math.max(r.mayUsers, r.juneUsers);

  const smallTiles: { value: string; label: Bilingual }[] = [
    { value: fmt(r.totalUsers), label: { hi: "कुल यूज़र (मई-जून)", en: "Total users (May-Jun)" } },
    { value: fmt(r.totalPageViews), label: { hi: "कुल पेज व्यूज़", en: "Total page views" } },
    { value: fmt(r.mapViews), label: { hi: "नक़्शा देखा गया", en: "Live map views" } },
    { value: fmt(r.searchClicks), label: { hi: "गूगल सर्च क्लिक्स", en: "Google search clicks" } },
    { value: fmt(r.searchImpressions), label: { hi: "सर्च इंप्रेशन्स", en: "Search impressions" } },
    { value: `${r.searchCtr}%`, label: { hi: "सर्च CTR", en: "Search CTR" } },
  ];

  return (
    <section className="relative bg-gradient-to-b from-saffron-50/70 via-cream-50 to-cream-50 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          isHi={isHi}
          headFont={headFont}
          kicker={r.kicker}
          heading={r.heading}
          body={r.body}
        />
        <p className="mt-1 text-center text-[0.7rem] uppercase tracking-[0.2em] text-ink-600/60">
          {isHi ? r.asOf.hi : r.asOf.en}
        </p>

        {/* May -> June growth bars */}
        <div className="mt-10 mx-auto max-w-xl">
          <div className="flex items-end justify-between gap-6 h-48">
            <GrowthBar
              value={r.mayUsers}
              max={maxUsers}
              label={isHi ? "मई" : "May"}
              tone="muted"
            />
            <GrowthBar
              value={r.juneUsers}
              max={maxUsers}
              label={isHi ? "जून" : "June"}
              tone="hot"
            />
          </div>
          <p className="mt-6 text-center">
            <span className="font-numerals font-extrabold text-sindoor-700 text-2xl sm:text-3xl">
              +{r.momPercent}%
            </span>{" "}
            <span className="text-sm text-ink-600">
              {isHi ? r.momLabel.hi : r.momLabel.en}
            </span>
          </p>
        </div>

        <ol className="mt-12 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 max-w-4xl mx-auto">
          {smallTiles.map((tile, i) => (
            <li
              key={i}
              className="rounded-2xl border border-saffron-500/30 bg-white/70 px-4 py-4 text-center"
            >
              <p className="font-numerals font-bold text-sindoor-700 text-xl sm:text-2xl tabular-nums">
                {tile.value}
              </p>
              <p className="mt-1 text-[0.65rem] font-mukta uppercase tracking-[0.14em] text-ink-600">
                {isHi ? tile.label.hi : tile.label.en}
              </p>
            </li>
          ))}
        </ol>

        <p className="mt-8 text-center text-sm text-ink-600 max-w-lg mx-auto">
          {isHi ? r.brandNote.hi : r.brandNote.en}
        </p>
      </div>
    </section>
  );
}

function GrowthBar({
  value,
  max,
  label,
  tone,
}: {
  value: number;
  max: number;
  label: string;
  tone: "muted" | "hot";
}) {
  const pct = Math.max(6, Math.round((value / max) * 100));
  return (
    <div className="flex flex-1 flex-col items-center justify-end h-full">
      <span className="mb-2 font-numerals font-bold text-ink-900 text-sm sm:text-base tabular-nums">
        {fmt(value)}
      </span>
      <div className="w-full max-w-[92px] flex items-end h-full">
        <div
          className={`w-full rounded-t-2xl ${
            tone === "hot"
              ? "bg-gradient-to-t from-sindoor-700 to-saffron-500"
              : "bg-gold-500/45"
          }`}
          style={{ height: `${pct}%` }}
        />
      </div>
      <span className="mt-2 font-mukta text-xs font-semibold uppercase tracking-[0.2em] text-ink-600">
        {label}
      </span>
    </div>
  );
}

/* ── 4. Press ────────────────────────────────────────────────────────── */

function PressBand({ isHi, headFont }: { isHi: boolean; headFont: string }) {
  const r = RECAP.press;
  return (
    <section className="textured-ink relative overflow-hidden py-16 sm:py-20 text-cream-50">
      <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          isHi={isHi}
          headFont={headFont}
          kicker={r.kicker}
          heading={r.heading}
          body={r.body}
          dark
        />

        <ul className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-5">
          {r.items.map((item) => (
            <li key={item.name}>
              <div className="flex h-full flex-col items-center gap-4 rounded-3xl border border-gold-500/30 bg-white/95 px-6 py-8 shadow-warm">
                <div className="flex h-16 w-full items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.logo}
                    alt={`${item.name} logo`}
                    loading="lazy"
                    decoding="async"
                    className="max-h-16 w-auto max-w-[80%] rounded-lg object-contain"
                  />
                </div>
                <p className="font-mukta text-[0.62rem] font-bold uppercase tracking-[0.2em] text-ink-900/80">
                  {item.name} <span className="text-gold-500">·</span>{" "}
                  <span className="text-saffron-600">{item.freq}</span>
                </p>
                <p className={`${headFont} text-sm text-sindoor-700`}>
                  {isHi ? item.host.hi : item.host.en}
                </p>
                <p className="text-[0.65rem] uppercase tracking-[0.14em] text-ink-600/70">
                  {isHi ? item.dateLabel.hi : item.dateLabel.en}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── 5. Social ───────────────────────────────────────────────────────── */

function SocialBand({ isHi, headFont }: { isHi: boolean; headFont: string }) {
  const r = RECAP.social;
  return (
    <section className="relative bg-cream-50 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeader
          isHi={isHi}
          headFont={headFont}
          kicker={r.kicker}
          heading={r.heading}
          body={r.body}
        />

        <div className="mt-10 text-center">
          <p className={`${headFont} text-6xl sm:text-8xl font-extrabold text-sindoor-700 leading-none`}>
            {r.igTotalViews}
          </p>
          <p className="mt-2 font-mukta text-xs font-semibold uppercase tracking-[0.24em] text-ink-600">
            {isHi ? "इंस्टाग्राम रील व्यूज़" : "Instagram reel views"}
          </p>
          <p className="mt-1 text-sm text-ink-600">
            {isHi
              ? `${fmt(r.igReached)}+ अकाउंट्स तक पहुँच, सिर्फ़ ${r.igFollowersAtStart} फ़ॉलोअर्स से शुरू होकर`
              : `${fmt(r.igReached)}+ accounts reached, starting from just ${r.igFollowersAtStart} followers`}
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
          {r.topReels.map((reel, i) => (
            <div
              key={i}
              className="rounded-3xl border border-gold-500/40 bg-white px-6 py-6 text-center shadow-warm"
            >
              <p className="font-numerals font-extrabold text-saffron-600 text-3xl sm:text-4xl tabular-nums">
                {fmt(reel.views)}
              </p>
              <p className="mt-1 text-[0.65rem] font-mukta uppercase tracking-[0.16em] text-ink-600">
                {isHi ? `रील #${i + 1} व्यूज़` : `Reel #${i + 1} views`}
              </p>
              <p className="mt-2 text-xs text-ink-600/80">
                {isHi
                  ? `${fmt(reel.reached)} तक पहुँच`
                  : `${fmt(reel.reached)} accounts reached`}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-saffron-50 px-4 py-2 text-sm text-ink-900">
            <RedditGlyph />
            <span className="font-numerals font-bold text-saffron-600">{r.redditViews}</span>
            <span>{isHi ? r.redditNote.hi : r.redditNote.en}</span>
          </span>
        </div>
      </div>
    </section>
  );
}

function RedditGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="text-[#FF4500]">
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

/* ── 6. Geography ────────────────────────────────────────────────────── */

function GeographyBand({ isHi, headFont }: { isHi: boolean; headFont: string }) {
  const r = RECAP.geography;
  const max = Math.max(...r.cities.map((c) => c.visits));
  return (
    <section className="relative bg-gradient-to-b from-cream-50 via-saffron-50/50 to-cream-50 py-16 sm:py-20">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <SectionHeader
          isHi={isHi}
          headFont={headFont}
          kicker={r.kicker}
          heading={r.heading}
          body={r.body}
        />

        <ol className="mt-10 space-y-2.5">
          {r.cities.map((city) => (
            <li key={city.name} className="flex items-center gap-3">
              <span className="w-24 sm:w-28 shrink-0 text-sm font-medium text-ink-900">
                {city.name}
              </span>
              <span className="relative flex-1 h-6 rounded-full bg-saffron-50 overflow-hidden border border-gold-500/25">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-saffron-500 to-sindoor-700"
                  style={{ width: `${Math.max(6, (city.visits / max) * 100)}%` }}
                />
              </span>
              <span className="w-12 shrink-0 text-right font-numerals text-sm font-bold text-sindoor-700 tabular-nums">
                {city.visits}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── 7. Closing ──────────────────────────────────────────────────────── */

function ClosingBand({ isHi, headFont }: { isHi: boolean; headFont: string }) {
  const r = RECAP.closing;
  return (
    <section className="textured-ink relative overflow-hidden py-20 sm:py-28 text-cream-50 text-center">
      <div className="relative mx-auto max-w-2xl px-4 sm:px-6">
        <MarigoldDivider className="mx-auto w-40 text-gold-500/70" />
        <p className="mt-6 font-mukta text-xs font-semibold uppercase tracking-[0.3em] text-gold-500">
          {isHi ? r.kicker.hi : r.kicker.en}
        </p>
        <h2 className={`mt-4 ${headFont} text-2xl sm:text-4xl leading-snug [text-wrap:balance]`}>
          {isHi ? r.heading.hi : r.heading.en}
        </h2>
        <p className="mt-4 text-cream-50/80 leading-relaxed">
          {isHi ? r.body.hi : r.body.en}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`/${isHi ? "" : "?lang=en"}#map`}
            className="btn btn-sindoor btn-lg"
          >
            {isHi ? r.ctaMap.hi : r.ctaMap.en}
          </Link>
        </div>

        <p className="mt-10 font-tiro text-lg text-gold-500/90">{r.benediction}</p>
      </div>
    </section>
  );
}

/* ── Shared ──────────────────────────────────────────────────────────── */

type Bilingual = { hi: string; en: string };

function SectionHeader({
  isHi,
  headFont,
  kicker,
  heading,
  body,
  dark,
}: {
  isHi: boolean;
  headFont: string;
  kicker: Bilingual;
  heading: Bilingual;
  body: Bilingual;
  dark?: boolean;
}) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <p
        className={`font-mukta uppercase tracking-[0.32em] text-xs font-semibold ${
          dark ? "text-gold-500" : "text-saffron-600"
        }`}
      >
        {isHi ? kicker.hi : kicker.en}
      </p>
      <h2
        className={`mt-2 ${headFont} text-2xl sm:text-3xl font-semibold ${
          dark ? "text-cream-50" : "text-sindoor-700"
        }`}
      >
        {isHi ? heading.hi : heading.en}
      </h2>
      <p className={`mt-2 text-sm sm:text-base ${dark ? "text-cream-50/75" : "text-ink-600"}`}>
        {isHi ? body.hi : body.en}
      </p>
    </div>
  );
}
