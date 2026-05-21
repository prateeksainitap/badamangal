"use client";

import Link from "next/link";
import { useState } from "react";
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
 * Implementation: React-controlled accordion via useState.
 *
 * Previously this used native <details>/<summary> with a CSS-only
 * grid-template-rows animation. Two problems with that approach:
 *   1. The UA stylesheet's `display: none` on collapsed details
 *      contents fought with our transition, so the open/close
 *      animation worked SOMETIMES (right after the open animation
 *      completed, the close animation would sometimes not run).
 *   2. Native <details> with the `name=""` attribute almost gives
 *      us exclusive accordion behaviour for free, but the close
 *      animation on the auto-closing sibling is even more
 *      unreliable than the manual close.
 *
 * Trade-off accepted: lose the no-JS progressive-enhancement story
 * for snappier, reliable open/close animations and clean exclusive
 * behaviour. The full answer text still ships in the server HTML
 * for search engines + FAQPage JSON-LD (in src/lib/seo.ts) — only
 * the toggle interaction needs JS. Accessibility wired up via
 * <button> + aria-expanded + aria-controls per WAI-ARIA
 * accordion pattern.
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
  // Exclusive accordion: only one item open at a time. Defaults to
  // the first FAQ open so visitors see at least one fully-expanded
  // answer on landing. `null` means everything collapsed.
  const [openId, setOpenId] = useState<string | null>(
    FAQ_ITEMS[0]?.id ?? null,
  );

  const accordion = (
    <ul className="grid gap-3 max-w-3xl mx-auto">
      {FAQ_ITEMS.map((item) => {
        const isOpen = openId === item.id;
        const q = isHi ? item.questionHi : item.questionEn;
        const a = isHi ? item.answerHi : item.answerEn;
        const links = item.relatedLinks ?? [];
        const headingId = `faq-q-${item.id}`;
        const bodyId = `faq-a-${item.id}`;
        return (
          <li key={item.id} id={item.id} className="scroll-mt-24">
            <div
              className={`group rounded-2xl border bg-cream-50 overflow-hidden transition-colors hover:border-saffron-500/60 ${
                isOpen ? "border-saffron-500/60" : "border-gold-500/40"
              }`}
            >
              <h3 className="m-0">
                <button
                  type="button"
                  id={headingId}
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                  aria-expanded={isOpen}
                  aria-controls={bodyId}
                  className="w-full cursor-pointer flex items-start justify-between gap-3 px-5 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-600/60 focus-visible:ring-inset"
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
                  {/* Plus / minus indicator. duration-300 matches
                      the body grid-template-rows animation below so
                      icon flip + body slide finish in sync. */}
                  <span
                    aria-hidden
                    className={`shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-saffron-50 border border-saffron-500/45 text-saffron-600 text-sm font-bold mt-0.5 transition-transform duration-300 ease-out ${
                      isOpen ? "rotate-45" : ""
                    }`}
                  >
                    +
                  </span>
                </button>
              </h3>
              {/* Body wrapper animates grid-template-rows 0fr->1fr
                  for height, inner wrapper fades + slides 4px for
                  the content feel. Both directions animate cleanly
                  because there is no display:none toggling, only
                  the grid-row size and opacity change. Reliable
                  in every modern browser. */}
              <div
                id={bodyId}
                role="region"
                aria-labelledby={headingId}
                aria-hidden={!isOpen}
                className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <div
                    className={`px-5 pb-5 pt-1 text-ink-900/85 text-sm sm:text-base leading-relaxed [text-wrap:pretty] transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none ${
                      isOpen
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 -translate-y-1"
                    }`}
                  >
                    {a}
                    {links.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                        {links.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            tabIndex={isOpen ? 0 : -1}
                            className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-saffron-600 hover:text-sindoor-700 hover:underline underline-offset-2"
                          >
                            {isHi ? link.labelHi : link.labelEn}
                            <span aria-hidden>→</span>
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
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
