import { prisma } from "@/lib/db";
import { ALL_TUESDAY_ISO } from "@/lib/dates";
import { humanCaption as personLine, publicFirstName } from "@/lib/home-community";
import { stripBotProvenance } from "@/lib/sanitize";
import { cleanName } from "@/lib/display-name";
import { SEASON_2026_HIDE_CAPTION, SEASON_2026_PICKS } from "@/content/season-2026";
import { isHiddenPublicPhoto } from "@/lib/public-caption";

/**
 * Bada Mangal 2026, Tuesday by Tuesday, for the homepage season section.
 * Read only. Counts come straight from the database:
 *  - listed: APPROVED Lucknow bhandaras whose tuesdayDates include the day
 *  - spotted: APPROVED spots created that day (IST)
 *  - photos: every photo (primary and extras) on those spots
 * The photos shown are the hand picked set in src/content/season-2026.ts.
 */

export type SeasonPhoto = {
  id: string;
  url: string;
  /** A line a person wrote, never an AI description. */
  caption: string | null;
  area: string | null;
  firstName: string | null;
  bhandaraSlug: string | null;
  /** "listing": the organiser's own photo (banner, pamphlet), used on a
   *  Tuesday before the community started sharing photos. */
  source?: "spot" | "listing";
};

export type SeasonDay = {
  iso: string;
  /** 1 to 8 */
  ordinal: number;
  listed: number;
  spotted: number;
  photoCount: number;
  photos: SeasonPhoto[];
};

const IST_MS = 5.5 * 60 * 60 * 1000;
const istDay = (d: Date) => new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);

/** The vision bot describes photos in full sentences ("Devotees serving
 *  and receiving food at a Bada Mangal bhandara, with a crowd waiting.").
 *  People write short notes ("Puri sabzi bhandara"). Keep only those. */
const VISION_WORDS =
  /\b(possibly|likely|appears|being served|served (at|in)|gathered|gathers|receiving|devotees|canopy|pandal|a plate of)\b/i;
function humanCaption(raw: string | null | undefined): string | null {
  const t = personLine(stripBotProvenance(raw) ?? null);
  if (!t) return null;
  if (VISION_WORDS.test(t)) return null;
  if (/bada mangal bhandara/i.test(t) && t.length > 30) return null;
  if (/^[A-Z][a-z]+(\s[a-z]+){4,}.*\.$/.test(t)) return null;
  return t;
}

let cache: { at: number; p: Promise<SeasonDay[]> } | null = null;
const TTL_MS = 10 * 60 * 1000;

export function getSeason2026(): Promise<SeasonDay[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.p;
  const p = compute();
  p.catch(() => {
    if (cache?.p === p) cache = null;
  });
  cache = { at: Date.now(), p };
  return p;
}

async function compute(): Promise<SeasonDay[]> {
  const first = new Date(`${ALL_TUESDAY_ISO[0]}T00:00:00+05:30`);
  const last = new Date(`${ALL_TUESDAY_ISO[ALL_TUESDAY_ISO.length - 1]}T23:59:59+05:30`);
  const pickIds = Object.values(SEASON_2026_PICKS).flatMap((ps) => ps.map((p) => p.spotId));

  const [listings, spots, picked] = await Promise.all([
    prisma.bhandara.findMany({
      where: { status: "APPROVED", city: "lucknow" },
      select: { id: true, tuesdayDates: true, photoUrl: true, name: true, area: true, slug: true },
    }),
    prisma.spot.findMany({
      where: { status: "APPROVED", createdAt: { gte: first, lte: last } },
      select: { createdAt: true, photoUrl: true, extraPhotoUrls: true },
    }),
    prisma.spot.findMany({
      where: { id: { in: pickIds }, status: "APPROVED" },
      select: {
        id: true,
        photoUrl: true,
        extraPhotoUrls: true,
        caption: true,
        reporterName: true,
        area: true,
        bhandara: { select: { slug: true, status: true } },
      },
    }),
  ]);

  const listedBy = new Map<string, number>();
  const listingPhotosBy = new Map<string, SeasonPhoto[]>();
  for (const b of listings) {
    let dates: unknown = [];
    try {
      dates = JSON.parse(b.tuesdayDates || "[]");
    } catch {
      /* skip a malformed row */
    }
    if (!Array.isArray(dates)) continue;
    for (const d of new Set(dates.filter((x): x is string => typeof x === "string"))) {
      listedBy.set(d, (listedBy.get(d) ?? 0) + 1);
      if (b.photoUrl) {
        const arr = listingPhotosBy.get(d) ?? [];
        arr.push({
          id: `listing:${b.id}`,
          url: b.photoUrl,
          caption: cleanName(b.name),
          area: b.area?.trim() || null,
          firstName: null,
          bhandaraSlug: b.slug,
          source: "listing",
        });
        listingPhotosBy.set(d, arr);
      }
    }
  }

  const spottedBy = new Map<string, number>();
  const photosBy = new Map<string, number>();
  for (const s of spots) {
    const d = istDay(s.createdAt);
    spottedBy.set(d, (spottedBy.get(d) ?? 0) + 1);
    let extras = 0;
    try {
      const e = JSON.parse(s.extraPhotoUrls || "[]");
      if (Array.isArray(e)) extras = e.filter((x) => typeof x === "string" && x).length;
    } catch {
      /* keep 0 */
    }
    const n = (s.photoUrl ? 1 : 0) + extras;
    if (n) photosBy.set(d, (photosBy.get(d) ?? 0) + n);
  }

  const byId = new Map(picked.map((s) => [s.id, s]));
  return ALL_TUESDAY_ISO.map((iso, i) => {
    const photos: SeasonPhoto[] = [];
    for (const pick of SEASON_2026_PICKS[iso] ?? []) {
      const s = byId.get(pick.spotId);
      if (!s) continue;
      let urls: string[] = [];
      try {
        const e = JSON.parse(s.extraPhotoUrls || "[]");
        if (Array.isArray(e)) urls = e.filter((x): x is string => typeof x === "string");
      } catch {
        /* primary only */
      }
      if (s.photoUrl !== pick.url && !urls.includes(pick.url)) continue;
      if (isHiddenPublicPhoto(s.id, pick.url)) continue;
      photos.push({
        id: `${s.id}:${photos.length}`,
        url: pick.url,
        caption: SEASON_2026_HIDE_CAPTION.includes(s.id) ? null : humanCaption(s.caption),
        area: s.area?.trim() || null,
        firstName: publicFirstName(s.reporterName),
        bhandaraSlug: s.bhandara?.status === "APPROVED" ? s.bhandara.slug : null,
      });
    }
    // No community photos that Tuesday (5 May, before the site was
    // live): show the organisers' own photos of bhandaras held that day.
    if (!photos.length) photos.push(...(listingPhotosBy.get(iso) ?? []).slice(0, 5));
    return {
      iso,
      ordinal: i + 1,
      listed: listedBy.get(iso) ?? 0,
      spotted: spottedBy.get(iso) ?? 0,
      photoCount: photosBy.get(iso) ?? 0,
      photos,
    };
  });
}
