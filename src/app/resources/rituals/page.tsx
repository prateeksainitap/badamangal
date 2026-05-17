import type { Metadata } from "next";
import { RITUALS } from "@/content/rituals";
import RitualsView from "@/components/RitualsView";

export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";

export const metadata: Metadata = {
  title: "Tuesday vrat guide · Bada Mangal puja vidhi · BadaMangal",
  description:
    "What to do on a Bada Mangal, vrat, mantra, prasad, etiquette, and notes for organizers. A practical, faith-respecting guide.",
  alternates: {
    canonical: "/resources/rituals",
    languages: {
      "hi-IN": "/resources/rituals",
      "en-IN": "/resources/rituals?lang=en",
    },
  },
  openGraph: {
    title: "Tuesday vrat guide · BadaMangal",
    description:
      "What to do on a Bada Mangal, vrat, mantra, prasad, etiquette.",
    url: `${SITE_URL}/resources/rituals`,
    type: "article",
    siteName: "BadaMangal",
  },
};

export default function RitualsPage() {
  // Thin server wrapper, FAQ JSON-LD here, bilingual body in
  // <RitualsView /> client component so the Hindi toggle swaps every
  // label without a server-tree refresh.
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: RITUALS.map((s) => ({
      "@type": "Question",
      name: s.heading.en,
      acceptedAnswer: {
        "@type": "Answer",
        text: s.body.en.join(" "),
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <RitualsView />
    </>
  );
}
