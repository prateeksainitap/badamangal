import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  kicker: string;
  title: string;
  intro: string;
  /** ISO date string for "last updated" line. */
  lastUpdated: string;
  children: ReactNode;
};

/**
 * Shared layout for /terms, /privacy, /disclaimers.
 *
 * Editorial chrome only — saffron kicker, sindoor headline, last-updated
 * line, then a long-form prose body in `children` styled via the
 * `.legal-prose` class so callers can write plain JSX without re-applying
 * typography to every heading and paragraph.
 */
export default function LegalPage({
  kicker,
  title,
  intro,
  lastUpdated,
  children,
}: Props) {
  return (
    <article className="pb-24">
      <header className="mx-auto max-w-3xl px-4 sm:px-6 pt-12 sm:pt-16 pb-8 text-center">
        <Link
          href="/"
          className="inline-block text-sm text-ink-600 hover:text-saffron-600 transition-colors"
        >
          ← Back to BadaMangal
        </Link>
        <p className="mt-4 font-mukta uppercase tracking-[0.32em] text-saffron-600 text-xs font-semibold">
          {kicker}
        </p>
        <h1 className="mt-3 font-fraunces font-semibold text-[2rem] sm:text-[2.6rem] leading-[1.15] text-sindoor-700">
          {title}
        </h1>
        <p className="mt-5 max-w-xl mx-auto text-ink-600 leading-relaxed">
          {intro}
        </p>
        <p className="mt-3 text-xs text-ink-600">
          Last updated: <span className="font-numerals tabular-nums">{lastUpdated}</span>
        </p>
      </header>

      <section className="mx-auto max-w-3xl px-4 sm:px-6 legal-prose">
        {children}
      </section>
    </article>
  );
}
