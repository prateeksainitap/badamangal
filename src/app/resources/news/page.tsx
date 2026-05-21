import type { Metadata } from "next";
import { NEWS } from "@/content/news";
import NewsPageView, { type LiveNewsItem } from "@/components/NewsPageView";
import { prisma } from "@/lib/db";

// Keep the page cacheable but short — auto-fetched news flows in via the
// /api/news/refresh cron, and 5 min ISR is fresh enough for the editorial
// "this week" framing (we're not racing breaking news).
export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";

export const metadata: Metadata = {
  title: "This week in Lucknow · Bada Mangal news",
  description:
    "Hand-picked editorial plus an always-live feed of Bada Mangal coverage from Lucknow's leading Hindi and English dailies.",
  alternates: {
    canonical: "/resources/news",
    languages: {
      "hi-IN": "/resources/news",
      "en-IN": "/resources/news?lang=en",
    },
  },
  openGraph: {
    title: "This week in Lucknow · BadaMangal",
    description: "Editor's-pick news + live newspaper feed from Lucknow.",
    url: `${SITE_URL}/resources/news`,
    type: "website",
    siteName: "BadaMangal",
  },
};

export default async function NewsPage() {
  // Editorial layout split:
  //   • Static NEWS array (hand-curated by us, with bilingual excerpts
  //     and hand-picked imagery) drives the FEATURED card + the
  //     TERTIARY grid below the fold.
  //   • Auto-fetched NewsItem rows from the DB drive the SIDEBAR +
  //     the live tertiary band — always-live, pulled every couple of
  //     hours from Google News RSS + direct publisher feeds.
  //
  // ONE display filter at the query level (no DB-level cleanup; we
  // keep all ingested rows for forensic reasons, just hide off-year
  // items from the UI):
  //
  //   publishedAt >= Jan 1 of the current year — last year's
  //   coverage shouldn't pollute "this week in Lucknow".
  //
  // The image filter is applied IN THE CLIENT VIEW per-section, not
  // here, because we want:
  //   • sidebar  → ALL this-year items (image or not). The sidebar
  //     LiveCard is a text-only treatment that doesn't need a thumb,
  //     so requiring images there would starve the column on slow
  //     news days.
  //   • tertiary → only image-bearing items. The grid below uses
  //     LiveTertiaryCard which is image-led — a no-image card there
  //     would have a visual hole.
  //   • featured left slot → newest image-bearing item if any;
  //     falls back to the static editorial featured otherwise.
  //
  // 24 items per language gives enough for both sections combined
  // with headroom for the featured pick at the top.
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const liveWhere = (language: "hi" | "en") => ({
    status: "APPROVED",
    language,
    publishedAt: { gte: yearStart },
  });
  const [liveHi, liveEn] = await Promise.all([
    prisma.newsItem.findMany({
      where: liveWhere("hi"),
      orderBy: { publishedAt: "desc" },
      take: 24,
      select: { id: true, url: true, title: true, source: true, publishedAt: true, imageUrl: true },
    }),
    prisma.newsItem.findMany({
      where: liveWhere("en"),
      orderBy: { publishedAt: "desc" },
      take: 24,
      select: { id: true, url: true, title: true, source: true, publishedAt: true, imageUrl: true },
    }),
  ]);

  const toClient = (rows: typeof liveHi): LiveNewsItem[] =>
    rows.map((r) => ({
      id: r.id,
      url: r.url,
      title: r.title,
      source: r.source,
      publishedAt: r.publishedAt.toISOString(),
      imageUrl: r.imageUrl,
    }));

  // Featured + rest from static NEWS for JSON-LD (kept stable so the
  // structured-data outline doesn't churn every cron tick).
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
      <NewsPageView
        liveHi={toClient(liveHi)}
        liveEn={toClient(liveEn)}
      />
    </>
  );
}
