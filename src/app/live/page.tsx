import type { Metadata } from "next";
import LiveFeedTimeline from "@/components/LiveFeedTimeline";
import LiveHero from "@/components/LiveHero";
import { prisma } from "@/lib/db";
import { localised } from "@/lib/seo";
import { stripBotProvenance } from "@/lib/sanitize";

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
  title: "Live from the bhandara, Bada Mangal Lucknow today · BadaMangal",
  description:
    "Real-time photos and updates from Bada Mangal bhandaras across Lucknow. See what's serving right now, where the crowds are, and follow the city's seva live.",
  alternates: localised("/live"),
  openGraph: {
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
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
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

  const spots = spotRecords.map((s) => ({
    id: `spot:${s.id}`,
    bhandaraSlug: s.bhandara?.slug ?? null,
    bhandaraName: s.bhandara?.name ?? null,
    bhandaraLat: s.bhandara?.lat ?? s.lat,
    bhandaraLng: s.bhandara?.lng ?? s.lng,
    authorName: s.reporterName?.trim() || "Spotter",
    // Strip [bot:whatsapp …] tag, public live feed must show prose
    // only. See lib/sanitize.ts.
    text: stripBotProvenance(s.caption) || null,
    photoUrl: s.photoUrl,
    language: s.language,
    createdAt: s.createdAt.toISOString(),
  }));

  const feed = spots.slice(0, 50);

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

  return (
    <div className="relative">
      <LiveHero liveCount={liveCount} />

      <LiveFeedTimeline
        initial={feed}
        bhandaras={bhandarasWithActivity.map((b) => ({
          slug: b.slug,
          name: b.name,
        }))}
      />
    </div>
  );
}
