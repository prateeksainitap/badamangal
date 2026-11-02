import type { Metadata } from "next";
import FaqPageView from "@/components/FaqPageView";
import { faqSchema, SITE_URL, DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "FAQ · BadaMangal Lucknow",
  description:
    "Common questions about Bada Mangal, the 400-year-old Tuesday meal tradition of Lucknow, the rare 8-Tuesday 2026 cycle, how to find a bhandara near you, and how to list your own.",
  alternates: {
    canonical: "/faq",
    languages: {
      "hi-IN": "/faq",
      "en-IN": "/faq?lang=en",
    },
  },
  openGraph: {
    images: [DEFAULT_OG_IMAGE],
    title: "FAQ · BadaMangal Lucknow",
    description:
      "Common questions about Bada Mangal, the tradition, the dates, the bhandaras.",
    url: `${SITE_URL}/faq`,
    type: "website",
    siteName: "BadaMangal",
  },
};

export default function FAQPage() {
  // Reuse the same FAQPage JSON-LD that the homepage emits, the
  // /faq page IS the FAQ surface, so the rich-snippet eligibility
  // belongs here as much as on /.
  const jsonLd = faqSchema();

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FaqPageView />
    </main>
  );
}
