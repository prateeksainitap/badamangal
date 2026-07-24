"use client";

import Link from "next/link";
import AnimatedHeading from "@/components/AnimatedHeading";
import { strings } from "@/content/strings";
import { useLocaleFromContext } from "@/lib/locale-context";
import {
  formatEnglishDate,
  formatHindiDate,
  nextBadaMangal,
  BADA_MANGAL_DATES_2026,
} from "@/lib/dates";

/**
 * Homepage hero, extracted out of the server-rendered page so its
 * editorial text (eyebrow, tagline, body, Tuesday line, CTA labels)
 * swaps to Hindi the instant the LangToggle fires, without waiting on
 * a server-tree refresh.
 *
 * Why this exists as its own component:
 *   The page is statically rendered (revalidate: 60) for fast edge
 *   delivery. A server-side cookies() read would force per-request
 *   rendering and re-introduce the 3-4 s Function cold-start lag.
 *   Instead, the page renders English HTML at build time and this
 *   client component swaps to the visitor's preferred locale
 *   immediately on hydration based on the bm_lang cookie.
 *
 * The "next Tuesday" / "today" copy is derived live on the client
 * from BADA_MANGAL_DATES_2026 + the current IST clock, the server
 * doesn't need to pass anything in.
 */
export default function HomeHero() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const t = strings[locale];

  // Pick the Tuesday this rule under the hero refers to.
  // - If today (IST) is itself a Bada Mangal Tuesday, surface it as "Today".
  // - Else show the next upcoming one.
  // - Once the season is over (no upcoming dates), fall back to a quiet
  //   season-complete line so we never show a stale 2026 date.
  const now = new Date();
  const istTodayIso = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const todayIsBadaMangal = BADA_MANGAL_DATES_2026.find(
    (d) => d.toISOString().slice(0, 10) === istTodayIso,
  );
  const upcomingBadaMangal = todayIsBadaMangal ?? nextBadaMangal(now);
  const seasonOver = !upcomingBadaMangal;
  const tuesdayKicker = todayIsBadaMangal
    ? isHi
      ? "आज"
      : "Today"
    : isHi
      ? "अगला मंगल"
      : "Next Tuesday";
  const tuesdayLine = seasonOver
    ? isHi
      ? "इस वर्ष के सभी आठ बड़े मंगल पूर्ण। जय हनुमान।"
      : "This year's eight Bada Mangals are complete. Jai Hanuman."
    : isHi
      ? `${formatHindiDate(upcomingBadaMangal)}, सुबह से शाम तक, शहर भर के द्वार खुले रहेंगे।`
      : `${formatEnglishDate(upcomingBadaMangal)}, gates open across the city, dawn to dusk.`;

  return (
    <div className="lg:col-span-6 text-ink-900 text-center lg:text-left">
      {/* Devotional benediction, wraps cleanly on narrow screens. */}
      <div className="mb-5 flex items-center gap-2 sm:gap-3 max-w-md mx-auto lg:mx-0">
        <span className="h-px flex-1 bg-gold-500/45" />
        <p className="font-tiro text-base sm:text-xl text-sindoor-700 text-center">
          ॥ जय श्री राम · जय हनुमान ॥
        </p>
        <span className="h-px flex-1 bg-gold-500/45" />
      </div>

      {/* Eyebrow with brand mark */}
      <div className="inline-flex items-center gap-2.5 sm:gap-3 rounded-full border border-gold-500/45 bg-cream-50/70 backdrop-blur px-3 py-1.5 shadow-warm">
        <span className="block w-2 h-2 rounded-full bg-saffron-600 motion-safe:animate-pulse" />
        <span className="font-mukta font-semibold uppercase tracking-[0.22em] text-[0.65rem] sm:text-[0.8rem] text-sindoor-700">
          {isHi
            ? "बड़ा मंगल · लखनऊ · 2026"
            : "Bada Mangal · Lucknow · 2026"}
        </span>
      </div>

      <AnimatedHeading
        as="h1"
        text="जहाँ भक्ति, वहाँ भंडारा"
        lang="hi"
        className="mt-5 sm:mt-6 font-mukta font-extrabold text-[2rem] sm:text-[3rem] lg:text-[4rem] leading-[1.05] tracking-tight text-sindoor-700 [text-wrap:balance]"
      />

      <p className="mt-5 sm:mt-6 max-w-xl mx-auto lg:mx-0 text-ink-900/85 text-base sm:text-lg leading-relaxed">
        {isHi
          ? "हर मंगलवार लखनऊ एक बड़ी रसोई बन जाता है। इस दुर्लभ 8-मंगल वर्ष में, हर भंडारा एक नक़्शे पर।"
          : "Every Tuesday of Jyeshtha, Lucknow becomes one giant kitchen. In this rare 8-Tuesday year, every bhandara on one map."}
      </p>

      {/* Hero CTAs, both pinned to the same min-width so the
          primary sindoor pill and the secondary ghost pill read
          as a balanced pair. The find CTA carries a magnifier
          glyph; the add CTA is intentionally text-only (the +
          icon was dropped 2026-05-26, the pill reads cleaner
          without a duplicate "add" signal when the label
          already says it). On mobile the row stays centred and
          the buttons keep equal width via `w-[240px]` so they
          align in a single column when wrap kicks in. */}
      <div className="mt-7 sm:mt-8 flex flex-wrap gap-3 justify-center lg:justify-start">
        <Link
          href="#map"
          className="btn btn-sindoor btn-lg w-[240px] justify-center gap-2"
          data-ga="cta_hero_find_bhandara"
          data-ga-source="hero"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          {seasonOver
            ? isHi
              ? "इस सीज़न के भंडारे देखें"
              : "See this season's bhandaras"
            : t.cta.findBhandara}
        </Link>
        <Link
          href={`/list-bhandara${isHi ? "" : "?lang=en"}`}
          className="btn btn-ghost btn-lg w-[240px] justify-center"
          data-ga="cta_hero_list_bhandara"
          data-ga-source="hero"
        >
          {t.cta.listBhandara}
        </Link>
      </div>

      {/* Marigold rule under the CTAs */}
      <div className="mt-8 flex items-center gap-3 max-w-md mx-auto lg:mx-0">
        <span className="h-px flex-1 bg-gold-500/40" />
        <span className="text-[0.62rem] sm:text-[0.65rem] uppercase tracking-[0.28em] sm:tracking-[0.32em] text-gold-500 font-medium">
          {tuesdayKicker}
        </span>
        <span className="h-px flex-1 bg-gold-500/40" />
      </div>
      <p className="mt-3 text-sm text-ink-600 max-w-md mx-auto lg:mx-0">
        {tuesdayLine}
      </p>
    </div>
  );
}
