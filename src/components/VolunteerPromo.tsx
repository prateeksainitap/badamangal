"use client";

import Link from "next/link";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * Homepage volunteer-programme nudge.
 *
 * Quiet horizontal strip rather than a banner — sits near the bottom
 * of the homepage (just before the closing benediction), deliberately
 * de-emphasised so:
 *   1. It doesn't compete with the primary OrganisePromo banner up top
 *      (which is the bigger commercial driver for the team).
 *   2. The "earn ₹50" angle stays a footnote, not a billboard. Leading
 *      with money felt cheap given the devotional context.
 *
 * One primary CTA → /volunteer (the marketing page). The signup +
 * earnings angle is mentioned in body copy as a small subordinate
 * line, not the headline.
 */
export default function VolunteerPromo() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";

  return (
    <section
      aria-labelledby="volunteer-promo-heading"
      className="mx-auto max-w-4xl px-4 sm:px-6 py-6"
    >
      <div className="rounded-2xl border border-gold-500/35 bg-cream-50/70 px-5 py-4 sm:px-6 sm:py-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          {/* Subtle icon block — small saffron disc, just enough to anchor
              the row visually without screaming "banner". */}
          <span
            aria-hidden
            className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full bg-saffron-50 border border-saffron-500/30 text-lg"
          >
            🙏
          </span>

          <div className="flex-1 min-w-0">
            <h2
              id="volunteer-promo-heading"
              className={`text-base sm:text-lg text-sindoor-700 leading-snug ${
                isHi ? "font-tiro" : "font-fraunces font-semibold"
              }`}
            >
              {isHi
                ? "स्वयंसेवक कार्यक्रम में जुड़ें"
                : "Join the volunteer programme"}
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm text-ink-600 leading-relaxed">
              {isHi
                ? "हर बड़े मंगल पर अपने area के भण्डारों की जानकारी जुटाने में मदद करें। छोटी सी सेवा-राशि भी मिलती है।"
                : "Help document bhandaras in your area on Tuesdays + Saturdays. A small honorarium per documented bhandara."}
            </p>
          </div>

          <Link
            href="/volunteer"
            data-ga="volunteer_strip_learn"
            data-ga-source="strip"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-gold-500/55 text-sindoor-700 hover:bg-gold-500/10 font-medium px-4 py-2 text-sm transition-colors self-start sm:self-auto"
          >
            {isHi ? "और जानें" : "Learn more"}
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
