import type { Metadata } from "next";
import { ASHTAK } from "@/content/devotional";
import DevotionalPageView from "@/components/DevotionalPageView";

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

export default function AshtakPage() {
  // Thin server wrapper, JSON-LD here, bilingual chrome in
  // <DevotionalPageView /> (client) so the Hindi toggle swaps every
  // label without a server-tree refresh.
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
      <DevotionalPageView
        text={ASHTAK}
        kickerKey="ashtak"
        footer={{
          en: `Tulsidas · ${ASHTAK.era}`,
          hi: `तुलसीदास · ${ASHTAK.era}`,
        }}
      />
    </>
  );
}
