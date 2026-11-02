import type { Metadata } from "next";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";
import RecapView from "@/components/RecapView";
import { getHomepageStats } from "@/lib/stats";
import { getSeason2026, type SeasonDay } from "@/lib/home-season";

// ISR, same cache window as the homepage's stats panel. The headline
// numbers are the one genuinely live thing on this page; everything
// else (growth, press, social, geography) is a dated historical
// snapshot baked into src/content/recap.ts.
export const revalidate = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";

export const metadata: Metadata = {
  title: "2026 Season Recap",
  description:
    "Bada Mangal 2026, the full recap: bhandaras tracked, community growth, press coverage, and how far the story travelled. Eight Tuesdays, one city, one map.",
  alternates: {
    canonical: "/recap",
    languages: {
      "hi-IN": "/recap",
      "en-IN": "/recap?lang=en",
    },
  },
  openGraph: {
    images: [DEFAULT_OG_IMAGE],
    title: "2026 Season Recap · BadaMangal",
    description:
      "Bada Mangal 2026, the full recap. Eight Tuesdays, one city, one map that Lucknow built together.",
    url: `${SITE_URL}/recap`,
    type: "article",
    siteName: "BadaMangal",
    locale: "en_IN",
  },
  twitter: {
    images: [DEFAULT_OG_IMAGE],
    card: "summary_large_image",
    title: "2026 Season Recap · BadaMangal",
    description: "Bada Mangal 2026, the full recap, in numbers.",
  },
};

export default async function RecapPage() {
  // The Tuesday by Tuesday picker reuses the homepage's season data
  // (read only). A failed load hides the picker, never the page.
  const [stats, days] = await Promise.all([
    getHomepageStats(),
    getSeason2026().catch((err): SeasonDay[] => {
      console.error("[recap] season 2026 load failed", err);
      return [];
    }),
  ]);
  return <RecapView stats={stats} days={days} />;
}
