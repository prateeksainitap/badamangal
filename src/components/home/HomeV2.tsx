import "../v2/tokens.css";
import "./home-v2.css";
import type { HomepageData } from "@/lib/home-data";
import { stripBotProvenance } from "@/lib/sanitize";
import { buildPaintedMap, groupByLocality, type MapPoint } from "@/lib/home-map";
import { buildThread, pickHeroPrints, type ChatterLike } from "@/lib/home-community";
import { anekLatin } from "./fonts";
import BenedictionSection from "./BenedictionSection";
import CommunitySection from "./CommunitySection";
import CompanionSection from "./CompanionSection";
import HeroV2 from "./HeroV2";
import HomeFaqV2 from "./HomeFaqV2";
import HomeMotion from "./HomeMotion";
import HomeSplash, { SPLASH_BOOT } from "./HomeSplash";
import PaintedMapSection from "./PaintedMapSection";
import Season2026Section from "./Season2026Section";
import SeasonMala from "./SeasonMala";
import TodayBhandaras from "./TodayBhandaras";
import SevaSection from "./SevaSection";
import TraditionSection from "./TraditionSection";
import VoicesSection from "./VoicesSection";
import { cleanName } from "@/lib/display-name";
import { SEASON_2026 } from "@/lib/season";

/** True when a timestamp falls inside the 2026 season window (IST
 *  dates). Off season the page tells the 2026 story, so it keeps only
 *  2026 spots and chat; this is deliberately 2026, not "the season". */
function inSeason2026(at: Date | string): boolean {
  const iso = new Date(at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return iso >= SEASON_2026.startISO && iso <= SEASON_2026.endISO;
}

/**
 * The v2 homepage, one component tree fed by the shared homepage loader
 * (src/lib/home-data.ts). Everything text-bearing is server rendered;
 * client islands only add motion, audio, the live-map switch, the FAQ
 * toggle and the splash.
 */
export default function HomeV2({ data, now }: { data: HomepageData; now?: Date }) {
  const {
    displayListings,
    isPastSeason,
    liveSpots,
    mentionsInitial,
    communityCounterRows,
    threadMentionRows,
  } = data;

  const count = (id: string) => communityCounterRows.find((r) => r.id === id)?.count ?? 0;
  const communityTotal = count("community_total_members");
  const groupCounts = Object.fromEntries(
    communityCounterRows
      .filter((r) => r.id.startsWith("community_count_"))
      .map((r) => [r.id.replace("community_count_", ""), r.count]),
  );

  // In season: what is on the map right now (listed + live spots).
  // Off season the page tells 2026 with one set of numbers: the season
  // total (every listed plus every spotted bhandara), the same figure
  // the season section and the old stats panel show.
  const seasonTotal = data.stats.bhandarasTotal;
  // Off season, spots from after the season (July to now) are not part
  // of the 2026 story, so photos, pins and chat use the season's spots.
  // A spot with no bhandara page links to the gallery: /live only holds
  // spots from the last day.
  const seasonSpots = isPastSeason
    ? data.spotRecords.filter((s) => inSeason2026(s.createdAt))
    : [];
  const spotHref = (id: string) => (isPastSeason ? "/gallery" : `/live#spot:${id}`);
  const totalOnMap =
    isPastSeason && seasonTotal > 0 ? seasonTotal : displayListings.length + liveSpots.length;
  // Off season the painted map carries the whole season's spots, not
  // just the latest few, so the gadas match that total. Coordless spots
  // come too: buildPaintedMap stands one around its locality when its
  // text names one ("around Aliganj") and leaves the rest off.
  const mapSpots = isPastSeason
    ? seasonSpots.map((s) => ({
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        area: s.area,
        photoUrl: s.photoUrl,
        bhandaraSlug: s.bhandara?.slug ?? null,
        bhandaraName: cleanName(s.bhandara?.name),
        place: [s.address, stripBotProvenance(s.caption)].filter(Boolean).join(" "),
      }))
    : liveSpots.map((s) => ({ ...s, place: [s.address, s.caption].filter(Boolean).join(" ") }));

  // Hero prints: real recent spots with photos, first name and caption.
  const spotLikes = isPastSeason
    ? seasonSpots.map((s) => ({
        id: s.id,
        photoUrl: s.photoUrl,
        caption: stripBotProvenance(s.caption) || null,
        // Spotter names never appear publicly (Founder's ruling, 1 Nov 2026).
        reporterName: null,
        area: s.area,
        createdAt: s.createdAt.toISOString(),
        bhandaraSlug: s.bhandara?.slug ?? null,
      }))
    : liveSpots.map((s) => ({
        id: s.id,
        photoUrl: s.photoUrl,
        caption: s.caption,
        reporterName: null,
        area: s.area,
        createdAt: s.createdAt,
        bhandaraSlug: s.bhandaraSlug,
      }));
  const prints = pickHeroPrints(spotLikes, 4).map((p) =>
    p.href.startsWith("/live#") ? { ...p, href: spotHref(p.id) } : p,
  );
  const used = new Set(prints.map((p) => p.photoUrl));
  const faces = spotLikes
    .map((s) => s.photoUrl)
    .filter((u): u is string => !!u && !used.has(u))
    .filter((u, i, arr) => arr.indexOf(u) === i)
    .slice(0, 3);

  // Community thread: live chat rows first, then last season's archive.
  const chatRows: ChatterLike[] = [
    ...mentionsInitial.map((m) => ({
      id: m.id,
      kind: m.kind,
      text: m.text,
      photoUrl: m.photoUrl,
      locationLabel: m.locationLabel,
      senderName: m.senderName,
      createdAt: m.createdAt,
      bhandaraSlug: m.bhandaraSlug,
      intent: m.intent,
    })),
    ...threadMentionRows
      .filter((m) => !isPastSeason || inSeason2026(m.createdAt))
      .map((m) => ({
      id: `mention:${m.id}`,
      kind: "mention" as const,
      text: m.cleanedText ?? m.originalText.split("\n\n[bot:")[0] ?? "",
      photoUrl: null,
      locationLabel: m.locationLabel,
      senderName: null,
      createdAt: m.createdAt.toISOString(),
      bhandaraSlug: null,
      intent: m.intent,
    })),
    // Bot-ingested photo spots, in case the live window had none.
    ...(isPastSeason ? seasonSpots : data.spotRecords)
      .filter((s) => s.photoUrl && (s.caption ?? "").includes("[bot:"))
      .slice(0, 40)
      .map((s) => ({
        id: `spot:${s.id}`,
        kind: "spot" as const,
        text: stripBotProvenance(s.caption) || "",
        photoUrl: s.photoUrl,
        locationLabel: s.area,
        senderName: null,
        createdAt: s.createdAt.toISOString(),
        bhandaraSlug: s.bhandara?.slug ?? null,
      })),
  ];
  // Five messages (two with photos) so the chat panel stays near the
  // height of the left column; "Open the live feed" is the way to more.
  const thread = buildThread(chatRows, { maxPhotos: 2, maxTexts: 3, excludePhotos: used });

  // Painted map: every listed bhandara plus spots that carry real coords.
  const points: MapPoint[] = [
    ...displayListings.map((b) => ({
      id: b.id,
      lat: b.lat,
      lng: b.lng,
      href: `/bhandara/${b.slug}`,
      label: b.name,
      area: b.area || null,
      kind: "listed" as const,
      photo: b.photoUrl ?? null,
    })),
    ...mapSpots.map((s) => ({
      id: `spot:${s.id}`,
      lat: s.lat,
      lng: s.lng,
      href: s.bhandaraSlug ? `/bhandara/${s.bhandaraSlug}` : spotHref(s.id),
      label: s.bhandaraName ?? "A bhandara spotted by a neighbour",
      area: s.area,
      kind: "spotted" as const,
      photo: s.photoUrl ?? null,
      place: s.place,
    })),
  ];
  const model = buildPaintedMap(points);
  const groups = groupByLocality(displayListings);

  return (
    <div className={`bmh ${anekLatin.variable}`} suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: SPLASH_BOOT }} />
      <HomeSplash />
      <HomeMotion />
      <HeroV2
        prints={prints}
        faces={faces}
        communityTotal={communityTotal}
        totalOnMap={totalOnMap}
        isPastSeason={isPastSeason}
      />
      {/* In season, on a day with bhandaras listed: today's list first. */}
      <TodayBhandaras listings={displayListings} now={now} />
      <SeasonMala now={now} />
      <PaintedMapSection
        model={model}
        groups={groups}
        totalCount={totalOnMap}
        stage={{
          // The live map's listings and spots load on demand from
          // /api/home/map (see MapStage); the totals stay here.
          communityMembers: communityTotal,
          totalListed:
            isPastSeason && seasonTotal > 0 ? data.stats.bhandarasListed : displayListings.length,
          totalSpotted:
            isPastSeason && seasonTotal > 0 ? data.stats.bhandarasSpotted : liveSpots.length,
          isPastSeason,
        }}
      />
      {/* Off season the 2026 story leads; in season the live chat does. */}
      {isPastSeason ? <Season2026Section stats={data.stats} /> : null}
      <CommunitySection
        thread={thread}
        communityTotal={communityTotal}
        groupCounts={groupCounts}
        isPastSeason={isPastSeason}
      />
      {isPastSeason ? null : <Season2026Section stats={data.stats} />}
      <TraditionSection />
      <CompanionSection />
      <VoicesSection />
      <SevaSection />
      <HomeFaqV2 />
      <BenedictionSection />
    </div>
  );
}
