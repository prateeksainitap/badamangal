import type { Metadata } from "next";
import ArchiveTabs from "@/components/ArchiveTabs";
import { prisma, toBhandara } from "@/lib/db";
import { hasUpcomingDate } from "@/lib/dates";
import { localised } from "@/lib/seo";
import { stripBotProvenance } from "@/lib/sanitize";

// ISR. The archive is curated history (past Tuesdays, expired spots) so
// it doesn't need to be live, half-hour refresh is plenty. The page
// itself is cookie-free / searchParam-free so it caches on the edge.
export const revalidate = 1800;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";

export const metadata: Metadata = {
  title: "Past Bhandaras of Lucknow · BadaMangal",
  description:
    "Search every Bada Mangal bhandara that has already served this season, both organiser-listed venues and crowd-sourced spotted sightings. The full record of Lucknow's seva, kept publicly so the city's memory doesn't fade after Tuesday.",
  alternates: localised("/archive"),
  openGraph: {
    title: "Past Bhandaras · BadaMangal Lucknow",
    description:
      "Listed and spotted bhandaras from earlier in the season, searchable, all in one place.",
    url: `${SITE_URL}/archive`,
    type: "website",
    siteName: "BadaMangal",
    locale: "hi_IN",
    alternateLocale: "en_IN",
  },
};

export default async function ArchivePage() {
  // Fetch in parallel, both queries are pure reads with small result sets.
  const [allListedRecords, expiredSpotRecords] = await Promise.all([
    prisma.bhandara.findMany({
      where: { status: "APPROVED" },
      orderBy: [{ createdAt: "desc" }],
      take: 400,
    }),
    prisma.spot.findMany({
      where: {
        status: "APPROVED",
        expiresAt: { lte: new Date() },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        bhandara: { select: { slug: true, name: true, nameHi: true } },
      },
    }),
  ]);

  // Past listed = approved bhandaras whose every Tuesday date has passed.
  // We compute this in JS because tuesdayDates is a string[] column,
  // SQL filtering would be awkward for that shape.
  const listedPast = allListedRecords
    .map(toBhandara)
    .filter((b) => !hasUpcomingDate(b))
    .map((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      nameHi: b.nameHi ?? null,
      area: b.area,
      lat: b.lat,
      lng: b.lng,
      tuesdayDates: b.tuesdayDates,
      timeStart: b.timeStart,
      timeEnd: b.timeEnd ?? null,
      organizerName: b.organizerName,
      photoUrl: b.photoUrl ?? null,
    }));

  const spottedPast = expiredSpotRecords.map((s) => ({
    id: s.id,
    photoUrl: s.photoUrl,
    // Strip the [bot:whatsapp …] provenance tag, internal metadata
    // that should never reach a public surface. See lib/sanitize.ts.
    caption: stripBotProvenance(s.caption) || null,
    area: s.area,
    address: s.address,
    reporterName: s.reporterName,
    createdAt: s.createdAt.toISOString(),
    bhandaraSlug: s.bhandara?.slug ?? null,
    bhandaraName: s.bhandara?.name ?? null,
    bhandaraNameHi: s.bhandara?.nameHi ?? null,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-14">
      <ArchiveTabs listed={listedPast} spotted={spottedPast} />
    </div>
  );
}
