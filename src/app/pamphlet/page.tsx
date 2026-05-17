import type { Metadata } from "next";
import PamphletGenerator from "@/components/PamphletGenerator";
import { localised } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title:
    "Free Bada Mangal Pamphlet Generator · BadaMangal.com",
  description:
    "Make a free printable Bada Mangal bhandara pamphlet in 30 seconds. Devotional design, Hindi + English, QR code, ready for any print shop in Lucknow.",
  keywords: [
    "bada mangal pamphlet",
    "bhandara pamphlet generator",
    "free bhandara invite",
    "bhandara invitation card",
    "बड़ा मंगल आमंत्रण",
    "भंडारा पैम्फलेट",
    "बड़ा मंगल पम्पलेट",
  ],
  alternates: localised("/pamphlet"),
  // Soft-launch posture: the feature ships and works at /pamphlet,
  // but we don't want search engines indexing it or the public
  // discovering it via SERPs until the design is finalised. Pair
  // this with the sitemap.ts exclusion + the removed homepage
  // promo + footer link so the only way in is a direct URL share.
  robots: { index: false, follow: false },
  openGraph: {
    title: "Free Bada Mangal Pamphlet Generator",
    description:
      "Make a printable Bada Mangal bhandara pamphlet free, ready in 30 seconds. Devotional design + QR code.",
    type: "website",
    siteName: "BadaMangal",
  },
};

export default function PamphletPage() {
  return <PamphletGenerator />;
}
