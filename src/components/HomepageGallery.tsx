"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocaleFromContext } from "@/lib/locale-context";
import GalleryLightbox, {
  type GalleryItem,
  isFreshSpot,
} from "@/components/GalleryLightbox";

// Re-export so callers that imported from here keep working.
export type { GalleryItem };

/**
 * HomepageGallery
 *
 * Slow horizontal-scrolling marquee of community photos.
 *
 *   1. The strip translates leftward continuously (~120 s per full
 *      cycle), so the gallery reads as a calm living thing rather
 *      than a static wall. Pauses on hover / keyboard focus, and
 *      respects prefers-reduced-motion (see the @media query on
 *      .bm-marquee-track in globals.css).
 *
 *   2. Items are distributed round-robin into a fixed number of
 *      COLUMNS (each column a vertical flex stack of 3 photos).
 *      Columns sit side-by-side in a flex row, each one a tall
 *      sliver, same visual rhythm as a CSS-columns masonry but
 *      laid out horizontally so the marquee can carry the row
 *      sideways without breaking the column grid.
 *
 *   3. Edge fades dissolve the masonry into the page on all four
 *      sides: cream-to-transparent on left + right (hides the
 *      marquee scroll boundary), saffron-to-transparent at the
 *      bottom (so the ragged bottom edge of the columns blends
 *      warmly into the page below instead of cutting off
 *      abruptly).
 *
 * Lightbox:
 *   Clicking any photo opens the same shared GalleryLightbox used by
 *   the /gallery page. Arrows navigate the FLAT items[] list (not
 *   the column-grouped order), so the lightbox feels chronological
 *   instead of snaking through columns.
 *
 * For seamless looping: the column set is rendered twice (a + b) and
 * the animation translates -50%. When the second set lines up where
 * the first started, the snap-back to 0 is invisible.
 */
type Props = {
  items: GalleryItem[];
};

/** How many columns to lay out across the marquee. The full set
 *  renders twice, so the effective rendered count is 2× this. */
const COLUMN_COUNT = 7;

/** Full marquee cycle duration in seconds. Slow & devotional. */
const MARQUEE_SECONDS = 120;

/** Maximum visible photos in the preview. Kept evenly divisible by
 *  COLUMN_COUNT (21 ÷ 7 = 3 per column) so the buildColumns trim
 *  below never has to drop items to keep columns balanced. */
const PREVIEW_CAP = 21;

/** Fixed-aspect cycle assigned per slot-index within each column.
 *  Cycling three aspects gives visual rhythm (tall → medium → square)
 *  while keeping EVERY column the same total height (since every
 *  column gets the same aspect sequence in the same order). Result:
 *  the marquee's bottom edge is flat, no ragged column endings. */
const SLOT_ASPECTS: readonly string[] = [
  "aspect-[3/4]",
  "aspect-[4/5]",
  "aspect-square",
];

type ColumnSlot = { item: GalleryItem; flatIndex: number };

/** Round-robin distribute items into N columns. Returns a 2D array
 *  of slots ready to render. No more decorative gradient tiles ,
 *  blank space at the bottom of short columns is now masked by the
 *  page-level saffron fade overlay (see the marquee JSX). */
function buildColumns(items: GalleryItem[], cols: number): ColumnSlot[][] {
  const buckets: ColumnSlot[][] = Array.from({ length: cols }, () => []);
  items.forEach((item, flatIndex) => {
    const target = flatIndex % cols;
    buckets[target].push({ item, flatIndex });
  });
  return buckets;
}

export default function HomepageGallery({ items }: Props) {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // 60-second tick so the LIVE pill on each tile flips off as photos
  // cross the 8-hour threshold while the visitor sits on the page.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Preview cap, full set lives on /gallery. Trim to an
  // evenly-divisible item count so every column gets the same
  // number of slots (and therefore the same total height, which
  // is what kills the ragged-bottom-edge look).
  const previewItems = useMemo(() => {
    const capped = items.slice(0, PREVIEW_CAP);
    const evenCount = Math.floor(capped.length / COLUMN_COUNT) * COLUMN_COUNT;
    return capped.slice(0, evenCount);
  }, [items]);
  const hasMore = items.length > previewItems.length;
  const langSuffix = locale === "en" ? "?lang=en" : "";

  const columns = useMemo(
    () => buildColumns(previewItems, COLUMN_COUNT),
    [previewItems],
  );

  const openLightbox = useCallback((flatIndex: number) => {
    setLightboxIndex(flatIndex);
  }, []);

  if (items.length === 0) return null;

  function captionOf(item: GalleryItem): string {
    return (isHi && item.captionHi ? item.captionHi : item.caption) ?? "";
  }

  return (
    <>
      <section
        aria-labelledby="homepage-gallery-heading"
        className="relative py-12 sm:py-16"
      >
        {/* Header (constrained to max-w-6xl so it visually anchors
            inside the page, even though the marquee below is full-bleed). */}
        <header className="mx-auto max-w-6xl px-4 sm:px-6 text-center max-w-2xl mb-8 sm:mb-10">
          <p className="font-mukta uppercase tracking-[0.32em] text-saffron-600 text-xs font-semibold inline-flex items-center gap-2 justify-center">
            <span
              aria-hidden
              className="block w-1.5 h-1.5 rounded-full bg-saffron-600"
            />
            {isHi ? "गैलरी" : "Gallery"}
          </p>
          <h2
            id="homepage-gallery-heading"
            className={`mt-3 text-3xl sm:text-4xl ${
              isHi
                ? "font-tiro text-sindoor-700"
                : "font-fraunces font-bold text-sindoor-700"
            }`}
          >
            {isHi ? "लखनऊ की झलकियाँ" : "Snapshots from Lucknow"}
          </h2>
          <p className="mt-2 text-sm text-ink-600 leading-relaxed">
            {isHi
              ? "बड़े मंगल की भीड़, थालियाँ, पंडाल और चेहरे, सब एक जगह।"
              : "The crowds, the kadhais, the pandals, the faces of Bada Mangal Lucknow, in one place."}
          </p>
        </header>

        {/* Marquee strip. Full-bleed (extends edge-to-edge) for the
            real ticker feel. overflow-hidden on the outer container
            clips whatever slides off the left edge. Edge fades on
            left + right (cream-to-transparent) hide the marquee
            scroll boundary so tiles dissolve in/out at the viewport
            edges rather than jumping. */}
        <div className="relative overflow-hidden">
          {/* Left edge fade */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-12 sm:w-20 z-10 bg-gradient-to-r from-cream-50 to-transparent"
          />
          {/* Right edge fade */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-12 sm:w-20 z-10 bg-gradient-to-l from-cream-50 to-transparent"
          />

          <div
            className="bm-marquee-track flex gap-2 sm:gap-3 px-2 sm:px-3"
            style={{ ["--marquee-duration" as string]: `${MARQUEE_SECONDS}s` }}
          >
            {/* First column set */}
            {columns.map((col, ci) => (
              <MarqueeColumn
                key={`a-${ci}`}
                slots={col}
                isHi={isHi}
                onPhotoClick={openLightbox}
                captionOf={captionOf}
              />
            ))}
            {/* Cloned second set, identical, so the -50% translate
                lines up pixel-perfectly with the first set's start
                and the loop is invisible. aria-hidden so screen
                readers don't repeat every photo's alt text. */}
            <div aria-hidden className="flex gap-2 sm:gap-3" style={{ contain: "layout paint" }}>
              {columns.map((col, ci) => (
                <MarqueeColumn
                  key={`b-${ci}`}
                  slots={col}
                  isHi={isHi}
                  onPhotoClick={openLightbox}
                  captionOf={captionOf}
                  cloned
                />
              ))}
            </div>
          </div>
        </div>

        {hasMore ? (
          <div className="mt-8 text-center">
            <Link
              href={`/gallery${langSuffix}`}
              data-ga="cta_gallery_view_all"
              data-ga-count={String(items.length)}
              className="inline-flex items-center gap-1.5 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 shadow-warm px-5 py-2 text-sm font-semibold transition-colors"
            >
              {isHi
                ? `पूरी गैलरी देखें · ${items.length} तस्वीरें`
                : `View full gallery · ${items.length} photos`}
              <span aria-hidden>→</span>
            </Link>
          </div>
        ) : null}
      </section>

      {lightboxIndex !== null ? (
        <GalleryLightbox
          items={items}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(i) => setLightboxIndex(i)}
          isHi={isHi}
        />
      ) : null}
    </>
  );
}

/** One vertical column of the marquee, flex column of photo tiles.
 *  Fixed width AND fixed aspect-ratio per slot, so every column ends
 *  at the same baseline (the marquee never shows a ragged bottom
 *  edge). Photos use `object-cover` to fill their cells, which trades
 *  full-image visibility for tight grid alignment, acceptable in a
 *  scrolling preview where visitors are scanning, not studying. The
 *  full-frame view lives in the lightbox + on /gallery. */
function MarqueeColumn({
  slots,
  isHi,
  onPhotoClick,
  captionOf,
  cloned = false,
}: {
  slots: ColumnSlot[];
  isHi: boolean;
  onPhotoClick: (flatIndex: number) => void;
  captionOf: (item: GalleryItem) => string;
  cloned?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 sm:gap-3 w-[140px] sm:w-[170px] md:w-[190px] shrink-0">
      {slots.map(({ item, flatIndex }, slotIdx) => {
        const fresh = isFreshSpot(item);
        const cap = captionOf(item);
        // Cycle SLOT_ASPECTS by slot index. Every column gets the same
        // sequence (tall → medium → square) so total column heights
        // are identical and the bottom edge is flat.
        const aspectClass = SLOT_ASPECTS[slotIdx % SLOT_ASPECTS.length];
        // Cloned tiles don't fire the lightbox (their flat index is
        // the same as the original, but the click would feel like
        // a double-tap to the visitor). They're decoration for the
        // seamless loop.
        const handleClick = cloned ? undefined : () => onPhotoClick(flatIndex);
        const interactive = !cloned;
        return (
          <button
            type="button"
            key={item.id + (cloned ? ":b" : ":a")}
            onClick={handleClick}
            disabled={!interactive}
            tabIndex={interactive ? 0 : -1}
            {...(interactive
              ? {
                  "data-ga": "cta_gallery_photo_open",
                  "data-ga-source": item.source,
                  "data-ga-index": String(flatIndex),
                }
              : {})}
            aria-label={
              cap || (item.source === "admin" ? "Gallery photo" : "Spot photo")
            }
            className={`group relative block w-full ${aspectClass} break-inside-avoid rounded-xl overflow-hidden border border-gold-500/30 bg-saffron-50 shadow-warm transition-all duration-200 ${
              interactive
                ? "hover:border-saffron-500 hover:-translate-y-0.5 cursor-zoom-in"
                : "cursor-default"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.url}
              alt={
                cap || (item.source === "admin" ? "Gallery photo" : "Spot photo")
              }
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="block w-full h-full object-cover"
            />
            {/* Hover magnifier affordance. Without it the marquee
                reads as a passive decorative strip, visitors didn't
                realise each photo opens the lightbox (the marquee
                pauses on hover, so the tile IS clickable, it just
                lacked a visible "click to zoom" cue). A dark scrim
                fades in on hover/focus and a circular magnifier badge
                springs up in the centre. pointer-events-none so it
                never intercepts the button's own click. Cloned
                loop-filler tiles don't get it (they're inert). */}
            {interactive ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink-900/0 transition-colors duration-200 group-hover:bg-ink-900/35 group-focus-visible:bg-ink-900/35"
              >
                <span className="flex h-9 w-9 scale-75 items-center justify-center rounded-full bg-cream-50/95 text-sindoor-700 opacity-0 shadow-warm transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
              </span>
            ) : null}
            {fresh ? (
              <span className="pointer-events-none absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-saffron-600 text-cream-50 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.16em] font-bold shadow-sm">
                <span
                  aria-hidden
                  className="block w-1 h-1 rounded-full bg-cream-50 motion-safe:animate-pulse"
                />
                {isHi ? "लाइव" : "Live"}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
