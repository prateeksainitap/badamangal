"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useLocaleFromContext } from "@/lib/locale-context";

type Bi<T> = { en: T; hi: T };

type Props = {
  /** Saffron eyebrow text above the title. */
  kicker: Bi<string>;
  /** Large sindoor headline. */
  title: Bi<string>;
  /** One-sentence intro that sits under the title. */
  intro: Bi<string>;
  /** Date string. Format-agnostic, passed through unchanged because
   *  the same "10 May 2026" reads cleanly in both locales. */
  lastUpdated: string;
  /** English-language prose body. */
  en: ReactNode;
  /** Hindi-language prose body. Renders when the LocaleProvider
   *  context says `hi`. Keeping both bodies inline (instead of trying
   *  to translate per-paragraph at runtime) means the bilingual swap
   *  stays accurate and lawyers can audit both versions independently. */
  hi: ReactNode;
};

/**
 * Shared layout for /terms, /privacy, /disclaimers.
 *
 * Used to be a server component with a single English children prop;
 * that meant the Hindi toggle never swapped any of the legal text.
 * Now this is a client component that reads locale from the
 * LocaleProvider context and renders the matching variant.
 *
 * Trade-off: per-page bundle is slightly larger (both English and
 * Hindi bodies ship in HTML). For static legal pages this is fine,
 * each page is well under 30 KB even with both languages inline,
 * and we keep edge-cached static rendering with instant locale swap.
 */
export default function LegalPage({
  kicker,
  title,
  intro,
  lastUpdated,
  en,
  hi,
}: Props) {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";

  return (
    <article className="pb-24">
      <header className="mx-auto max-w-3xl px-4 sm:px-6 pt-12 sm:pt-16 pb-8 text-center">
        <Link
          href={`/${isHi ? "" : "?lang=en"}`}
          data-ga="cta_legal_back_home"
          data-ga-source="legal_page"
          className="inline-block text-sm text-ink-600 hover:text-saffron-600 transition-colors"
        >
          {isHi ? "← BadaMangal पर वापस" : "← Back to BadaMangal"}
        </Link>
        <p className="mt-4 font-mukta uppercase tracking-[0.32em] text-saffron-600 text-xs font-semibold">
          {isHi ? kicker.hi : kicker.en}
        </p>
        <h1 className="mt-3 font-fraunces font-semibold text-[2rem] sm:text-[2.6rem] leading-[1.15] text-sindoor-700">
          {isHi ? title.hi : title.en}
        </h1>
        <p className="mt-5 max-w-xl mx-auto text-ink-600 leading-relaxed">
          {isHi ? intro.hi : intro.en}
        </p>
        <p className="mt-3 text-xs text-ink-600">
          {isHi ? "अंतिम अपडेट: " : "Last updated: "}
          <span className="font-numerals tabular-nums">{lastUpdated}</span>
        </p>
      </header>

      <section className="mx-auto max-w-3xl px-4 sm:px-6 legal-prose">
        {isHi ? hi : en}
      </section>
    </article>
  );
}
