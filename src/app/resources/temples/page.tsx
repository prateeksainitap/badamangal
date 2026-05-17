import type { Metadata } from "next";
import { TEMPLES } from "@/content/temples";
import TemplesView from "@/components/TemplesView";

export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";

export const metadata: Metadata = {
  title: "Hanuman temples of Lucknow · BadaMangal",
  description:
    "Aliganj Naya, Aliganj Purana, Hanuman Setu, Sankat Mochan, and Bada Hanuman, the temples that anchor Lucknow's Bada Mangal.",
  alternates: {
    canonical: "/resources/temples",
    languages: {
      "hi-IN": "/resources/temples",
      "en-IN": "/resources/temples?lang=en",
    },
  },
  openGraph: {
    title: "Hanuman temples of Lucknow · BadaMangal",
    description:
      "The five Hanuman temples that define Bada Mangal in Lucknow.",
    url: `${SITE_URL}/resources/temples`,
    type: "website",
    siteName: "BadaMangal",
  },
};

export default function TemplesDirectoryPage() {
  // Thin server wrapper, ItemList JSON-LD here, bilingual chrome in
  // <TemplesView /> client component so the Hindi toggle swaps every
  // label without a server-tree refresh.
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Hanuman temples of Lucknow",
    itemListElement: TEMPLES.map((temple, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/resources/temples/${temple.slug}`,
      name: temple.name.en,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <TemplesView />
    </>
  );
}
