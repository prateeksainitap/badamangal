"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import BhandaraMap from "@/components/BhandaraMap";
import MapSideList, {
  type SideListFilter,
  type SideListSpot,
} from "@/components/MapSideList";
import NearMeButton, { type NearMeState } from "@/components/NearMeButton";
import { trackEvent } from "@/lib/ga";
import type { Bhandara } from "@/types/bhandara";
import type { Locale } from "@/content/strings";

type LiveSpotInput = {
  id: string;
  lat: number;
  lng: number;
  area: string | null;
  caption: string | null;
  photoUrl: string | null;
  createdAt: string;
  bhandaraSlug: string | null;
  bhandaraName: string | null;
  bhandaraNameHi: string | null;
};

type Filter = "all" | "listed" | "spotted";

type Props = {
  locale: Locale;
  isHi: boolean;
  heading: string;
  body: string;
  listBhandaraLabel: string;
  listings: Bhandara[];
  liveSpots: LiveSpotInput[];
};

/**
 * Client wrapper that owns the filter state for the homepage map board.
 *
 * Renders the section heading row (with the filter chip strip and the
 * "Add a bhandara" CTA), the map, the map's two-marker legend, and the
 * side list — all derived from the same filtered slice of listings +
 * live spots so the map and the side list never disagree.
 */
export default function MapBoard({
  locale,
  isHi,
  heading,
  body,
  listBhandaraLabel,
  listings,
  liveSpots,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  // Near-me state lives at the board level so the trigger button can sit
  // in the top toolbar (next to the filter pills) while still controlling
  // the side list's distance filter.
  const [near, setNear] = useState<NearMeState>({
    status: "idle",
    coords: null,
  });

  const filteredListings = useMemo(
    () => (filter === "spotted" ? [] : listings),
    [filter, listings],
  );
  const filteredSpots = useMemo(
    () => (filter === "listed" ? [] : liveSpots),
    [filter, liveSpots],
  );

  /**
   * Reshape spots into the prop-shape BhandaraMap expects, memoised
   * so the reference is stable across unrelated re-renders. Without
   * this memo, an inline `.map()` literal produced a fresh array on
   * every parent render — Effect B in BhandaraMap then saw "new
   * reference" → tore down every marker → fitBounds → any open
   * popup closed and the camera snapped back to its default zoom.
   * Now the array only changes when `filteredSpots` or `isHi` does.
   */
  const mappedLiveSpots = useMemo(
    () =>
      filteredSpots.map((s) => ({
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        caption: s.caption,
        photoUrl: s.photoUrl,
        bhandaraSlug: s.bhandaraSlug,
        bhandaraName: isHi
          ? s.bhandaraNameHi ?? s.bhandaraName
          : s.bhandaraName,
      })),
    [filteredSpots, isHi],
  );

  // Pills in the filter strip; counts shown so users see how many of each
  // exist before clicking.
  const tabs: { key: Filter; label: string; count: number }[] = [
    {
      key: "all",
      label: isHi ? "सब" : "All",
      count: listings.length + liveSpots.length,
    },
    {
      key: "listed",
      label: isHi ? "लिस्टेड" : "Listed",
      count: listings.length,
    },
    {
      key: "spotted",
      label: isHi ? "स्पॉट" : "Spotted",
      count: liveSpots.length,
    },
  ];

  return (
    <section
      id="map"
      className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10"
    >
      {/* Heading row: title + filter pills + Add-a-bhandara CTA */}
      <div className="mb-3 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2
            className={`text-3xl sm:text-4xl ${
              isHi
                ? "font-tiro text-sindoor-700"
                : "font-fraunces font-bold text-sindoor-700"
            }`}
          >
            {heading}
          </h2>
          <p className="text-ink-600 mt-1">{body}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div
            role="tablist"
            aria-label={isHi ? "नक़्शा फ़िल्टर" : "Map filter"}
            className="inline-flex items-center gap-1 p-1 rounded-full bg-saffron-50/60 border border-gold-500/40"
          >
            {tabs.map((tab) => {
              const active = filter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    if (active) return;
                    setFilter(tab.key);
                    trackEvent("map_filter", { filter: tab.key });
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-saffron-600 text-cream-50 shadow-warm"
                      : "text-ink-900 hover:bg-cream-50"
                  }`}
                >
                  {tab.key === "spotted" ? (
                    <span
                      aria-hidden
                      className={`block w-1.5 h-1.5 rounded-full ${
                        active ? "bg-cream-50 motion-safe:animate-pulse" : "bg-saffron-600"
                      }`}
                    />
                  ) : null}
                  <span>{tab.label}</span>
                  <span
                    className={`font-numerals tabular-nums ${
                      active ? "text-cream-50/85" : "text-ink-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Near-me lives between the filter pills and the primary CTA so
              the user can move from "what kind" → "where" → "add new" left
              to right without scanning twice. */}
          <NearMeButton
            isHi={isHi}
            active={near.status === "active"}
            source="map_board"
            onChange={setNear}
          />
          <Link href="/list-bhandara" className="btn btn-ghost btn-sm">
            {listBhandaraLabel}
          </Link>
        </div>
      </div>

      {/* Legend, two marker types on the map. The miniature glyphs
          here mirror the real markers exactly — cream-disc backdrop
          + gada SVG for listed, the same plus a saffron pulsing ring
          for spotted — so the visitor can map "legend dot ↔ map pin"
          at a glance. The pulse uses the same `bm-pin-ring` keyframe
          the actual spot markers use, so the timing + circular
          geometry stay in sync between legend and map. */}
      <div className="mb-5 flex flex-wrap items-center gap-4 text-xs text-ink-600">
        <span className="inline-flex items-center gap-2">
          <span className="relative inline-flex h-5 w-5 items-center justify-center shrink-0">
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-cream-50 border-[1.5px] border-gold-500/55 shadow-[inset_0_1px_2px_rgba(26,20,16,0.10)]"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/map-pin-gada.svg"
              alt=""
              className="relative h-[18px] w-[18px]"
            />
          </span>
          <span>{isHi ? "सूचीबद्ध भंडारा" : "Listed bhandara"}</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="relative inline-flex h-5 w-5 items-center justify-center shrink-0">
            {/* Pulse ring — sized larger than the disc and anchored
                concentrically. Inline-styles the keyframe so the
                legend pulse and the marker pulse share one source
                of truth (bm-pin-ring lives in globals.css). */}
            <span
              aria-hidden
              className="absolute inset-[-3px] rounded-full border-2 border-saffron-500/80 pointer-events-none"
              style={{
                animation: "bm-pin-ring 1.6s ease-out infinite",
                transformOrigin: "center center",
              }}
            />
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-cream-50 border-[1.5px] border-saffron-500/65 shadow-[inset_0_1px_2px_rgba(26,20,16,0.10)]"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/map-pin-gada.svg"
              alt=""
              className="relative h-[18px] w-[18px]"
            />
          </span>
          <span>
            {isHi
              ? "अभी स्पॉट किया गया (8 घंटों के लिए लाइव)"
              : "Spotted live (active for 8 hours)"}
          </span>
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <BhandaraMap listings={filteredListings} liveSpots={mappedLiveSpots} />
        <MapSideList
          listings={filteredListings}
          liveSpots={filteredSpots as SideListSpot[]}
          locale={locale}
          isHi={isHi}
          filter={filter as SideListFilter}
          near={near}
        />
      </div>
    </section>
  );
}
