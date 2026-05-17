"use client";

import Link from "next/link";
import { strings } from "@/content/strings";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * "A 400-year-old tradition" history teaser, extracted out of the
 * server-rendered homepage so the heading + body + CTA swap to Hindi
 * the instant the LangToggle fires. Same pattern as HomeHero /
 * HomeResourcesTeaser.
 */
export default function HomeHistoryTeaser() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const t = strings[locale];

  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 py-12 sm:py-16">
      <div className="rounded-3xl bg-saffron-50 border border-gold-500/40 px-6 py-10 sm:px-10 sm:py-14 text-center">
        <h2
          className={`text-3xl sm:text-4xl ${
            isHi
              ? "font-tiro text-sindoor-700"
              : "font-fraunces font-bold text-sindoor-700"
          }`}
        >
          {t.history.teaserHeading}
        </h2>
        <p className="mt-3 text-ink-600 max-w-2xl mx-auto">
          {t.history.teaserBody}
        </p>
        <Link
          href={`/history${isHi ? "" : "?lang=en"}`}
          data-ga="cta_home_history_readmore"
          className="mt-6 inline-flex items-center rounded-full border-2 border-saffron-600 text-saffron-600 hover:bg-saffron-600 hover:text-cream-50 font-medium px-5 py-2 transition-colors"
        >
          {t.history.readMore} →
        </Link>
      </div>
    </section>
  );
}
