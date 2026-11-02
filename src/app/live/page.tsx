import type { Metadata } from "next";
import LivePageView, { type PastPost } from "@/components/LivePageView";
import { prisma } from "@/lib/db";
import { localised, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { stripBotProvenance } from "@/lib/sanitize";
import { cleanName } from "@/lib/display-name";
import { isHiddenPublicPhoto, isPoliticalText, publicCaption } from "@/lib/public-caption";
import {
  SEASONS,
  istIso,
  istMidnight,
  lastCompletedSeason,
} from "@/lib/season";

// ISR. Previously force-dynamic because the page read `?bhandara=<slug>`
// from searchParams on the server to pre-filter the feed, that gave
// every click on a filter pill a Netlify Function cold-start. The
// filter now lives inside <LiveFeedTimeline />, which reads it from
// window.location.search on mount and updates as the user clicks
// pills. Server fetches the full active-spot set; the client filters.
//
// 30s revalidate keeps the first-paint feed reasonably fresh; the
// in-page poll (every 8s) is what actually drives "real time", this
// is just the initial server snapshot.
export const revalidate = 30;

export const metadata: Metadata = {
  title: { absolute: "Live from the bhandara, Bada Mangal Lucknow today · BadaMangal" },
  description:
    "Real-time photos and updates from Bada Mangal bhandaras across Lucknow. See what's serving right now, where the crowds are, and follow the city's seva live.",
  alternates: localised("/live"),
  openGraph: {
    images: [DEFAULT_OG_IMAGE],
    title: "Live from Lucknow's Bada Mangal bhandaras · BadaMangal",
    description:
      "Photos and updates from devotees across the city, refreshed in real time. Follow the seva live.",
    type: "website",
    locale: "hi_IN",
    alternateLocale: "en_IN",
  },
};

export default async function LivePage() {
  // Page is locale-agnostic on the server, every text-bearing block
  // (LiveHero, LiveFeedTimeline empty state, post card chrome) is a
  // client component that reads the visitor's bm_lang cookie via the
  // LocaleProvider context, so the Hindi toggle swaps every label
  // instantly without re-fetching the page.

  // Spots-only feed + a total-count query. The count is rendered in
  // the LiveHero pill ("60 live right now") and is intentionally
  // independent of the feed `take` so the hero stays truthful even
  // when the feed itself is capped for wire-size reasons. Run in
  // parallel so the additional count query doesn't add to the
  // critical-path latency of the SSR.
  const now = new Date();
  const [spotRecords, liveCount] = await Promise.all([
    prisma.spot.findMany({
      where: {
        status: "APPROVED",
        expiresAt: { gt: now },
        // No lat/lng filter here. /live renders photo cards with
        // captions, there's no map on this page, so coordless
        // bot-ingested spots ("0,0" pending admin geocode) belong
        // in the feed exactly like any other live photo. The
        // Africa-pin guard lives only in page.tsx (homepage
        // MapBoard) where coords actually plant a marker. Keeping
        // it in sync with /api/feed (which also doesn't filter
        // 0,0) was the missing piece: SSR was dropping fresh
        // coordless spots, then the 8s client poll added them back.
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      // Explicit select so the spotter's reporterName is never read
      // for this public page.
      select: {
        id: true,
        lat: true,
        lng: true,
        caption: true,
        photoUrl: true,
        extraPhotoUrls: true,
        language: true,
        createdAt: true,
        bhandara: {
          select: { slug: true, name: true, nameHi: true, lat: true, lng: true },
        },
      },
    }),
    prisma.spot.count({
      where: {
        status: "APPROVED",
        expiresAt: { gt: now },
      },
    }),
  ]);

  const spots = spotRecords.map((s) => {
    // Multi-photo: primary first, then extras (Spot.extraPhotoUrls).
    // Defensive JSON.parse. The LiveFeedTimeline card uses this for
    // its in-card carousel; falls back gracefully to [photoUrl] when
    // empty.
    let extras: string[] = [];
    try {
      const parsed = JSON.parse(s.extraPhotoUrls || "[]") as unknown;
      if (Array.isArray(parsed)) {
        extras = parsed.filter(
          (u): u is string => typeof u === "string" && u.length > 0,
        );
      }
    } catch {
      extras = [];
    }
    return {
    id: `spot:${s.id}`,
    bhandaraSlug: s.bhandara?.slug ?? null,
    bhandaraName: cleanName(s.bhandara?.name),
    bhandaraLat: s.bhandara?.lat ?? s.lat,
    bhandaraLng: s.bhandara?.lng ?? s.lng,
    // Neutral label only, never the spotter's name (Founder's ruling,
    // 1 Nov 2026).
    authorName: "Spotter",
    // Strip [bot:whatsapp …] tag, public live feed must show prose
    // only. See lib/sanitize.ts.
    text: stripBotProvenance(s.caption) || null,
    photoUrl: s.photoUrl,
    photoUrls: s.photoUrl ? [s.photoUrl, ...extras] : extras,
    language: s.language,
    createdAt: s.createdAt.toISOString(),
    };
  });

  // Founder's rule: no politician pamphlets (src/lib/public-caption.ts).
  const feed = spots
    .filter((p) => !isHiddenPublicPhoto(p.id.replace(/^spot:/, ""), p.photoUrl))
    .map((p) => ({ ...p, photoUrls: p.photoUrls.filter((u) => !isHiddenPublicPhoto(null, u)) }))
    .slice(0, 50);

  // For the "filter by bhandara" pill list, surface every approved
  // bhandara that has at least one currently-live spot tied to it.
  const bhandarasWithActivity = await prisma.bhandara.findMany({
    where: {
      status: "APPROVED",
      spots: {
        some: { status: "APPROVED", expiresAt: { gt: new Date() } },
      },
    },
    orderBy: { name: "asc" },
    select: { slug: true, name: true, nameHi: true },
    take: 40,
  });

  // Off season (nothing live): the last Tuesday of the latest finished
  // season, as Lucknow posted it, so the quiet page still shows the
  // seva. Photos only, no names, no AI vision captions, nothing
  // political (Founder's rules).
  let pastDay: string | null = null;
  let pastPosts: PastPost[] = [];
  let pastDayCount = 0;
  const done = liveCount === 0 ? lastCompletedSeason(now) : null;
  if (done) {
    pastDay = done.tuesdays[done.tuesdays.length - 1] ?? null;
    if (pastDay) {
      const from = new Date(istMidnight(pastDay));
      const to = new Date(istMidnight(pastDay) + 24 * 60 * 60 * 1000);
      const dayWhere = {
        status: "APPROVED",
        photoUrl: { not: null },
        createdAt: { gte: from, lt: to },
      };
      const [rows, count] = await Promise.all([
        prisma.spot.findMany({
          where: dayWhere,
          orderBy: { createdAt: "desc" },
          take: 300,
          select: {
            id: true,
            caption: true,
            photoUrl: true,
            area: true,
            createdAt: true,
            bhandara: { select: { slug: true, name: true, nameHi: true, area: true } },
          },
        }),
        prisma.spot.count({ where: dayWhere }),
      ]);
      pastDayCount = count;
      pastPosts = rows
        .filter(
          (r) =>
            r.photoUrl &&
            !isHiddenPublicPhoto(r.id, r.photoUrl) &&
            !isPoliticalText(r.caption) &&
            !isPoliticalText(r.bhandara?.name) &&
            !isPoliticalText(r.bhandara?.nameHi),
        )
        // Twelve moments spread across the day, morning to night, so
        // the day reads as it unfolded.
        .reverse()
        .filter((_, i, all) => all.length <= 12 || i % Math.ceil(all.length / 12) === 0)
        .slice(0, 12)
        .map((r) => ({
          id: r.id,
          photoUrl: r.photoUrl as string,
          text: publicCaption(stripBotProvenance(r.caption)),
          area: r.area ?? r.bhandara?.area ?? null,
          bhandaraSlug: r.bhandara?.slug ?? null,
          bhandaraName: cleanName(r.bhandara?.name) || null,
          bhandaraNameHi: r.bhandara?.nameHi ? cleanName(r.bhandara.nameHi) : null,
          createdAt: r.createdAt.toISOString(),
        }));
    }
  }

  // The next season's Tuesdays, for the countdown.
  const today = istIso(now);
  const nextSeason = SEASONS.find((s) => s.startISO > today) ?? null;

  return (
    <LivePageView
      liveCount={liveCount}
      initial={feed}
      bhandaras={bhandarasWithActivity.map((b) => ({
        slug: b.slug,
        name: b.name,
      }))}
      pastDay={pastDay}
      pastDayCount={pastDayCount}
      pastPosts={pastPosts}
      nextTuesdays={nextSeason ? [...nextSeason.tuesdays] : []}
    />
  );
}
