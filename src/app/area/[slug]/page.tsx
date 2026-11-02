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
import { ALL_AREA_SLUGS, slugToAreaCity } from "@/lib/areaSlug";
import { getCity, areasFor } from "@/lib/cities";
import {
  getAllApprovedBhandarasPublic,
  toPublicBhandaraListItem,
} from "@/lib/db";
import {
  hasUpcomingDate,
  isBadaMangalSeasonOver,
  istTodayIso,
} from "@/lib/dates";
import type { BhandaraListItem } from "@/types/bhandara";
import {
  DEFAULT_OG_IMAGE,
  breadcrumbSchema,
  faqPageSchema,
  localised,
  organizationSchema,
  SITE_URL,
} from "@/lib/seo";
import { AREAS } from "@/lib/lucknow";
import { placeOnPaintedMap } from "@/lib/home-map";

export const revalidate = 300;
export const dynamicParams = false; // only the canonical 36 slugs render

type RouteParams = Promise<{ slug: string }>;

/**
 * This area's bhandaras, split into what is still to come and what
 * already served. Shared by the metadata and the page so the title
 * count and the list on the page always agree (30 Oct 2026 test: the
 * title said "10 bhandaras" while the list said none, because the list
 * kept only upcoming rows and the title counted everything).
 *
 *   upcoming : at least one service day today or later (IST), shown
 *              first as before, one card per date.
 *   past     : every service day is over, limited to the latest season
 *              on record (e.g. 2026), one card per bhandara with its
 *              dates shown as served. Off season this is what fills the
 *              page, so it is never empty while the title has a count.
 *   pastYear : that season's year, for the "From the 2026 season" label.
 */
function splitAreaBhandaras(
  all: Awaited<ReturnType<typeof getAllApprovedBhandarasPublic>>,
  area: string,
  citySlug: string,
): { upcoming: BhandaraListItem[]; past: BhandaraListItem[]; pastYear: string | null } {
  // Filter on city AND area. Area alone is ambiguous now: Kalyanpur
  // exists in Lucknow and Kanpur, Civil Lines in three cities, so
  // matching on area only would blend two cities' bhandaras onto one
  // page. Legacy rows have city "lucknow" from the backfill.
  const rows = all.filter(
    (b) => b.area === area && (b.city ?? "lucknow") === citySlug,
  );
  // Public list projection: no organiser phone, WhatsApp or UPI
  // (Founder's ruling, 1 Nov 2026). Calls happen on the bhandara's
  // own page.
  const mapped = rows.map(toPublicBhandaraListItem);
  const upcoming = mapped.filter((b) => hasUpcomingDate(b));
  const served = mapped.filter(
    (b) => !hasUpcomingDate(b) && b.tuesdayDates.length > 0,
  );
  // A few listings never had a date entered. They belong to the season
  // they were listed in (by createdAt) and show with no date chip.
  const listedYear = new Map(
    rows.map((r) => [r.id, new Date(r.createdAt).toISOString().slice(0, 4)]),
  );
  const undated = mapped.filter((b) => b.tuesdayDates.length === 0);
  const lastDate = (b: BhandaraListItem) => [...b.tuesdayDates].sort().at(-1) ?? "";
  const firstDate = (b: BhandaraListItem) => [...b.tuesdayDates].sort()[0] ?? "";
  const pastYear =
    served.map(lastDate).sort().at(-1)?.slice(0, 4) ??
    undated.map((b) => listedYear.get(b.id) ?? "").sort().at(-1) ??
    null;
  const past = pastYear
    ? [
        ...served
          .filter((b) => lastDate(b).startsWith(pastYear))
          .sort(
            (a, z) =>
              firstDate(a).localeCompare(firstDate(z)) ||
              lastDate(a).localeCompare(lastDate(z)),
          ),
        ...undated.filter((b) => listedYear.get(b.id) === pastYear),
      ]
    : [];
  return { upcoming, past, pastYear };
}

export function generateStaticParams(): { slug: string }[] {
  return ALL_AREA_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: RouteParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const target = slugToAreaCity(slug);
  if (!target) return { title: "Area not found" };
  const { area, city: citySlug } = target;
  // City name is interpolated rather than hardcoded so a Kanpur area
  // page does not advertise itself as being in Lucknow.
  const cityName = getCity(citySlug).name;

  // Count bhandaras up front so the title + description can include
  // "5 bhandaras" etc., concrete numbers in SERP snippets always
  // beat abstract ones for CTR.
  //
  // Build-time note: every area page hits this function during
  // `next build`. We MUST use the deduped getAllApprovedBhandarasPublic()
  // (one query shared across all 36 pages) instead of per-page
  // prisma.count() calls, otherwise we exhaust Supabase's
  // connection_limit=1 pooler and the build crashes with P2024.
  const all = await getAllApprovedBhandarasPublic();
  const split = splitAreaBhandaras(all, area, citySlug);
  // Upcoming plus the latest season's served bhandaras: exactly the
  // cards the page shows.
  const count = split.upcoming.length + split.past.length;

  // SEO-tuned title: "Bada Mangal in <Area>, Lucknow 2026, N bhandaras".
  // Area is position 3, "Bada Mangal" position 1 (the brand + intent
  // keyword), "Lucknow 2026" anchors local + season. Count gives the
  // snippet a concrete number.
  const title = count
    ? `Bada Mangal in ${area}, ${cityName} 2026, ${count} ${count === 1 ? "bhandara" : "bhandaras"}`
    : `Bada Mangal in ${area}, ${cityName} 2026, Find a Bhandara`;

  const description = count
    ? `Find every Bada Mangal bhandara in ${area}, ${cityName} for the 2026 8-Tuesday Jyeshtha season. ${count} ${count === 1 ? "bhandara" : "bhandaras"} mapped with timings, prasad menu, organizer details. Free.`
    : `Looking for a Bada Mangal bhandara in ${area}, ${cityName}? Browse the 2026 directory and list yours free.`;

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
      // A page-level openGraph replaces the root one, so the site card
      // has to be named here or area shares go out with no picture.
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

export default async function AreaPage({ params }: { params: RouteParams }) {
  const { slug } = await params;
  const target = slugToAreaCity(slug);
  if (!target) notFound();
  const { area, city: citySlug } = target;
  const city = getCity(citySlug);

  // Same dedup story as generateMetadata above, share ONE findMany
  // across all 36 area pages during build via the module-level
  // cache, then filter in memory for this area's slice. The upstream
  // query already orders by isSponsored / isVerified / createdAt so
  // the filtered slice keeps that ordering for free.
  const all = await getAllApprovedBhandarasPublic();
  // Upcoming bhandaras lead the page (what you can still visit). The
  // latest season's served bhandaras follow, clearly labelled as past,
  // so off season the page keeps real content that matches its title.
  const { upcoming: bhandaras, past, pastYear } = splitAreaBhandaras(
    all,
    area,
    citySlug,
  );
  // "Earlier this season" while that season is still running, "From the
  // 2026 season" once it is over.
  const pastIsThisSeason =
    pastYear === istTodayIso().slice(0, 4) && !isBadaMangalSeasonOver();

  // Pick 2-3 adjacent areas for cross-linking. Trivial heuristic:
  // the 2 areas immediately before and after this one in the
  // alphabetic AREAS list. Good-enough for V1; can be replaced by
  // a real geographic-adjacency map later.
  const cityAreas = areasFor(citySlug);
  const ix = cityAreas.indexOf(area);
  const adjacent: string[] = [];
  if (ix > 0) adjacent.push(cityAreas[ix - 1]!);
  if (ix < cityAreas.length - 1) adjacent.push(cityAreas[ix + 1]!);
  if (ix > 1 && adjacent.length < 3) adjacent.push(cityAreas[ix - 2]!);

  const breadcrumbs = breadcrumbSchema([
    { name: "Home", path: "/" },
    { name: "Areas", path: "/area" },
    { name: area, path: `/area/${slug}` },
  ]);

  const faqSchema = faqPageSchema([
    {
      q: `How many Bada Mangal bhandaras are in ${area}, ${city.name}?`,
      a: bhandaras.length
        ? `${bhandaras.length} ${bhandaras.length === 1 ? "bhandara is" : "bhandaras are"} currently listed in ${area} for the 2026 Bada Mangal season. The list is community-sourced and grows as the season progresses.`
        : past.length
          ? `${past.length} ${past.length === 1 ? "bhandara was" : "bhandaras were"} listed in ${area} for the ${pastYear} Bada Mangal season. The list is community-sourced; bhandaras for the next season appear here as organisers add them.`
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
    name: `Bada Mangal Bhandaras in ${area}, ${city.name} 2026`,
    itemListElement: [...bhandaras, ...past].map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/bhandara/${b.slug}`,
      name: b.name,
    })),
  };

  // This area's bhandaras on the painted Lucknow plate (same projection
  // as the homepage map), for the hero art. Server side, static HTML.
  const painted = placeOnPaintedMap(
    [...bhandaras, ...past].map((b) => ({ id: b.id, lat: b.lat, lng: b.lng })),
    all,
  );

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
        past={past}
        pastYear={pastYear}
        pastIsThisSeason={pastIsThisSeason}
        adjacent={adjacent}
        mapPins={painted.pins}
        mapLabels={painted.labels}
      />
    </>
  );
}
