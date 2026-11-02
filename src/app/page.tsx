import type { Metadata } from "next";
import {
  SITE_URL,
  eventSchemaBatch,
  faqSchema,
  localised,
  organizationSchema,
  websiteSchema,
} from "@/lib/seo";
import { listingSeason } from "@/lib/season";
import HomeV2 from "@/components/home/HomeV2";
import VisitorBeacon from "@/components/VisitorBeacon";
import { loadHomepageData } from "@/lib/home-data";

/**
 * The homepage: the v2 redesign (swapped in 2 Nov 2026, Founder's
 * "merge"). Metadata, alternates, keywords, every JSON-LD block, the
 * visitor beacon and ISR are unchanged from the old page; only the
 * rendered tree is new (src/components/home/). The old page is in git
 * history (main before this commit).
 */

// True ISR: the page reads no cookies or searchParams, so Next
// prerenders it and revalidates every 60 seconds.
export const revalidate = 60;

// Homepage metadata, tuned to the queries Search Console is ACTUALLY
// showing us impressions for, not the queries we wish we ranked for.
//
// GSC data (as of mid-May 2026 season-start):
//   • "bhandara near me today"          12 imp · position 6.1 · CTR 0%
//   • "bhandara near me"                 9 imp · position 6.9 · CTR 0%
//   • "bhandara near me today open now"  2 imp · position 9    · CTR 0%
//   • "bada mangal lucknow"              1 imp · position 11
//
// We were ranking page-1-bottom for "near me" queries but seeing
// zero clicks because the SERP snippet promised "2026 Jyeshtha
// season" and "directory", abstract / institutional. Searchers
// typing "bhandara near me today" want a concrete here-and-now
// answer ("open now", "live map", "free prasad").
//
// New title leads with "Bhandara Near Me" (matches the query
// verbatim), then anchors with the brand. New description leads
// with "happening today" + "free" + "every Tuesday", every word
// is an answer to something the searcher actually wants to know.
//
// Expected impact: CTR from 0% → 4-7% at position 6, which 3-5×
// our organic traffic from the same Google impressions we're
// already getting.
export const metadata: Metadata = {
  title: "Bhandara Near Me · Bada Mangal Lucknow 2026 · Live Map & Today's Bhandaras",
  description:
    "Find every Bada Mangal bhandara in Lucknow happening today and every Tuesday of the 8-Tuesday 2026 Jyeshtha season. Live map, timings, prasad menu, directions, free. लखनऊ के सभी बड़े मंगल भंडारे एक नक़्शे पर।",
  keywords: [
    // "near me" intent, matches the queries actually in GSC
    "bhandara near me",
    "bhandara near me today",
    "bhandara lucknow near me",
    "free bhandara lucknow",
    // brand + season
    "bada mangal",
    "bada mangal 2026",
    "bada mangal lucknow",
    "bhandara lucknow",
    "hanuman bhandara",
    "jyeshtha tuesdays",
    "8 bada mangal",
    // Hindi
    "बड़ा मंगल",
    "बड़ा मंगल लखनऊ",
    "हनुमान भंडारा",
    "भंडारा लखनऊ",
    "लखनऊ बड़ा मंगल 2026",
  ],
  alternates: localised("/"),
  openGraph: {
    // OG title kept slightly shorter for social cards (WhatsApp /
    // Twitter truncate aggressively at ~60-70 chars; the SERP title
    // above can run longer because Google word-wraps).
    title: "Bhandara Near Me · Bada Mangal Lucknow 2026",
    description:
      "Every Bada Mangal bhandara in Lucknow on one live map. Today's bhandaras, timings, prasad menu, free directions.",
    url: SITE_URL,
    siteName: "BadaMangal",
    locale: "en_IN",
    alternateLocale: "hi_IN",
    type: "website",
  },
};

export default async function HomePage() {
  // Every DB read (Promise.allSettled + last-good cache) lives in the
  // shared loader. Locale is resolved in client components from the
  // LocaleProvider, so the page stays static.
  const data = await loadHomepageData({ withThread: true });

  // WebSite + Organization anchor the brand; FAQPage targets "People
  // also ask"; Events cover the season people can plan for now.
  const jsonLdBlocks = [
    websiteSchema(),
    organizationSchema(),
    faqSchema(),
    ...eventSchemaBatch(listingSeason().tuesdays),
  ];

  return (
    <>
      {/* Fire-and-forget visitor counter bump, once per tab. */}
      <VisitorBeacon />
      {jsonLdBlocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
      <HomeV2 data={data} />
    </>
  );
}
