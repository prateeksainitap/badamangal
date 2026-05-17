import type { Metadata } from "next";
import ResourcesHubView from "@/components/ResourcesHubView";
import { strings } from "@/content/strings";

export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";

export const metadata: Metadata = {
  title: "Resources · Hanuman Chalisa, Aarti, news, temples · BadaMangal",
  description:
    "The Hanuman Chalisa, Hanuman Aarti, Tuesday vrat guide, the city's biggest temples, and this week's Lucknow news, one place to keep coming back to.",
  alternates: {
    canonical: "/resources",
    languages: {
      "hi-IN": "/resources",
      "en-IN": "/resources?lang=en",
    },
  },
  openGraph: {
    title: "Resources · BadaMangal",
    description:
      "Read, listen, watch, the canonical companion to Lucknow's Bada Mangal.",
    url: `${SITE_URL}/resources`,
    type: "website",
    siteName: "BadaMangal",
  },
};

export default function ResourcesHubPage() {
  // Thin server wrapper, emits the CollectionPage JSON-LD (read by
  // crawlers, locale-agnostic) and renders the bilingual hub body in
  // a client component so the Hindi toggle swaps every label
  // synchronously.
  const t = strings.en;
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "BadaMangal Resources",
    url: `${SITE_URL}/resources`,
    inLanguage: ["hi-IN", "en-IN"],
    isPartOf: {
      "@type": "WebSite",
      name: "BadaMangal",
      url: SITE_URL,
    },
    hasPart: [
      { "@type": "WebPage", name: t.resources.cards.news.title, url: `${SITE_URL}/resources/news` },
      { "@type": "WebPage", name: t.resources.cards.chalisa.title, url: `${SITE_URL}/resources/chalisa` },
      { "@type": "WebPage", name: t.resources.cards.aarti.title, url: `${SITE_URL}/resources/aarti` },
      { "@type": "WebPage", name: t.resources.cards.ashtak.title, url: `${SITE_URL}/resources/ashtak` },
      { "@type": "WebPage", name: t.resources.cards.bajrangBaan.title, url: `${SITE_URL}/resources/bajrang-baan` },
      { "@type": "WebPage", name: t.resources.cards.ramStuti.title, url: `${SITE_URL}/resources/ram-stuti` },
      { "@type": "WebPage", name: t.resources.cards.rituals.title, url: `${SITE_URL}/resources/rituals` },
      { "@type": "WebPage", name: t.resources.cards.temples.title, url: `${SITE_URL}/resources/temples` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <ResourcesHubView />
    </>
  );
}
