"use client";

import Link from "next/link";
import { FAQ_ITEMS } from "@/content/faq";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * HomeFAQ
 *
 * Bilingual FAQ accordion. Used in two places:
 *
 *   1. Homepage section above VolunteerPromo (visible to every
 *      first-time visitor scrolling all the way down).
 *   2. Dedicated /faq page (full standalone view; same component,
 *      `variant="standalone"` removes the section chrome / kicker
 *      and adds a back-to-home link).
 *
 * Implementation uses native <details>/<summary>, no JS state, this
 * means the accordion works even if JS fails to hydrate, AND each
 * panel is independently expandable (one open doesn't close
 * another). Server-rendered HTML stays scannable for search
 * engines, complementing the FAQPage JSON-LD that already lives in
 * src/lib/seo.ts.
 *
 * The section root carries id="faq" so footer / nav links can
 * deep-link to /#faq.
 */
type Props = {
  /** "section" (default) renders with eyebrow + headline as a
   *  homepage band; "standalone" drops the chrome for use inside
   *  a dedicated /faq page that already has its own header. */
  variant?: "section" | "standalone";
};

export default function HomeFAQ({ variant = "section" }: Props) {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";

  const accordion = (
    <ul className="grid gap-3 max-w-3xl mx-auto">
      {FAQ_ITEMS.map((item, i) => {
        const q = isHi ? item.questionHi : item.questionEn;
        const a = isHi ? item.answerHi : item.answerEn;
        return (
          <li key={item.id} id={item.id} className="scroll-mt-24">
            {/* Native <details>: each panel is independently
                expandable. `open` defaults to closed for every item
                except the first one (so visitors see at least one
                fully-expanded answer at first glance). */}
            <details
              className="group rounded-2xl border border-gold-500/40 bg-cream-50 overflow-hidden transition-colors hover:border-saffron-500/60"
              {...(i === 0 ? { open: true } : {})}
            >
              <summary
                className="cursor-pointer list-none flex items-start justify-between gap-3 px-5 py-4 text-left"
              >
                <span
                  className={`flex-1 ${
                    isHi
                      ? "font-deva font-semibold text-base sm:text-lg"
                      : "font-fraunces font-semibold text-base sm:text-lg"
                  } text-sindoor-700 leading-snug`}
                >
                  {q}
                </span>
                {/* Plus / minus indicator via CSS state. group-open
                    swaps the icon without JavaScript. duration-300
                    matches the body grid-template-rows animation
                    below so the icon flip + body slide finish in
                    sync. */}
                <span
                  aria-hidden
                  className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-saffron-50 border border-saffron-500/45 text-saffron-600 text-sm font-bold mt-0.5 group-open:rotate-45 transition-transform duration-300 ease-out"
                >
                  +
                </span>
              </summary>
              {/* Subtle open/close animation, see .bm-faq-body in
                  globals.css. Outer wrapper animates grid rows
                  0fr->1fr for height; inner wrapper fades + slides
                  in 4px. Both directions animate (open AND close)
                  because grid-template-rows is interpolatable in
                  every modern browser, no JS required. */}
              <div className="bm-faq-body">
                <div className="bm-faq-body-inner">
                  <div className="px-5 pb-5 pt-1 text-ink-900/85 text-sm sm:text-base leading-relaxed [text-wrap:pretty]">
                    {a}
                  </div>
                </div>
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );

  if (variant === "standalone") {
    return <div className="px-4 sm:px-6">{accordion}</div>;
  }

  return (
    <section
      id="faq"
      aria-labelledby="homepage-faq-heading"
      className="relative mx-auto max-w-5xl px-4 sm:px-6 py-12 sm:py-16 scroll-mt-20"
    >
      <header className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
        <p className="font-mukta uppercase tracking-[0.32em] text-saffron-600 text-xs font-semibold inline-flex items-center gap-2 justify-center">
          <span
            aria-hidden
            className="block w-1.5 h-1.5 rounded-full bg-saffron-600"
          />
          {isHi ? "पूछे जाने वाले प्रश्न" : "Frequently asked"}
        </p>
        <h2
          id="homepage-faq-heading"
          className={`mt-3 text-3xl sm:text-4xl ${
            isHi
              ? "font-tiro text-sindoor-700"
              : "font-fraunces font-bold text-sindoor-700"
          }`}
        >
          {isHi
            ? "बड़े मंगल के बारे में आम सवाल"
            : "Common questions about Bada Mangal"}
        </h2>
        <p className="mt-2 text-sm text-ink-600 leading-relaxed">
          {isHi
            ? "परंपरा, तिथियाँ, भंडारे, और साइट के बारे में सब कुछ।"
            : "The tradition, the dates, the bhandaras, and the site, all in one place."}
        </p>
      </header>

      {accordion}

      <div className="mt-8 text-center">
        <Link
          href={locale === "en" ? "/faq?lang=en" : "/faq"}
          className="inline-flex items-center gap-1.5 text-sm text-saffron-600 hover:underline font-semibold"
        >
          {isHi ? "सभी FAQ देखें" : "View all FAQs"}
          <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}
