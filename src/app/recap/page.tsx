import type { Metadata } from "next";
import RecapView from "@/components/RecapView";
import { getHomepageStats } from "@/lib/stats";

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
    title: "2026 Season Recap · BadaMangal",
    description:
      "Bada Mangal 2026, the full recap. Eight Tuesdays, one city, one map that Lucknow built together.",
    url: `${SITE_URL}/recap`,
    type: "article",
    siteName: "BadaMangal",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "2026 Season Recap · BadaMangal",
    description: "Bada Mangal 2026, the full recap, in numbers.",
  },
};

export default async function RecapPage() {
  const stats = await getHomepageStats();
  return <RecapView stats={stats} />;
}
