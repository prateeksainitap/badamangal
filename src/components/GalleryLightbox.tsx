"use client";

import { useEffect } from "react";

/**
 * Shape shared between HomepageGallery and the full /gallery page.
 * Defined once here so both surfaces speak the same language.
 */
export type GalleryItem = {
  id: string;
  url: string;
  source: "admin" | "spot";
  caption?: string;
  captionHi?: string;
  credit?: string;
  /** ISO publish timestamp. Drives the 8h-fresh LIVE pill on
   *  spot photos AND the date grouping on the full /gallery page. */
  createdAt?: string;
};

const LIVE_WINDOW_MS = 8 * 60 * 60 * 1000;

export function isFreshSpot(item: GalleryItem): boolean {
  if (item.source !== "spot" || !item.createdAt) return false;
  const t = Date.parse(item.createdAt);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < LIVE_WINDOW_MS;
}

/**
 * GalleryLightbox
 *
 * Modal viewer for gallery items. Centred image on a near-black
 * backdrop, caption + source pill underneath, prev/next arrows,
 * close button, keyboard navigation (Esc / ← / →), body-scroll lock.
 *
 * The backdrop is `bg-black/95 backdrop-blur-md` — dark enough that
 * the underlying gallery doesn't bleed through (the earlier
 * `bg-ink-900/92` was a warm dark that let the saffron tiles show
 * up). Click on the backdrop (or the close button, or Esc) closes;
 * clicks on the image itself are absorbed.
 */
export default function GalleryLightbox({
  items,
  index,
  onClose,
  onNavigate,
  isHi,
}: {
  items: GalleryItem[];
  index: number;
  onClose: () => void;
  onNavigate: (next: number) => void;
  isHi: boolean;
}) {
  const item = items[index];
  const total = items.length;

  // Body-scroll lock while the lightbox is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Keyboard: Esc closes, arrows navigate
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && index < total - 1) onNavigate(index + 1);
      else if (e.key === "ArrowLeft" && index > 0) onNavigate(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, total, onClose, onNavigate]);

  if (!item) return null;

  const caption =
    (isHi && item.captionHi ? item.captionHi : item.caption) ?? "";
  const fresh = isFreshSpot(item);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={caption || "Gallery photo"}
      onClick={onClose}
      className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-md flex items-center justify-center overflow-hidden"
    >
      {/* Image container. Stop click propagation so taps on the
          image itself don't close the modal — only backdrop / close
          button / Esc do. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-[96vw] max-h-[92vh] flex flex-col items-center"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt={caption || "Gallery photo"}
          className="max-w-[96vw] max-h-[78vh] sm:max-h-[82vh] object-contain rounded-lg shadow-2xl"
        />

        {/* Caption + source strip below the image */}
        {(caption || item.source === "spot" || item.credit) ? (
          <div className="mt-3 max-w-[96vw] sm:max-w-3xl text-cream-50 text-center px-3">
            {caption ? (
              <p className="text-sm sm:text-base leading-snug">{caption}</p>
            ) : null}
            <div className="mt-1.5 flex items-center justify-center gap-2 text-[0.65rem] sm:text-xs uppercase tracking-[0.18em] text-cream-50/75 font-mukta font-semibold">
              {item.credit ? <span>{item.credit}</span> : null}
              {item.credit && item.source === "spot" ? (
                <span aria-hidden>·</span>
              ) : null}
              {item.source === "spot" ? (
                <span className="inline-flex items-center gap-1.5">
                  {fresh ? (
                    <>
                      <span
                        aria-hidden
                        className="block w-1.5 h-1.5 rounded-full bg-saffron-600 motion-safe:animate-pulse"
                      />
                      <span className="text-saffron-500">
                        {isHi ? "लाइव स्पॉट" : "Live spot"}
                      </span>
                    </>
                  ) : (
                    <span>{isHi ? "स्पॉट की गई" : "Spotted earlier"}</span>
                  )}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* Close button (top-right) */}
      <button
        type="button"
        onClick={onClose}
        aria-label={isHi ? "बंद करें" : "Close"}
        className="absolute top-3 right-3 sm:top-5 sm:right-5 inline-flex items-center justify-center w-10 h-10 rounded-full bg-cream-50/15 hover:bg-cream-50/25 text-cream-50 transition-colors backdrop-blur-sm"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      {/* Counter (top-left) */}
      <p className="absolute top-3 left-3 sm:top-5 sm:left-5 text-cream-50/70 text-xs sm:text-sm font-mukta tabular-nums">
        {index + 1} / {total}
      </p>

      {/* Prev / Next arrows. Hidden on the very first / last item. */}
      {index > 0 ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(index - 1);
          }}
          aria-label={isHi ? "पिछली" : "Previous"}
          className="absolute left-2 sm:left-5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-cream-50/15 hover:bg-cream-50/25 text-cream-50 transition-colors backdrop-blur-sm"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      ) : null}
      {index < total - 1 ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(index + 1);
          }}
          aria-label={isHi ? "अगली" : "Next"}
          className="absolute right-2 sm:right-5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-cream-50/15 hover:bg-cream-50/25 text-cream-50 transition-colors backdrop-blur-sm"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
