"use client";

import Link from "next/link";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * Full-bleed strip directly under the sticky Header, the very first
 * thing a visitor reads once the season has fully ended (every 2026
 * date has passed, see page.tsx's `isPastSeason`). Sits above the
 * hero on purpose, "the season is over" is the frame for the WHOLE
 * homepage now (hero, map, cards all quietly fall back to past-tense
 * copy), not just a note attached to the map section, so it reads
 * first, not several scrolls in.
 *
 * Only one CTA: the season recap. An earlier version also linked
 * /history ("Read the full story"), dropped per operator request,
 * a slim top strip is not the place for two competing links.
 */
export default function SeasonCompleteBanner() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";

  return (
    <div className="textured-ink relative border-b border-gold-500/25">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 sm:py-3.5 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
        <span className="inline-flex items-center gap-2 shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-saffron-500" />
          <span className="font-mukta uppercase tracking-[0.24em] text-gold-500 text-[0.62rem] font-bold">
            {isHi ? "सत्र पूरा हुआ" : "Season complete"}
          </span>
        </span>
        <p className="text-cream-50/85 text-sm sm:flex-1">
          {isHi
            ? "बड़ा मंगल 2026 अब समाप्त हो चुका है। यहाँ है इस सीज़न की पूरी कहानी।"
            : "Bada Mangal 2026 has ended. Here's the whole season, in one place."}
        </p>
        <Link
          href={`/recap${isHi ? "" : "?lang=en"}`}
          data-ga="cta_season_banner_recap"
          className="inline-flex items-center gap-1.5 shrink-0 font-mukta text-xs font-semibold uppercase tracking-[0.16em] text-saffron-500 hover:text-saffron-400 transition-colors"
        >
          {isHi ? "सीज़न रिकैप देखें" : "See the season recap"}
          <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
