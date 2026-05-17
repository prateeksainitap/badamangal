import type { Metadata } from "next";
import HistoryView from "@/components/HistoryView";

export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";

export const metadata: Metadata = {
  title: "The story of Bada Mangal · बड़ा मंगल का इतिहास",
  description:
    "A 400-year Lucknow tradition: from a Begum's vow at the Aliganj temple in 1798 to the rare 2026 cycle of eight Bada Mangals. The full story of the city's biggest meal.",
  alternates: {
    canonical: "/history",
    languages: {
      "hi-IN": "/history",
      "en-IN": "/history?lang=en",
    },
  },
  openGraph: {
    title: "The story of Bada Mangal · बड़ा मंगल का इतिहास",
    description:
      "A 400-year Lucknow tradition. From a Begum's vow at the Aliganj temple to the rare 2026 cycle of eight Bada Mangals.",
    url: `${SITE_URL}/history`,
    type: "article",
    siteName: "BadaMangal",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "The story of Bada Mangal · बड़ा मंगल का इतिहास",
    description: "A 400-year Lucknow tradition, in eight chapters.",
  },
};

export default function HistoryPage() {
  // Thin server wrapper, JSON-LD here, every text-bearing element
  // lives in <HistoryView /> (client) so the Hindi toggle swaps the
  // entire article without a server-tree refresh. Page stays
  // statically renderable.
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "The story of Bada Mangal",
    description: metadata.description,
    inLanguage: ["en-IN", "hi-IN"],
    publisher: {
      "@type": "Organization",
      name: "BadaMangal.com",
      url: SITE_URL,
    },
    mainEntityOfPage: `${SITE_URL}/history`,
    image: `${SITE_URL}/history/opengraph-image`,
    dateModified: new Date().toISOString().slice(0, 10),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <HistoryView />
    </>
  );
}
