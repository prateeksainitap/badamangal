"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import NearMeButton, { type NearMeState } from "@/components/NearMeButton";
import { haversineKm } from "@/lib/geo";
import { trackEvent } from "@/lib/ga";
import { useToast } from "@/components/Toast";
import type { Locale } from "@/content/strings";
import { strings } from "@/content/strings";

const NEAR_ME_RADIUS_KM = 3;

export type LiveSpot = {
  id: string;
  lat: number;
  lng: number;
  area: string | null;
  address: string | null;
  photoUrl: string | null;
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
  locale: Locale;
};

const POLL_MS = 15_000;

export default function HappeningNow({ initial, locale }: Props) {
  const t = strings[locale];
  const isHi = locale === "hi";
  const [spots, setSpots] = useState<LiveSpot[]>(initial);
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [near, setNear] = useState<NearMeState>({ status: "idle", coords: null });

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/spots?limit=24", { cache: "no-store" });
        if (!alive || !res.ok) return;
        const data = (await res.json()) as { spots: LiveSpot[] };
        setSpots(data.spots);
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
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-saffron-600 opacity-50 motion-safe:animate-ping" />
              <span className="relative h-2 w-2 rounded-full bg-saffron-600" />
            </span>
            {isHi ? "अभी हो रहा है" : "Happening now"}
          </p>
          <h2
            className={`mt-2 text-2xl sm:text-3xl ${
              isHi ? "font-tiro text-sindoor-700" : "font-fraunces font-semibold text-sindoor-700"
            }`}
          >
            {isHi
              ? `${nearbySpots.length} भंडारे लाइव`
              : `${nearbySpots.length} bhandaras spotted live`}
          </h2>
          <p className="mt-1 text-sm text-ink-600">
            {isHi
              ? "लखनऊ-वालों के द्वारा भेजी गई तस्वीरें, बीते 8 घंटों में।"
              : "Photos sent by Lucknow walkers in the last 8 hours."}
          </p>
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

      {/* Area-counter chips, clickable filters */}
      {byArea.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {areaFilter !== null ? (
            <button
              type="button"
              onClick={() => {
                trackEvent("happening_area_filter_clear");
                setAreaFilter(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-600/30 bg-cream-50 px-3 py-1 text-xs text-ink-900 hover:border-sindoor-700 transition-colors"
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
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
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
          <ol className="mt-6 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.slice(0, 8).map((s) => (
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

      {spots.length > 8 ? (
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

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`;
  const mapsUrl = `https://www.google.com/maps?q=${spot.lat},${spot.lng}&z=18`;
  const shareText = spot.caption
    ? `${spot.caption}, live at ${mapsUrl}`
    : `Live bhandara spotted: ${mapsUrl}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  const inner = (
    <article className="group relative h-full rounded-2xl overflow-hidden border border-saffron-500/40 bg-cream-50 shadow-warm flex flex-col">
      {/* Photo (optional, fall back to a saffron empty-state with a
          temple-pin glyph when a spot was reported without a picture). */}
      {spot.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={spot.photoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="aspect-square w-full object-cover bg-saffron-50"
        />
      ) : (
        <div className="aspect-square w-full bg-saffron-50 flex items-center justify-center text-saffron-600">
          <svg
            width="42"
            height="42"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 21s7-7.58 7-13a7 7 0 1 0-14 0c0 5.42 7 13 7 13z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
        </div>
      )}
      {/* Live badge */}
      <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-saffron-600 text-cream-50 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] font-semibold">
        <span className="block w-1.5 h-1.5 rounded-full bg-cream-50 motion-safe:animate-pulse" />
        {isHi ? "लाइव" : "Live"}
      </span>
      {/* Distance/ETA chip, only when we know where the user is */}
      {distanceLabel ? (
        <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-cream-50/95 backdrop-blur border border-saffron-500/45 px-2 py-0.5 text-[10px] font-semibold text-sindoor-700 shadow-warm">
          <span className="font-numerals tabular-nums">{distanceLabel}</span>
          <span className="text-ink-600/70" aria-hidden>·</span>
          <span className="font-numerals tabular-nums">
            {isHi ? `~${minutes} मि.` : `~${minutes} min`}
          </span>
        </span>
      ) : null}
      {/* Info */}
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
        <p className="mt-auto text-[10px] text-ink-600 flex items-center gap-1.5">
          {areaLabel ? <span>{areaLabel}</span> : null}
          {areaLabel ? <span aria-hidden>·</span> : null}
          <span>{relative(spot.createdAt, isHi)}</span>
        </p>
        {/* Single-row action bar: primary Directions takes the bulk of the
            width, secondary Share + Copy collapse to icon-only chips on the
            right. Reads cleanly even on the smallest card width.
            `relative z-20` keeps these anchors above the stretched-link
            overlay so they remain independently clickable. */}
        <div className="relative z-20 mt-1 flex items-stretch gap-1.5">
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
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 text-[11px] font-semibold h-9 px-3 shadow-warm transition-colors min-w-0"
          >
            <IconPin />
            <span className="truncate">
              {isHi ? "रास्ता बताएँ" : "Get directions"}
            </span>
          </a>
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
                await navigator.clipboard.writeText(mapsUrl);
                trackEvent("happening_copy_link", { spot_id: spot.id });
                btn.dataset.copied = "1";
                window.setTimeout(() => {
                  delete btn.dataset.copied;
                }, 1200);
                toast.show(isHi ? "लिंक कॉपी हो गया" : "Link copied");
              } catch {
                toast.show(
                  isHi ? "कॉपी नहीं हुआ" : "Couldn't copy",
                  "error",
                );
              }
            }}
            aria-label={isHi ? "लिंक कॉपी करें" : "Copy link"}
            title={isHi ? "लिंक कॉपी करें" : "Copy link"}
            className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full border border-saffron-500/45 bg-cream-50 hover:bg-saffron-50 text-saffron-600 transition-colors data-[copied]:bg-leaf-600 data-[copied]:border-leaf-600 data-[copied]:text-cream-50"
          >
            <IconCopy />
          </button>
        </div>
      </div>
      {/* Stretched-link overlay — only when the spot maps to a real
          bhandara page. Sits above the photo/info but below the action
          bar (z-10 vs z-20) so the inner Directions/Share/Copy anchors
          stay clickable without nesting <a> inside <a>. */}
      {spot.bhandaraSlug ? (
        <Link
          href={`/bhandara/${spot.bhandaraSlug}${isHi ? "" : "?lang=en"}`}
          onClick={() =>
            trackEvent("happening_open_bhandara", { slug: spot.bhandaraSlug })
          }
          aria-label={bhandaraName ?? (isHi ? "भंडारा खोलें" : "Open bhandara")}
          className="absolute inset-0 z-10 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-600/60"
        />
      ) : null}
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
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
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
 * The fix: a single editorial moment — clear empty-state headline,
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

        {/* "How it works" — abstract 3-step diagram. Big circular
            icons + arrows. No avatars, no names, no italic quotes,
            no card-like shapes — visually unmistakable as "process",
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
