"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { JaliCorner, MarigoldDivider } from "@/components/ornaments";
import { trackEvent } from "@/lib/ga";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * /archive — public record of bhandaras whose moment has passed:
 *   • Listed (organiser-submitted) bhandaras whose every Tuesday is over
 *   • Spotted (crowd-sourced) sightings whose 8-hour live window expired
 *
 * Both tabs render in the same brand language as the rest of the site
 * (jali corners, marigold divider, sindoor headline + saffron kicker).
 * Tab state lives entirely on the client so the page itself can stay
 * statically prerendered — clicking either tab is instant.
 */

type ListedItem = {
  id: string;
  slug: string;
  name: string;
  nameHi: string | null;
  area: string;
  lat: number;
  lng: number;
  tuesdayDates: string[];
  timeStart: string;
  timeEnd: string | null;
  organizerName: string;
  photoUrl: string | null;
};

type SpottedItem = {
  id: string;
  photoUrl: string | null;
  caption: string | null;
  area: string | null;
  address: string | null;
  reporterName: string | null;
  createdAt: string;
  bhandaraSlug: string | null;
  bhandaraName: string | null;
  bhandaraNameHi: string | null;
};

type Tab = "listed" | "spotted";

const HINDI_MONTHS = [
  "जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून",
  "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर",
];
const HINDI_MONTHS_SHORT = [
  "जन", "फ़र", "मार्च", "अप्रैल", "मई", "जून",
  "जुल", "अग", "सित", "अक्ट", "नव", "दिस",
];
const EN_MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function shortDate(iso: string, isHi: boolean): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const month = (isHi ? HINDI_MONTHS_SHORT : EN_MONTHS_SHORT)[m - 1];
  return `${d} ${month}`;
}

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

function relativeWhen(iso: string, isHi: boolean): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = now - then;
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return isHi ? "आज" : "Today";
  if (diff < 2 * day) return isHi ? "कल" : "Yesterday";
  const days = Math.floor(diff / day);
  if (days < 14) {
    return isHi ? `${days} दिन पहले` : `${days} days ago`;
  }
  // For older spots, show the actual short date.
  const d = new Date(iso);
  const month = (isHi ? HINDI_MONTHS_SHORT : EN_MONTHS_SHORT)[d.getMonth()];
  return `${d.getDate()} ${month}`;
}

function fullDate(iso: string, isHi: boolean): string {
  const d = new Date(iso);
  const day = d.getDate();
  const month = (isHi ? HINDI_MONTHS : EN_MONTHS_SHORT)[d.getMonth()];
  const year = d.getFullYear();
  return isHi ? `${day} ${month}, ${year}` : `${day} ${month} ${year}`;
}

function normalise(s: string | null | undefined): string {
  return (s ?? "").toLocaleLowerCase().trim();
}

export default function ArchiveTabs({
  listed,
  spotted,
}: {
  listed: ListedItem[];
  spotted: SpottedItem[];
}) {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const [tab, setTab] = useState<Tab>("listed");
  const [query, setQuery] = useState("");

  const switchTo = (next: Tab) => {
    if (next === tab) return;
    setTab(next);
    trackEvent("archive_tab_switch", { tab: next });
  };

  // Substring search across the fields a visitor would plausibly type
  // — bhandara name (both scripts), area, organiser, address, caption.
  // Pure JS .filter() over the prerendered set; the page itself is
  // statically cached and we don't want a per-keystroke API hit.
  const q = normalise(query);
  const filteredListed = useMemo(() => {
    if (!q) return listed;
    return listed.filter((b) =>
      [b.name, b.nameHi, b.area, b.organizerName]
        .map(normalise)
        .some((field) => field.includes(q)),
    );
  }, [listed, q]);
  const filteredSpotted = useMemo(() => {
    if (!q) return spotted;
    return spotted.filter((s) =>
      [
        s.caption,
        s.area,
        s.address,
        s.bhandaraName,
        s.bhandaraNameHi,
        s.reporterName,
      ]
        .map(normalise)
        .some((field) => field.includes(q)),
    );
  }, [spotted, q]);

  const counts = useMemo(
    () => ({ listed: filteredListed.length, spotted: filteredSpotted.length }),
    [filteredListed.length, filteredSpotted.length],
  );

  const onSearchChange = (next: string) => {
    setQuery(next);
    // Only emit the GA event on real searches — debounce by length so
    // we don't spam the funnel with one event per keystroke.
    if (next.trim().length >= 3) {
      trackEvent("archive_search", { length: next.trim().length });
    }
  };

  return (
    <article>
      {/* HERO */}
      <header className="text-center mb-8 sm:mb-10">
        <p className="font-mukta uppercase tracking-[0.32em] text-saffron-600 text-xs font-semibold inline-flex items-center gap-1.5">
          <span aria-hidden className="block w-1.5 h-1.5 rounded-full bg-gold-500" />
          {isHi ? "बीते भंडारे" : "Past Bhandaras"}
        </p>
        <h1
          className={`mt-3 text-3xl sm:text-[2.6rem] leading-tight ${
            isHi
              ? "font-tiro text-sindoor-700"
              : "font-fraunces font-semibold text-sindoor-700"
          }`}
        >
          {isHi
            ? "बीते मंगलों के भंडारे"
            : "Bhandaras of past Tuesdays"}
        </h1>
        <p className="mt-3 max-w-2xl mx-auto text-ink-600 leading-relaxed">
          {isHi
            ? "हर मंगल जिसका वक़्त बीत गया, यहाँ दर्ज है। ऑर्गनाइज़र के सूचीबद्ध भंडारे और राहगीरों के स्पॉट किए हुए — दोनों एक जगह।"
            : "Every Tuesday whose moment has passed, kept here on the record. Both organiser-listed bhandaras and passer-by spotted sightings, side by side."}
        </p>
        <div className="mt-6 flex justify-center">
          <MarigoldDivider size={220} className="text-gold-500" />
        </div>
      </header>

      {/* SEARCH */}
      <div className="mb-6 sm:mb-8">
        <label className="relative block max-w-xl mx-auto">
          <span className="sr-only">
            {isHi ? "खोजें" : "Search past bhandaras"}
          </span>
          <span
            aria-hidden
            className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-600/70"
          >
            <SearchGlyph />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={
              isHi
                ? "नाम, क्षेत्र, ऑर्गनाइज़र, संदेश से खोजें…"
                : "Search by name, area, organiser, or caption…"
            }
            className="w-full rounded-full bg-cream-50 border border-gold-500/45 focus:border-saffron-500 focus:outline-none focus:ring-2 focus:ring-saffron-500/30 shadow-warm pl-11 pr-11 py-2.5 text-sm placeholder:text-ink-600/60 transition-colors"
            aria-label={isHi ? "बीते भंडारे खोजें" : "Search past bhandaras"}
          />
          {query.length > 0 ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label={isHi ? "खोज साफ़ करें" : "Clear search"}
              className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-7 h-7 rounded-full text-ink-600 hover:text-sindoor-700 hover:bg-saffron-50 transition-colors"
            >
              <ClearGlyph />
            </button>
          ) : null}
        </label>
        {q ? (
          <p className="mt-2 text-center text-[0.7rem] uppercase tracking-[0.22em] text-ink-600">
            {isHi
              ? `${counts.listed + counts.spotted} परिणाम`
              : `${counts.listed + counts.spotted} result${
                  counts.listed + counts.spotted === 1 ? "" : "s"
                }`}
          </p>
        ) : null}
      </div>

      {/* TAB STRIP */}
      <div
        role="tablist"
        aria-label={isHi ? "अभिलेख फ़िल्टर" : "Archive filter"}
        className="mx-auto inline-flex items-center gap-1 p-1 rounded-full bg-cream-50 border border-gold-500/45 shadow-warm"
      >
        {(
          [
            {
              key: "listed" as const,
              label: isHi ? "सूचीबद्ध" : "Listed",
              count: counts.listed,
            },
            {
              key: "spotted" as const,
              label: isHi ? "स्पॉट किए" : "Spotted",
              count: counts.spotted,
            },
          ]
        ).map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchTo(item.key)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "bg-saffron-600 text-cream-50 shadow-warm"
                  : "text-ink-900 hover:bg-saffron-50"
              }`}
            >
              <span>{item.label}</span>
              <span
                className={`font-numerals tabular-nums text-xs ${
                  active ? "text-cream-50/85" : "text-ink-600"
                }`}
              >
                {item.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* CONTENT */}
      <div className="mt-8">
        {tab === "listed" ? (
          filteredListed.length === 0 ? (
            q ? (
              <NoMatches isHi={isHi} onClear={() => onSearchChange("")} />
            ) : (
              <ArchiveEmpty isHi={isHi} variant="listed" />
            )
          ) : (
            <ListedGrid items={filteredListed} isHi={isHi} />
          )
        ) : filteredSpotted.length === 0 ? (
          q ? (
            <NoMatches isHi={isHi} onClear={() => onSearchChange("")} />
          ) : (
            <ArchiveEmpty isHi={isHi} variant="spotted" />
          )
        ) : (
          <SpottedTimeline items={filteredSpotted} isHi={isHi} />
        )}
      </div>
    </article>
  );
}

function NoMatches({
  isHi,
  onClear,
}: {
  isHi: boolean;
  onClear: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-gold-500/45 bg-cream-50 px-6 py-10 text-center shadow-warm">
      <p
        className={`text-lg sm:text-xl ${
          isHi
            ? "font-tiro text-sindoor-700"
            : "font-fraunces font-semibold text-sindoor-700"
        }`}
      >
        {isHi ? "कोई मिलान नहीं मिला।" : "No matches."}
      </p>
      <p className="mt-2 text-sm text-ink-600">
        {isHi
          ? "अलग शब्दों से कोशिश करें, या खोज साफ़ करें।"
          : "Try a different term, or clear the search to see everything."}
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-saffron-500/45 text-saffron-600 hover:bg-saffron-50 px-4 py-2 text-sm font-semibold transition-colors"
      >
        {isHi ? "खोज साफ़ करें" : "Clear search"}
      </button>
    </div>
  );
}

function SearchGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ClearGlyph() {
  return (
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

/* ── Listed grid ─────────────────────────────────────────────────────── */

function ListedGrid({ items, isHi }: { items: ListedItem[]; isHi: boolean }) {
  const langSuffix = isHi ? "" : "?lang=en";
  return (
    <ul className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((b) => {
        const displayName = isHi ? (b.nameHi ?? b.name) : b.name;
        // Show up to 3 most-recent past dates for compactness.
        const dates = [...b.tuesdayDates].sort().reverse().slice(0, 3);
        const time =
          format12h(b.timeStart) +
          (b.timeEnd ? `–${format12h(b.timeEnd)}` : "");
        return (
          <li key={b.id}>
            <Link
              href={`/bhandara/${b.slug}${langSuffix}`}
              data-ga="archive_listed_open"
              data-ga-slug={b.slug}
              className="group relative block h-full rounded-3xl bg-white border border-gold-500/40 hover:border-saffron-500 shadow-warm overflow-hidden transition-transform hover:-translate-y-0.5"
            >
              {/* Pamphlet / venue photo. Most listed bhandaras come in
                  via the WhatsApp invite scan, so photoUrl is usually
                  the original poster — leading with it makes the card
                  scannable at a glance and matches the spotted-tab
                  layout. Cards without a photo fall back to a soft
                  cream banner so the grid stays visually even. */}
              {b.photoUrl ? (
                <div className="relative aspect-[4/3] bg-cream-50 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={b.photoUrl}
                    alt={displayName}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  {/* Soft top-left chip with the area, mirrors the
                      spotted-card relative-time chip placement. */}
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-cream-50/95 backdrop-blur border border-gold-500/45 px-2 py-0.5 text-[0.6rem] font-mukta uppercase tracking-[0.22em] text-saffron-600 font-semibold">
                    {b.area}
                  </span>
                </div>
              ) : (
                <div className="relative aspect-[4/3] bg-gradient-to-br from-saffron-50 via-cream-50 to-cream-50 overflow-hidden">
                  {/* Same jali ornament accent as the empty-state cards
                      so a photo-less listing still feels brand-native
                      instead of starkly empty. */}
                  <JaliCorner
                    position="tl"
                    size={64}
                    className="absolute top-0 left-0 text-gold-500/55"
                  />
                  <JaliCorner
                    position="br"
                    size={64}
                    className="absolute bottom-0 right-0 text-gold-500/40"
                  />
                  <div className="relative h-full w-full flex items-center justify-center">
                    <span className="font-mukta uppercase tracking-[0.32em] text-saffron-600 text-[0.65rem] font-semibold">
                      {b.area}
                    </span>
                  </div>
                </div>
              )}

              <div className="relative px-5 pt-5 pb-6">
                <h3
                  className={`text-lg leading-snug ${
                    isHi
                      ? "font-tiro text-sindoor-700"
                      : "font-fraunces font-semibold text-sindoor-700"
                  } [text-wrap:balance]`}
                >
                  {displayName}
                </h3>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {dates.map((iso) => (
                    <span
                      key={iso}
                      className="inline-flex items-center gap-1 rounded-full border border-gold-500/40 bg-cream-50 px-2 py-0.5 text-[0.7rem] font-numerals tabular-nums text-ink-700"
                    >
                      {shortDate(iso, isHi)}
                    </span>
                  ))}
                  {b.tuesdayDates.length > dates.length ? (
                    <span className="inline-flex items-center text-[0.7rem] text-ink-600">
                      +{b.tuesdayDates.length - dates.length}
                    </span>
                  ) : null}
                </div>
                {time ? (
                  <p className="mt-3 text-xs text-ink-600">{time}</p>
                ) : null}
                <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-saffron-600 group-hover:text-saffron-500">
                  {isHi ? "विवरण देखें" : "View details"}
                  <span aria-hidden>→</span>
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Spotted timeline ────────────────────────────────────────────────── */

function SpottedTimeline({
  items,
  isHi,
}: {
  items: SpottedItem[];
  isHi: boolean;
}) {
  const langSuffix = isHi ? "" : "?lang=en";
  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((s) => {
        const linkedName = isHi
          ? s.bhandaraNameHi ?? s.bhandaraName
          : s.bhandaraName;
        return (
          <li
            key={s.id}
            className="relative rounded-3xl bg-white border border-gold-500/40 shadow-warm overflow-hidden"
          >
            {s.photoUrl ? (
              <div className="relative aspect-[4/3] bg-cream-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.photoUrl}
                  alt={s.caption ?? (isHi ? "स्पॉट" : "Spot")}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-cream-50/95 backdrop-blur border border-gold-500/45 px-2 py-0.5 text-[0.6rem] font-mukta uppercase tracking-[0.22em] text-saffron-600 font-semibold">
                  {relativeWhen(s.createdAt, isHi)}
                </span>
              </div>
            ) : (
              <div className="aspect-[4/3] bg-gradient-to-br from-saffron-50 to-cream-50 flex items-center justify-center">
                <p className="font-mukta uppercase tracking-[0.28em] text-gold-500 text-[0.65rem]">
                  {relativeWhen(s.createdAt, isHi)}
                </p>
              </div>
            )}
            <div className="px-4 py-4">
              <p className="text-[0.7rem] font-mukta uppercase tracking-[0.28em] text-gold-500">
                {s.area ?? (isHi ? "लखनऊ" : "Lucknow")}
              </p>
              {s.caption ? (
                <p className="mt-1.5 text-sm text-ink-900 leading-snug [text-wrap:pretty] line-clamp-3">
                  {s.caption}
                </p>
              ) : (
                <p className="mt-1.5 text-sm italic text-ink-600">
                  {isHi
                    ? "बिना संदेश के स्पॉट"
                    : "Spotted without a caption"}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between text-[0.7rem] text-ink-600">
                <span>
                  {(s.reporterName?.trim() ||
                    (isHi ? "स्पॉटर" : "Spotter"))}
                </span>
                <span title={fullDate(s.createdAt, isHi)}>
                  {fullDate(s.createdAt, isHi)}
                </span>
              </div>
              {s.bhandaraSlug && linkedName ? (
                <Link
                  href={`/bhandara/${s.bhandaraSlug}${langSuffix}`}
                  data-ga="archive_spotted_open_bhandara"
                  data-ga-slug={s.bhandaraSlug}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-saffron-600 hover:text-saffron-500"
                >
                  {linkedName}
                  <span aria-hidden>→</span>
                </Link>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────── */

function ArchiveEmpty({
  isHi,
  variant,
}: {
  isHi: boolean;
  variant: "listed" | "spotted";
}) {
  const copy =
    variant === "listed"
      ? {
          headline: isHi
            ? "अभी कोई भंडारा बीता नहीं।"
            : "No bhandaras have wrapped up yet.",
          body: isHi
            ? "जैसे ही पहला मंगलवार पूरा होगा, उस दिन के भंडारे यहाँ अपने-आप सहेज लिए जाएँगे।"
            : "As soon as the first Tuesday completes, that day's bhandaras will be quietly archived here.",
        }
      : {
          headline: isHi
            ? "अभी कोई स्पॉट एक्सपायर नहीं हुआ।"
            : "No spots have expired yet.",
          body: isHi
            ? "हर स्पॉट 8 घंटे तक लाइव फ़ीड में रहता है, फिर यहाँ आ जाता है।"
            : "Every spot stays on the live feed for 8 hours, then settles here for the long-term record.",
        };
  return (
    <div className="relative overflow-hidden rounded-3xl border border-gold-500/45 bg-gradient-to-br from-saffron-50 via-cream-50 to-cream-50 px-6 sm:px-10 py-10 sm:py-14 text-center shadow-warm">
      <JaliCorner
        position="tl"
        size={56}
        className="absolute top-0 left-0 text-gold-500/55"
      />
      <JaliCorner
        position="br"
        size={56}
        className="absolute bottom-0 right-0 text-gold-500/40"
      />
      <h2
        className={`text-xl sm:text-2xl ${
          isHi
            ? "font-tiro text-sindoor-700"
            : "font-fraunces font-semibold text-sindoor-700"
        }`}
      >
        {copy.headline}
      </h2>
      <p className="mt-2 text-sm text-ink-600 max-w-xl mx-auto leading-relaxed">
        {copy.body}
      </p>
    </div>
  );
}
