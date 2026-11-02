import type { Metadata } from "next";
import ArchiveTabs from "@/components/ArchiveTabs";
import {
  PUBLIC_BHANDARA_LIST_SELECT,
  prisma,
  toPublicBhandaraListItem,
} from "@/lib/db";
import { hasUpcomingDate } from "@/lib/dates";
import { localised, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { stripBotProvenance } from "@/lib/sanitize";
import { cleanName } from "@/lib/display-name";
import { isHiddenPublicPhoto, isPoliticalText, publicCaption } from "@/lib/public-caption";

// ISR. The archive is curated history (past Tuesdays, expired spots) so
// it doesn't need to be live, half-hour refresh is plenty. The page
// itself is cookie-free / searchParam-free so it caches on the edge.
export const revalidate = 1800;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";

export const metadata: Metadata = {
  title: { absolute: "Past Bhandaras of Lucknow · BadaMangal" },
  description:
    "Search every Bada Mangal bhandara that has already served this season, both organiser-listed venues and crowd-sourced spotted sightings. The full record of Lucknow's seva, kept publicly so the city's memory doesn't fade after Tuesday.",
  alternates: localised("/archive"),
  openGraph: {
    images: [DEFAULT_OG_IMAGE],
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
    // No organiser phone, WhatsApp or UPI columns: this is a public
    // list (Founder's ruling, 1 Nov 2026).
    prisma.bhandara.findMany({
      where: { status: "APPROVED" },
      orderBy: [{ createdAt: "desc" }],
      take: 400,
      select: PUBLIC_BHANDARA_LIST_SELECT,
    }),
    prisma.spot.findMany({
      where: {
        status: "APPROVED",
        expiresAt: { lte: new Date() },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      // Explicit select so the spotter's reporterName is never read
      // for this public page.
      select: {
        id: true,
        photoUrl: true,
        caption: true,
        area: true,
        address: true,
        createdAt: true,
        bhandara: { select: { slug: true, name: true, nameHi: true } },
      },
    }),
  ]);

  // Past listed = approved bhandaras whose every Tuesday date has passed.
  // We compute this in JS because tuesdayDates is a string[] column,
  // SQL filtering would be awkward for that shape.
  // The public list shape (no phone, WhatsApp or UPI), trimmed of the
  // long text the rows never show so the static payload stays small.
  const listedPast = allListedRecords
    .map(toPublicBhandaraListItem)
    .filter((b) => !hasUpcomingDate(b))
    .map((b) => ({
      ...b,
      description: undefined,
      descriptionHi: undefined,
      menu: [],
      menuHi: [],
    }));

  const spottedPast = expiredSpotRecords
    .filter(
      (s) =>
        !isHiddenPublicPhoto(s.id, s.photoUrl) &&
        !isPoliticalText(s.caption) &&
        !isPoliticalText(s.bhandara?.name) &&
        !isPoliticalText(s.bhandara?.nameHi),
    )
    .map((s) => ({
    id: s.id,
    photoUrl: s.photoUrl,
    // Strip the [bot:whatsapp …] provenance tag, internal metadata
    // that should never reach a public surface. See lib/sanitize.ts.
    // Only the spotter's own words, never an AI vision caption.
    caption: publicCaption(stripBotProvenance(s.caption)),
    area: s.area,
    address: s.address,
    // Spotter names are never shown publicly (Founder's ruling,
    // 1 Nov 2026); the card shows the neutral "Spotter" label.
    reporterName: null,
    createdAt: s.createdAt.toISOString(),
    bhandaraSlug: s.bhandara?.slug ?? null,
    bhandaraName: cleanName(s.bhandara?.name),
    bhandaraNameHi: s.bhandara?.nameHi ?? null,
  }));

  return <ArchiveTabs listed={listedPast} spotted={spottedPast} />;
}
