/**
 * Homepage data loader for the v2 homepage (`/`).
 *
 * Extracted VERBATIM from src/app/page.tsx on 29 Oct 2026 (approach B of
 * the redesign spec). Same queries, same Promise.allSettled survival
 * switch, same module-level last-good cache, same derived shapes. The
 * only addition is the opt-in `withThread` query, which the classic
 * homepage does not request.
 */
import { stripBotProvenance } from "@/lib/sanitize";
import { isHiddenPublicPhoto } from "@/lib/public-caption";
import type { GalleryItem } from "@/components/HomepageGallery";
import type { ChatterMention } from "@/components/LiveChatterBoard";
import type { GeoMention } from "@/components/MentionHeatmap";
import {
  PUBLIC_BHANDARA_LIST_SELECT,
  prisma,
  toPublicBhandaraListItem,
} from "@/lib/db";
import { hasUpcomingDate } from "@/lib/dates";
import { SEASON_2026, isInSeason, istMidnight, upcomingSeason } from "@/lib/season";

/**
 * Show next season's listings on the homepage only once the season is
 * close (this many days before it opens) or running. Before that, the
 * homepage stays in last season's recap even if organisers have
 * already listed for next year (listing opens months early).
 */
const PRESEASON_DAYS = 30;

function showUpcomingSeason(now: Date = new Date()): boolean {
  if (isInSeason(now)) return true;
  const next = upcomingSeason(now);
  if (!next) return false;
  return istMidnight(next.startISO) - now.getTime() <= PRESEASON_DAYS * 86_400_000;
}
import { getHomepageStats } from "@/lib/stats";
import { cleanName } from "@/lib/display-name";

/**
 * Module-level "last known good" cache for the homepage's 7 parallel
 * Prisma queries. Lives per Lambda instance.
 *
 * Why this exists: on Tuesday-1 of Adhik Mas 2026 the Supabase pooler
 * hit EMAXCONN (200/200 connections) under traffic spike. The
 * Promise.allSettled fallback in the data-fetch section below would
 * normally return empty arrays for failed queries, so the public
 * homepage suddenly rendered as "All 0 Bada Mangal bhandaras in
 * Lucknow", a catastrophic UX regression on the season's biggest
 * day. With this cache the failure mode degrades to "all data is
 * 1-5 minutes stale" instead, which is invisible to the visitor.
 *
 * Stored value is opaque (each key is keyed off the unwrap label).
 * Eviction is by TTL only, we never evict on count, since the
 * working set is exactly 7 entries (one per Prisma query). Each
 * Lambda warms its own cache from successful queries; cold-start
 * Lambdas start empty and the fallback shape kicks in.
 */
const lastGood: Record<string, { value: unknown; at: number }> = {};
/** Stale tolerance for last-good fallback. 5 min is short enough that
 *  visitors don't ever see truly-stale data, long enough to cover
 *  the typical pool-saturation window (~30s to ~2 min). */
const LAST_GOOD_TTL_MS = 5 * 60 * 1000;

// Unwrap each settled result with a TWO-LAYER fallback so a DB
// failure degrades gracefully instead of catastrophically.
//
// Layer A (fresh-success): query succeeded, store the result in
// the module-level lastGood cache so future failures can reuse it.
//
// Layer B (recent-cached): query failed but we have a successful
// result from less than LAST_GOOD_TTL_MS ago. Serve that. This
// covers the EMAXCONN window during a Vercel cold-start storm
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

/** Every APPROVED bhandara. Shared by the homepage and the live map
 *  route so both derive the same listings. */
function findApprovedBhandaras() {
  // REVERTED 2026-05-26: was getCachedApprovedBhandaras() via
  // unstable_cache. unstable_cache JSON-serializes cached values,
  // which converts Date columns (createdAt, etc.) into strings on
  // retrieval, downstream code calls .toISOString() on those
  // dates and crashed the SSR. Real prod incident: HTTP 500 +
  // segment-error infinite re-render storm. Back to direct
  // prisma; in-memory `lastGood` cache + Promise.allSettled
  // fallback still cover the warm-Lambda case.
  //
  // PUBLIC_BHANDARA_LIST_SELECT: no organiser phone, WhatsApp or UPI
  // columns. These listings feed the homepage payload and the public
  // /api/home/map route, so contact details must not be in them
  // (Founder's ruling, 1 Nov 2026).
  return prisma.bhandara.findMany({
    where: { status: "APPROVED" },
    orderBy: [{ isSponsored: "desc" }, { createdAt: "asc" }],
    select: PUBLIC_BHANDARA_LIST_SELECT,
  });
}

/** Most recent APPROVED spots, newest first. Shared by the homepage
 *  and the live map route. */
function findRecentSpots() {
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
  // so this is naturally bounded by activity-in-the-last-8h.
  //
  // Ceiling raised from 500 to 1000 on 1 Nov 2026: the 2026 season
  // alone holds 676 approved spots, so 500 silently left about 180
  // of them off the v2 painted map. The full spot list no longer
  // rides in the page payload (the live map fetches it from
  // /api/home/map on demand), so the larger ceiling costs a DB read,
  // not page weight.
  // Reverted from getCachedLiveSpots() for the same reason as
  // bhandaras above, unstable_cache JSON-serializes Date columns
  // and breaks downstream .toISOString() calls.
  return prisma.spot.findMany({
    // No createdAt window (removed the earlier 12-day cutoff, see
    // below), so the homepage keeps showing spotted bhandaras
    // regardless of how long the gap since the last one is, between
    // Tuesdays mid-season, or between one season and the next.
    // Genuinely-live spots are still preferred when any exist (see
    // displaySpotRecords below); `take` + the createdAt index
    // keeps this cheap without needing a date filter to bound it.
    //
    // The original 12-day window was tuned for "quiet day inside an
    // active season", it silently zeroed out the whole section once
    // the gap since the last Tuesday passed 12 days (verified: this
    // is exactly why "Spotted" read 0 a month after 2026's season
    // ended). Sorted desc + take already gives the same
    // most-recent-first fallback behaviour without an arbitrary
    // cutoff that expires.
    where: { status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    take: 1000,
    // Explicit select (not include) so the spotter's reporterName never
    // leaves the database for the homepage or /api/home/map (Founder's
    // ruling, 1 Nov 2026: no user names on public surfaces).
    select: {
      id: true,
      lat: true,
      lng: true,
      area: true,
      address: true,
      photoUrl: true,
      extraPhotoUrls: true,
      caption: true,
      language: true,
      createdAt: true,
      expiresAt: true,
      bhandara: { select: { slug: true, name: true, nameHi: true } },
    },
  });
}

type SpotRecord = Awaited<ReturnType<typeof findRecentSpots>>[number];

/** True when a timestamp falls inside the 2026 season (IST calendar
 *  dates). Off season the homepage tells the 2026 story, so the live
 *  map keeps 2026 spots only, matching inSeason2026 in HomeV2. */
function inSeason2026(at: Date | string): boolean {
  const iso = new Date(at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return iso >= SEASON_2026.startISO && iso <= SEASON_2026.endISO;
}

/** Live spots when any exist, otherwise the most recent 60. */
function pickDisplaySpots(spotRecords: SpotRecord[]): SpotRecord[] {
  const nowMs = Date.now();
  const live = spotRecords.filter((s) => s.expiresAt.getTime() > nowMs);
  return live.length > 0 ? live : spotRecords.slice(0, 60);
}

// Filter out any row whose coords are 0,0 OR fall outside the
// Lucknow bbox (26.7-27.0 lat, 80.7-81.2 lng). A bhandara at 0,0
// would render in the Atlantic Ocean / off Africa coast, the
// operator literally saw a pin "near Madagascar" today after a
// recovery sweep promoted PENDING rows without fixing their
// bot-fallback coords. The spots array already has the same
// filter (see liveSpotsWithCoords below); bhandaras need it too.
// This is a defence-in-depth guard: ingest paths should set real
// coords, the geocode-fallback chain should bridge any gaps, and
// this filter is the last-mile safety net on the way to the map.
function hasValidLucknowCoords(
  b: ReturnType<typeof toPublicBhandaraListItem>,
): boolean {
  return (
    typeof b.lat === "number" &&
    typeof b.lng === "number" &&
    b.lat >= 26.7 &&
    b.lat <= 27.0 &&
    b.lng >= 80.7 &&
    b.lng <= 81.2
  );
}

/** Upcoming listings, or last season's when nothing is upcoming. */
function deriveListings(records: Awaited<ReturnType<typeof findApprovedBhandaras>>) {
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
  // Off season (more than PRESEASON_DAYS before the next season opens)
  // early listings for next year do not flip the homepage out of the
  // recap; they still show on their own pages, area pages and /api.
  const listings = showUpcomingSeason()
    ? records
        .map(toPublicBhandaraListItem)
        .filter((b) => hasUpcomingDate(b) && hasValidLucknowCoords(b))
    : [];

  // Past-season fallback. When every bhandara's service dates have
  // passed (true for the whole gap between the last Tuesday of one
  // season and the first Tuesday of the next), `listings` above is
  // empty and the homepage map + card grid would otherwise render
  // nothing, looking like the project stopped rather than like a
  // season that already happened. Mirrors /archive's own query
  // (same APPROVED-and-past-dated predicate) so the homepage falls
  // back to real, already-served bhandaras instead of a blank state.
  // Sorted most-recently-approved first so the freshest season's
  // bhandaras lead, not the oldest ones ever recorded.
  const pastListings = listings.length
    ? []
    : records
        .map(toPublicBhandaraListItem)
        .filter((b) => !hasUpcomingDate(b) && hasValidLucknowCoords(b))
        .sort((a, z) => {
          const aLast = a.tuesdayDates.slice().sort().at(-1) ?? "";
          const zLast = z.tuesdayDates.slice().sort().at(-1) ?? "";
          return zLast.localeCompare(aLast);
        });
  const isPastSeason = listings.length === 0 && pastListings.length > 0;
  const displayListings = isPastSeason ? pastListings : listings;
  return { displayListings, isPastSeason };
}

/**
 * Data for the v2 homepage's LIVE map (MapBoard), served by the cached
 * GET route /api/home/map so it no longer rides in the homepage's
 * initial payload (about 440 KB of RSC data that most visitors never
 * open). Same queries and the same selection the homepage used to pass
 * inline: off season the whole season's spots with coords, in season
 * the live (or most recent) spots with coords.
 */
export async function loadLiveMapData() {
  const [recordsResult, spotRecordsResult] = await Promise.allSettled([
    findApprovedBhandaras(),
    findRecentSpots(),
  ]);
  const records = unwrap(recordsResult, [], "bhandaras");
  const spotRecords = unwrap(spotRecordsResult, [], "spots");
  const { displayListings, isPastSeason } = deriveListings(records);
  const source = isPastSeason
    ? spotRecords.filter((s) => inSeason2026(s.createdAt))
    : pickDisplaySpots(spotRecords);
  const liveSpots = source
    .filter((s) => s.lat !== 0 && s.lng !== 0)
    .map((s) => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      area: s.area,
      caption: stripBotProvenance(s.caption) || null,
      photoUrl: s.photoUrl,
      createdAt: s.createdAt.toISOString(),
      bhandaraSlug: s.bhandara?.slug ?? null,
      bhandaraName: cleanName(s.bhandara?.name),
      bhandaraNameHi: cleanName(s.bhandara?.nameHi),
    }));
  return { listings: displayListings, liveSpots, isPastSeason };
}

export type LiveMapData = Awaited<ReturnType<typeof loadLiveMapData>>;

export async function loadHomepageData(opts: { withThread?: boolean } = {}) {
  // Fire every DB read in parallel via Promise.allSettled (NOT
  // Promise.all). This is the survival switch for the homepage:
  //
  // Previously we used Promise.all, so if ANY single Prisma query
  // rejected (transient Supabase pooler drop, cold-start connection
  // saturation right after a Vercel deploy swap, a momentary
  // pgbouncer recycle), the whole homepage SSR threw and visitors
  // saw the alarming "Something stopped working" global error page.
  // That happened in production at ~05:00 IST on 26 May 2026, the
  // morning of Tuesday 1 of the Adhik Mas season, and the digest
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
  // function logs, we don't want partial failure to be silent.
  const [
    recordsResult,
    statsResult,
    spotRecordsResult,
    galleryAdminResult,
    gallerySpotPhotosResult,
    mentionRowsResult,
    communityCounterRowsResult,
    threadMentionRowsResult,
  ] = await Promise.allSettled([
    findApprovedBhandaras(),
    getHomepageStats(),
    findRecentSpots(),
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
        createdAt: true,
      },
    }),
    // APPROVED, non-expired BhandaraMention rows for the new homepage
    // LiveChatterBoard (WhatsApp text-message ingest, fed by
    // /api/bot/message + classified by Gemini). Cap at 500 to cover
    // a peak Tuesday with full headroom (Bada Mangal #4 of 2026
    // logged 244+ live signals in the first 12 hours alone). 24h
    // TTL on expiresAt still bounds the natural upper end. Matches
    // the section's client-side MAX_CARDS so SSR and the polling
    // loop converge on the same ceiling.
    // `expiresAt: { gt: now }` mirrors the public /api/mentions/feed
    // filter; keeps the 24h public-visibility window consistent
    // between SSR and the live poll.
    //
    // Sort by `approvedAt` (NOT createdAt) so freshly-approved
    // mentions of older PENDING rows show at the top, matches the
    // semantic the polling loop uses, so SSR and post-hydration state
    // converge to the same ordering.
    prisma.bhandaraMention.findMany({
      where: {
        status: "APPROVED",
        // Recent window instead of the 24h live TTL, so the chat keeps
        // showing the last open day's conversation between Tuesdays.
        // Live rows are still preferred when present (displayMentionRows).
        createdAt: { gt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000) },
        approvedAt: { not: null },
      },
      orderBy: { approvedAt: "desc" },
      take: 500,
      select: {
        id: true,
        expiresAt: true,
        cleanedText: true,
        originalText: true,
        language: true,
        intent: true,
        locationLabel: true,
        lat: true,
        lng: true,
        locationSource: true,
        // senderName and quotedSender are NOT selected: WhatsApp
        // senders' names never reach a public surface or the page
        // payload (Founder's ruling, 1 Nov 2026). Admin still sees them.
        createdAt: true,
        quotedText: true,
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
    // ADDED for the v2 homepage community thread (opt-in, read only):
    // the latest approved WhatsApp mentions with NO 12-day window, so
    // the off-season page still shows last season's real messages. The
    // classic homepage never asks for it (resolves to an empty array
    // without touching the database).
    opts.withThread
      ? prisma.bhandaraMention.findMany({
          where: { status: "APPROVED", approvedAt: { not: null } },
          orderBy: { createdAt: "desc" },
          take: 160,
          select: {
            id: true,
            cleanedText: true,
            originalText: true,
            // No senderName: names never reach the public thread.
            locationLabel: true,
            intent: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  // Two-layer fallback per query, see unwrap() above.
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
  // Founder's rule: no politician pamphlets on public surfaces. The
  // hidden list (src/lib/public-caption.ts) drops those spots from the
  // hero prints, map, chat and gallery; single photos are dropped below.
  const spotRecords = unwrap(spotRecordsResult, [], "spots").filter(
    (s) => !isHiddenPublicPhoto(s.id, s.photoUrl),
  );
  const galleryAdmin = unwrap(galleryAdminResult, [], "galleryAdmin");
  const gallerySpotPhotos = unwrap(
    gallerySpotPhotosResult,
    [],
    "gallerySpotPhotos",
  ).filter((s) => !isHiddenPublicPhoto(s.id, s.photoUrl));
  const mentionRows = unwrap(mentionRowsResult, [], "mentions");
  const communityCounterRows = unwrap(
    communityCounterRowsResult,
    [],
    "communityCounters",
  );
  const threadMentionRows = unwrap(
    threadMentionRowsResult,
    [],
    "threadMentions",
  );

  // Off-day fallback. Between Bada Mangal Tuesdays the live spot (8h)
  // and mention (24h) TTLs roll over, and the spotted + chat sections
  // would otherwise go empty, leaving the homepage looking dead for
  // off-day visitors (e.g. influencer-driven traffic landing on a
  // Thursday). We prefer genuinely-live rows when any exist; otherwise
  // we fall back to the most recent set so the sections stay populated.
  // The "is this live right now" decision is data-driven (any unexpired
  // row), so the live pulse + "spotted live" wording only appear when
  // real-time activity exists; off-days read as "recently spotted".
  const nowMs = Date.now();
  const displaySpotRecords = pickDisplaySpots(spotRecords);
  const liveMentionRows = mentionRows.filter(
    (m) => m.expiresAt.getTime() > nowMs,
  );
  const displayMentionRows =
    liveMentionRows.length > 0 ? liveMentionRows : mentionRows;

  // Auto-delist past-dated rows, with the past-season fallback, see
  // deriveListings() above for the full contract.
  const { displayListings, isPastSeason } = deriveListings(records);
  const stats = statsRaw;

  // Live "spots", crowd-sourced sightings of bhandaras happening right
  // now (auto-expire after 8 hours). Already fetched above in the
  // Promise.all batch, just shape into the wire format here.
  //
  // Two derived arrays, NOT one:
  //   • `liveSpots` (all approved + live), fed to HappeningNow so the
  //     homepage card grid matches /live exactly. /live's SSR query
  //     doesn't filter 0,0 coords either; this keeps both surfaces in
  //     sync so a coordless-but-photo-rich Spot (bot ingest without
  //     EXIF / location share) doesn't appear on /live but vanish on
  //     the homepage.
  //   • `liveSpotsWithCoords`, same array minus 0,0 entries, fed to
  //     MapBoard so the city map never plants an Africa-pin marker at
  //     null-island. Map pins genuinely need real coords; HappeningNow
  //     cards don't.
  const liveSpots = displaySpotRecords.map((s) => {
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
    photoUrls: (s.photoUrl ? [s.photoUrl, ...extras] : extras).filter((u) => !isHiddenPublicPhoto(null, u)),
    // Strip the internal [bot:whatsapp …] tag so it never reaches a
    // public surface. See lib/sanitize.ts for the regex source.
    caption: stripBotProvenance(s.caption) || null,
    // Spotter names are never shown publicly; cards fall back to their
    // neutral label.
    reporterName: null,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    bhandaraSlug: s.bhandara?.slug ?? null,
    bhandaraName: cleanName(s.bhandara?.name),
    bhandaraNameHi: cleanName(s.bhandara?.nameHi),
  };
  });
  const liveSpotsWithCoords = liveSpots.filter((s) => s.lat !== 0 && s.lng !== 0);

  // Off-day fallback for the LiveChatterBoard's mention heatmap (the
  // "live chat map"). That map plots geo-located chat mentions only, and
  // the spots merged into its feed are gated to non-expired rows, so on
  // any off-day between Bada Mangal Tuesdays it renders blank, the
  // operator reported "I still can't see the spots on this live chat
  // map". Feed it the same recent spots-with-coords the main city map
  // already shows so it mirrors that surface instead of going empty.
  // LiveChatterBoard unions this with live geo-mentions (deduped by id),
  // so the map stays full even once recent bot-spots also appear in the
  // chat stream. `spot:`-prefixed id matches the chat spot ids so the
  // dedup collapses the overlap. Shaped to MentionHeatmap's GeoMention.
  const heatmapFallbackSpots: GeoMention[] = liveSpotsWithCoords.map((s) => ({
    id: `spot:${s.id}`,
    lat: s.lat,
    lng: s.lng,
    intent: "SHARING" as const,
    locationLabel: s.area ?? null,
    locationSource: "spot_photo",
    createdAt: s.createdAt,
  }));

  // Live feed initial payload, active spots only. The Post model
  // (per-bhandara comments) was removed, so the marquee + /live feed
  // now mirror just the crowd-sourced spots stream. authorName falls
  // back to a generic "Spotter" / "स्पॉटर" label on the client because
  // the page now renders without a server-side locale.
  const feedInitial = displaySpotRecords
    .map((s) => ({
      id: `spot:${s.id}`,
      bhandaraSlug: s.bhandara?.slug ?? null,
      bhandaraName: cleanName(s.bhandara?.name),
      // Neutral label only, never the spotter's own name.
      authorName: "Spotter",
      // Strip the [bot:whatsapp …] provenance tag, was leaking onto
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
  // Bot-ingested spots for the chat stream, with an off-day fallback
  // that mirrors displaySpotRecords: prefer live (non-expired) bot-spots,
  // but when none are live (any day between Bada Mangal Tuesdays) fall
  // back to the most recent bot-spots so the chat keeps showing last
  // Tuesday's sightings instead of emptying out to a lone question. The
  // off-day banner already frames these as "recent". Strict bot-only
  // (the `[bot:` provenance tag) so user/admin uploads stay out of chat.
  const botSpotRecords = spotRecords.filter(
    (s) => s.photoUrl && (s.caption ?? "").includes("[bot:"),
  );
  const liveBotSpotRecords = botSpotRecords.filter(
    (s) => s.expiresAt > new Date(),
  );
  const chatSpotRecords =
    liveBotSpotRecords.length > 0
      ? liveBotSpotRecords
      : botSpotRecords.slice(0, 60);
  const mentionsInitial: ChatterMention[] = [
    ...displayMentionRows.map((m): ChatterMention => ({
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
      quotedSender: null,
      bhandaraSlug: null,
      bhandaraName: null,
      senderName: null,
      createdAt: m.createdAt.toISOString(),
    })),
    // Bot-spots-with-photos go through the same chat panel, sourced from
    // chatSpotRecords above (live bot-spots, or the most recent ones as
    // an off-day fallback so last Tuesday's chat stays visible). We keep
    // lat=0/lng=0 spots here, bot photos auto-publish at 0,0 because
    // WhatsApp strips EXIF GPS, and the chat should still show the photo;
    // the heatmap filters 0,0 separately so no ghost pin lands on null
    // island. STRICT WHATSAPP-ONLY (the `[bot:` tag) is enforced when
    // chatSpotRecords is built, so user/admin uploads never reach chat.
    ...chatSpotRecords.map((s): ChatterMention => {
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
          photoUrls: [s.photoUrl!, ...extras].filter((u) => !isHiddenPublicPhoto(null, u)),
          quotedText: null,
          quotedSender: null,
          bhandaraSlug: s.bhandara?.slug ?? null,
          bhandaraName: cleanName(s.bhandara?.name),
          senderName: null,
          createdAt: s.createdAt.toISOString(),
        };
      }),
  ]
    .sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
    )
    // 500 matches LiveChatterBoard's MAX_CARDS so the SSR payload
    // covers a peak Tuesday with headroom. Previously .slice(0, 30)
    // silently truncated mentionsInitial regardless of the take cap
    // above, which made the chat panel land at exactly 30 mentions
    // even when the DB had 60+. Then bumped to 200, hit the cap on
    // Bada Mangal #4 (244+ signals in 12h). Now 500.
    .slice(0, 500);

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
        (u): u is string => Boolean(u) && !isHiddenPublicPhoto(null, u),
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

  return {
    records,
    stats,
    spotRecords,
    displayListings,
    isPastSeason,
    liveSpots,
    liveSpotsWithCoords,
    heatmapFallbackSpots,
    feedInitial,
    mentionsInitial,
    galleryItems,
    communityCounterRows,
    threadMentionRows,
  };
}

export type HomepageData = Awaited<ReturnType<typeof loadHomepageData>>;
