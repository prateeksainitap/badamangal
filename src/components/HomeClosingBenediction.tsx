"use client";

import MaharajjiBlessing from "@/components/MaharajjiBlessing";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * Closing benediction block, the last editorial moment on the
 * homepage. Extracted into a client component so the bilingual
 * blessing body ("May Hanuman Ji bless..." / "बजरंगबली की कृपा...")
 * swaps on the Hindi toggle without waiting for a server-tree
 * refresh.
 *
 * The Devanagari slogan "॥ जय श्री राम · जय हनुमान ॥" and its
 * English transliteration are always shown side-by-side, they're
 * brand marks, not translations, so neither locale hides the other.
 */
export default function HomeClosingBenediction() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";

  return (
    <section
      aria-label="Benediction"
      className="relative mx-auto max-w-3xl px-4 sm:px-6 pt-2 pb-16 sm:pb-20 text-center"
    >
      <div className="flex items-center justify-center gap-3 text-gold-500">
        <span className="block h-px w-16 sm:w-24 bg-gradient-to-r from-transparent to-gold-500/60" />
        <span aria-hidden className="text-xl">🪔</span>
        <span className="block h-px w-16 sm:w-24 bg-gradient-to-l from-transparent to-gold-500/60" />
      </div>
      <p className="mt-5 font-tiro text-2xl sm:text-4xl text-sindoor-700 leading-tight">
        ॥ जय श्री राम · जय हनुमान ॥
      </p>
      {/* English transliteration of the slogan above. Promoted from
          a muted italic caption to a bold sindoor headline so it
          matches the editorial "section heading" family used across
          the page, feels like a benediction, not a footnote. */}
      <p className="mt-3 font-fraunces font-bold text-3xl sm:text-4xl text-sindoor-700">
        Jai Shri Ram &middot; Jai Hanuman
      </p>
      <p className="mt-4 max-w-xl mx-auto text-sm text-ink-600 leading-relaxed">
        {isHi
          ? "बजरंगबली की कृपा से हर थाली शुभ हो, हर हाथ सेवा में लगे।"
          : "May Hanuman Ji bless every plate served and every hand that serves."}
      </p>

      {/* Maharajji medallion. Hover the portrait to wake the gold
          spirals and hear the Maharajji-Ram-Ram aarti chant. */}
      <MaharajjiBlessing />
    </section>
  );
}
