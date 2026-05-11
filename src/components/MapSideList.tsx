"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type NearMeState } from "@/components/NearMeButton";
import { haversineKm } from "@/lib/geo";
import type { Bhandara } from "@/types/bhandara";
import type { Locale } from "@/content/strings";
import { strings } from "@/content/strings";
import { trackEvent } from "@/lib/ga";
import { useToast } from "@/components/Toast";

export type SideListSpot = {
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

export type SideListFilter = "all" | "listed" | "spotted";

type Props = {
  listings: Bhandara[];
  liveSpots?: SideListSpot[];
  locale: Locale;
  isHi: boolean;
  /** Currently active map filter, drives the side-list heading. */
  filter?: SideListFilter;
  /** Lifted near-me state, owned by the parent so the trigger button can
   *  live elsewhere in the layout. */
  near?: NearMeState;
};

const NEAR_ME_RADIUS_KM = 3;

function format12h(time: string): string {
  if (!time) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min)) return "";
  const period = h >= 12 ? "PM" : "AM";
  const display = ((h + 11) % 12) + 1;
  return `${display}:${String(min).padStart(2, "0")} ${period}`;
}

const HINDI_MONTHS_SHORT = [
  "जन", "फ़र", "मार्च", "अप्रैल", "मई", "जून",
  "जुल", "अग", "सित", "अक्ट", "नव", "दिस",
];
const EN_MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Today's date as YYYY-MM-DD in IST. */
function istTodayIso(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

/** Format an ISO date (YYYY-MM-DD) as "12 May" / "12 मई", or "Today"/"आज" if it's today. */
function shortDate(iso: string, isHi: boolean): string {
  if (!iso) return "";
  if (iso === istTodayIso()) return isHi ? "आज" : "Today";
  // Treat the YYYY-MM-DD as a calendar date (no timezone shift).
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  const month = (isHi ? HINDI_MONTHS_SHORT : EN_MONTHS_SHORT)[m - 1];
  return `${d} ${month}`;
}

/** Pick the next upcoming Tuesday from a listing's tuesdayDates,
 *  or — if the listing serves today — return today. */
function nextServingDate(dates: string[]): string | null {
  if (!Array.isArray(dates) || dates.length === 0) return null;
  const today = istTodayIso();
  // Same-day match wins.
  if (dates.includes(today)) return today;
  const upcoming = dates.filter((d) => d > today).sort();
  if (upcoming.length > 0) return upcoming[0];
  // Whole season is in the past — show the most recent so the row isn't dateless.
  const past = [...dates].sort();
  return past[past.length - 1] ?? null;
}

/** Unified row shape so the same template renders both kinds of pin. */
type Entry = {
  key: string;
  type: "organized" | "spotted";
  name: string;
  area: string | null;
  /** Pre-formatted date label (e.g. "12 May" or "Today"). null = no date. */
  dateLabel: string | null;
  meta: string;
  href: string | null;
  lat: number;
  lng: number;
  km?: number;
  // Sharing
  shareText: string;
  mapsUrl: string;
};

export default function MapSideList({
  listings,
  liveSpots = [],
  locale,
  isHi,
  filter = "all",
  near = { status: "idle", coords: null },
}: Props) {
  const t = strings[locale];
  const langSuffix = locale === "en" ? "?lang=en" : "";

  // Build a single entry list out of listed bhandaras + live spots so the
  // sidebar mirrors what's on the map.
  const entries = useMemo<Entry[]>(() => {
    const fromListings: Entry[] = listings.map((b) => {
      const name = isHi ? b.nameHi : b.name;
      const mapsUrl = `https://www.google.com/maps?q=${b.lat},${b.lng}&z=18`;
      const serveOn = nextServingDate(b.tuesdayDates ?? []);
      return {
        key: `org:${b.id}`,
        type: "organized",
        name,
        area: t.areas[b.area] ?? b.area,
        dateLabel: serveOn ? shortDate(serveOn, isHi) : null,
        meta: [
          format12h(b.timeStart),
          b.timeEnd ? `– ${format12h(b.timeEnd)}` : "",
        ]
          .filter(Boolean)
          .join(" "),
        href: `/bhandara/${b.slug}${langSuffix}`,
        lat: b.lat,
        lng: b.lng,
        shareText: `${name} · ${b.area} · ${mapsUrl}`,
        mapsUrl,
      };
    });

    const fromSpots: Entry[] = liveSpots.map((s) => {
      const name =
        (isHi ? s.bhandaraNameHi ?? s.bhandaraName : s.bhandaraName) ??
        (isHi ? "स्पॉट किया गया भंडारा" : "Spotted bhandara");
      const mapsUrl = `https://www.google.com/maps?q=${s.lat},${s.lng}&z=18`;
      // Spots are date-stamped at creation; treat it as today if the IST
      // calendar day matches.
      const spottedIstIso = new Date(
        new Date(s.createdAt).getTime() + 5.5 * 60 * 60 * 1000,
      )
        .toISOString()
        .slice(0, 10);
      return {
        key: `spot:${s.id}`,
        type: "spotted",
        name,
        area: s.area ? t.areas[s.area] ?? s.area : null,
        dateLabel: shortDate(spottedIstIso, isHi),
        meta: s.caption ?? (isHi ? "लाइव" : "Live now"),
        href: s.bhandaraSlug ? `/bhandara/${s.bhandaraSlug}${langSuffix}` : null,
        lat: s.lat,
        lng: s.lng,
        shareText: s.caption
          ? `${s.caption} · live at ${mapsUrl}`
          : `Live bhandara spotted: ${mapsUrl}`,
        mapsUrl,
      };
    });

    return [...fromListings, ...fromSpots];
  }, [listings, liveSpots, isHi, t.areas, langSuffix]);

  const filtered = useMemo(() => {
    if (near.status !== "active" || !near.coords) return entries;
    const c = near.coords;
    return entries
      .map((e) => ({ ...e, km: haversineKm(c, { lat: e.lat, lng: e.lng }) }))
      .filter((e) => (e.km ?? Infinity) <= NEAR_ME_RADIUS_KM)
      .sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
  }, [entries, near]);

  const isFiltering = near.status === "active";

  // Heading switches with the active filter (and is overridden by the
  // Near-me toggle when active, since proximity is the stronger lens).
  const heading = (() => {
    if (isFiltering) return isHi ? "मेरे पास के भंडारे" : "Bhandaras near me";
    if (filter === "listed")
      return isHi ? "सूचीबद्ध भंडारे" : "Listed bhandaras";
    if (filter === "spotted")
      return isHi ? "स्पॉट किए गए भंडारे" : "Spotted bhandaras";
    return isHi ? "सभी भंडारे" : "All bhandaras";
  })();

  // Scroll-aware "N more below" indicator. Tracks the scrollable <ul>,
  // counts items whose top edge sits below the visible viewport, and
  // surfaces a sticky chip on top of the list bottom when count > 0.
  // Without this, users on narrow phones reading the first 2–3 cards
  // had no way to know more entries existed below the fold.
  const listRef = useRef<HTMLUListElement>(null);
  const [itemsBelow, setItemsBelow] = useState(0);

  const recomputeItemsBelow = useCallback(() => {
    const ul = listRef.current;
    if (!ul) return;
    const items = Array.from(ul.querySelectorAll<HTMLLIElement>(
      "li[data-list-row]",
    ));
    if (items.length === 0) {
      setItemsBelow(0);
      return;
    }
    // Use viewport-relative coords for both the scroll container's
    // bottom edge and each item's top edge. This is robust regardless
    // of how the ancestors are positioned — `offsetTop` was returning
    // values relative to the nearest positioned ancestor (the `aside`
    // on desktop, the `ul` itself on some mobile layouts), which made
    // the comparison silently wrong on desktop and the chip never
    // appeared even when items were clearly below the fold.
    const ulBottom = ul.getBoundingClientRect().bottom;
    let below = 0;
    for (const item of items) {
      const itemTop = item.getBoundingClientRect().top;
      if (itemTop >= ulBottom - 4) {
        below += 1;
      }
    }
    setItemsBelow(below);
  }, []);

  useEffect(() => {
    const ul = listRef.current;
    if (!ul) return;
    recomputeItemsBelow();
    const onScroll = () => recomputeItemsBelow();
    ul.addEventListener("scroll", onScroll, { passive: true });
    // Recompute on window resize too (clientHeight changes between
    // mobile and tablet rotations).
    window.addEventListener("resize", onScroll);
    return () => {
      ul.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [filtered.length, recomputeItemsBelow]);

  const scrollDown = useCallback(() => {
    const ul = listRef.current;
    if (!ul) return;
    // One viewport-worth of scroll feels right — same gesture the user
    // would do with a mouse-wheel click. Smooth scroll on top of that
    // for the gentle "there's more here" feedback.
    ul.scrollBy({
      top: ul.clientHeight - 32,
      behavior: "smooth",
    });
  }, []);

  return (
    <aside className="relative rounded-2xl border border-gold-500/40 bg-cream-50 overflow-hidden flex flex-col h-[420px] sm:h-[520px]">
      <header className="px-4 py-3 border-b border-gold-500/30 bg-saffron-50/60 flex items-center justify-between gap-2">
        <p
          className={`text-sm ${
            isHi
              ? "font-tiro text-sindoor-700"
              : "font-fraunces text-sindoor-700 font-semibold"
          }`}
        >
          {heading}
        </p>
        <span className="text-[11px] text-ink-600 font-numerals tabular-nums">
          {isHi
            ? `${filtered.length} दिख रहे हैं`
            : `${filtered.length} showing`}
        </span>
      </header>

      {isFiltering ? (
        <div className="px-4 py-2 border-b border-gold-500/20 bg-saffron-50/40 text-[10px] text-ink-600">
          {isHi
            ? `3 कि.मी. के दायरे में, सबसे पास से क्रम में।`
            : `Within 3 km, sorted by distance.`}
        </div>
      ) : null}

      <ul
        ref={listRef}
        // When the list has rows, behave as a normal scrollable
        // divided list. When it's empty, flex-center the single
        // empty-state child so the explainer sits in the vertical
        // middle of the available panel space instead of clinging
        // to the top with awkward whitespace below.
        className={
          filtered.length === 0
            ? "flex-1 flex items-center justify-center"
            : "overflow-y-auto divide-y divide-gold-500/20 flex-1"
        }
      >
        {filtered.map((e) => (
          <SideRow
            key={e.key}
            entry={e}
            isHi={isHi}
          />
        ))}
        {filtered.length === 0 ? (
          // Empty-state copy tailored to the active filter. The
          // generic one-liner "No bhandaras yet" looked broken when a
          // visitor landed on the Spotted tab and saw nothing — they
          // had no way to know spots are a separate, live-only stream
          // that requires someone in Lucknow to upload a photo. This
          // explains the mechanic and gives them a CTA to be the first.
          <li className="px-4 text-center text-xs text-ink-600 list-none">
            {isFiltering ? (
              isHi
                ? "3 कि.मी. के अंदर कोई भंडारा नहीं मिला।"
                : "No bhandaras within 3 km of you yet."
            ) : filter === "spotted" ? (
              <EmptySpotted isHi={isHi} />
            ) : filter === "listed" ? (
              <EmptyListed isHi={isHi} />
            ) : isHi ? (
              "अभी कोई भंडारा नहीं"
            ) : (
              "No bhandaras yet"
            )}
          </li>
        ) : null}
      </ul>

      {/* "N more bhandaras" sticky chip — only renders when there are
          items below the fold inside the scrollable list. Click scrolls
          the list down by one viewport's height. Sits above a gentle
          cream→transparent fade so the chip lifts off the last visible
          card without a hard divider. */}
      {itemsBelow > 0 ? (
        // Bottom overlay: a taller fade that fully covers the chip area
        // so the row text behind the chip doesn't bleed through next to
        // it. Previously the gradient was only 32px tall and sat *above*
        // the chip, leaving a hard band of unfaded list rows directly
        // behind the pill (visible as "...LISTED" peeking next to the
        // saffron chip). Now the fade and the chip share a single
        // overlay box that's tall enough to mask both visually.
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-cream-50 via-cream-50/95 to-transparent"
        />
      ) : null}
      {itemsBelow > 0 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-3">
          <button
            type="button"
            onClick={scrollDown}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 text-xs font-semibold px-3.5 py-1.5 shadow-warm transition-colors"
            aria-label={
              isHi
                ? `और ${itemsBelow} भंडारे नीचे, स्क्रॉल करें`
                : `${itemsBelow} more bhandaras below, scroll`
            }
          >
            <span className="font-numerals tabular-nums">{itemsBelow}</span>
            <span>
              {isHi ? "और भंडारे" : `more ${itemsBelow === 1 ? "bhandara" : "bhandaras"}`}
            </span>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      ) : null}
    </aside>

  );
}

function SideRow({ entry: e, isHi }: { entry: Entry; isHi: boolean }) {
  const toast = useToast();
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(e.shareText)}`;

  // Header row content (name + tag + distance) is wrapped in the bhandara
  // link when there's one, else falls back to a plain block.
  const head = (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p
          className={`text-sm leading-snug line-clamp-1 ${
            isHi
              ? "font-deva font-semibold text-sindoor-700"
              : "font-fraunces font-semibold text-sindoor-700"
          }`}
        >
          {e.name}
        </p>
        <p className="mt-0.5 text-[11px] text-ink-600 flex items-center flex-wrap gap-x-1.5">
          {e.area ? <span>{e.area}</span> : null}
          {e.area && (e.dateLabel || e.meta) ? (
            <span aria-hidden>·</span>
          ) : null}
          {e.dateLabel ? (
            <span
              className={
                // "Today" / "आज" gets a soft saffron emphasis so the row
                // reads as freshly relevant; other dates stay quiet.
                e.dateLabel === "Today" || e.dateLabel === "आज"
                  ? "font-semibold text-saffron-600"
                  : ""
              }
            >
              {e.dateLabel}
            </span>
          ) : null}
          {e.dateLabel && e.meta ? <span aria-hidden>·</span> : null}
          <span className="line-clamp-1">{e.meta}</span>
        </p>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1">
        {/* Type tag */}
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.22em] font-mukta font-semibold ${
            e.type === "spotted"
              ? "bg-saffron-50 border border-saffron-500/45 text-saffron-600"
              : "bg-cream-50 border border-gold-500/55 text-gold-500"
          }`}
        >
          {e.type === "spotted" ? (
            <span
              aria-hidden
              className="block w-1 h-1 rounded-full bg-saffron-600 motion-safe:animate-pulse"
            />
          ) : null}
          {e.type === "spotted"
            ? isHi
              ? "स्पॉट"
              : "Spotted"
            : isHi
              ? "लिस्टेड"
              : "Listed"}
        </span>
        {/* Distance pill (when Near Me filter is active) */}
        {typeof e.km === "number" ? (
          <span className="inline-flex items-center rounded-full bg-saffron-50 border border-saffron-500/40 px-2 py-0.5 text-[10px] text-saffron-600 font-semibold font-numerals tabular-nums">
            {e.km < 1
              ? `${Math.round(e.km * 1000)} m`
              : `${e.km.toFixed(1)} km`}
          </span>
        ) : null}
      </div>
    </div>
  );

  return (
    <li
      data-list-row
      className="px-4 py-3 hover:bg-saffron-50/60 transition-colors"
    >
      {e.href ? (
        <Link
          href={e.href}
          className="block"
          data-ga="map_list_open"
          data-ga-type={e.type}
        >
          {head}
        </Link>
      ) : (
        head
      )}

      {/* Round CTA cluster — same icon-only language as the spot cards */}
      <div className="mt-2 flex items-center gap-1.5">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={isHi ? "रास्ता बताएँ" : "Get directions"}
          title={isHi ? "रास्ता बताएँ" : "Get directions"}
          onClick={() =>
            trackEvent("map_list_directions", { type: e.type })
          }
          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 shadow-warm transition-colors"
        >
          <IconPin />
        </a>
        <a
          href={waUrl}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={isHi ? "व्हाट्सएप पर शेयर" : "Share on WhatsApp"}
          title={isHi ? "व्हाट्सएप पर शेयर" : "Share on WhatsApp"}
          onClick={() => trackEvent("map_list_share", { type: e.type })}
          className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-leaf-600/55 bg-cream-50 hover:bg-leaf-600/10 text-leaf-600 transition-colors"
        >
          <IconWhatsapp />
        </a>
        <button
          type="button"
          onClick={async (ev) => {
            const btn = ev.currentTarget;
            try {
              await navigator.clipboard.writeText(e.mapsUrl);
              trackEvent("map_list_copy", { type: e.type });
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
          className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-saffron-500/45 bg-cream-50 hover:bg-saffron-50 text-saffron-600 transition-colors data-[copied]:bg-leaf-600 data-[copied]:border-leaf-600 data-[copied]:text-cream-50"
        >
          <IconCopy />
        </button>
      </div>
    </li>
  );
}

function IconPin() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 21s-6.5-7-6.5-12a6.5 6.5 0 1 1 13 0c0 5-6.5 12-6.5 12z" />
      <circle cx="12" cy="9" r="2.25" />
    </svg>
  );
}
function IconWhatsapp() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden
    >
      <path d="M16 3C8.82 3 3 8.82 3 16c0 2.29.6 4.43 1.65 6.3L3 29l6.86-1.62A12.95 12.95 0 0 0 16 29c7.18 0 13-5.82 13-13S23.18 3 16 3zm0 23.5c-1.93 0-3.74-.5-5.32-1.4l-.38-.22-4.07.96.97-3.96-.25-.4A10.5 10.5 0 1 1 16 26.5zm6.06-7.86c-.33-.17-1.96-.97-2.27-1.08-.3-.11-.52-.17-.74.17-.22.33-.85 1.07-1.04 1.29-.19.22-.38.25-.71.08-.33-.17-1.4-.52-2.66-1.65-.98-.88-1.65-1.96-1.84-2.29-.19-.33-.02-.51.15-.67.15-.15.33-.39.5-.58.16-.19.22-.33.33-.55.11-.22.06-.41-.03-.58-.08-.17-.74-1.79-1.01-2.45-.27-.66-.55-.57-.74-.58l-.63-.01a1.21 1.21 0 0 0-.88.41c-.3.33-1.15 1.13-1.15 2.75 0 1.62 1.18 3.19 1.34 3.41.16.22 2.32 3.55 5.62 4.97 2.61 1.13 3.14 1.06 3.71.99.57-.06 1.84-.75 2.1-1.48.26-.73.26-1.36.18-1.49-.08-.13-.3-.21-.63-.38z" />
    </svg>
  );
}
/**
 * Empty-state explainer for the "Spotted" tab when no spots are live.
 * Carries: a mini illustrated marker (gada + pulse ring, mirrors the
 * map legend), a one-line headline, a short body explaining the
 * 8-hour live window mechanic, and a CTA pointing at /spot so the
 * visitor can be the first to upload one. Two-language.
 */
function EmptySpotted({ isHi }: { isHi: boolean }) {
  return (
    <div className="text-center px-2 py-4">
      {/* Marker icon — mirrors the actual spotted pin: cream disc +
          gada + circular pulsing ring. Uses the same `bm-pin-ring`
          keyframe the map markers use so the legend, this empty
          state, and the live map all pulse on one rhythm. */}
      <span
        aria-hidden
        className="relative inline-flex h-9 w-9 items-center justify-center mx-auto"
      >
        <span
          className="absolute inset-[-4px] rounded-full border-2 border-saffron-500/75 pointer-events-none"
          style={{
            animation: "bm-pin-ring 1.6s ease-out infinite",
            transformOrigin: "center center",
          }}
        />
        <span className="absolute inset-0 rounded-full bg-cream-50 border-[1.5px] border-saffron-500/65 shadow-[inset_0_1px_2px_rgba(26,20,16,0.10)]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/map-pin-gada.svg"
          alt=""
          className="relative h-[26px] w-[26px]"
        />
      </span>
      <p
        className={`mt-3 text-sm ${
          isHi
            ? "font-tiro text-sindoor-700"
            : "font-fraunces font-semibold text-sindoor-700"
        }`}
      >
        {isHi ? "अभी कोई स्पॉट नहीं" : "No live spots right now"}
      </p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-600 max-w-[240px] mx-auto">
        {isHi
          ? "जब लखनऊ-वाले किसी चल रहे भंडारे की तस्वीर खींचकर भेजते हैं, वह यहाँ 8 घंटों के लिए पल्स करते पिन के रूप में दिखता है।"
          : "When someone in Lucknow snaps a photo of a bhandara happening right now, it appears here as a pulsing pin for 8 hours."}
      </p>
      <Link
        href="/spot"
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-3.5 py-1.5 text-xs shadow-warm"
      >
        {/* Camera glyph evokes the "snap a photo" gesture that creates
            a spot — clearer call-to-action than a bare arrow. */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        {isHi ? "पहले बनो, स्पॉट करो" : "Be first, spot one"}
      </Link>
    </div>
  );
}

/**
 * Empty-state explainer for the "Listed" tab when no listed bhandaras
 * are upcoming. Mirrors the EmptySpotted treatment so both tabs feel
 * like part of the same family — but with copy + CTA tuned for a
 * *planned* bhandara rather than a live-now spot.
 *
 * When this renders: either the season hasn't started yet, OR every
 * listed bhandara's dates have already passed (the homepage filter
 * auto-hides past entries). Either way the visitor needs to know
 * what a "listed bhandara" is and how to bring the list back to
 * life — by listing their own.
 */
function EmptyListed({ isHi }: { isHi: boolean }) {
  return (
    <div className="text-center px-2 py-4">
      <span
        aria-hidden
        className="relative inline-flex h-9 w-9 items-center justify-center mx-auto"
      >
        {/* Cream disc + gada — mirrors the actual listed marker
            (without the pulse, since listed pins are planned not
            live). Same visual language as the legend chip + the
            real map marker so the visitor can map this glyph to
            what they'll see on the map at a glance. */}
        <span className="absolute inset-0 rounded-full bg-cream-50 border-[1.5px] border-gold-500/55 shadow-[inset_0_1px_2px_rgba(26,20,16,0.10)]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/map-pin-gada.svg"
          alt=""
          className="relative h-[26px] w-[26px]"
        />
      </span>
      <p
        className={`mt-3 text-sm ${
          isHi
            ? "font-tiro text-sindoor-700"
            : "font-fraunces font-semibold text-sindoor-700"
        }`}
      >
        {isHi ? "अभी कोई आगामी भंडारा नहीं" : "No upcoming bhandaras yet"}
      </p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-600 max-w-[240px] mx-auto">
        {isHi
          ? "कोई भी आयोजक अपना भंडारा यहाँ सूचीबद्ध कर सकता है, स्थान, समय और मेन्यू के साथ। सूची हर बड़े मंगल के पहले भर जाती है।"
          : "Any organizer can list their bhandara here with location, time, and menu. The list fills up as each Bada Mangal approaches."}
      </p>
      <Link
        href="/list-bhandara"
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-3.5 py-1.5 text-xs shadow-warm"
      >
        {/* Pencil/clipboard glyph: form-filling, planning. Distinct
            from the camera glyph used in EmptySpotted so the two
            CTAs read as different actions. */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="9" y1="13" x2="15" y2="13" />
          <line x1="9" y1="17" x2="13" y2="17" />
        </svg>
        {isHi ? "अपना भंडारा सूचीबद्ध करें" : "List your bhandara"}
      </Link>
    </div>
  );
}

function IconCopy() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}
