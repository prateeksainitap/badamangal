"use client";

import Link from "next/link";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * Homepage volunteer-programme block.
 *
 * Rebuilt 2026-05-25 from a quiet horizontal strip into a real
 * prominent CTA card, ahead of the Adhik Mas season's first Bada
 * Mangal Tuesday. Two reasons for the upgrade:
 *
 *   1. The earlier "small honorarium per documented bhandara" copy
 *      is dropped. There is no money. The programme is pure seva.
 *      Anyone who wants to contribute (delivery riders, cab drivers,
 *      students, anyone) joins the volunteer WhatsApp group for the
 *      full 8-Tuesday season and helps document bhandaras in their
 *      area. Stripping the money angle makes the offer cleaner — no
 *      one asks "but how much?" when the answer is "we asked for
 *      your seva, not your wallet".
 *
 *   2. The strip version under-recruited. A clearer, larger card
 *      with personas + a filled saffron CTA reads as "this is a
 *      real way you can help", not "footer fine print".
 */
export default function VolunteerPromo() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";

  const personas = isHi
    ? ["डिलीवरी राइडर", "कैब ड्राइवर", "छात्र", "आप भी"]
    : ["Delivery riders", "Cab drivers", "Students", "Anyone, really"];

  return (
    <section
      aria-labelledby="volunteer-promo-heading"
      className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-14"
    >
      <div className="relative overflow-hidden rounded-3xl border-2 border-saffron-500/55 bg-cream-50 shadow-[0_24px_70px_-30px_rgba(156,42,42,0.35)]">
        {/* Warm saffron wash so the block reads as the page's primary
            community CTA, distinct from the quiet editorial body
            sections that surround it. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-0"
          style={{
            background:
              "radial-gradient(800px 460px at 92% 8%, rgba(242,148,76,0.18), transparent 65%), radial-gradient(800px 460px at 8% 92%, rgba(214,73,73,0.10), transparent 65%)",
          }}
        />

        <div className="relative p-6 sm:p-10">
          {/* Single-column layout — the 🙏 icon used to sit in its
              own left column (`md:grid-cols-[auto,1fr]`) which
              made the heading start way to the right; now it flows
              inline at the end of the H2, which reads as a
              devotional flourish rather than a sidebar logo. */}
          <div>
            <div className="min-w-0">
              {/* Eyebrow makes the "no money" angle a positive — sets
                  expectations before someone clicks through. */}
              <p
                className={`text-[11px] sm:text-xs uppercase tracking-[0.18em] text-saffron-600 font-mono font-semibold ${
                  isHi ? "tracking-[0.14em]" : ""
                }`}
              >
                {isHi
                  ? "केवल सेवा · कोई शुल्क नहीं"
                  : "Pure seva · No fee, no payment"}
              </p>

              <h2
                id="volunteer-promo-heading"
                className={`mt-2 text-2xl sm:text-3xl lg:text-4xl text-sindoor-700 leading-tight ${
                  isHi ? "font-tiro" : "font-fraunces font-semibold"
                }`}
              >
                {isHi
                  ? "इस सीज़न के स्वयंसेवक बनें"
                  : "Be a season volunteer"}
                {/* Inline devotional flourish, right after the
                    heading text. Smaller than the old standalone
                    icon block (no border, no card) so it reads
                    as decoration, not a separate UI element. */}
                <span
                  aria-hidden
                  className="ml-2 sm:ml-3 inline-block align-baseline text-2xl sm:text-3xl"
                >
                  🙏
                </span>
              </h2>

              <p className="mt-3 text-sm sm:text-base text-ink-600 leading-relaxed max-w-prose">
                {isHi
                  ? "डिलीवरी राइडर, कैब ड्राइवर, छात्र, या कोई भी जो योगदान देना चाहता है। अपने इलाके के भंडारों की जानकारी, फोटो और स्थान दर्ज करने में मदद करें। पूरे आठ मंगलवार के सीज़न के लिए हमारे WhatsApp समूह में जुड़ें।"
                  : "Delivery riders, cab drivers, students, anyone who wants to contribute. Help log bhandaras in your area with photos, time, and location. You get added to our volunteer WhatsApp group for the full 8-Tuesday season."}
              </p>

              {/* Persona chips — make the "anyone can do this" idea
                  feel concrete rather than vague. */}
              <ul className="mt-5 flex flex-wrap gap-2">
                {personas.map((p) => (
                  <li
                    key={p}
                    className="inline-flex items-center text-xs sm:text-sm font-medium text-sindoor-700 bg-saffron-50 border border-saffron-500/40 rounded-full px-3 py-1"
                  >
                    {p}
                  </li>
                ))}
              </ul>

              {/* Filled saffron CTA — primary action of the block.
                  Stronger contrast than the prior outline button so
                  it reads as "click me" from across the page. */}
              <div className="mt-6 sm:mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href="/volunteer#signup"
                  data-ga="volunteer_strip_learn"
                  data-ga-source="strip"
                  className="inline-flex items-center gap-2 rounded-full bg-saffron-500 hover:bg-saffron-600 text-cream-50 font-semibold px-6 py-3 text-sm sm:text-base transition-colors shadow-[0_10px_24px_-12px_rgba(242,148,76,0.7)]"
                >
                  {isHi ? "सेवा में जुड़ें" : "Join the seva"}
                  <span aria-hidden>→</span>
                </Link>
                <span className="text-xs text-ink-600/75 font-mono uppercase tracking-[0.12em]">
                  {isHi
                    ? "30 सेकंड का फॉर्म"
                    : "30-second signup"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

