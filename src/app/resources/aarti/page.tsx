import type { Metadata } from "next";
import { AARTI } from "@/content/devotional";
import DevotionalPageView from "@/components/DevotionalPageView";
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

export default function AartiPage() {
  // Thin server wrapper, JSON-LD here, bilingual chrome in
  // <DevotionalPageView /> (client) so the Hindi toggle swaps every
  // label without a server-tree refresh.
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

  const faqSchema = faqPageSchema([
    {
      q: "When is the Hanuman Aarti sung at a Bada Mangal bhandara?",
      a: "Most Lucknow bhandaras sing the Aarti at the start of the seva, usually around 11 AM or 12 noon, and again before the evening close. The Aarti is short (about three minutes) and the whole gathering joins in.",
    },
    {
      q: "What does 'Aarti Kije Hanuman Lala Ki' mean?",
      a: "The opening line means 'Let us perform the aarti of Hanuman Lala (beloved Hanuman)'. The verses praise his bravery, his strength as Anjani's son, his service to Lord Ram, and the protection he offers his devotees. Composed traditionally for evening worship at Hanuman temples.",
    },
    {
      q: "Can I sing the Hanuman Aarti at home?",
      a: "Yes, devotees commonly sing it at home on Tuesdays and Saturdays after lighting a diya and offering boondi or laddoo. Many start with the Hanuman Chalisa and end with the Aarti. The audio on this page can guide the tune if you're learning it for the first time.",
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
        text={AARTI}
        kickerKey="aarti"
        footer={{
          en: `Traditional · ${AARTI.era}`,
          hi: `परंपरा · ${AARTI.era}`,
        }}
      />
    </>
  );
}
