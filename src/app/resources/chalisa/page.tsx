import type { Metadata } from "next";
import { CHALISA } from "@/content/devotional";
import DevotionalPageView from "@/components/DevotionalPageView";
import { faqPageSchema } from "@/lib/seo";

export const revalidate = 300;

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

export default function ChalisaPage() {
  // Thin server wrapper, JSON-LD scripts here, bilingual chrome in
  // <DevotionalPageView /> (client) so the Hindi toggle swaps every
  // label without a server-tree refresh.
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

  // FAQ schema, Google sometimes surfaces these as expandable Q&A
  // blocks directly in the SERP, doubling the listing's vertical
  // real estate. Keep the questions genuinely useful (not promotional)
  // so Google doesn't downgrade them as low-quality FAQ markup.
  // Three Qs is the sweet spot: enough to anchor multiple search
  // intents ("how to recite", "how long it takes", "when to chant"),
  // few enough that quality stays high.
  const faqSchema = faqPageSchema([
    {
      q: "How long does the Hanuman Chalisa take to recite?",
      a: "Around 7–10 minutes at a steady devotional pace. The Chalisa is 40 chaupais plus the opening doha and closing dohas, most devotees finish a single round in under ten minutes. Some chant it 11 or 108 times across the day on Tuesdays and Saturdays.",
    },
    {
      q: "When should I chant the Hanuman Chalisa?",
      a: "Traditionally on Tuesdays and Saturdays, after a morning bath and facing east. During Lucknow's Bada Mangal season (Jyeshtha Tuesdays of 2026, May–June), devotees chant it at every bhandara, at the temple, and at home through the day.",
    },
    {
      q: "What is the meaning of the Hanuman Chalisa?",
      a: "Composed in Awadhi by Tulsidas in the 16th century, the Chalisa is a forty-verse hymn praising Lord Hanuman, his birth, his strength, his devotion to Lord Ram, and the blessings he grants those who remember him. Each verse is short enough to memorise and recite together.",
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
      <DevotionalPageView
        text={CHALISA}
        kickerKey="chalisa"
        footer={{
          en: `By ${CHALISA.author} · ${CHALISA.era}`,
          hi: `रचयिता: ${CHALISA.author} · ${CHALISA.era}`,
        }}
      />
    </>
  );
}
