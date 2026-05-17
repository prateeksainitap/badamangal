import type { Metadata } from "next";
import { BAJRANG_BAAN } from "@/content/devotional";
import DevotionalPageView from "@/components/DevotionalPageView";

export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";

export const metadata: Metadata = {
  title: "Bajrang Baan · बजरंग बाण (with audio) · BadaMangal",
  description:
    "Bajrang Baan, a fierce protective recitation invoking Hanuman Ji's force. Verified audio and full canonical text.",
  alternates: {
    canonical: "/resources/bajrang-baan",
    languages: {
      "hi-IN": "/resources/bajrang-baan",
      "en-IN": "/resources/bajrang-baan?lang=en",
    },
  },
  openGraph: {
    title: "Bajrang Baan · BadaMangal",
    description:
      "A protective recitation to Hanuman Ji, with verified audio and canonical text.",
    url: `${SITE_URL}/resources/bajrang-baan`,
    type: "article",
    siteName: "BadaMangal",
  },
};

export default function BajrangBaanPage() {
  // Thin server wrapper, JSON-LD here, bilingual chrome in
  // <DevotionalPageView /> (client) so the Hindi toggle swaps every
  // label without a server-tree refresh.
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${SITE_URL}/resources/bajrang-baan`,
    headline: "Bajrang Baan",
    alternativeHeadline: "बजरंग बाण",
    inLanguage: ["hi-IN", "en-IN"],
    about: { "@type": "CreativeWork", name: "Bajrang Baan" },
    publisher: { "@type": "Organization", name: "BadaMangal", url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}/resources/bajrang-baan`,
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
        text={BAJRANG_BAAN}
        kickerKey="bajrangBaan"
        footer={{
          en: `Traditional · ${BAJRANG_BAAN.era}`,
          hi: `परंपरा · ${BAJRANG_BAAN.era}`,
        }}
      />
    </>
  );
}
