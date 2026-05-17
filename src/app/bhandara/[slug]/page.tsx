import { notFound } from "next/navigation";
import type { Metadata } from "next";
import BhandaraDetailView from "@/components/BhandaraDetailView";
import { strings } from "@/content/strings";
import { prisma, toBhandara } from "@/lib/db";
import {
  bhandaraEventSchema,
  bhandaraLocalBusinessSchema,
  breadcrumbSchema,
  localised,
  organizationSchema,
  SITE_URL,
} from "@/lib/seo";

// ISR. Was force-dynamic, every visit cold-started a Netlify Function
// (3-4s lag when clicking a bhandara from the homepage). Now each slug
// pre-renders to static HTML at build time via generateStaticParams,
// and revalidates every 5 minutes so edits in /admin show up quickly.
// New bhandaras added after the build are caught by Next's on-demand
// generation: the first request renders + caches; everyone after gets
// the cached HTML.
export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const rows = await prisma.bhandara.findMany({
    where: { status: "APPROVED" },
    select: { slug: true },
  });
  return rows.map((r) => ({ slug: r.slug }));
}

type RouteParams = Promise<{ slug: string }>;

function format12h(time: string): string {
  if (!time) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min)) return "";
  const period = h >= 12 ? "PM" : "AM";
  const display = ((h + 11) % 12) + 1;
  return `${display}:${String(min).padStart(2, "0")} ${period}`;
}

export async function generateMetadata({
  params,
}: {
  params: RouteParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const record = await prisma.bhandara.findUnique({ where: { slug } });
  if (!record) return { title: "Bhandara not found" };

  const time = `${format12h(record.timeStart)}${record.timeEnd ? `–${format12h(record.timeEnd)}` : ""}`;

  // Pick the most-imminent serving date for the title, if a future
  // Tuesday is set, surface that ("May 19" creates urgency in the
  // SERP snippet much better than the static season name does).
  // Falls back to the first listed date if none are future, and
  // to no date string at all if the list is empty.
  let dateForTitle = "";
  try {
    const dates: string[] = JSON.parse(record.tuesdayDates ?? "[]");
    if (Array.isArray(dates) && dates.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const upcoming = dates.filter((d) => d >= today).sort();
      const pick = upcoming[0] ?? dates[dates.length - 1];
      if (pick && /^\d{4}-\d{2}-\d{2}$/.test(pick)) {
        const [y, m, d] = pick.split("-").map(Number);
        const months = [
          "Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ];
        if (m && d && y && months[m - 1]) {
          dateForTitle = `${d} ${months[m - 1]} ${y}`;
        }
      }
    }
  } catch {
    /* tuesdayDates is malformed JSON on a legacy row, skip the
       date in the title, keep the rest of the metadata correct. */
  }

  // SEO-tuned title, re-tuned after GSC data showed bhandara
  // pages were getting impressions but zero clicks. New formula:
  //   "<Name>, <Area> · Free Prasad <Date> · Bada Mangal Lucknow"
  //
  // Why each piece is here:
  //   • Name + Area at start, matches "<organiser> bhandara
  //     <area>" + "bada mangal <area>" long-tail queries.
  //   • "Free Prasad", the question every searcher is implicitly
  //     asking. High-intent, search-intent-perfect, and uncommon
  //     in competitor titles → CTR lift.
  //   • Date right after, answers "when?" before they click,
  //     creates urgency for "today" / "this Tuesday" searches.
  //   • Brand at end, softens, signals trustworthy directory.
  const titleHead = `${record.name}, ${record.area}`;
  const titleMid = dateForTitle
    ? `Free Prasad ${dateForTitle}`
    : "Free Prasad";
  const title = `${titleHead} · ${titleMid} · Bada Mangal Lucknow`;

  // SEO-tuned description: lead with "Free" (high-intent qualifier),
  // area early, full address + organiser for long-tail uniqueness.
  // Keeping under 160 chars where possible, Google truncates at
  // ~155-160 in SERP previews.
  const description =
    record.description ??
    `Free Bada Mangal bhandara in ${record.area}, Lucknow. ${record.organizerName}'s seva at ${record.address}. Serving ${time}${dateForTitle ? ` on ${dateForTitle}` : ""}.`;
  const ogImage = record.photoUrl ?? `${SITE_URL}/illustrations/hanuman-sitting.webp`;
  const ogAlt = `${record.name} bhandara in ${record.area}, Lucknow`;

  return {
    title,
    description,
    alternates: localised(`/bhandara/${slug}`),
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/bhandara/${slug}`,
      siteName: "BadaMangal",
      type: "article",
      locale: "hi_IN",
      alternateLocale: "en_IN",
      images: [{ url: ogImage, width: 1200, height: 630, alt: ogAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function BhandaraDetailPage({
  params,
}: {
  params: RouteParams;
}) {
  const { slug } = await params;

  const record = await prisma.bhandara.findUnique({ where: { slug } });
  if (!record || record.status !== "APPROVED") notFound();

  const b = toBhandara(record);
  const otherRecords = await prisma.bhandara.findMany({
    where: { status: "APPROVED", area: b.area, NOT: { id: b.id } },
    take: 3,
    orderBy: [{ isSponsored: "desc" }, { createdAt: "asc" }],
  });
  const others = otherRecords.map(toBhandara);

  // Locale-agnostic strings used in the JSON-LD breadcrumb. We never
  // ship the breadcrumb's label to a visitor, it's pure SEO, so
  // English is the right default here.
  const en = strings.en;
  const areaLabel = en.areas[b.area] ?? b.area;

  // JSON-LD bundle: one FoodEvent per Tuesday this bhandara serves on,
  // plus a BreadcrumbList so the SERP shows Home › Bhandara › Name,
  // plus Organization for publisher attribution. The Event entries are
  // what unlock the Google Events carousel for "bada mangal lucknow".
  const jsonLdBlocks: object[] = [
    organizationSchema(),
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: en.cards.sectionHeading, path: "/#map" },
      { name: b.name, path: `/bhandara/${b.slug}` },
    ]),
    ...bhandaraEventSchema({
      slug: b.slug,
      name: b.name,
      description: b.description ?? null,
      address: b.address,
      area: areaLabel,
      lat: b.lat,
      lng: b.lng,
      tuesdayDates: b.tuesdayDates,

      timeStart: b.timeStart,
      timeEnd: b.timeEnd,
      organizerName: b.organizerName,
      photoUrl: b.photoUrl ?? null,
    }),
    // LocalBusiness, anchors the bhandara as a "place" entity for
    // Google's Knowledge Panel + Local Pack rankings. Complements
    // the per-Tuesday Event schemas above (Event = "what's happening
    // here on date X"; LocalBusiness = "what is this place").
    bhandaraLocalBusinessSchema({
      slug: b.slug,
      name: b.name,
      description: b.description ?? null,
      address: b.address,
      area: areaLabel,
      lat: b.lat,
      lng: b.lng,
      timeStart: b.timeStart,
      timeEnd: b.timeEnd,
      organizerName: b.organizerName,
      organizerPhone: b.organizerPhone ?? null,
      photoUrl: b.photoUrl ?? null,
    }),
  ];

  return (
    <>
      {/* Preload the LCP image so the browser's request scheduler
          picks it up before any CSS-discovered images. Drops mobile
          LCP by ~300ms in field-test conditions. `as="image"` is
          the spec-correct hint for an <img>. Only emitted when we
          have a photoUrl, without one, the hero falls back to a
          text-only block, no preload needed. */}
      {b.photoUrl ? (
        <link
          rel="preload"
          as="image"
          href={b.photoUrl}
          // Hint to the browser that this is the most important
          // image on the page. Browsers that honor it (Chrome,
          // Edge) start the fetch before the HTML parser even
          // hits the <img>.
          fetchPriority="high"
        />
      ) : null}
      {jsonLdBlocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
      <BhandaraDetailView b={b} others={others} />
    </>
  );
}
