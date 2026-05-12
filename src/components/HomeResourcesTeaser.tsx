"use client";

import Link from "next/link";
import { strings } from "@/content/strings";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * Inline "The Bada Mangal companion" teaser shown on the homepage,
 * extracted out of the now-statically-rendered page so the card text
 * (Chalisa / Aarti / Ashtak / Bajrang Baan) can swap to Hindi after
 * the LocaleProvider hydrates from the bm_lang cookie.
 *
 * The same content lives on /resources too, which gets its own
 * client-side localization path; this component only powers the
 * four-card preview band on `/`.
 */
export default function HomeResourcesTeaser() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const t = strings[locale];
  const langSuffix = isHi ? "" : "?lang=en";

  const cards = [
    {
      href: `/resources/chalisa${langSuffix}`,
      title: t.resources.cards.chalisa.title,
      body: t.resources.cards.chalisa.body,
      cta: t.resources.cards.chalisa.cta,
      accent: "saffron" as const,
    },
    {
      href: `/resources/aarti${langSuffix}`,
      title: t.resources.cards.aarti.title,
      body: t.resources.cards.aarti.body,
      cta: t.resources.cards.aarti.cta,
      accent: "sindoor" as const,
    },
    {
      href: `/resources/ashtak${langSuffix}`,
      title: t.resources.cards.ashtak.title,
      body: t.resources.cards.ashtak.body,
      cta: t.resources.cards.ashtak.cta,
      accent: "saffron" as const,
    },
    {
      href: `/resources/bajrang-baan${langSuffix}`,
      title: t.resources.cards.bajrangBaan.title,
      body: t.resources.cards.bajrangBaan.body,
      cta: t.resources.cards.bajrangBaan.cta,
      accent: "sindoor" as const,
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
      <div className="mb-7 text-center">
        <p className="font-mukta uppercase tracking-[0.32em] text-saffron-600 text-xs font-semibold">
          {t.resources.hubKicker}
        </p>
        <h2
          className={`mt-3 ${
            isHi
              ? "font-tiro text-sindoor-700"
              : "font-fraunces font-bold text-sindoor-700"
          } text-3xl sm:text-4xl`}
        >
          {t.resources.hubHeading}
        </h2>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={`group rounded-3xl bg-white shadow-warm px-6 py-7 transition-colors block ${
              card.accent === "saffron"
                ? "border border-saffron-500/40 hover:border-saffron-500"
                : "border border-sindoor-700/30 hover:border-sindoor-700"
            }`}
          >
            <p
              className={`font-mukta uppercase tracking-[0.28em] text-[0.65rem] ${
                card.accent === "saffron" ? "text-saffron-600" : "text-sindoor-700"
              }`}
            >
              {isHi ? "पढ़ें · सुनें" : "Read · listen"}
            </p>
            <h3 className="mt-3 font-fraunces font-semibold text-xl text-sindoor-700">
              {card.title}
            </h3>
            <p className="mt-2 text-sm text-ink-600">{card.body}</p>
            <p
              className={`mt-5 inline-flex items-center gap-1.5 font-medium text-sm ${
                card.accent === "saffron" ? "text-saffron-600" : "text-sindoor-700"
              }`}
            >
              {card.cta} <span aria-hidden>→</span>
            </p>
          </Link>
        ))}
      </div>
      <div className="mt-7 text-center">
        <Link
          href={`/resources${langSuffix}`}
          className="inline-flex items-center text-sm text-ink-600 hover:text-saffron-600 transition-colors"
        >
          {isHi ? "सभी संसाधन देखें" : "View all resources"} →
        </Link>
      </div>
    </section>
  );
}
