import Link from "next/link";
import type { Metadata } from "next";
import { strings, type Locale } from "@/content/strings";
import { AARTI } from "@/content/devotional";
import DevotionalReader from "@/components/DevotionalReader";
import { MarigoldDivider } from "@/components/ornaments";
import { faqPageSchema } from "@/lib/seo";

export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";

export const metadata: Metadata = {
  title: "Hanuman Aarti · हनुमान आरती (with audio) · BadaMangal",
  description:
    "Aarti Kije Hanuman Lala Ki, the aarti sung at every Lucknow Bada Mangal bhandara, with verified audio and bilingual text.",
  alternates: {
    canonical: "/resources/aarti",
    languages: {
      "hi-IN": "/resources/aarti",
      "en-IN": "/resources/aarti?lang=en",
    },
  },
  openGraph: {
    title: "Hanuman Aarti · हनुमान आरती · BadaMangal",
    description:
      "Aarti Kije Hanuman Lala Ki, with verified audio and bilingual text.",
    url: `${SITE_URL}/resources/aarti`,
    type: "article",
    siteName: "BadaMangal",
  },
};

export default async function AartiPage({}: {
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
    "@id": `${SITE_URL}/resources/aarti`,
    headline: "Hanuman Aarti",
    alternativeHeadline: "हनुमान आरती",
    inLanguage: ["hi-IN", "en-IN"],
    about: {
      "@type": "CreativeWork",
      name: "Aarti Kije Hanuman Lala Ki",
    },
    publisher: { "@type": "Organization", name: "BadaMangal", url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}/resources/aarti`,
    description: metadata.description,
    isAccessibleForFree: true,
  };

  // FAQ schema — Google sometimes surfaces these as expandable Q&A
  // blocks in the SERP. See chalisa/page.tsx for the rationale on
  // why we keep three Qs (anchors multiple search intents, stays
  // genuinely useful).
  const faqSchema = faqPageSchema([
    {
      q: "When is the Hanuman Aarti sung at a Bada Mangal bhandara?",
      a: "Most Lucknow bhandaras sing the Aarti at the start of the seva — usually around 11 AM or 12 noon — and again before the evening close. The Aarti is short (about three minutes) and the whole gathering joins in.",
    },
    {
      q: "What does 'Aarti Kije Hanuman Lala Ki' mean?",
      a: "The opening line means 'Let us perform the aarti of Hanuman Lala (beloved Hanuman)'. The verses praise his bravery, his strength as Anjani's son, his service to Lord Ram, and the protection he offers his devotees. Composed traditionally for evening worship at Hanuman temples.",
    },
    {
      q: "Can I sing the Hanuman Aarti at home?",
      a: "Yes — devotees commonly sing it at home on Tuesdays and Saturdays after lighting a diya and offering boondi or laddoo. Many start with the Hanuman Chalisa and end with the Aarti. The audio on this page can guide the tune if you're learning it for the first time.",
    },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
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
            {t.resources.aarti.kicker}
          </p>
          <h1 className="mt-3 font-deva font-medium text-[2rem] sm:text-[2.6rem] leading-[1.2] text-sindoor-700">
            {AARTI.titleHi}
          </h1>
          <p className="mt-3 font-fraunces italic text-xl sm:text-2xl text-ink-900">
            {AARTI.titleEn}
          </p>
          <p className="mt-5 max-w-xl mx-auto text-ink-600 leading-relaxed">
            {t.resources.aarti.body}
          </p>
        </header>

        <section className="mx-auto max-w-4xl px-4 sm:px-6">
          <DevotionalReader text={AARTI} />
        </section>

        <div className="flex justify-center my-14">
          <MarigoldDivider size={280} className="text-gold-500" />
        </div>

        <section className="mx-auto max-w-3xl px-4 sm:px-6">
          <p className="font-mukta uppercase tracking-[0.32em] text-gold-500 text-xs">
            {isHi ? "संपादक की टिप्पणी" : "Editor's note"}
          </p>
          <p className="mt-3 font-fraunces italic text-ink-900/85 leading-relaxed">
            {AARTI.editorialNotes}
          </p>
          <p className="mt-4 text-sm text-ink-600">
            {isHi
              ? `परंपरा · ${AARTI.era}`
              : `Traditional · ${AARTI.era}`}
          </p>
        </section>
      </article>
    </>
  );
}
