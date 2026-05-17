import type { Metadata } from "next";
import { RAM_STUTI } from "@/content/devotional";
import DevotionalPageView from "@/components/DevotionalPageView";

export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";

export const metadata: Metadata = {
  title: "Shri Ram Stuti · श्री राम स्तुति (with audio) · BadaMangal",
  description:
    "Tulsidas's Shri Ram Stuti from the Ramcharitmanas, with audio. Sung at every Lucknow Hanuman temple alongside the Aarti.",
  alternates: {
    canonical: "/resources/ram-stuti",
    languages: {
      "hi-IN": "/resources/ram-stuti",
      "en-IN": "/resources/ram-stuti?lang=en",
    },
  },
  openGraph: {
    title: "Shri Ram Stuti · BadaMangal",
    description:
      "Tulsidas's five-stanza praise of Shri Ram, with audio.",
    url: `${SITE_URL}/resources/ram-stuti`,
    type: "article",
    siteName: "BadaMangal",
  },
};

export default function RamStutiPage() {
  // Thin server wrapper, JSON-LD here, bilingual chrome in
  // <DevotionalPageView /> (client) so the Hindi toggle swaps every
  // label without a server-tree refresh.
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${SITE_URL}/resources/ram-stuti`,
    headline: "Shri Ram Stuti",
    alternativeHeadline: "श्री राम स्तुति",
    inLanguage: ["hi-IN", "en-IN"],
    about: {
      "@type": "CreativeWork",
      name: "Shri Ramachandra Kripalu Bhajamana",
      author: { "@type": "Person", name: "Goswami Tulsidas" },
    },
    publisher: { "@type": "Organization", name: "BadaMangal", url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}/resources/ram-stuti`,
    description: metadata.description,
    isAccessibleForFree: true,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <DevotionalPageView
        text={RAM_STUTI}
        kickerKey="ramStuti"
        footer={{
          en: `Tulsidas · ${RAM_STUTI.era}`,
          hi: `तुलसीदास · ${RAM_STUTI.era}`,
        }}
      />
    </>
  );
}
