import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LANG_COOKIE, resolveLocale } from "@/lib/i18n";
import { strings } from "@/content/strings";
import { RITUALS } from "@/content/rituals";
import { GadaBullet, MarigoldDivider, SunburstSpark } from "@/components/ornaments";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";

export const metadata: Metadata = {
  title: "Tuesday vrat guide · Bada Mangal puja vidhi · BadaMangal",
  description:
    "What to do on a Bada Mangal, vrat, mantra, prasad, etiquette, and notes for organizers. A practical, faith-respecting guide.",
  alternates: {
    canonical: "/resources/rituals",
    languages: {
      "hi-IN": "/resources/rituals",
      "en-IN": "/resources/rituals?lang=en",
    },
  },
  openGraph: {
    title: "Tuesday vrat guide · BadaMangal",
    description:
      "What to do on a Bada Mangal, vrat, mantra, prasad, etiquette.",
    url: `${SITE_URL}/resources/rituals`,
    type: "article",
    siteName: "BadaMangal",
  },
};

type SearchParams = Promise<{ lang?: string }>;

export default async function RitualsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const c = await cookies();
  const locale = resolveLocale({
    urlLang: sp.lang,
    cookieLang: c.get(LANG_COOKIE)?.value,
  });
  const t = strings[locale];
  const isHi = locale === "hi";
  const langSuffix = locale === "en" ? "?lang=en" : "";

  // Build a FAQPage / HowTo-ish JSON-LD from the section list.
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: RITUALS.map((s) => ({
      "@type": "Question",
      name: s.heading.en,
      acceptedAnswer: {
        "@type": "Answer",
        text: s.body.en.join(" "),
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

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
    </>
  );
}
