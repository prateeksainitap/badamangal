import type { Metadata } from "next";
import {
  SITE_URL,
  eventSchemaBatch,
  faqSchema,
  localised,
  organizationSchema,
  websiteSchema,
} from "@/lib/seo";
import { ALL_TUESDAY_ISO } from "@/lib/dates";
import { stripBotProvenance } from "@/lib/sanitize";
import AreaIndexGrid from "@/components/AreaIndexGrid";
import BhandaraCardsSection from "@/components/BhandaraCardsSection";
import FeaturedBhandaras from "@/components/FeaturedBhandaras";
import OrganisePromo from "@/components/OrganisePromo";
import VolunteerPromo from "@/components/VolunteerPromo";
import HomeFAQ from "@/components/HomeFAQ";
import HappeningNow from "@/components/HappeningNow";
import HomeCardsEmpty from "@/components/HomeCardsEmpty";
// MediaCoverage re-mounted 22 May once Dainik Jagran ran a story.
// Currently displays only Dainik Jagran's logo, see OUTLETS array
// in src/components/MediaCoverage.tsx. Times of India + Navbharat
// Times entries are parked commented-out, uncomment them there as
// each outlet's piece runs.
import MediaCoverage from "@/components/MediaCoverage";
import HomeTestimonials from "@/components/HomeTestimonials";
import HomeClosingBenediction from "@/components/HomeClosingBenediction";
import HomeHero from "@/components/HomeHero";
import HomeHistoryTeaser from "@/components/HomeHistoryTeaser";
import HomepageGallery, { type GalleryItem } from "@/components/HomepageGallery";
// PamphletPromo intentionally not imported, the homepage section
// for it is commented out below during the soft-launch phase. See the
// matching comment near the FAMOUS BHANDARAS block.
// import PamphletPromo from "@/components/PamphletPromo";
import MapBoard from "@/components/MapBoard";
import CountdownTimer from "@/components/CountdownTimer";
import LiveFeedMarquee from "@/components/LiveFeedMarquee";
import LiveChatterBoard, {
  type ChatterMention,
} from "@/components/LiveChatterBoard";
import SeasonTimeline from "@/components/SeasonTimeline";
import StatsSection from "@/components/StatsSection";
import FamousBhandaras from "@/components/FamousBhandaras";
import HomeResourcesTeaser from "@/components/HomeResourcesTeaser";
import VisitorBeacon from "@/components/VisitorBeacon";
import { MarigoldDivider } from "@/components/ornaments";
import { prisma, toBhandara } from "@/lib/db";
import { areaToSlug } from "@/lib/areaSlug";
import { hasUpcomingDate } from "@/lib/dates";
import { getHomepageStats } from "@/lib/stats";

// True ISR, the page no longer reads cookies() or searchParams, so
// Next can prerender it once and serve cached HTML from the edge.
// Revalidates every 60 seconds to surface new bhandaras / spots /
// counter ticks. Visitor-counter bump is fire-and-forget via the
// VisitorBeacon below.
export const revalidate = 60;

/**
 * Module-level "last known good" cache for the homepage's 7 parallel
 * Prisma queries. Lives per Lambda instance.
 *
 * Why this exists: on Tuesday-1 of Adhik Mas 2026 the Supabase pooler
 * hit EMAXCONN (200/200 connections) under traffic spike. The
 * Promise.allSettled fallback in the data-fetch section below would
 * normally return empty arrays for failed queries, so the public
 * homepage suddenly rendered as "All 0 Bada Mangal bhandaras in
 * Lucknow" — a catastrophic UX regression on the season's biggest
 * day. With this cache the failure mode degrades to "all data is
 * 1-5 minutes stale" instead, which is invisible to the visitor.
 *
 * Stored value is opaque (each key is keyed off the unwrap label).
 * Eviction is by TTL only — we never evict on count, since the
 * working set is exactly 7 entries (one per Prisma query). Each
 * Lambda warms its own cache from successful queries; cold-start
 * Lambdas start empty and the fallback shape kicks in.
 */
const lastGood: Record<string, { value: unknown; at: number }> = {};
/** Stale tolerance for last-good fallback. 5 min is short enough that
 *  visitors don't ever see truly-stale data, long enough to cover
 *  the typical pool-saturation window (~30s to ~2 min). */
const LAST_GOOD_TTL_MS = 5 * 60 * 1000;

// Homepage metadata, tuned to the queries Search Console is ACTUALLY
// showing us impressions for, not the queries we wish we ranked for.
//
// GSC data (as of mid-May 2026 season-start):
//   • "bhandara near me today"          12 imp · position 6.1 · CTR 0%
//   • "bhandara near me"                 9 imp · position 6.9 · CTR 0%
//   • "bhandara near me today open now"  2 imp · position 9    · CTR 0%
//   • "bada mangal lucknow"              1 imp · position 11
//
// We were ranking page-1-bottom for "near me" queries but seeing
// zero clicks because the SERP snippet promised "2026 Jyeshtha
// season" and "directory", abstract / institutional. Searchers
// typing "bhandara near me today" want a concrete here-and-now
// answer ("open now", "live map", "free prasad").
//
// New title leads with "Bhandara Near Me" (matches the query
// verbatim), then anchors with the brand. New description leads
// with "happening today" + "free" + "every Tuesday", every word
// is an answer to something the searcher actually wants to know.
//
// Expected impact: CTR from 0% → 4-7% at position 6, which 3-5×
// our organic traffic from the same Google impressions we're
// already getting.
export const metadata: Metadata = {
  title: "Bhandara Near Me · Bada Mangal Lucknow 2026 · Live Map & Today's Bhandaras",
  description:
    "Find every Bada Mangal bhandara in Lucknow happening today and every Tuesday of the 8-Tuesday 2026 Jyeshtha season. Live map, timings, prasad menu, directions, free. लखनऊ के सभी बड़े मंगल भंडारे एक नक़्शे पर।",
  keywords: [
    // "near me" intent, matches the queries actually in GSC
    "bhandara near me",
    "bhandara near me today",
    "bhandara lucknow near me",
    "free bhandara lucknow",
    // brand + season
    "bada mangal",
    "bada mangal 2026",
    "bada mangal lucknow",
    "bhandara lucknow",
    "hanuman bhandara",
    "jyeshtha tuesdays",
    "8 bada mangal",
    // Hindi
    "बड़ा मंगल",
    "बड़ा मंगल लखनऊ",
    "हनुमान भंडारा",
    "भंडारा लखनऊ",
    "लखनऊ बड़ा मंगल 2026",
  ],
  alternates: localised("/"),
  openGraph: {
    // OG title kept slightly shorter for social cards (WhatsApp /
    // Twitter truncate aggressively at ~60-70 chars; the SERP title
    // above can run longer because Google word-wraps).
    title: "Bhandara Near Me · Bada Mangal Lucknow 2026",
    description:
      "Every Bada Mangal bhandara in Lucknow on one live map. Today's bhandaras, timings, prasad menu, free directions.",
    url: SITE_URL,
    siteName: "BadaMangal",
    locale: "en_IN",
    alternateLocale: "hi_IN",
    type: "website",
  },
};

export default async function HomePage() {
  // NB: The page itself is locale-AGNOSTIC. Every text-bearing
  // section is rendered by a client component that reads the
  // visitor's bm_lang cookie via LocaleProvider context, so the
  // Hindi toggle swaps every label instantly without re-fetching the
  // page. Reading cookies here would opt the homepage out of static
  // generation and reintroduce the 3-4 s Function cold-start lag.
  //
  // The previous version hardcoded `locale = "en"` and threaded that
  // into 6+ server-rendered headings (hero body, map heading,
  // history teaser, etc.). On the Hindi toggle, router.refresh()
  // re-rendered the page on the server with locale STILL pinned to
  // English, so visitors saw the toggle pill animate but the text
  // never changed. Hence this refactor.

  // Fire every DB read in parallel via Promise.allSettled (NOT
  // Promise.all). This is the survival switch for the homepage:
  //
  // Previously we used Promise.all, so if ANY single Prisma query
  // rejected (transient Supabase pooler drop, cold-start connection
  // saturation right after a Vercel deploy swap, a momentary
  // pgbouncer recycle), the whole homepage SSR threw and visitors
  // saw the alarming "Something stopped working" global error page.
  // That happened in production at ~05:00 IST on 26 May 2026 — the
  // morning of Tuesday 1 of the Adhik Mas season — and the digest
  // bubbled all the way up because there was no segment error.tsx
  // catching it either.
  //
  // The Prisma client already retries each individual query once on
  // a known transient error (250ms backoff, see lib/db.ts). What
  // this layer adds is a second line of defence: if the retry also
  // fails, that single section degrades to its safe-fallback shape
  // and the rest of the page still renders. The cards/map/feed/etc
  // each independently tolerate empty arrays / zero stats, so the
  // visitor sees a slightly thinner homepage instead of a broken
  // one. Within 60 s the next revalidate pass refreshes the data.
  //
  // Errors are console.error-ed so they're still visible in Vercel
  // function logs — we don't want partial failure to be silent.
  const [
    recordsResult,
    statsResult,
    spotRecordsResult,
    galleryAdminResult,
    gallerySpotPhotosResult,
    mentionRowsResult,
    communityCounterRowsResult,
  ] = await Promise.allSettled([
    prisma.bhandara.findMany({
      where: { status: "APPROVED" },
      orderBy: [{ isSponsored: "desc" }, { createdAt: "asc" }],
    }),
    getHomepageStats(),
    // Pull ALL currently-live spots, not a capped slice. The previous
    // `take: 24` was originally sized for the HappeningNow feed (which
    // only renders 15 cards from this array), but the SAME array is
    // fed into MapBoard for two things that need the full set:
    //   • the map pins (1 pin per spot), under the cap, ≥25th spot
    //     never rendered on the map at all
    //   • the heading counter `listings.length + liveSpots.length`
    //    , under the cap, the headline froze at "Spotted 24" even
    //     when the DB had 60+ live spots, which is exactly the bug
    //     the user is staring at on the live homepage.
    // Spot rows auto-expire after 8h and the table only keeps APPROVED,
    // so this is naturally bounded by activity-in-the-last-8h. A safety
    // ceiling of 500 protects the wire payload (~300 KB worst case) in
    // case a future bug pushes expiresAt unusually far out.
    prisma.spot.findMany({
      where: { status: "APPROVED", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        bhandara: { select: { slug: true, name: true, nameHi: true } },
      },
    }),
    // Admin-curated gallery photos (visible only). Newest pinned-
    // first via displayOrder, then by createdAt desc. Capped at 60
    // since the gallery section is meant to be browsable, not
    // exhaustive, admin can prune older items by flipping their
    // status to HIDDEN if the section grows unwieldy.
    prisma.galleryPhoto.findMany({
      where: { status: "VISIBLE" },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      take: 60,
      select: {
        id: true,
        imageUrl: true,
        caption: true,
        captionHi: true,
        uploadedBy: true,
        createdAt: true,
      },
    }),
    // Spot photos for the gallery: take the most recent 60 APPROVED
    // spots that have a primary photo. Includes both photoUrl AND
    // extraPhotoUrls (the multi-photo array we added in Item 1) ,
    // each extra photo gets its own gallery tile. We don't filter
    // for "currently live" (expiresAt > now) here because the
    // gallery's value is in the visual record of the season, not
    // a live ops view.
    prisma.spot.findMany({
      where: { status: "APPROVED", photoUrl: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        photoUrl: true,
        extraPhotoUrls: true,
        caption: true,
        reporterName: true,
        createdAt: true,
      },
    }),
    // APPROVED, non-expired BhandaraMention rows for the new homepage
    // LiveChatterBoard (WhatsApp text-message ingest, fed by
    // /api/bot/message + classified by Gemini). Cap at 200 to cover
    // an entire Bada Mangal day's chatter — the 24h TTL on
    // expiresAt naturally bounds the upper end and a peak Tuesday
    // tops out around 150-250 mentions across all groups. Matches
    // the section's client-side MAX_CARDS so SSR and the polling
    // loop converge on the same ceiling.
    // `expiresAt: { gt: now }` mirrors the public /api/mentions/feed
    // filter; keeps the 24h public-visibility window consistent
    // between SSR and the live poll.
    //
    // Sort by `approvedAt` (NOT createdAt) so freshly-approved
    // mentions of older PENDING rows show at the top — matches the
    // semantic the polling loop uses, so SSR and post-hydration state
    // converge to the same ordering.
    prisma.bhandaraMention.findMany({
      where: {
        status: "APPROVED",
        expiresAt: { gt: new Date() },
        approvedAt: { not: null },
      },
      orderBy: { approvedAt: "desc" },
      take: 200,
      select: {
        id: true,
        cleanedText: true,
        originalText: true,
        language: true,
        intent: true,
        locationLabel: true,
        lat: true,
        lng: true,
        locationSource: true,
        senderName: true,
        createdAt: true,
        quotedText: true,
        quotedSender: true,
      },
    }),
    // Community member counts for the LiveChatterBoard:
    //   - `community_total_members` powers the header chip
    //   - `community_count_<key>` powers each WhatsApp CTA card's
    //     per-group count (4 rows, one per CTA)
    // One findMany pulls them all in a single round-trip instead of
    // five separate queries. The component receives a typed map and
    // looks each up by stable id.
    prisma.siteCounter.findMany({
      where: {
        id: {
          in: [
            "community_total_members",
            "community_count_bada_mangal_community",
            "community_count_balaji_bhandara_community",
            "community_count_bhandara_group",
            "community_count_bada_mangal_channel",
          ],
        },
      },
      select: { id: true, count: true },
    }),
  ]);

  // Unwrap each settled result with a TWO-LAYER fallback so a DB
  // failure degrades gracefully instead of catastrophically.
  //
  // Layer A (fresh-success): query succeeded — store the result in
  // the module-level lastGood cache so future failures can reuse it.
  //
  // Layer B (recent-cached): query failed but we have a successful
  // result from less than LAST_GOOD_TTL_MS ago. Serve that. This
  // covers the EMAXCONN window during a Vercel cold-start storm —
  // the homepage stays populated with the most recent known data
  // while the pool recovers. The 5-min TTL is short enough that
  // genuinely stale data doesn't linger; long enough to cover the
  // typical pool-saturation event.
  //
  // Layer C (empty fallback): no recent cache either. Return the
  // empty-shape fallback the page's downstream code already handles.
  // This is the "first request after Lambda cold-start, while the
  // pool is also down" worst case.
  //
  // Errors are still console.error-ed in every case so Vercel
  // function logs show the underlying failure.
  function unwrap<T>(
    result: PromiseSettledResult<T>,
    fallback: T,
    label: string,
  ): T {
    if (result.status === "fulfilled") {
      lastGood[label] = { value: result.value, at: Date.now() };
      return result.value;
    }
    console.error(`[homepage] data fetch failed for ${label}:`, result.reason);
    const cached = lastGood[label];
    if (cached && Date.now() - cached.at < LAST_GOOD_TTL_MS) {
      console.warn(
        `[homepage] serving last-good ${label} (age: ${Math.round((Date.now() - cached.at) / 1000)}s)`,
      );
      return cached.value as T;
    }
    return fallback;
  }
  const records = unwrap(recordsResult, [], "bhandaras");
  const statsRaw = unwrap(
    statsResult,
    {
      visitorNumber: 0,
      bhandarasTotal: 0,
      bhandarasListed: 0,
      bhandarasSpotted: 0,
      bhandarasMentioned: 0,
      areasCovered: 0,
      areasTotal: 0,
      tuesdaysSoFar: 0,
      communityMembers: 0,
    },
    "stats",
  );
  const spotRecords = unwrap(spotRecordsResult, [], "spots");
  const galleryAdmin = unwrap(galleryAdminResult, [], "galleryAdmin");
  const gallerySpotPhotos = unwrap(
    gallerySpotPhotosResult,
    [],
    "gallerySpotPhotos",
  );
  const mentionRows = unwrap(mentionRowsResult, [], "mentions");
  const communityCounterRows = unwrap(
    communityCounterRowsResult,
    [],
    "communityCounters",
  );

  // Auto-delist bhandaras whose every service date has already passed
  // (IST calendar). The DB row stays APPROVED so admins still see it
  // in /admin and historical /bhandara/[slug] permalinks keep
  // working; only the public main list trims to what's still
  // upcoming. Past-only rows surface on /archive instead, which is
  // the explicit "season history" view that filters with the
  // inverse predicate.
  //
  // This is the contract every public surface (map, card grid, area
  // chips, /api/bhandaras GET, stats panel) MUST share, otherwise
  // headline counts diverge from the cards / pins below them.
  const listings = records.map(toBhandara).filter((b) => hasUpcomingDate(b));
  const stats = statsRaw;

  // Live "spots", crowd-sourced sightings of bhandaras happening right
  // now (auto-expire after 8 hours). Already fetched above in the
  // Promise.all batch, just shape into the wire format here.
  //
  // Two derived arrays, NOT one:
  //   • `liveSpots` (all approved + live) — fed to HappeningNow so the
  //     homepage card grid matches /live exactly. /live's SSR query
  //     doesn't filter 0,0 coords either; this keeps both surfaces in
  //     sync so a coordless-but-photo-rich Spot (bot ingest without
  //     EXIF / location share) doesn't appear on /live but vanish on
  //     the homepage.
  //   • `liveSpotsWithCoords` — same array minus 0,0 entries, fed to
  //     MapBoard so the city map never plants an Africa-pin marker at
  //     null-island. Map pins genuinely need real coords; HappeningNow
  //     cards don't.
  const liveSpots = spotRecords.map((s) => {
    // Build a multi-photo array so the HappeningNow card can show
    // an in-place carousel when the submitter attached extras.
    // Defensive JSON.parse; primary photoUrl is first.
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
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    area: s.area,
    address: s.address,
    photoUrl: s.photoUrl,
    photoUrls: s.photoUrl ? [s.photoUrl, ...extras] : extras,
    // Strip the internal [bot:whatsapp …] tag so it never reaches a
    // public surface. See lib/sanitize.ts for the regex source.
    caption: stripBotProvenance(s.caption) || null,
    reporterName: s.reporterName,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    bhandaraSlug: s.bhandara?.slug ?? null,
    bhandaraName: s.bhandara?.name ?? null,
    bhandaraNameHi: s.bhandara?.nameHi ?? null,
  };
  });
  const liveSpotsWithCoords = liveSpots.filter((s) => s.lat !== 0 && s.lng !== 0);

  // Live feed initial payload, active spots only. The Post model
  // (per-bhandara comments) was removed, so the marquee + /live feed
  // now mirror just the crowd-sourced spots stream. authorName falls
  // back to a generic "Spotter" / "स्पॉटर" label on the client because
  // the page now renders without a server-side locale.
  const feedInitial = spotRecords
    .map((s) => ({
      id: `spot:${s.id}`,
      bhandaraSlug: s.bhandara?.slug ?? null,
      bhandaraName: s.bhandara?.name ?? null,
      authorName: s.reporterName?.trim() || "Spotter",
      // Strip the [bot:whatsapp …] provenance tag — was leaking onto
      // the LiveFeedMarquee card, where the truncated tail "…[bot:
      // whatsapp · from:R.K Pal Balaji ka bhandara (2) · …" was
      // visible mid-caption.
      text: stripBotProvenance(s.caption) || null,
      photoUrl: s.photoUrl,
      language: s.language,
      createdAt: s.createdAt.toISOString(),
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 18);

  // Initial payload for the LiveChatterBoard. The feed merges two
  // sources: BhandaraMention rows (WhatsApp text/location messages)
  // and Spot rows with photos (image-with-coords from the same bot).
  // Same shape contract as /api/mentions/feed so SSR + client-poll
  // converge. `kind` discriminates rendering (photo thumbnail +
  // "view bhandara" link for spots, text-only for mentions).
  const mentionsInitial: ChatterMention[] = [
    ...mentionRows.map((m): ChatterMention => ({
      id: `mention:${m.id}`,
      kind: "mention",
      text:
        m.cleanedText ??
        m.originalText.split("\n\n[bot:")[0] ??
        "",
      language: m.language,
      intent:
        m.intent === "ASKING" || m.intent === "SHARING"
          ? m.intent
          : "MENTIONING",
      locationLabel: m.locationLabel,
      lat: m.lat,
      lng: m.lng,
      locationSource: m.locationSource,
      photoUrl: null,
      photoUrls: [],
      quotedText: m.quotedText,
      quotedSender: m.quotedSender,
      bhandaraSlug: null,
      bhandaraName: null,
      senderName: m.senderName,
      createdAt: m.createdAt.toISOString(),
    })),
    // Spots-with-photos go through the same chat panel. We pull from
    // the spotRecords already fetched above (so no extra DB hit) and
    // filter to ones with a real photo + non-zero coords (the same
    // filter the API endpoint applies — keeps SSR + poll responses
    // identical in shape).
    //
    // STRICT WHATSAPP-ONLY: only bot-ingested spots (caption carries
    // the `[bot:…]` provenance tag) belong in the live chat. User-
    // submitted spots via /spot or admin-scan uploads still live in
    // the homepage gallery + map heatmap, but the chat stream itself
    // is reserved for things the WhatsApp community actually posted.
    // Mirror of the same filter on /api/mentions/feed (2026-05).
    ...spotRecords
      .filter(
        (s) =>
          // Photo + non-expired only. We DO NOT drop lat=0/lng=0
          // spots here — bot-ingested live photos auto-publish with
          // 0,0 because WhatsApp strips EXIF GPS, and the chat panel
          // should still show the photo. The heatmap filters 0,0
          // separately so no ghost pin lands on null island.
          s.photoUrl &&
          s.expiresAt > new Date() &&
          (s.caption ?? "").includes("[bot:"),
      )
      .map((s): ChatterMention => {
        // Parse extra photo URLs (JSON-encoded string column) so the
        // chat-bubble carousel can cycle through primary + extras.
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
          kind: "spot",
          text: stripBotProvenance(s.caption) || "Bhandara spotted",
          language: s.language,
          intent: "SHARING",
          locationLabel: s.area,
          lat: s.lat,
          lng: s.lng,
          locationSource: "spot_photo",
          photoUrl: s.photoUrl!,
          photoUrls: [s.photoUrl!, ...extras],
          quotedText: null,
          quotedSender: null,
          bhandaraSlug: s.bhandara?.slug ?? null,
          bhandaraName: s.bhandara?.name ?? null,
          senderName: s.reporterName,
          createdAt: s.createdAt.toISOString(),
        };
      }),
  ]
    .sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
    )
    // 200 matches LiveChatterBoard's MAX_CARDS so the SSR payload
    // covers a full day's chatter. Previously .slice(0, 30) silently
    // truncated mentionsInitial regardless of the take: 200 above,
    // which made the chat panel land at exactly 30 mentions even
    // when the DB had 60+. This was the actual bug behind the
    // "messages getting cropped" report.
    .slice(0, 200);

  // Homepage gallery items: combine admin-curated GalleryPhoto rows
  // with spot photos (primary + extras). Admin items first so the
  // curated band leads, then spots, capped at 60 visible at most.
  // Each extra spot photo becomes its own tile so a multi-photo
  // spot upload doesn't get squashed into one thumb.
  const galleryItems: GalleryItem[] = [
    ...galleryAdmin.map((g) => ({
      id: `admin:${g.id}`,
      url: g.imageUrl,
      source: "admin" as const,
      caption: g.caption ?? undefined,
      captionHi: g.captionHi ?? undefined,
      credit: g.uploadedBy ?? undefined,
      // createdAt drives the date grouping on the full /gallery
      // page (and is harmless on the homepage since admin items
      // never trigger the LIVE pill regardless of timestamp).
      createdAt: g.createdAt.toISOString(),
    })),
    ...gallerySpotPhotos.flatMap((s) => {
      let extras: string[] = [];
      try {
        const parsed = JSON.parse(s.extraPhotoUrls || "[]");
        if (Array.isArray(parsed)) {
          extras = parsed.filter(
            (x): x is string => typeof x === "string" && x.length > 0,
          );
        }
      } catch {
        /* keep extras = [] */
      }
      const urls = [s.photoUrl, ...extras].filter(
        (u): u is string => Boolean(u),
      );
      const cleanCaption = stripBotProvenance(s.caption) || undefined;
      // createdAt flows through so the gallery can compute the
      // 8h freshness window client-side and only render the LIVE
      // pill on photos posted within the last 8 hours. Past that,
      // the photo stays in the gallery (it's still a real record
      // of the season) but loses the LIVE chrome.
      const createdAtIso = s.createdAt.toISOString();
      return urls.map((url, i) => ({
        id: `spot:${s.id}:${i}`,
        url,
        source: "spot" as const,
        caption: cleanCaption,
        createdAt: createdAtIso,
      }));
    }),
  ].slice(0, 60);

  // JSON-LD bundle for the homepage. WebSite + Organization anchor
  // the brand for Google's knowledge panel; the 8 Event entries seed
  // the events carousel for "bada mangal 2026" searches.
  const jsonLdBlocks = [
    websiteSchema(),
    organizationSchema(),
    // FAQPage targets "People also ask" SERP boxes for high-intent
    // Bada Mangal queries ("what is bada mangal", "why 8 tuesdays
    // 2026", "next bada mangal lucknow"). Pure top-of-search real
    // estate when Google decides to render it.
    faqSchema(),
    ...eventSchemaBatch(ALL_TUESDAY_ISO),
  ];

  return (
    <>
      {/* Fire-and-forget visitor counter bump, runs once per tab after
          first paint. Replaces the per-render DB write that used to
          force the homepage to be server-dynamic. */}
      <VisitorBeacon />
      {/* JSON-LD structured data, embedded inline so search-engine
          crawlers (which usually don't run client JS) see them on
          first paint. */}
      {jsonLdBlocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}

      {/* HERO, editorial cream layout with the commissioned Hanuman Ji
          illustration anchoring the right. Replaces the flat saffron band
          with a layered cream-paper composition. */}
      <section className="relative isolate overflow-hidden">
        {/* Soft saffron radial glow behind the right column */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(900px 600px at 78% 35%, rgba(242,148,76,0.22), transparent 60%), radial-gradient(720px 480px at 12% 110%, rgba(156,42,42,0.10), transparent 60%)",
          }}
        />
        {/* Faint gold rule at the very top of the band */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/40 to-transparent"
        />

        {/* Soft fade at the bottom edge so the cut-off where the
            illustration ends doesn't read as abrupt, a thin band of
            warm shadow tapers into the cream paper of the next
            section. Sits on top of the background but below content. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-24 sm:h-32 -z-10 pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(156,42,42,0.06) 60%, rgba(26,20,16,0.10) 100%)",
          }}
        />
        {/* And a faint gold rule mirroring the top, anchoring the
            bottom edge of the hero band visually. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-500/40 to-transparent"
        />

        <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 pb-0 sm:pt-20 sm:pb-0">
          <div className="grid gap-10 lg:gap-14 lg:grid-cols-12 items-center">
            {/* Left 7/12: bilingual hero text rendered by the
                HomeHero client component so the Hindi toggle flips
                eyebrow / body / Tuesday line synchronously. */}
            <HomeHero />

            {/* Right 5/12: real Hanuman Ji illustration */}
            <div className="lg:col-span-6">
              <HeroIllustrationFrame />
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED BHANDARAS, concrete answer to "where can I go to a
          bhandara today?" up high, before the countdown/map. GA4
          data showed 20× more hero-CTA clicks than bhandara-card
          opens, meaning the cards were too deep in the page. This
          section pulls 3-4 photographed, verified, today-or-soonest
          bhandaras above the fold so visitors arriving from
          WhatsApp shares + organic search ("bhandara near me today")
          land on a specific answer without scrolling. */}
      {/* locale is read from React context inside FeaturedBhandaras
          so the Hindi toggle swaps the section heading + Today
          pills + area labels synchronously. */}
      <FeaturedBhandaras listings={listings} />

      {/* COUNTDOWN + 8-MANGAL TIMELINE
          Hierarchy rebuild: the previous version had a giant
          "8 Bada Mangals in 2026: the rarest cycle in 19 years"
          heading + body + two fact-pills competing for attention
          with the countdown, the "Today is" banner, the date pill,
          and the timeline. Seven focal points, all visually loud.
          The rare-cycle framing is *interesting context* but not
          *actionable info*, the actionable bits are "today is
          happening" (live days) and "countdown to next" (other days).
          So: rare-cycle is compressed into a single subtle kicker
          line above the date pill, and everything actionable
          (banner, date pill, timer, timeline) gets to breathe. */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-12 sm:py-16">
        <div className="rounded-3xl border border-gold-500/40 bg-cream-50 px-6 py-10 sm:px-10 sm:py-12">
          {/* Countdown to the next Bada Mangal (or, on a Bada Mangal
              day itself, a big "Today is the Nth" headline + timer
              for the *next* one). Both Countdown + Timeline read locale
              from context so the Hindi toggle swaps every label here
              without a server-tree refresh. */}
          <CountdownTimer />

          {/* 8-Mangal timeline + the rare-cycle subtitle */}
          <SeasonTimeline />
        </div>
      </section>

      {/* MAP + side list, promoted up so primary discovery happens
          immediately after the season-context band. MapBoard now
          reads its heading + body + "List your bhandara" label from
          the LocaleProvider context, no locale props needed. */}
      <MapBoard
        listings={listings}
        liveSpots={liveSpotsWithCoords.map((s) => ({
          id: s.id,
          lat: s.lat,
          lng: s.lng,
          area: s.area,
          caption: s.caption,
          photoUrl: s.photoUrl,
          createdAt: s.createdAt,
          bhandaraSlug: s.bhandaraSlug,
          bhandaraName: s.bhandaraName,
          bhandaraNameHi: s.bhandaraNameHi,
        }))}
        communityMembers={
          communityCounterRows.find((r) => r.id === "community_total_members")?.count ?? 0
        }
      />

      {/* HAPPENING NOW, crowd-sourced live spots, sits right under
          the map so the urgency layer reads as an overlay on top of
          the discovery surface. Reads locale from context. */}
      <HappeningNow initial={liveSpots} />

      {/* CARDS, equal-height grid with filters. Locale reads from
          context inside the component. The saffron headline number
          is `listings.length`, ie. the upcoming-only filtered total
          (matches everything else on the page + the stats panel,
          past-only bhandaras live exclusively on /archive). */}
      {listings.length > 0 ? (
        <BhandaraCardsSection listings={listings} />
      ) : (
        <HomeCardsEmpty />
      )}

      {/* LIVE CHATTER BOARD — sits BELOW the listed-bhandaras grid.
          (Was briefly promoted above the grid; reverted because the
          on-the-day chatter, when stale or from a previous Tuesday,
          misled visitors landing on a non-Bada-Mangal day.) The
          curated bhandara list reads first as the trustworthy
          "what's listed" surface, and the live chatter + WhatsApp
          community CTAs follow as supporting context. */}
      <LiveChatterBoard
        initial={mentionsInitial}
        communityMembers={
          communityCounterRows.find((r) => r.id === "community_total_members")?.count ?? 0
        }
        communityCountsByKey={Object.fromEntries(
          communityCounterRows
            .filter((r) => r.id.startsWith("community_count_"))
            .map((r) => [r.id.replace("community_count_", ""), r.count]),
        )}
      />

      {/* HOMEPAGE GALLERY, masonry of community photos. Mixes
          admin-curated GalleryPhoto rows with spot photos (primary +
          extras from each Spot's photoUrl / extraPhotoUrls). Hidden
          entirely when there are no items so the homepage doesn't
          show a ghost section. */}
      <HomepageGallery items={galleryItems} />

      {/* AREA INDEX, 36 pill chips, one per Lucknow neighbourhood,
          each a direct Link to /area/[slug]. Two wins:
          1. SEO: distributes PageRank from the homepage to every
             area landing page (the biggest SEO lever from the
             audit), accelerates ranking on "bada mangal <area>"
             queries.
          2. UX: visitors who know their area jump in one tap
             instead of scrolling through the cards.

          Both the count and the highlighted-chip set source from
          `listings` (upcoming-dates-only) rather than `records`
          (all APPROVED). A highlighted chip is a contract with the
          visitor: "yes, you can visit a bhandara in this area right
          now". A past-only bhandara doesn't honour that contract,
          its area is invisible in the listings below, so the chip
          must not highlight either. The stats panel keeps the
          cumulative "Areas covered" view because its frame is
          "what has the city ever done", a different lens. */}
      <AreaIndexGrid
        activeAreaCount={new Set(listings.map((l) => l.area)).size}
        activeAreaSlugs={
          new Set(listings.map((l) => areaToSlug(l.area)))
        }
      />

      {/* PAMPHLET PROMO is temporarily hidden, the /pamphlet feature
          ships but is not publicly promoted during the soft-launch
          phase. Re-enable by uncommenting <PamphletPromo /> below
          (and the import at the top of the file) once the design
          is finalised. Sitemap and footer link have also been
          stripped so the only way in is a direct URL.
          <PamphletPromo />
      */}

      {/* ORGANISE-BHANDARA promo, lead-capture banner for the
          full-service path. Sits right under AreaIndexGrid so a
          visitor who just scanned the area chips and didn't find
          their neighbourhood's bhandara (or wants to be the one
          adding it) is one tap from the request form. ?from=banner
          attributes the inbound channel on the lead's email. */}
      <OrganisePromo />

      {/* FAMOUS BHANDARAS, curated landmark venues. Sits below the
          listed-bhandaras grid so visitors first see what organisers
          have actually submitted, then the city-wide landmark anchors. */}
      <FamousBhandaras />

      {/* STATS, pulled up to lead the lower half of the page. The
          city's running tally (visitors, listings, spotted bhandaras,
          areas, Tuesdays served) sets the tone for the editorial /
          live content that follows. Tiles with value 0 are hidden so
          the panel doesn't read as empty on a quiet day. */}
      <StatsSection stats={stats} />

      {/* PRESS / MEDIA COVERAGE band. Sits AFTER the "Lucknow, this
          season" stats block (was previously right after the hero,
          moved here 22 May so the stats-then-press flow lets the
          numbers do the trust-build first and the press logos
          reinforce as social proof). Re-mounted earlier the same day
          when Dainik Jagran covered the project. The component reads
          which outlets to show from its own OUTLETS array, see
          src/components/MediaCoverage.tsx for how to add Times of
          India / Navbharat Times when those stories land. */}
      <MediaCoverage />

      {/* TESTIMONIALS, "Lucknow is liking us" — community feedback
          band. Sits right after press coverage so the flow reads as
          "newspapers are talking about us → here's what individual
          Lucknow folks said back" before resources / history /
          benediction. Currently seeded with one real testimonial
          from the contact form; the array in HomeTestimonials.tsx
          grows as more come in. */}
      <HomeTestimonials />

      {/* RESOURCES TEASER, extracted into a client component so the
          card titles + bodies localise from the LocaleProvider context
          after the static HTML lands (otherwise Hindi-cookie visitors
          would see this band in English). */}
      <HomeResourcesTeaser />

      {/* LIVE FEED MARQUEE, sits between resources and the editorial
          history teaser. Returns null and renders nothing when there
          are < 3 entries (see LiveFeedMarquee.tsx), so on a quiet day
          this band is invisible rather than a sparse half-empty rail. */}
      <LiveFeedMarquee initial={feedInitial} />

      {/* MARIGOLD DIVIDER */}
      <div className="flex justify-center my-4">
        <MarigoldDivider size={320} className="text-gold-500" />
      </div>

      {/* HISTORY TEASER, client component, locale from context. */}
      <HomeHistoryTeaser />

      {/* FAQ, bilingual accordion of the highest-intent questions
          about the tradition, the rare 8-Tuesday 2026 cycle, finding
          a bhandara, and listing one. Native <details>/<summary>, no
          JS. Anchored at #faq so footer + /resources can deep-link.
          Sits above VolunteerPromo so a curious long-scroll visitor
          has their questions answered before the volunteer ask. */}
      <HomeFAQ />

      {/* Quiet volunteer-programme nudge, slim strip near the bottom
          of the page rather than a banner near the top. Reaches the
          long-scroll user who's already invested in the site without
          competing with discovery (map / listings) or the primary
          OrganisePromo CTA up top. */}
      <VolunteerPromo />

      {/* CLOSING BENEDICTION, bilingual blessing line + Maharajji
          medallion. Client component so the body line ("May Hanuman
          Ji bless..." / "बजरंगबली की कृपा...") swaps on toggle. */}
      <HomeClosingBenediction />
    </>
  );
}

function HeroIllustrationFrame() {
  // Two-layer composition:
  //   1. Ram-name halo SVG, slowly rotating behind the figure's head
  //   2. Hanuman Ji illustration on top (transparent PNG)
  // Both float directly on the page paper, no card, no border,
  // no vignette. The halo is sized + positioned so its centre sits
  // roughly behind the painted halo on the figure's head; the
  // illustration's transparent areas around the body let the rotating
  // ring show through as motion in the corners.
  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none aspect-[4/5]">
      {/* Rotating Ram-name halo. Two nested divs so the outer one
          can position the halo's centre exactly behind the head
          while the inner one handles rotation independently,
          combining position translates with a rotation animation
          in a single transform would cancel one out. Position
          values fine-tuned visually to align with the standing
          figure's head. Slow 180s per turn so the motion reads as
          devotional, not animated noise. */}
      <div
        aria-hidden
        className="absolute left-[42%] top-[26%] -translate-x-[41%] -translate-y-[39%] w-[84%] aspect-square pointer-events-none opacity-50"
      >
        <div
          className="w-full h-full"
          style={{ animation: "bm-spiral-spin 180s linear infinite" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/illustrations/ram-name-halo.svg"
            alt=""
            className="w-full h-full object-contain"
          />
        </div>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/illustrations/hanuman-standing.webp"
        alt="Hanuman Ji, illustrated for BadaMangal"
        loading="eager"
        decoding="async"
        fetchPriority="high"
        className="relative w-full h-full object-contain"
      />
    </div>
  );
}
