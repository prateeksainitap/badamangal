"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocaleFromContext } from "@/lib/locale-context";
import GalleryLightbox, {
  type GalleryItem,
  isFreshSpot,
} from "@/components/GalleryLightbox";

/**
 * GalleryFullView
 *
 * Full /gallery page. Same masonry / lightbox / freshness chrome as
 * the homepage gallery section, but:
 *
 *   • All photos (admin + spots) shown, not capped at 18
 *   • Grouped by calendar day (IST), newest day first, with a date
 *     header above each section
 *   • Lightbox flows ACROSS sections (arrow keys navigate the full
 *     flat list, not just the current day) so deep-browse feels
 *     continuous
 *
 * Date label rules (per the visitor's locale):
 *   • Today
 *   • Yesterday
 *   • Otherwise: "21 May 2026" (or "21 मई 2026" in Hindi)
 */
type Props = {
  items: GalleryItem[];
};

export default function GalleryFullView({ items }: Props) {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const langSuffix = locale === "en" ? "?lang=en" : "";

  // 60-second tick so LIVE pills self-update as photos cross 8h
  // while the visitor is on the page.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Order items newest-first (already so from the server, but normalize
  // again in case both source streams interleave at the same second).
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
      const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
      return tb - ta;
    });
  }, [items]);

  // Group by IST calendar day. Using local-date `YYYY-MM-DD` from
  // each createdAt-ISO is good enough for visitor display (we don't
  // need precision to the hour, and IST and the host server tz are
  // both close enough to identical for date-grouping purposes).
  const groups = useMemo(() => {
    const buckets = new Map<string, GalleryItem[]>();
    for (const it of sortedItems) {
      const date = it.createdAt ? it.createdAt.slice(0, 10) : "undated";
      const bucket = buckets.get(date);
      if (bucket) bucket.push(it);
      else buckets.set(date, [it]);
    }
    // Map back to an ordered array (newest day first, "undated" last)
    return Array.from(buckets.entries())
      .sort((a, b) => {
        if (a[0] === "undated") return 1;
        if (b[0] === "undated") return -1;
        return b[0].localeCompare(a[0]);
      })
      .map(([date, list]) => ({ date, items: list }));
  }, [sortedItems]);

  // Flat index for each item so the lightbox can navigate across
  // section boundaries with the arrow keys.
  const indexLookup = useMemo(() => {
    const m = new Map<string, number>();
    sortedItems.forEach((it, i) => m.set(it.id, i));
    return m;
  }, [sortedItems]);

  const openLightbox = useCallback((id: string) => {
    const i = indexLookup.get(id);
    if (typeof i === "number") setLightboxIndex(i);
  }, [indexLookup]);

  function captionOf(item: GalleryItem): string {
    return (isHi && item.captionHi ? item.captionHi : item.caption) ?? "";
  }

  return (
    <>
      <article className="pb-24">
        {/* Header */}
        <header className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 sm:pt-14">
          <Link
            href={`/${langSuffix}`}
            className="inline-block text-sm text-ink-600 hover:text-saffron-600 transition-colors"
          >
            {isHi ? "← मुख्य पृष्ठ पर जाएँ" : "← Back to home"}
          </Link>
          {/* Eyebrow needs `flex w-fit` (not `inline-flex`) so the
              <p> is block-level and drops to its own line beneath
              the back link. Previously was `inline-flex`, the link
              + eyebrow rendered on the same line and the eyebrow
              bullet visually clashed into the "← Back to home" text. */}
          <p className="mt-4 font-mukta uppercase tracking-[0.32em] text-saffron-600 text-xs font-semibold flex w-fit items-center gap-2">
            <span aria-hidden className="block w-1.5 h-1.5 rounded-full bg-saffron-600" />
            {isHi ? "गैलरी" : "Gallery"}
          </p>
          <h1
            className={`mt-3 text-3xl sm:text-5xl ${
              isHi
                ? "font-tiro text-sindoor-700"
                : "font-fraunces font-bold text-sindoor-700"
            }`}
          >
            {isHi ? "लखनऊ की झलकियाँ" : "Snapshots from Lucknow"}
          </h1>
          <p className="mt-3 text-sm sm:text-base text-ink-600 leading-relaxed max-w-2xl">
            {isHi
              ? `पूरी गैलरी, दिन के अनुसार सजी हुई। कुल ${sortedItems.length} तस्वीरें।`
              : `Every photo on BadaMangal, grouped by the day it landed. ${sortedItems.length} in total.`}
          </p>
        </header>

        {/* Empty state */}
        {sortedItems.length === 0 ? (
          <p className="mx-auto max-w-3xl px-4 sm:px-6 mt-10 text-ink-600 italic">
            {isHi
              ? "अभी कोई तस्वीर नहीं। पहली स्पॉट या अपलोड के बाद दिखेगी।"
              : "No photos yet. The first spot / upload will land here."}
          </p>
        ) : null}

        {/* Date-grouped sections */}
        {groups.map(({ date, items: dayItems }) => (
          <section
            key={date}
            className="mx-auto max-w-6xl px-4 sm:px-6 mt-10 sm:mt-12"
          >
            <header className="mb-4 flex items-baseline justify-between gap-3 border-b border-gold-500/30 pb-2">
              <h2
                className={`text-xl sm:text-2xl ${
                  isHi
                    ? "font-tiro text-sindoor-700"
                    : "font-fraunces font-semibold text-sindoor-700"
                }`}
              >
                {formatDateHeading(date, isHi)}
              </h2>
              <p className="text-xs sm:text-sm text-ink-600 font-mukta">
                {isHi
                  ? `${dayItems.length} तस्वीरें`
                  : `${dayItems.length} photo${dayItems.length === 1 ? "" : "s"}`}
              </p>
            </header>

            {/* Same dense masonry rhythm as HomepageGallery, 3 → 4 →
                5 → 6 → 7 columns. Same tile size so the two surfaces
                visually rhyme. */}
            <div className="columns-3 sm:columns-4 md:columns-5 lg:columns-6 xl:columns-7 gap-2 sm:gap-3 [column-fill:_balance]">
              {dayItems.map((it) => {
                const fresh = isFreshSpot(it);
                const cap = captionOf(it);
                return (
                  <button
                    type="button"
                    key={it.id}
                    onClick={() => openLightbox(it.id)}
                    aria-label={cap || (it.source === "admin" ? "Gallery photo" : "Spot photo")}
                    className="group relative block w-full mb-2 sm:mb-3 break-inside-avoid rounded-xl overflow-hidden border border-gold-500/30 bg-saffron-50 shadow-warm hover:border-saffron-500 hover:-translate-y-0.5 transition-all duration-200 cursor-zoom-in"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={it.url}
                      alt={cap || (it.source === "admin" ? "Gallery photo" : "Spot photo")}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="block w-full h-auto"
                    />
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
          </section>
        ))}
      </article>

      {lightboxIndex !== null ? (
        <GalleryLightbox
          items={sortedItems}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(i) => setLightboxIndex(i)}
          isHi={isHi}
        />
      ) : null}
    </>
  );
}

/** "2026-05-21" → "Today" / "Yesterday" / "21 May 2026" (or Hindi). */
function formatDateHeading(dateKey: string, isHi: boolean): string {
  if (dateKey === "undated") {
    return isHi ? "तारीख़ अज्ञात" : "Undated";
  }
  // Build today / yesterday in the same yyyy-mm-dd shape using local time.
  const now = new Date();
  const todayKey = isoLocalDate(now);
  const yKey = isoLocalDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  if (dateKey === todayKey) return isHi ? "आज" : "Today";
  if (dateKey === yKey) return isHi ? "कल" : "Yesterday";

  // Otherwise: "21 May 2026" / "21 मई 2026"
  const [, mStr, dStr] = dateKey.split("-");
  const m = Number(mStr);
  const d = Number(dStr);
  if (!m || !d) return dateKey;
  const enMonths = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const hiMonths = [
    "जन", "फ़र", "मार्च", "अप्रैल", "मई", "जून",
    "जुल", "अग", "सित", "अक्ट", "नव", "दिस",
  ];
  const year = dateKey.slice(0, 4);
  const month = (isHi ? hiMonths : enMonths)[m - 1] ?? "";
  return `${d} ${month} ${year}`;
}

/** YYYY-MM-DD in the local time-zone (string-only, no UTC drift). */
function isoLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
