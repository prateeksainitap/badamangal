"use client";

import Link from "next/link";
import { strings } from "@/content/strings";
import type { DevotionalText } from "@/content/devotional";
import DevotionalReader from "@/components/DevotionalReader";
import { MarigoldDivider } from "@/components/ornaments";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * Shared page body for the five canonical-text resource pages
 * (Chalisa, Aarti, Ashtak, Bajrang Baan, Ram Stuti). All five used to
 * have near-identical inline JSX in their respective server pages
 * with `isHi = false` hardcoded, so the Hindi toggle never swapped
 * the "Back to resources" link, the kicker, the editor's-note line,
 * or the author/era footer.
 *
 * Centralising the chrome here means:
 *   • One client component reads locale from LocaleProvider context
 *   • Five page.tsx files shrink to thin server wrappers (metadata +
 *     JSON-LD only)
 *   • Hindi toggle flips every label instantly across all 5 pages
 */
type Kicker =
  | "chalisa"
  | "aarti"
  | "ashtak"
  | "bajrangBaan"
  | "ramStuti";

type Props = {
  text: DevotionalText;
  /** Which `strings.resources.<key>` entry powers the kicker + body
   *  copy at the top of the page. */
  kickerKey: Kicker;
  /** Locale-aware author/era footer line. Each page picks its own
   *  flavour ("By Tulsidas · era", "Traditional · era", "Tulsidas ·
   *  era") so this stays a per-page prop rather than living on the
   *  shared component. Passed as a render function so the swap
   *  happens inside the client component on locale change. */
  footer: { en: string; hi: string };
};

export default function DevotionalPageView({ text, kickerKey, footer }: Props) {
  const locale = useLocaleFromContext();
  const t = strings[locale];
  const isHi = locale === "hi";
  const langSuffix = locale === "en" ? "?lang=en" : "";
  const kicker = t.resources[kickerKey];

  return (
    <article className="pb-24">
      <header className="mx-auto max-w-3xl px-4 sm:px-6 pt-12 sm:pt-16 pb-8 text-center">
        <Link
          href={`/resources${langSuffix}`}
          className="inline-block text-sm text-ink-600 hover:text-saffron-600 transition-colors"
        >
          {t.resources.common.backToResources}
        </Link>
        <p className="mt-4 font-mukta uppercase tracking-[0.32em] text-gold-500 text-xs">
          {kicker.kicker}
        </p>
        <h1 className="mt-3 font-deva font-medium text-[2rem] sm:text-[2.6rem] leading-[1.2] text-sindoor-700">
          {text.titleHi}
        </h1>
        <p className="mt-3 font-fraunces italic text-xl sm:text-2xl text-ink-900">
          {text.titleEn}
        </p>
        <p className="mt-5 max-w-xl mx-auto text-ink-600 leading-relaxed">
          {kicker.body}
        </p>
      </header>

      <section className="mx-auto max-w-4xl px-4 sm:px-6">
        <DevotionalReader text={text} />
      </section>

      <div className="flex justify-center my-14">
        <MarigoldDivider size={280} className="text-gold-500" />
      </div>

      <section className="mx-auto max-w-3xl px-4 sm:px-6">
        <p className="font-mukta uppercase tracking-[0.32em] text-gold-500 text-xs">
          {isHi ? "संपादक की टिप्पणी" : "Editor's note"}
        </p>
        <p className="mt-3 font-fraunces italic text-ink-900/85 leading-relaxed">
          {text.editorialNotes}
        </p>
        <p className="mt-4 text-sm text-ink-600">
          {isHi ? footer.hi : footer.en}
        </p>
      </section>
    </article>
  );
}
