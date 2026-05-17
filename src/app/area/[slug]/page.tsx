/**
 * Per-area landing page, the single largest SEO unlock in the
 * audit. GSC showed page-1-bottom rankings for "bhandara <area>" /
 * "bada mangal <area>" with no clicks because the only existing
 * answer was the generic homepage, which doesn't rank specifically
 * for the area term.
 *
 * Each page is statically pre-rendered for every neighbourhood in
 * `AREAS` (lib/lucknow.ts). Content includes:
 *   • SEO-tuned H1 + meta (matches "bada mangal <area>" intent
 *     verbatim)
 *   • Bilingual page body rendered by <AreaPageView /> (client) so
 *     the Hindi toggle swaps every label without a server refresh
 *   • Area-specific FAQ schema (eligible for Google's FAQ
 *     rich-result blocks)
 *   • Breadcrumb + ItemList + LocalBusiness schemas
 *   • Internal links: back to homepage, to /list-bhandara, to
 *     adjacent areas (link-graph depth → ranking signal)
 *
 * Static generation: ISR with 5-minute revalidate so new
 * bhandaras flowing in via /list-bhandara or the WhatsApp bot
 * surface here automatically within minutes.
 */
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import AreaPageView from "@/components/AreaPageView";
import { ALL_AREA_SLUGS, slugToArea } from "@/lib/areaSlug";
import { getAllApprovedBhandaras, toBhandara } from "@/lib/db";
import { hasUpcomingDate } from "@/lib/dates";
import {
  breadcrumbSchema,
  faqPageSchema,
  localised,
  organizationSchema,
  SITE_URL,
} from "@/lib/seo";
import { AREAS } from "@/lib/lucknow";

export const revalidate = 300;
export const dynamicParams = false; // only the canonical 36 slugs render

type RouteParams = Promise<{ slug: string }>;

export function generateStaticParams(): { slug: string }[] {
  return ALL_AREA_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: RouteParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const area = slugToArea(slug);
  if (!area) return { title: "Area not found" };

  // Count bhandaras up front so the title + description can include
  // "5 bhandaras" etc., concrete numbers in SERP snippets always
  // beat abstract ones for CTR.
  //
  // Build-time note: every area page hits this function during
  // `next build`. We MUST use the deduped getAllApprovedBhandaras()
  // (one query shared across all 36 pages) instead of per-page
  // prisma.count() calls — otherwise we exhaust Supabase's
  // connection_limit=1 pooler and the build crashes with P2024.
  const all = await getAllApprovedBhandaras();
  const count = all.filter((b) => b.area === area).length;

  // SEO-tuned title: "Bada Mangal in <Area>, Lucknow 2026, N bhandaras".
  // Area is position 3, "Bada Mangal" position 1 (the brand + intent
  // keyword), "Lucknow 2026" anchors local + season. Count gives the
  // snippet a concrete number.
  const title = count
    ? `Bada Mangal in ${area}, Lucknow 2026, ${count} ${count === 1 ? "bhandara" : "bhandaras"}`
    : `Bada Mangal in ${area}, Lucknow 2026, Find a Bhandara`;

  const description = count
    ? `Find every Bada Mangal bhandara in ${area}, Lucknow for the 2026 8-Tuesday Jyeshtha season. ${count} ${count === 1 ? "bhandara" : "bhandaras"} mapped with timings, prasad menu, organizer details. Free.`
    : `Looking for a Bada Mangal bhandara in ${area}, Lucknow? Browse the 2026 directory and list yours free.`;

  return {
    title,
    description,
    keywords: [
      `bada mangal ${area.toLowerCase()}`,
      `bhandara ${area.toLowerCase()}`,
      `${area.toLowerCase()} bada mangal`,
      `bhandara near me ${area.toLowerCase()}`,
      `बड़ा मंगल ${area}`,
      `${area} भंडारा`,
      "bada mangal lucknow 2026",
      "bhandara lucknow",
    ],
    alternates: localised(`/area/${slug}`),
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/area/${slug}`,
      siteName: "BadaMangal",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function AreaPage({ params }: { params: RouteParams }) {
  const { slug } = await params;
  const area = slugToArea(slug);
  if (!area) notFound();

  // Same dedup story as generateMetadata above, share ONE findMany
  // across all 36 area pages during build via the module-level
  // cache, then filter in memory for this area's slice. The upstream
  // query already orders by isSponsored / isVerified / createdAt so
  // the filtered slice keeps that ordering for free.
  const all = await getAllApprovedBhandaras();
  const records = all.filter((b) => b.area === area);
  const bhandaras = records.map(toBhandara).filter((b) => hasUpcomingDate(b));

  // Pick 2-3 adjacent areas for cross-linking. Trivial heuristic:
  // the 2 areas immediately before and after this one in the
  // alphabetic AREAS list. Good-enough for V1; can be replaced by
  // a real geographic-adjacency map later.
  const ix = AREAS.indexOf(area);
  const adjacent: string[] = [];
  if (ix > 0) adjacent.push(AREAS[ix - 1]!);
  if (ix < AREAS.length - 1) adjacent.push(AREAS[ix + 1]!);
  if (ix > 1 && adjacent.length < 3) adjacent.push(AREAS[ix - 2]!);

  const breadcrumbs = breadcrumbSchema([
    { name: "Home", path: "/" },
    { name: "Areas", path: "/area" },
    { name: area, path: `/area/${slug}` },
  ]);

  const faqSchema = faqPageSchema([
    {
      q: `How many Bada Mangal bhandaras are in ${area}, Lucknow?`,
      a: bhandaras.length
        ? `${bhandaras.length} ${bhandaras.length === 1 ? "bhandara is" : "bhandaras are"} currently listed in ${area} for the 2026 Bada Mangal season. The list is community-sourced and grows as the season progresses.`
        : `No bhandaras are listed in ${area} for the 2026 season yet, be the first to add one (free).`,
    },
    {
      q: `When does Bada Mangal happen in ${area}?`,
      a: `Bada Mangal in 2026 falls on the 8 Tuesdays of Jyeshtha, May 5, May 12, May 19, May 26, June 2, June 9, June 16, and June 23. ${area} bhandaras serve devotees through the day on each Tuesday; many also serve on Shani Jayanti (Saturday May 16) and the final Saturday rotations.`,
    },
    {
      q: `Are Bada Mangal bhandaras in ${area} free?`,
      a: `Yes, every Bada Mangal bhandara is a free community meal, offered as seva (selfless service) in honour of Lord Hanuman. Devotees and visitors are welcome regardless of background. Most bhandaras serve puri, sabzi, halwa, and prasad. Donations are accepted but never required.`,
    },
    {
      q: `How do I list my bhandara in ${area} on BadaMangal.com?`,
      a: `Use the free listing form at badamangal.com/list-bhandara, takes 60 seconds, no sign-up required. Your bhandara appears on the live map within seconds.`,
    },
  ]);

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Bada Mangal Bhandaras in ${area}, Lucknow 2026`,
    itemListElement: bhandaras.map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/bhandara/${b.slug}`,
      name: b.name,
    })),
  };

  const jsonLdBlocks: object[] = [
    organizationSchema(),
    breadcrumbs,
    faqSchema,
    itemList,
  ];

  return (
    <>
      {jsonLdBlocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
      <AreaPageView
        area={area}
        slug={slug}
        bhandaras={bhandaras}
        adjacent={adjacent}
      />
    </>
  );
}
