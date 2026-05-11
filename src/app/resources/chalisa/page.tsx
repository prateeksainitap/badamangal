import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LANG_COOKIE, resolveLocale } from "@/lib/i18n";
import { strings } from "@/content/strings";
import { CHALISA } from "@/content/devotional";
import DevotionalReader from "@/components/DevotionalReader";
import { MarigoldDivider } from "@/components/ornaments";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";

export const metadata: Metadata = {
  title: "Hanuman Chalisa · हनुमान चालीसा (with audio) · BadaMangal",
  description:
    "Tulsidas's Hanuman Chalisa, forty verses with audio, in Devanagari and Roman. The song every Lucknow Bada Mangal bhandara plays.",
  alternates: {
    canonical: "/resources/chalisa",
    languages: {
      "hi-IN": "/resources/chalisa",
      "en-IN": "/resources/chalisa?lang=en",
    },
  },
  openGraph: {
    title: "Hanuman Chalisa · हनुमान चालीसा · BadaMangal",
    description: "Forty verses, two dohas, with verified audio.",
    url: `${SITE_URL}/resources/chalisa`,
    type: "article",
    siteName: "BadaMangal",
  },
};

type SearchParams = Promise<{ lang?: string }>;

export default async function ChalisaPage({
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

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${SITE_URL}/resources/chalisa`,
    headline: "Hanuman Chalisa",
    alternativeHeadline: "हनुमान चालीसा",
    inLanguage: ["hi-IN", "en-IN"],
    author: { "@type": "Person", name: CHALISA.author },
    about: {
      "@type": "CreativeWork",
      name: "Hanuman Chalisa",
      author: { "@type": "Person", name: CHALISA.author },
    },
    publisher: { "@type": "Organization", name: "BadaMangal", url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}/resources/chalisa`,
    description: metadata.description,
    isAccessibleForFree: true,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <article className="pb-24">
        {/* HEADER */}
        <header className="mx-auto max-w-3xl px-4 sm:px-6 pt-12 sm:pt-16 pb-8 text-center">
          <Link
            href={`/resources${langSuffix}`}
            className="inline-block text-sm text-ink-600 hover:text-saffron-600 transition-colors"
          >
            {t.resources.common.backToResources}
          </Link>
          <p className="mt-4 font-mukta uppercase tracking-[0.32em] text-gold-500 text-xs">
            {t.resources.chalisa.kicker}
          </p>
          <h1 className="mt-3 font-deva font-medium text-[2rem] sm:text-[2.6rem] leading-[1.2] text-sindoor-700">
            {CHALISA.titleHi}
          </h1>
          <p className="mt-3 font-fraunces italic text-xl sm:text-2xl text-ink-900">
            {CHALISA.titleEn}
          </p>
          <p className="mt-5 max-w-xl mx-auto text-ink-600 leading-relaxed">
            {t.resources.chalisa.body}
          </p>
        </header>

        {/* PLAYER + VERSES */}
        <section className="mx-auto max-w-4xl px-4 sm:px-6">
          <DevotionalReader text={CHALISA} />
        </section>

        {/* DIVIDER */}
        <div className="flex justify-center my-14">
          <MarigoldDivider size={280} className="text-gold-500" />
        </div>

        {/* EDITORIAL NOTE */}
        <section className="mx-auto max-w-3xl px-4 sm:px-6">
          <p className="font-mukta uppercase tracking-[0.32em] text-gold-500 text-xs">
            {isHi ? "संपादक की टिप्पणी" : "Editor's note"}
          </p>
          <p className="mt-3 font-fraunces italic text-ink-900/85 leading-relaxed">
            {CHALISA.editorialNotes}
          </p>
          <p className="mt-4 text-sm text-ink-600">
            {isHi
              ? `रचयिता: ${CHALISA.author} · ${CHALISA.era}`
              : `By ${CHALISA.author} · ${CHALISA.era}`}
          </p>
        </section>
      </article>
    </>
  );
}
