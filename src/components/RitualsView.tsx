"use client";

import Link from "next/link";
import { strings } from "@/content/strings";
import { RITUALS } from "@/content/rituals";
import { GadaBullet, MarigoldDivider, SunburstSpark } from "@/components/ornaments";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * /resources/rituals body, extracted out of the server-rendered page
 * so the kicker, heading, intro, every section title/body, and outro
 * CTA labels swap on the Hindi toggle without a server-tree refresh.
 */
export default function RitualsView() {
  const locale = useLocaleFromContext();
  const t = strings[locale];
  const isHi = locale === "hi";
  const langSuffix = locale === "en" ? "?lang=en" : "";

  return (
    <article className="pb-24">
      {/* HEADER */}
      <header className="mx-auto max-w-3xl px-4 sm:px-6 pt-12 sm:pt-16 pb-10 text-center">
        <Link
          href={`/resources${langSuffix}`}
          className="inline-block text-sm text-ink-600 hover:text-saffron-600 transition-colors"
        >
          {t.resources.common.backToResources}
        </Link>
        <p className="mt-4 font-mukta uppercase tracking-[0.32em] text-gold-500 text-xs">
          {t.resources.rituals.kicker}
        </p>
        <h1
          className={`mt-3 ${
            isHi ? "font-deva text-sindoor-700" : "font-fraunces text-sindoor-700"
          } font-medium text-[2rem] sm:text-[2.6rem] leading-[1.2]`}
        >
          {t.resources.rituals.heading}
        </h1>
        <p className="mt-5 max-w-2xl mx-auto font-fraunces italic text-lg sm:text-xl text-ink-900 leading-relaxed">
          {t.resources.rituals.intro}
        </p>
        <div className="mt-7 flex justify-center">
          <SunburstSpark size={44} className="text-gold-500" />
        </div>
      </header>

      {/* SECTIONS */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 space-y-10">
        {RITUALS.map((section, idx) => (
          <section key={idx}>
            <h2
              className={`font-fraunces font-semibold text-2xl sm:text-[1.7rem] leading-tight text-sindoor-700`}
            >
              {isHi ? section.heading.hi : section.heading.en}
            </h2>
            <ul className="mt-4 space-y-3">
              {(isHi ? section.body.hi : section.body.en).map((line, i) => (
                <li key={i} className="flex items-start gap-3">
                  <GadaBullet
                    className="text-gold-500 mt-1.5 shrink-0"
                    size={16}
                  />
                  <p className="font-fraunces text-[1.05rem] leading-[1.7] text-ink-900">
                    {line}
                  </p>
                </li>
              ))}
            </ul>
            {idx < RITUALS.length - 1 ? (
              <div className="flex justify-center mt-10">
                <MarigoldDivider size={220} className="text-gold-500" />
              </div>
            ) : null}
          </section>
        ))}
      </div>

      {/* OUTRO CTAs */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-14 grid gap-3 sm:grid-cols-2">
        <Link
          href={`/${langSuffix}#map`}
          className="rounded-2xl border border-gold-500/40 bg-white shadow-warm px-6 py-5 hover:border-saffron-500 transition-colors block"
        >
          <p className="font-fraunces text-lg text-sindoor-700">
            {t.cta.findBhandara}
          </p>
          <p className="text-sm text-ink-600 mt-1">
            {isHi ? "नक़्शे पर भंडारा देखें →" : "See bhandaras on the map →"}
          </p>
        </Link>
        <Link
          href={`/list-bhandara${langSuffix}`}
          className="rounded-2xl border border-gold-500/40 bg-white shadow-warm px-6 py-5 hover:border-saffron-500 transition-colors block"
        >
          <p className="font-fraunces text-lg text-sindoor-700">
            {t.cta.listBhandara}
          </p>
          <p className="text-sm text-ink-600 mt-1">
            {isHi ? "अपना भंडारा सूचीबद्ध करें →" : "Register your bhandara →"}
          </p>
        </Link>
      </section>
    </article>
  );
}
