import type { Metadata } from "next";
import { NEWS } from "@/content/news";
import NewsPageView from "@/components/NewsPageView";

export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";

export const metadata: Metadata = {
  title: "This week in Lucknow · Bada Mangal news",
  description:
    "Hand-picked stories from across Lucknow, bhandaras, temples, civic notes, and Bada Mangal coverage worth bookmarking.",
  alternates: {
    canonical: "/resources/news",
    languages: {
      "hi-IN": "/resources/news",
      "en-IN": "/resources/news?lang=en",
    },
  },
  openGraph: {
    title: "This week in Lucknow · BadaMangal",
    description:
      "Editor's-pick news from the city's biggest meal.",
    url: `${SITE_URL}/resources/news`,
    type: "website",
    siteName: "BadaMangal",
  },
};

export default function NewsPage() {
  // Thin server wrapper, ItemList JSON-LD here, bilingual chrome
  // (kicker/heading/source labels/CTAs) in <NewsPageView /> client
  // component so the Hindi toggle swaps every label.
  const all = [...NEWS];
  const featured = all.find((n) => n.featured) ?? all[0];
  const rest = all
    .filter((n) => n.id !== featured?.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const sorted = [featured, ...rest];

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "BadaMangal, This week in Lucknow",
    itemListElement: sorted.map((n, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: n.url,
      name: n.headline,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
      />
      <NewsPageView />
    </>
  );
}
