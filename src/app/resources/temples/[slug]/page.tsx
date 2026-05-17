import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TEMPLES, TEMPLE_BY_SLUG, type Temple } from "@/content/temples";
import { prisma, toBhandara } from "@/lib/db";
import TempleDetailView from "@/components/TempleDetailView";

// ISR, static prerender per temple (see generateStaticParams below)
// plus an hourly revalidate for nearby-bhandara freshness.
export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";

export function generateStaticParams() {
  return TEMPLES.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const temple = TEMPLE_BY_SLUG[slug];
  if (!temple) return {};
  return {
    title: `${temple.name.en} · Hanuman temple, Lucknow · BadaMangal`,
    description: temple.history.en.slice(0, 155),
    alternates: {
      canonical: `/resources/temples/${slug}`,
      languages: {
        "hi-IN": `/resources/temples/${slug}`,
        "en-IN": `/resources/temples/${slug}?lang=en`,
      },
    },
    openGraph: {
      title: `${temple.name.en} · Lucknow`,
      description: temple.history.en.slice(0, 155),
      url: `${SITE_URL}/resources/temples/${slug}`,
      type: "article",
      siteName: "BadaMangal",
    },
  };
}

type Params = Promise<{ slug: string }>;

export default async function TemplePage({ params }: { params: Params }) {
  const { slug } = await params;
  const temple = TEMPLE_BY_SLUG[slug];
  if (!temple) notFound();

  // Pull a few nearby bhandaras (same area, approved).
  const nearbyRecords = await prisma.bhandara.findMany({
    where: { status: "APPROVED", area: temple.area },
    orderBy: [{ isSponsored: "desc" }, { createdAt: "desc" }],
    take: 4,
  });
  const nearby = nearbyRecords.map(toBhandara);

  // PlaceOfWorship JSON-LD here in the server wrapper, locale-agnostic
  // structured data for search engines. All visible labels live in
  // <TempleDetailView /> (client) so the Hindi toggle swaps every
  // field label / CTA / heading instantly.
  const placeSchema = {
    "@context": "https://schema.org",
    "@type": "PlaceOfWorship",
    name: temple.name.en,
    alternateName: [temple.altName, temple.name.hi].filter(Boolean),
    address: {
      "@type": "PostalAddress",
      streetAddress: temple.address.en,
      addressLocality: "Lucknow",
      addressRegion: "Uttar Pradesh",
      addressCountry: "IN",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: temple.lat,
      longitude: temple.lng,
    },
    openingHours: temple.timings.en,
    description: temple.history.en,
    isAccessibleForFree: true,
    url: `${SITE_URL}/resources/temples/${slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeSchema) }}
      />
      <TempleDetailView temple={temple} nearby={nearby} />
    </>
  );
}

// Re-export Temple type to satisfy isolatedModules in some toolchains
export type { Temple };
