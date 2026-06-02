"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import NearMeButton, { type NearMeState } from "@/components/NearMeButton";
import { haversineKm } from "@/lib/geo";
import { trackEvent } from "@/lib/ga";
import { useToast } from "@/components/Toast";
import { SunburstSpark } from "@/components/ornaments";
import type { Locale } from "@/content/strings";
import { strings } from "@/content/strings";
import { useLocaleFromContext } from "@/lib/locale-context";
import {
  hasMapPin,
  spotShareText,
  whatsappShareUrlForSpot,
} from "@/lib/share";

const NEAR_ME_RADIUS_KM = 3;

export type LiveSpot = {
  id: string;
  lat: number;
  lng: number;
  area: string | null;
  address: string | null;
  photoUrl: string | null;
  /** Optional: full photo list when the submitter attached extras
   *  via Spot.extraPhotoUrls. Primary first, then up to 4 extras.
   *  Card renders an in-place carousel when length > 1. Falls back
   *  to [photoUrl] when omitted so legacy callers keep working. */
  photoUrls?: string[];
  caption: string | null;
  reporterName: string | null;
  createdAt: string;
  expiresAt: string;
  bhandaraSlug: string | null;
  bhandaraName: string | null;
  bhandaraNameHi: string | null;
};

type Props = {
  initial: LiveSpot[];
  /** Optional, ignored at runtime, locale resolves from the
   *  LocaleProvider context so the Hindi toggle flips the heading
   *  ("bhandaras spotted live") and every label below without a
   *  server-tree refresh. Kept on the type for back-compat. */
  locale?: Locale;
};

const POLL_MS = 15_000;

export default function HappeningNow({ initial }: Props) {
  // Cookie-aware locale from context; the locale prop is ignored
  // (kept for API back-compat with callers).
  const locale = useLocaleFromContext();
  const t = strings[locale];
  const isHi = locale === "hi";
  const [spots, setSpots] = useState<LiveSpot[]>(initial);
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [near, setNear] = useState<NearMeState>({ status: "idle", coords: null });

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        // Pull the full live set, not just 24. The grid still only
        // *renders* 15 cards (slice below), but the heading counter
        // (`nearbySpots.length`) reads from this same `spots` array,
        // so capping the poll at 24 made the headline drop from "60
        // spotted live" to "24 spotted live" the moment the first
        // poll fired. /api/spots is now clamped at 500 too.
        const res = await fetch("/api/spots?limit=500", { cache: "no-store" });
        if (!alive || !res.ok) return;
        const data = (await res.json()) as { spots: LiveSpot[] };
        // Don't wipe the server-provided recent fallback with an empty
        // live poll on off-days; only replace when the poll has data.
        if (data.spots.length > 0) setSpots(data.spots);
      } catch {
        /* ignore */
      }
    };
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  // Apply Near-Me filter first (3 km), then anything below uses `nearbySpots`
  // as the source of truth so counters and grids stay in sync.
  const nearbySpots = useMemo(() => {
    if (near.status !== "active" || !near.coords) return spots;
    const c = near.coords;
    return spots.filter(
      (s) => haversineKm(c, { lat: s.lat, lng: s.lng }) <= NEAR_ME_RADIUS_KM,
    );
  }, [spots, near]);

  // Split nearbySpots by coord-validity so the heading can show a
  // truthful breakdown: "M on map · K without location". The bot
  // pipeline occasionally creates Spots with lat=0/lng=0 when the
  // source WhatsApp message has neither a location share nor EXIF
  // on the photo. Those rows still represent a real spotted
  // bhandara (we have the photo + sender), they just can't be
  // pinned yet, the operator fills coords in /admin/spots. We want
  // visitors to see the full count without pretending the orphans
  // don't exist.
  const onMapCount = useMemo(
    () => nearbySpots.filter((s) => s.lat !== 0 || s.lng !== 0).length,
    [nearbySpots],
  );
  const orphanCount = nearbySpots.length - onMapCount;

  // Are any of these spots genuinely live right now (still inside their
  // 8h TTL)? Drives the live pulse + "spotted live" wording. On off-days
  // the array is the recent fallback (all expired), so this is false and
  // the section honestly reads as "recently spotted" rather than faking
  // a live state for influencer-driven off-day traffic.
  const liveNow = useMemo(
    () => nearbySpots.some((s) => new Date(s.expiresAt).getTime() > Date.now()),
    [nearbySpots],
  );

  // Per-area counters for the chips row.
  const byArea = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of nearbySpots) {
      const k = s.area ?? ",";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [nearbySpots]);

  return (
    <section
      aria-label={isHi ? "अभी हो रहा है" : "Happening now"}
      className="relative mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16"
    >
      {/* Header row */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="font-mukta uppercase tracking-[0.32em] text-saffron-600 text-xs font-semibold inline-flex items-center gap-2">
            {liveNow ? (
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-saffron-600 opacity-50 motion-safe:animate-ping" />
                <span className="relative h-2 w-2 rounded-full bg-saffron-600" />
              </span>
            ) : null}
            {liveNow
              ? isHi
                ? "अभी हो रहा है"
                : "Happening now"
              : isHi
                ? "हाल ही में देखे गए"
                : "Recently spotted"}
          </p>
          <h2
            className={`mt-2 text-3xl sm:text-4xl ${
              isHi
                ? "font-tiro text-sindoor-700"
                : "font-fraunces font-bold text-sindoor-700"
            }`}
          >
            {/* Saffron count prefix, mirrors the "19 Bhandaras listed
                across the city" treatment so the live-spot count
                shares the same editorial-number language. The span
                inherits Fraunces / Tiro from the parent so the digit
                reads as one continuous headline. */}
            <span className="text-saffron-600 tabular-nums mr-1">
              {nearbySpots.length}
            </span>
            {liveNow
              ? isHi
                ? "भंडारे लाइव"
                : "bhandaras spotted live"
              : isHi
                ? "भंडारे हाल ही में देखे गए"
                : "bhandaras spotted recently"}
          </h2>
          <p className="mt-1 text-sm text-ink-600">
            {liveNow
              ? isHi
                ? "लखनऊ-वालों के द्वारा भेजी गई तस्वीरें, बीते 8 घंटों में।"
                : "Photos sent by Lucknow walkers in the last 8 hours."
              : isHi
                ? "पिछले बड़े मंगल की झलकियाँ, लखनऊ-वालों के द्वारा।"
                : "Recent sightings from the last Bada Mangal."}
          </p>
          {/* Breakdown chips (on map / without location) used to live
              here under the subtitle; moved 2026-05-30 into the single
              inline meta row below the header so they sit on the SAME
              line as the area-filter tags. */}
        </div>
        <Link
          href="/spot"
          data-ga="cta_happening_spot"
          className="btn btn-primary btn-sm"
        >
          <IconCamera />
          {isHi ? "भंडारा स्पॉट करें" : "Spot a bhandara"}
        </Link>
      </div>

      {/* Inline meta row: the on-map / without-location breakdown sits
          on the SAME line as the clickable area-filter tags (operator
          request 2026-05-30, the area tags must not drop to a second
          line). One horizontally-scrollable strip, scrollbar hidden,
          negative margin so it bleeds to the section edges, shrink-0 on
          every chip so nothing compresses. A thin gold rule separates
          the read-only breakdown chips from the interactive filters.

          Breakdown: how many of the spotted-live total are pinned on
          the map vs sitting without coords (bot ingests with neither a
          location share nor photo EXIF land at 0,0). We keep those in
          the public count but flag the gap so the MapBoard "Spotted N"
          chip not matching this heading reads as honesty, not a bug. */}
      {nearbySpots.length > 0 ? (
        <div
          className="mt-4 -mx-4 sm:-mx-6 flex items-center gap-2 overflow-x-auto px-4 sm:px-6 text-xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-saffron-50 border border-saffron-500/40 text-ink-900 px-2.5 py-1">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-saffron-600" />
            <span className="font-numerals tabular-nums font-semibold">
              {onMapCount}
            </span>
            <span className="text-ink-600">
              {isHi ? "नक़्शे पर" : "on map"}
            </span>
          </span>
          {orphanCount > 0 ? (
            <span
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-cream-50 border border-ink-600/25 text-ink-900 px-2.5 py-1"
              title={
                isHi
                  ? "लोकेशन के बिना भेजे गए, मॉडरेटर जल्द जोड़ देंगे।"
                  : "Sent without a location pin, moderator will add coords shortly."
              }
            >
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ink-600/55" />
              <span className="font-numerals tabular-nums font-semibold">
                {orphanCount}
              </span>
              <span className="text-ink-600">
                {isHi ? "बिना लोकेशन" : "without location"}
              </span>
            </span>
          ) : null}

          {/* Divider, only when there are area tags to set apart. */}
          {byArea.length > 0 ? (
            <span aria-hidden className="shrink-0 h-4 w-px bg-gold-500/50" />
          ) : null}

          {/* Clickable area-filter tags */}
          {byArea.length > 0 && areaFilter !== null ? (
            <button
              type="button"
              onClick={() => {
                trackEvent("happening_area_filter_clear");
                setAreaFilter(null);
              }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink-600/30 bg-cream-50 px-3 py-1 text-ink-900 hover:border-sindoor-700 transition-colors"
            >
              <span aria-hidden>×</span>
              <span className="font-medium">{isHi ? "सभी" : "All"}</span>
            </button>
          ) : null}
          {byArea.map(([a, n]) => {
            const active = areaFilter === a;
            return (
              <button
                key={a}
                type="button"
                onClick={() => {
                  trackEvent("happening_area_filter", { area: a });
                  setAreaFilter(active ? null : a);
                }}
                aria-pressed={active}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 transition-colors ${
                  active
                    ? "bg-saffron-600 border-saffron-600 text-cream-50 shadow-warm"
                    : "bg-saffron-50 border-saffron-500/40 text-ink-900 hover:border-saffron-500"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    active ? "bg-cream-50" : "bg-saffron-600"
                  }`}
                />
                <span className="font-medium">
                  {a === "," ? (isHi ? "अन्य" : "Other") : t.areas[a] ?? a}
                </span>
                <span
                  className={`font-numerals tabular-nums font-semibold ${
                    active ? "text-cream-50" : "text-saffron-600"
                  }`}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Spot cards (filtered by near-me + selected area, if any) */}
      {(() => {
        const filtered =
          areaFilter === null
            ? nearbySpots
            : nearbySpots.filter((s) => (s.area ?? ",") === areaFilter);
        if (filtered.length === 0) {
          // Area-filtered empty state stays terse; the *whole-section*
          // empty state (no area selected, no spots at all) gets the
          // rich marquee-style preview so the homepage carries one
          // strong empty-state surface, not two.
          if (areaFilter !== null) {
            return (
              <div className="mt-8 rounded-3xl border border-dashed border-gold-500/45 bg-cream-50 px-6 py-10 text-center">
                <p className="text-ink-600">
                  {isHi
                    ? "इस क्षेत्र में अभी कोई स्पॉट नहीं।"
                    : "No live spots in this area yet."}
                </p>
                <Link
                  href="/spot"
                  data-ga="cta_happening_spot_empty"
                  className="mt-4 inline-flex btn btn-ghost btn-sm"
                >
                  {isHi ? "स्पॉट करें" : "Spot one"}
                </Link>
              </div>
            );
          }
          return <HappeningNowEmpty isHi={isHi} />;
        }
        return (
          // Denser grid for the live-feed redesign. Goes 1 → 2 → 3 →
          // 4 → 5 columns as the viewport grows. The chat-style sender
          // header at the top of each card lets us pack more cards
          // visually because the "this is from a real person" signal
          // lands in 1.5 lines instead of needing the whole card to
          // breathe. 15 cards = exactly 3 rows at xl (5-col), 4 rows
          // at md (4-col), 5 rows at sm (3-col), 8 rows at xs (2-col).
          // The /api/spots fetch pulls up to 500, so the slice is the
          // only display cap.
          <ol className="mt-6 grid gap-3 grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {filtered.slice(0, 15).map((s) => (
              <SpotCard
                key={s.id}
                spot={s}
                locale={locale}
                userCoords={near.status === "active" ? near.coords : null}
              />
            ))}
          </ol>
        );
      })()}

      {spots.length > 15 ? (
        <div className="mt-6 text-center">
          <Link
            href="/live"
            data-ga="cta_happening_view_all"
            className="text-sm text-saffron-600 hover:underline"
          >
            {isHi ? "सभी देखें →" : "View all live posts →"}
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function SpotCard({
  spot,
  locale,
  userCoords,
}: {
  spot: LiveSpot;
  locale: Locale;
  userCoords: { lat: number; lng: number } | null;
}) {
  const isHi = locale === "hi";
  const t = strings[locale];
  const toast = useToast();
  const bhandaraName = isHi
    ? spot.bhandaraNameHi ?? spot.bhandaraName
    : spot.bhandaraName;
  const areaLabel = spot.area ? t.areas[spot.area] ?? spot.area : null;

  // Distance + travel-time only when the user has shared their location.
  // Travel time = distance / 22 km·h (a realistic Lucknow-traffic average),
  // floored to whole minutes; under 1 km we show metres.
  const distance = userCoords
    ? haversineKm(userCoords, { lat: spot.lat, lng: spot.lng })
    : null;
  const minutes =
    distance !== null ? Math.max(1, Math.round((distance / 22) * 60)) : null;
  const distanceLabel =
    distance !== null
      ? distance < 1
        ? `${Math.round(distance * 1000)} m`
        : `${distance.toFixed(1)} km`
      : null;

  // "Fresh" = posted in the last 10 minutes. Gets a stronger saffron
  // border + ring so the eye lands on the brand-new posts first, the
  // most valuable behaviour during a live event. 10 min ≈ the window
  // where the food is likely still being served and the photo is
  // still actionable. After that the card joins the rest of the feed.
  const ageMs = Date.now() - new Date(spot.createdAt).getTime();
  const isFresh = ageMs >= 0 && ageMs < 10 * 60_000;

  // Reporter avatar = first letter of name. When no name is present
  // (legacy rows, edge cases) we fall back to a dot so the chat-style
  // header still renders and the layout doesn't jump between cards.
  const reporterInitial = spot.reporterName
    ? spot.reporterName.trim().charAt(0).toUpperCase()
    : null;

  // Bot-ingested spots can land with lat=0/lng=0 (WhatsApp strips EXIF
  // until admin sets coords). When that's the case we hide the
  // "Get directions" button entirely, a maps link to 0,0 drops the
  // user in the Gulf of Guinea. The card still shows the photo +
  // caption + reporter + relative time; the directions row simply
  // doesn't render.
  const hasPin = hasMapPin(spot);
  const directionsUrl = hasPin
    ? `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`
    : null;
  // Share message comes from the shared lib/share builder so that the
  // wording stays in sync with the bhandara share + the popup share
  // on the map. The intro + closer match the bhandara share's voice
  // so recipients who get both kinds of message see one consistent
  // brand voice ("Jai Shri Ram. Jai Hanuman.").
  const waUrl = whatsappShareUrlForSpot(
    {
      lat: spot.lat,
      lng: spot.lng,
      caption: spot.caption,
      area: spot.area,
      address: spot.address,
      bhandaraSlug: spot.bhandaraSlug,
    },
    locale,
  );

  // Distance / ETA chip, pulled out so we can render it inside both
  // the photo and the no-photo branches without duplicating the JSX.
  const distanceChip = distanceLabel ? (
    <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-cream-50/95 backdrop-blur border border-saffron-500/45 px-2 py-0.5 text-[10px] font-semibold text-sindoor-700 shadow-warm">
      <span className="font-numerals tabular-nums">{distanceLabel}</span>
      <span className="text-ink-600/70" aria-hidden>·</span>
      <span className="font-numerals tabular-nums">
        {isHi ? `~${minutes} मि.` : `~${minutes} min`}
      </span>
    </span>
  ) : null;

  // LIVE pulse, same treatment, lifted into a const so both photo
  // and no-photo branches use it identically.
  const liveBadge = (
    <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-saffron-600 text-cream-50 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] font-bold shadow-warm">
      <span className="block w-1.5 h-1.5 rounded-full bg-cream-50 motion-safe:animate-pulse" />
      {isHi ? "लाइव" : "Live"}
    </span>
  );

  const inner = (
    <article
      className={`group relative h-full rounded-2xl overflow-hidden bg-cream-50 shadow-warm flex flex-col transition-all border ${
        isFresh
          ? "border-saffron-600 ring-2 ring-saffron-600/25"
          : "border-saffron-500/40 hover:border-saffron-500"
      }`}
    >
      {/* Chat-style sender header. Always renders, reinforces "real
          photo from a real person right now" instead of the old card
          which read more like a generic listing. The avatar is a
          one-letter initial chip (no real avatars for privacy /
          performance), the name truncates, and the time-ago lives
          on the right. When reporterName is missing (legacy rows /
          bot ingestion edge cases) the header still shows a neutral
          "Spotted live" label so the layout doesn't jump card-to-card. */}
      <header className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 border-b border-saffron-500/25 bg-saffron-50/60">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            aria-hidden
            className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-cream-50 text-[10px] font-semibold shrink-0 ${
              reporterInitial ? "bg-saffron-600" : "bg-saffron-500/70"
            }`}
          >
            {reporterInitial ?? "•"}
          </span>
          <span
            className="text-[11px] font-medium text-ink-900 truncate min-w-0"
            title={spot.reporterName ?? undefined}
          >
            {spot.reporterName ?? (isHi ? "किसी ने भेजा" : "Spotted live")}
          </span>
        </div>
        <span className="text-[10px] text-ink-600 tabular-nums shrink-0">
          {relative(spot.createdAt, isHi)}
        </span>
      </header>

      {/* Photo (optional). `object-cover` fills the whole square and
          center-crops the photo, which trades preserving the full
          composition for a uniform, dense feed where every card reads
          like a thumbnail of "what's being served right now". The
          earlier `object-contain` + blurred backdrop treatment was
          dropped here because vertical phone photos were ending up
          ~50% empty space inside the card, which made the live feed
          look sparser than the activity actually was. BhandaraCard
          (curated listings) keeps the contain treatment because
          those rows are often promotional posters where full content
          matters more than visual rhythm. LIVE + distance badges sit
          INSIDE the photo wrapper so the chat-style header above
          doesn't affect their absolute positioning. */}
      {spot.photoUrl ? (
        <LiveSpotPhotoCarousel
          photos={
            spot.photoUrls && spot.photoUrls.length > 0
              ? spot.photoUrls
              : [spot.photoUrl]
          }
          alt={spot.caption ?? ""}
          liveBadge={liveBadge}
          distanceChip={distanceChip}
        />
      ) : (
        <div
          className="relative aspect-square w-full flex items-center justify-center"
          style={{
            background:
              "radial-gradient(420px 260px at 50% 40%, rgba(242,148,76,0.22), transparent 70%), #FFF7EB",
          }}
        >
          <SunburstSpark
            size={72}
            className="text-saffron-600 opacity-60 transition-transform duration-500 group-hover:scale-105 group-hover:rotate-[8deg]"
          />
          {liveBadge}
          {distanceChip}
        </div>
      )}

      {/* Info, bhandara name (if linked) + caption + area pill.
          Time-ago moved to the chat header above, so this block is
          just "what + where" now. */}
      <div className="px-3 py-2 flex-1 flex flex-col gap-1">
        {bhandaraName ? (
          <p
            className={`text-sm font-semibold leading-tight line-clamp-1 ${
              isHi ? "font-deva text-sindoor-700" : "font-fraunces text-sindoor-700"
            }`}
          >
            {bhandaraName}
          </p>
        ) : null}
        {spot.caption ? (
          <p className="text-xs text-ink-900 line-clamp-2">{spot.caption}</p>
        ) : null}
        {areaLabel ? (
          <p className="mt-auto text-[10px] text-ink-600 flex items-center gap-1">
            <IconPinMini />
            <span className="truncate">{areaLabel}</span>
          </p>
        ) : null}

        {/* Action bar: three same-size circular icon-only chips ,
            Directions (saffron-filled, primary CTA), Share (green
            outline), Copy (saffron outline). Earlier iterations had
            Directions as a wide text pill which broke the visual
            rhythm at 5-col grid widths and dominated the tiny info
            block. All three actions now share the same w-9 h-9
            chip pattern so the action row reads as a tight three-
            button cluster. Hover tooltips + aria-labels keep
            "Get directions" discoverable for keyboard / screen-reader
            users. `relative z-20` keeps these anchors above the
            stretched-link overlay so they remain independently
            clickable. */}
        <div className="relative z-20 mt-1 flex items-center gap-1.5 flex-wrap">
          {directionsUrl ? (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(e) => {
                e.stopPropagation();
                trackEvent("happening_get_directions", {
                  spot_id: spot.id,
                  has_user_coords: userCoords ? 1 : 0,
                });
              }}
              aria-label={isHi ? "रास्ता बताएँ" : "Get directions"}
              title={isHi ? "रास्ता बताएँ" : "Get directions"}
              className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 shadow-warm transition-colors"
            >
              <IconPin />
            </a>
          ) : null}
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => {
              e.stopPropagation();
              trackEvent("happening_share_spot", { spot_id: spot.id });
            }}
            aria-label={isHi ? "व्हाट्सएप पर शेयर" : "Share on WhatsApp"}
            title={isHi ? "व्हाट्सएप पर शेयर" : "Share on WhatsApp"}
            className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full border border-leaf-600/55 bg-cream-50 hover:bg-leaf-600/10 text-leaf-600 transition-colors"
          >
            <IconWhatsapp />
          </a>
          <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation();
              const btn = e.currentTarget;
              try {
                // Copy the FULL warm share text (intro + caption +
                // place + BadaMangal link + Google Maps link + closer)
                // instead of the bare maps URL. Matches what the
                // WhatsApp share button sends, so a paste into any
                // messenger produces a complete invite. See
                // lib/share.ts for the message shape.
                await navigator.clipboard.writeText(
                  spotShareText(
                    {
                      lat: spot.lat,
                      lng: spot.lng,
                      caption: spot.caption,
                      area: spot.area,
                      address: spot.address,
                      bhandaraSlug: spot.bhandaraSlug,
                    },
                    locale,
                  ),
                );
                trackEvent("happening_copy_link", { spot_id: spot.id });
                btn.dataset.copied = "1";
                window.setTimeout(() => {
                  delete btn.dataset.copied;
                }, 1200);
                toast.show(isHi ? "संदेश कॉपी हो गया" : "Message copied");
              } catch {
                toast.show(
                  isHi ? "कॉपी नहीं हुआ" : "Couldn't copy",
                  "error",
                );
              }
            }}
            aria-label={isHi ? "संदेश कॉपी करें" : "Copy share message"}
            title={isHi ? "संदेश कॉपी करें" : "Copy share message"}
            className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full border border-saffron-500/45 bg-cream-50 hover:bg-saffron-50 text-saffron-600 transition-colors data-[copied]:bg-leaf-600 data-[copied]:border-leaf-600 data-[copied]:text-cream-50"
          >
            <IconCopy />
          </button>
        </div>
      </div>

      {/* Stretched-link overlay. Every spot card is clickable, taps
          outside the action-bar land the user on the /live timeline
          scrolled to this exact post. /live PostCard renders
          `id={post.id}` so the URL fragment `#spot:<id>` resolves
          natively without JS. z-[5] sits ABOVE the photo / info
          (static, z-auto) but BELOW the action bar (z-20) so the
          inner Directions / Share / Copy anchors stay clickable
          without nesting <a> in <a>. Header sits above the link in
          DOM order so the avatar + name still render through the
          transparent overlay. */}
      <Link
        href={`/live${isHi ? "" : "?lang=en"}#spot:${spot.id}`}
        onClick={() =>
          trackEvent("happening_open_in_live", { spot_id: spot.id })
        }
        aria-label={
          bhandaraName
            ? `${bhandaraName} ${isHi ? "- लाइव फ़ीड में देखें" : "- view in live feed"}`
            : isHi
              ? "लाइव फ़ीड में देखें"
              : "View in live feed"
        }
        className="absolute inset-0 z-[5] rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-600/60"
      />
    </article>
  );

  return <li className="h-full">{inner}</li>;
}

function relative(iso: string, isHi: boolean): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return isHi ? "अभी-अभी" : "just now";
  if (m < 60) return isHi ? `${m} मिनट पहले` : `${m} min ago`;
  const h = Math.floor(m / 60);
  return isHi ? `${h} घंटे पहले` : `${h} hr ago`;
}

function IconPinMini() {
  // 9px pin glyph used as the area marker in the bottom info row of
  // each spot card. Stroke-current keeps it inheriting the surrounding
  // `text-ink-600` tone so it sits quiet next to the area name.
  // Smaller than the action-bar IconPin (which is 11px) because this
  // is decorative metadata, not a CTA glyph.
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      <path d="M12 21s-6.5-7-6.5-12a6.5 6.5 0 1 1 13 0c0 5-6.5 12-6.5 12z" />
      <circle cx="12" cy="9" r="2.25" />
    </svg>
  );
}

function IconWhatsapp() {
  return (
    <svg width="13" height="13" viewBox="0 0 32 32" fill="currentColor" aria-hidden>
      <path d="M16 3C8.82 3 3 8.82 3 16c0 2.29.6 4.43 1.65 6.3L3 29l6.86-1.62A12.95 12.95 0 0 0 16 29c7.18 0 13-5.82 13-13S23.18 3 16 3zm0 23.5c-1.93 0-3.74-.5-5.32-1.4l-.38-.22-4.07.96.97-3.96-.25-.4A10.5 10.5 0 1 1 16 26.5zm6.06-7.86c-.33-.17-1.96-.97-2.27-1.08-.3-.11-.52-.17-.74.17-.22.33-.85 1.07-1.04 1.29-.19.22-.38.25-.71.08-.33-.17-1.4-.52-2.66-1.65-.98-.88-1.65-1.96-1.84-2.29-.19-.33-.02-.51.15-.67.15-.15.33-.39.5-.58.16-.19.22-.33.33-.55.11-.22.06-.41-.03-.58-.08-.17-.74-1.79-1.01-2.45-.27-.66-.55-.57-.74-.58l-.63-.01a1.21 1.21 0 0 0-.88.41c-.3.33-1.15 1.13-1.15 2.75 0 1.62 1.18 3.19 1.34 3.41.16.22 2.32 3.55 5.62 4.97 2.61 1.13 3.14 1.06 3.71.99.57-.06 1.84-.75 2.1-1.48.26-.73.26-1.36.18-1.49-.08-.13-.3-.21-.63-.38z" />
    </svg>
  );
}
function IconCopy() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function IconPin() {
  // Slightly bolder + larger than IconPinMini because this is the
  // glyph for the icon-only Directions chip, needs to read at a
  // glance against the saffron fill. 13px matches IconWhatsapp's
  // optical weight inside the same w-9 h-9 chip pattern.
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s-6.5-7-6.5-12a6.5 6.5 0 1 1 13 0c0 5-6.5 12-6.5 12z" />
      <circle cx="12" cy="9" r="2.25" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7h3l2-2h8l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

/**
 * Whole-section empty state for Happening Now.
 *
 * IMPORTANT design constraint: do NOT render anything that visually
 * resembles a real spot card. An earlier version showed three brand-
 * tinted "ghost cards" with photo placeholders + italic captions, and
 * usability testing showed users mistook them for real bhandaras.
 *
 * The fix: a single editorial moment, clear empty-state headline,
 * one strong CTA, and (below) an unmistakably abstract 3-step diagram
 * that explains *how* the section fills, not *what* the future cards
 * look like. The three steps use big circular icons + short labels,
 * separated by arrows, in a layout no reasonable person would parse
 * as "real bhandara listings".
 */
function HappeningNowEmpty({ isHi }: { isHi: boolean }) {
  const steps: Array<{ icon: React.ReactNode; label: string }> = [
    {
      icon: <StepIconCamera />,
      label: isHi ? "एक फ़ोटो लें" : "Take a photo",
    },
    {
      icon: <StepIconPin />,
      label: isHi ? "लोकेशन पिन करें" : "Pin the location",
    },
    {
      icon: <StepIconBroadcast />,
      label: isHi ? "लाइव फ़ीड पर आ जाता है" : "Lands on the live feed",
    },
  ];

  return (
    <div className="relative mt-8 rounded-3xl overflow-hidden border border-gold-500/30 bg-cream-50">
      {/* Soft saffron radial wash so the empty state has visual weight */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 320px at 50% -10%, rgba(242,148,76,0.16), transparent 70%), radial-gradient(700px 280px at 50% 110%, rgba(156,42,42,0.05), transparent 70%)",
        }}
      />

      <div className="px-4 sm:px-6 py-10 sm:py-12">
        {/* Centered editorial moment */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mukta uppercase tracking-[0.28em] text-saffron-600 text-[0.65rem] font-semibold inline-flex items-center gap-2 justify-center">
            <span aria-hidden className="text-base leading-none">🪔</span>
            {isHi
              ? "लाइव फ़ीड · आज की पहली तस्वीर का इंतज़ार"
              : "Live feed · waiting for today's first photo"}
          </p>
          <h3 className="mt-3 font-fraunces font-semibold text-2xl sm:text-3xl text-sindoor-700 leading-tight [text-wrap:balance]">
            {isHi ? (
              <>
                अभी कोई भंडारा{" "}
                <span className="text-saffron-600">रिपोर्ट नहीं हुआ है</span>।
              </>
            ) : (
              <>
                No bhandara has been{" "}
                <span className="text-saffron-600">spotted yet today</span>.
              </>
            )}
          </h3>
          <p className="mt-3 text-sm text-ink-600 leading-relaxed max-w-lg mx-auto">
            {isHi
              ? "जैसे ही कोई व्यक्ति लखनऊ में किसी भंडारे की फ़ोटो भेजेगा, वह यहाँ दिखाई देगी।"
              : "As soon as anyone in Lucknow sends a photo of a bhandara they walked past, it shows up here."}
          </p>
          <Link
            href="/spot"
            data-ga="cta_happening_empty_spot"
            className="btn btn-primary btn-lg mt-6 inline-flex items-center gap-2"
          >
            <IconCamera />
            {isHi ? "पहले व्यक्ति बनें" : "Be the first to spot one"}
          </Link>
        </div>

        {/* "How it works", abstract 3-step diagram. Big circular
            icons + arrows. No avatars, no names, no italic quotes,
            no card-like shapes, visually unmistakable as "process",
            not "content". */}
        <div className="mt-10">
          <p className="text-center text-[10px] uppercase tracking-[0.32em] text-gold-500/80 font-mukta font-semibold mb-5">
            {isHi ? "कैसे काम करता है" : "How it works"}
          </p>
          <ol className="flex items-start justify-center gap-3 sm:gap-6 max-w-3xl mx-auto">
            {steps.map((step, i) => (
              <li
                key={i}
                className="contents"
              >
                <div className="flex flex-col items-center gap-2 flex-1 min-w-0 max-w-[10rem] text-center">
                  <span
                    aria-hidden
                    className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-saffron-50 border border-saffron-500/40 text-saffron-600 shadow-warm"
                  >
                    {step.icon}
                  </span>
                  <span className="text-[11px] sm:text-xs font-medium text-ink-900 leading-snug">
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 ? (
                  <span
                    aria-hidden
                    className="hidden sm:flex items-center text-gold-500/55 text-lg pt-4"
                  >
                    →
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

/* ── Big circular icons used by the empty-state's "How it works" row ── */

function StepIconCamera() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 7h3l2-2h8l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
function StepIconPin() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 21s-7-7-7-12a7 7 0 1 1 14 0c0 5-7 12-7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}
function StepIconBroadcast() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12a7 7 0 0 1 14 0" />
      <path d="M3 12a9 9 0 0 1 18 0" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

/**
 * Square photo wrapper for a Live spot card. When the spot carries
 * just one photo it behaves exactly like the old static img; when
 * it carries multiple (Spot.extraPhotoUrls populated by the public
 * /spot form), the wrapper grows two small black/65 prev/next chips
 * on the photo edges + a "n / N" counter pill in the bottom-left,
 * mirroring the in-bubble carousel on the LiveChatterBoard. Click
 * handlers stopPropagation so cycling photos doesn't trigger the
 * card's outer Link to /bhandara/<slug>.
 */
function LiveSpotPhotoCarousel({
  photos,
  alt,
  liveBadge,
  distanceChip,
}: {
  photos: string[];
  alt: string;
  liveBadge: React.ReactNode;
  distanceChip: React.ReactNode;
}) {
  const [idx, setIdx] = useState(0);
  const safeIdx = Math.max(0, Math.min(idx, photos.length - 1));
  const showControls = photos.length > 1;
  const goPrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIdx((i) => (i - 1 + photos.length) % photos.length);
  };
  const goNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIdx((i) => (i + 1) % photos.length);
  };
  return (
    <div className="relative aspect-square w-full overflow-hidden bg-saffron-50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={photos[safeIdx]}
        src={photos[safeIdx]}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover"
      />
      {liveBadge}
      {distanceChip}
      {showControls ? (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-7 h-7 rounded-full bg-black/65 hover:bg-black/85 text-cream-50 text-base leading-none ring-1 ring-cream-50/20 shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-500"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-7 h-7 rounded-full bg-black/65 hover:bg-black/85 text-cream-50 text-base leading-none ring-1 ring-cream-50/20 shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-500"
          >
            ›
          </button>
          <span
            aria-hidden
            className="absolute bottom-2 left-2 inline-flex items-center text-[10px] font-semibold tabular-nums px-2 py-0.5 rounded-full bg-black/65 text-cream-50 ring-1 ring-cream-50/20"
          >
            {safeIdx + 1} / {photos.length}
          </span>
        </>
      ) : null}
    </div>
  );
}
