"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

// BhandaraMap wraps Ola Maps / MapLibre GL, ~200 KB of compressed JS
// that's only needed once the visitor scrolls to the map. Lazy-import
// it so the homepage's initial JS bundle stays light, and show a paper
// placeholder while the chunk downloads on demand. The map render is
// purely client-side (no SEO content lives inside <canvas>), so we
// skip SSR entirely.
const BhandaraMap = dynamic(() => import("@/components/BhandaraMap"), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden
      className="h-[560px] sm:h-[640px] w-full rounded-3xl border border-gold-500/40 bg-cream-50/70 animate-pulse"
    />
  ),
});
import MapSideList, {
  type SideListFilter,
  type SideListSpot,
} from "@/components/MapSideList";
import NearMeButton, { type NearMeState } from "@/components/NearMeButton";
import { trackEvent } from "@/lib/ga";
import type { Bhandara } from "@/types/bhandara";
import type { Locale } from "@/content/strings";
import { strings } from "@/content/strings";
import { useLocaleFromContext } from "@/lib/locale-context";
import { isLiveChatOpenToday } from "@/lib/live-chat-schedule";

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

/**
 * Locale-derived strings (heading, body, "List your bhandara" CTA) are
 * intentionally NOT passed as props anymore, they used to be computed
 * server-side from a hard-coded "en" locale and never re-rendered when
 * the Hindi toggle fired. Now everything text-bearing reads from the
 * client-side LocaleProvider so the toggle is instant on every label.
 * The optional props are kept on the type purely for back-compat with
 * any caller that still passes them; they're ignored at runtime.
 */
type Props = {
  locale?: Locale;
  isHi?: boolean;
  heading?: string;
  body?: string;
  listBhandaraLabel?: string;
  listings: Bhandara[];
  liveSpots: LiveSpotInput[];
  /** WhatsApp-community total, mirrored from the same counter the
   *  LiveChatterBoard reads. Drives the "X,XXX in our WhatsApp
   *  community" callout below the map heading that deep-links to
   *  #live-chat. 0 hides the chip entirely so the section header
   *  stays clean while we're bootstrapping the counter. */
  communityMembers?: number;
};

/**
 * Client wrapper that owns the filter state for the homepage map board.
 *
 * Renders the section heading row (with the filter chip strip and the
 * "Add a bhandara" CTA), the map, the map's two-marker legend, and the
 * side list, all derived from the same filtered slice of listings +
 * live spots so the map and the side list never disagree.
 */
export default function MapBoard({
  listings,
  liveSpots,
  communityMembers = 0,
}: Props) {
  // Locale + every locale-derived string comes from the client-side
  // context so SSR can render English and we still respect the
  // visitor's bm_lang cookie after hydration. Heading / body /
  // listBhandaraLabel props are accepted on the Props type for
  // backwards-compat and intentionally ignored, see the type
  // comment above for the why.
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const t = strings[locale];
  // Live chat only runs on Tue/Sat IST. On other days we keep the
  // community-count + WhatsApp link in the header chip but drop the
  // green LIVE pill so the chrome doesn't lie about being on air.
  const chatLive = isLiveChatOpenToday();
  // Total bhandaras on the map = listed bhandaras + live spots.
  // Matches the "All N" count the filter chip strip already shows
  // (single source of truth: both derive from the same prop arrays).
  const totalCount = listings.length + liveSpots.length;
  const heading = t.map.sectionHeading(totalCount);
  const body = t.map.sectionBody;
  const listBhandaraLabel = t.cta.listBhandara;
  const [filter, setFilter] = useState<Filter>("all");
  // Search query — matches against name / nameHi / area / address /
  // landmark / organizerName for listings, and caption / area /
  // bhandaraName for spots. Lower-cased on use so the comparison is
  // case-insensitive. Empty string means "no search filter".
  const [query, setQuery] = useState("");
  // Near-me state lives at the board level so the trigger button can sit
  // in the top toolbar (next to the filter pills) while still controlling
  // the side list's distance filter.
  const [near, setNear] = useState<NearMeState>({
    status: "idle",
    coords: null,
  });

  const normQuery = query.trim().toLowerCase();

  // Search-only filter (filter chip NOT applied) — drives tab counts so
  // the chips reflect "how many in each bucket match the search". The
  // map + side list further narrow by the filter chip below.
  const searchedListings = useMemo(() => {
    if (!normQuery) return listings;
    return listings.filter((b) => {
      const haystack = [
        b.name,
        b.nameHi,
        b.area,
        b.address,
        b.addressHi,
        b.landmark,
        b.organizerName,
        b.description,
        b.descriptionHi,
      ]
        .filter((v): v is string => typeof v === "string" && v.length > 0)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normQuery);
    });
  }, [listings, normQuery]);

  const searchedSpots = useMemo(() => {
    if (!normQuery) return liveSpots;
    return liveSpots.filter((s) => {
      const haystack = [
        s.caption,
        s.area,
        s.bhandaraName,
        s.bhandaraNameHi,
      ]
        .filter((v): v is string => typeof v === "string" && v.length > 0)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normQuery);
    });
  }, [liveSpots, normQuery]);

  const filteredListings = useMemo(
    () => (filter === "spotted" ? [] : searchedListings),
    [filter, searchedListings],
  );
  const filteredSpots = useMemo(
    () => (filter === "listed" ? [] : searchedSpots),
    [filter, searchedSpots],
  );

  /**
   * Reshape spots into the prop-shape BhandaraMap expects, memoised
   * so the reference is stable across unrelated re-renders. Without
   * this memo, an inline `.map()` literal produced a fresh array on
   * every parent render, Effect B in BhandaraMap then saw "new
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
  // exist before clicking. Counts derive from the SEARCH-filtered set
  // (not the raw totals) so when the visitor types "aliganj" the chips
  // collapse from "All 109 · Listed 47 · Spotted 62" to e.g. "All 7 ·
  // Listed 4 · Spotted 3" — the chips become a live drill-down of the
  // current search rather than lying about the unfiltered totals.
  const tabs: { key: Filter; label: string; count: number }[] = [
    {
      key: "all",
      label: isHi ? "सब" : "All",
      count: searchedListings.length + searchedSpots.length,
    },
    {
      key: "listed",
      label: isHi ? "लिस्टेड" : "Listed",
      count: searchedListings.length,
    },
    {
      key: "spotted",
      label: isHi ? "स्पॉट" : "Spotted",
      count: searchedSpots.length,
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
          {/* Deep-link chip to the LiveChatterBoard section below.
              Surfaces the WhatsApp community size + a pulsing LIVE
              dot so the map visitor sees "the conversation behind
              this map" without having to scroll-discover it. The
              chip is borderless on purpose (legend below has the
              same outline-cream-disc treatment, and stacking two
              outlined chips next to each other read as competing
              UI; the dark fill + saffron text on this chip is the
              callout, not the chrome). */}
          {communityMembers > 0 ? (
            <a
              href="#live-chat"
              data-ga="map_to_live_chat"
              className="inline-flex items-center gap-2 mt-3 rounded-full bg-ink-900 text-cream-50 pl-2 pr-3 py-1.5 text-xs hover:bg-ink-900/85 transition-colors group"
              aria-label={
                isHi
                  ? `लाइव चैट देखें · WhatsApp समुदाय में ${communityMembers.toLocaleString("en-IN")} लोग`
                  : `Open live chat · ${communityMembers.toLocaleString("en-IN")} in our WhatsApp community`
              }
            >
              {chatLive ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sindoor-700 text-cream-50 px-2 py-0.5 font-semibold uppercase tracking-wide">
                  <span aria-hidden className="relative flex h-1.5 w-1.5">
                    <span className="absolute inset-0 rounded-full bg-cream-50 opacity-60 motion-safe:animate-ping" />
                    <span className="relative h-1.5 w-1.5 rounded-full bg-cream-50" />
                  </span>
                  LIVE
                </span>
              ) : (
                // Off-day: no LIVE pill. WhatsApp glyph carries the
                // chat-community signal instead; the number + text +
                // hover arrow already make it clear this is a link.
                <span
                  aria-hidden
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-leaf-600/20 text-leaf-400"
                >
                  <WhatsAppGlyph />
                </span>
              )}
              <span className="font-medium">
                <span className="font-numerals tabular-nums text-saffron-500">
                  {communityMembers.toLocaleString("en-IN")}
                </span>{" "}
                {isHi ? "लोग WhatsApp समुदाय में" : "in our WhatsApp community"}
              </span>
              <span
                aria-hidden
                className="text-saffron-500 group-hover:translate-x-0.5 transition-transform"
              >
                →
              </span>
            </a>
          ) : null}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search input. Filters listings + spots in real time on
              every keystroke. Matches case-insensitive substring across
              name (en + hi), area, address, landmark, organizer name
              for listings; caption + area + linked-bhandara name for
              spots. The chip strip and the side list both react to
              this filter immediately, so the visitor can drill from
              "All 109" down to "Aliganj" or "Hanuman Mandir" without
              a page reload. */}
          <label className="relative inline-flex items-center">
            <span className="sr-only">
              {isHi ? "भंडारा खोजें" : "Search bhandaras"}
            </span>
            <svg
              aria-hidden
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-600/65 pointer-events-none"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                // Fire once when query crosses 3+ chars so GA can see
                // search adoption; throttled by GA debounce so live
                // typing isn't 30 events per word.
                if (e.target.value.trim().length >= 3) {
                  trackEvent("map_search", {
                    query_len: e.target.value.trim().length,
                  });
                }
              }}
              placeholder={
                isHi
                  ? "नाम, इलाक़ा, आयोजक..."
                  : "Search name, area, organizer..."
              }
              className="w-[180px] sm:w-[220px] pl-9 pr-8 py-1.5 text-xs rounded-full bg-cream-50 border border-gold-500/40 text-ink-900 placeholder:text-ink-600/55 focus:outline-none focus:border-saffron-500/65 focus:ring-2 focus:ring-saffron-500/25 transition-colors"
              aria-label={isHi ? "भंडारा खोजें" : "Search bhandaras"}
              data-ga="map_search_input"
            />
            {query.length > 0 ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={isHi ? "खोज साफ़ करें" : "Clear search"}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-5 w-5 items-center justify-center rounded-full text-ink-600/70 hover:bg-ink-900/10 hover:text-ink-900 transition-colors"
              >
                <svg
                  aria-hidden
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            ) : null}
          </label>
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
          {/* Promoted to btn-primary (was btn-ghost) so "List your
              bhandara" reads as the same primary affordance it does
              on the homepage cards-section empty state, header CTA,
              and bhandara detail page banner. One consistent visual
              for one consistent action across the site. */}
          <Link
            href={`/list-bhandara${isHi ? "" : "?lang=en"}`}
            data-ga="cta_map_list_bhandara"
            data-ga-source="map_board"
            className="btn btn-primary btn-sm"
          >
            {listBhandaraLabel}
          </Link>
        </div>
      </div>

      {/* Legend, two marker types on the map. The miniature glyphs
          here mirror the real markers exactly, cream-disc backdrop
          + gada SVG for listed, the same plus a saffron pulsing ring
          for spotted, so the visitor can map "legend dot ↔ map pin"
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
            {/* Pulse ring, sized larger than the disc and anchored
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

/** Small WhatsApp glyph used as the off-day fallback for the LIVE
 *  pill in the community-count chip. Keeps the chip visually
 *  weighted (a glyph is the same visual heft as the "LIVE" pill it
 *  replaces) so the layout doesn't reflow between days. */
function WhatsAppGlyph() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 2.1.55 4.07 1.6 5.84L2 22l4.4-1.6a9.92 9.92 0 0 0 5.64 1.72c5.47 0 9.92-4.45 9.92-9.92 0-2.65-1.03-5.14-2.91-7.02A9.83 9.83 0 0 0 12.04 2zm5.84 14.13c-.25.7-1.42 1.34-1.99 1.42-.51.07-1.16.1-1.87-.12-.43-.13-.99-.32-1.7-.62-2.99-1.29-4.94-4.32-5.09-4.52-.15-.2-1.22-1.62-1.22-3.1 0-1.47.77-2.19 1.04-2.49.27-.3.6-.37.8-.37.2 0 .4 0 .57.01.18.01.43-.07.67.51.25.6.85 2.07.93 2.22.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.32.39-.45.52-.15.15-.31.31-.13.61.18.3.8 1.32 1.71 2.14 1.18 1.05 2.17 1.37 2.47 1.52.3.15.47.13.65-.08.18-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.27.1 1.74.82 2.04.97.3.15.5.22.57.34.07.13.07.75-.18 1.46z" />
    </svg>
  );
}
