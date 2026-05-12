import Link from "next/link";
import type { Metadata } from "next";
import { strings, type Locale } from "@/content/strings";
import { ASHTAK } from "@/content/devotional";
import DevotionalReader from "@/components/DevotionalReader";
import { MarigoldDivider } from "@/components/ornaments";

export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";

export const metadata: Metadata = {
  title:
    "Sankat Mochan Hanuman Ashtak · संकट मोचन हनुमान अष्टक (with audio) · BadaMangal",
  description:
    "The eight-stanza Sankat Mochan Hanuman Ashtak by Tulsidas, recited when an obstacle feels immovable. Verified audio and full canonical text.",
  alternates: {
    canonical: "/resources/ashtak",
    languages: {
      "hi-IN": "/resources/ashtak",
      "en-IN": "/resources/ashtak?lang=en",
    },
  },
  openGraph: {
    title: "Sankat Mochan Hanuman Ashtak · BadaMangal",
    description:
      "The eight-stanza stotra by Tulsidas, with verified audio and canonical text.",
    url: `${SITE_URL}/resources/ashtak`,
    type: "article",
    siteName: "BadaMangal",
  },
};

export default async function AshtakPage({}: {
  // no-op
}) {
  // Server renders in English; client swaps via <LocaleProvider />.
  const locale = "en" as Locale;
  const t = strings[locale];
  const isHi = locale === "hi";
  const langSuffix = locale === "en" ? "?lang=en" : "";

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${SITE_URL}/resources/ashtak`,
    headline: "Sankat Mochan Hanuman Ashtak",
    alternativeHeadline: "संकट मोचन हनुमान अष्टक",
    inLanguage: ["hi-IN", "en-IN"],
    about: {
      "@type": "CreativeWork",
      name: "Sankat Mochan Hanuman Ashtak",
      author: { "@type": "Person", name: "Goswami Tulsidas" },
    },
    publisher: { "@type": "Organization", name: "BadaMangal", url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}/resources/ashtak`,
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
        <header className="mx-auto max-w-3xl px-4 sm:px-6 pt-12 sm:pt-16 pb-8 text-center">
          <Link
            href={`/resources${langSuffix}`}
            className="inline-block text-sm text-ink-600 hover:text-saffron-600 transition-colors"
          >
            {t.resources.common.backToResources}
          </Link>
          <p className="mt-4 font-mukta uppercase tracking-[0.32em] text-gold-500 text-xs">
            {t.resources.ashtak.kicker}
          </p>
          <h1 className="mt-3 font-deva font-medium text-[2rem] sm:text-[2.6rem] leading-[1.2] text-sindoor-700">
            {ASHTAK.titleHi}
          </h1>
          <p className="mt-3 font-fraunces italic text-xl sm:text-2xl text-ink-900">
            {ASHTAK.titleEn}
          </p>
          <p className="mt-5 max-w-xl mx-auto text-ink-600 leading-relaxed">
            {t.resources.ashtak.body}
          </p>
        </header>

        <section className="mx-auto max-w-4xl px-4 sm:px-6">
          <DevotionalReader text={ASHTAK} />
        </section>

        <div className="flex justify-center my-14">
          <MarigoldDivider size={280} className="text-gold-500" />
        </div>

        <section className="mx-auto max-w-3xl px-4 sm:px-6">
          <p className="font-mukta uppercase tracking-[0.32em] text-gold-500 text-xs">
            {isHi ? "संपादक की टिप्पणी" : "Editor's note"}
          </p>
          <p className="mt-3 font-fraunces italic text-ink-900/85 leading-relaxed">
            {ASHTAK.editorialNotes}
          </p>
          <p className="mt-4 text-sm text-ink-600">
            {isHi ? `तुलसीदास · ${ASHTAK.era}` : `Tulsidas · ${ASHTAK.era}`}
          </p>
        </section>
      </article>
    </>
  );
}
