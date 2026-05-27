"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import BhandaraCard from "@/components/BhandaraCard";
import FancySelect from "@/components/FancySelect";
import CtaPendingDot from "@/components/CtaPendingDot";
import { trackEvent } from "@/lib/ga";
import type { Bhandara } from "@/types/bhandara";
import type { Locale } from "@/content/strings";
import { strings } from "@/content/strings";
import { AREAS } from "@/lib/lucknow";
import { areaToSlug } from "@/lib/areaSlug";
import { useLocaleFromContext } from "@/lib/locale-context";
import { expandBhandarasByDate } from "@/lib/dates";

/**
 * Locale-derived heading/locale/isHi were once props (server-rendered
 * from a hardcoded "en"), which meant the section title never swapped
 * on the Hindi toggle. Now they're computed entirely from the
 * LocaleProvider context. Props remain on the type purely so any
 * legacy caller still compiles; values are ignored at runtime.
 */
type Props = {
  listings: Bhandara[];
  locale?: Locale;
  heading?: string;
  isHi?: boolean;
  /**
   * Total approved bhandaras across the city (not filtered by
   * `hasUpcomingDate`). Drives the headline "X Bhandaras listed
   * across the city" so the saffron prefix matches the stats panel
   * (35) instead of just the upcoming-dates subset (8). Caller is
   * page.tsx, which has both `records` (raw) and `listings`
   * (filtered) in scope. Falls back to `listings.length` when not
   * passed so any legacy caller keeps compiling and renders the
   * older number rather than 0.
   */
  totalListed?: number;
};

type DateFilter = "all" | string;

export default function BhandaraCardsSection({
  listings,
  totalListed,
}: Props) {
  // Locale + heading derive from the LocaleProvider so the Hindi
  // toggle flips the section title and every label below it
  // synchronously.
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const langSuffix = isHi ? "" : "?lang=en";
  const t = strings[locale];
  const heading = t.cards.sectionHeading;
  const [area, setArea] = useState<"all" | string>("all");
  const [tuesday, setTuesday] = useState<DateFilter>("all");
  // `q` is the freetext search filter. Populated either from the
  // URL on mount (Google's sitelinks search box deep-link
  // `${SITE_URL}/?q={search_term_string}`, declared in our
  // WebSite SearchAction schema in lib/seo) or from the inline
  // search input we mount alongside the filters. Stored as state
  // so subsequent typing reacts client-side without server hits.
  const [q, setQ] = useState<string>("");
  // Tracks whether the section has been scrolled into view in
  // response to an inbound ?q= URL. Used to ensure we only
  // scroll once per page load rather than on every state change.
  const scrolledRef = useRef(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  // Read ?q= from the URL on mount + scroll into view if present.
  // Runs once because deps are empty, only fires on initial mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const incoming = url.searchParams.get("q");
    if (incoming) {
      const cleaned = incoming.trim().slice(0, 80);
      setQ(cleaned);
      trackEvent("home_search_query_inbound", {
        len: cleaned.length,
      });
      if (!scrolledRef.current) {
        scrolledRef.current = true;
        window.requestAnimationFrame(() => {
          sectionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
      }
    }
  }, []);

  // Always show every Lucknow area we support, keeps the filter list
  // identical to the Add-bhandara form regardless of which listings exist.
  const areas = useMemo(
    () =>
      [...AREAS].sort((a, b) =>
        (t.areas[a] ?? a).localeCompare(t.areas[b] ?? b),
      ),
    [t.areas],
  );

  const tuesdays = useMemo(() => {
    const set = new Set<string>();
    for (const b of listings) for (const d of b.tuesdayDates) set.add(d);
    return Array.from(set).sort();
  }, [listings]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return listings.filter((b) => {
      if (area !== "all" && b.area !== area) return false;
      if (tuesday !== "all" && !b.tuesdayDates.includes(tuesday)) return false;
      if (needle) {
        // Match against name, nameHi, area, organizer, or address,
        // any token gives a hit. Lowercased on both sides so the
        // match is case-insensitive without an extra regex
        // compilation per row.
        const hay = `${b.name} ${b.nameHi ?? ""} ${b.area} ${b.organizerName} ${b.address}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [listings, area, tuesday, q]);

  // Total CARD count = expanded-by-date instance count, not the raw
  // listings.length. One bhandara record with 4 upcoming Tuesdays
  // renders as 4 cards (expandBhandarasByDate below), so the
  // headline "5 Bhandaras listed" was undercounting what the visitor
  // actually saw on the grid. This computes the same expansion the
  // render uses so the headline number == the card count rendered.
  // Uses `listings` (not `filtered`) so the headline stays stable as
  // the visitor applies filter chips, matching the design intent
  // documented in the totalListed-prop comment below.
  const totalCardCount = useMemo(
    () => expandBhandarasByDate(listings).length,
    [listings],
  );

  const areaOptions = [
    { value: "all", label: isHi ? "सभी क्षेत्र" : "All areas" },
    ...areas.map((a) => ({
      value: a,
      label: t.areas[a as keyof typeof t.areas] ?? a,
    })),
  ];
  const tuesdayOptions = [
    { value: "all", label: isHi ? "सभी तिथियाँ" : "All dates" },
    ...tuesdays.map((d) => ({
      value: d,
      label: new Date(`${d}T04:30:00Z`).toLocaleDateString(
        isHi ? "hi-IN" : "en-IN",
        { day: "numeric", month: "short" },
      ),
    })),
  ];

  return (
    <section
      ref={sectionRef}
      className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16 scroll-mt-20"
    >
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <h2
          className={`text-3xl sm:text-4xl ${
            isHi
              ? "font-tiro text-sindoor-700"
              : "font-fraunces font-bold text-sindoor-700"
          }`}
        >
          {/* Live count prefix, saffron coloured, but otherwise
              inherits the heading's font (Fraunces in English, Tiro
              in Hindi) so the number reads as one continuous editorial
              headline instead of a sans-serif tag glued to a serif
              title. We previously forced `font-numerals` here (the
              hand-tuned digit font we use for stats), but next to the
              Fraunces glyphs it looked like a separate badge. Keeping
              `tabular-nums` ensures the digit advances stay even,
              even though Fraunces' default figures already are. When
              the filters narrow the list, the headline still reflects
              the total (so "91 bhandaras listed" doesn't flip to 5
              the moment the user picks an area); the row below shows
              the filtered count separately. */}
          <span className="text-saffron-600 tabular-nums mr-1">
            {totalListed ?? totalCardCount}
          </span>
          {heading}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.24em] text-ink-600">
            {isHi ? "छाँटें" : "Filter"}
          </span>
          <FancySelect
            ariaLabel={isHi ? "क्षेत्र" : "Area"}
            value={area}
            onChange={(v) => {
              setArea(v);
              trackEvent("filter_area_change", { value: v });
            }}
            options={areaOptions}
          />
          <FancySelect
            ariaLabel={isHi ? "तिथि" : "Date"}
            value={tuesday}
            onChange={(v) => {
              setTuesday(v);
              trackEvent("filter_tuesday_change", { value: v });
            }}
            options={tuesdayOptions}
          />
        </div>
      </div>

      {/* Inline search input, also serves as the landing surface
          for Google's sitelinks search box (WebSite SearchAction
          deep-links here as `${SITE_URL}/?q=...`). The mount-effect
          above reads the URL `q` param and scrolls into view + pre-
          populates this input automatically. */}
      <div className="mt-5 flex items-center gap-2 max-w-md">
        <input
          type="search"
          inputMode="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={
            isHi
              ? "खोजें: नाम, क्षेत्र, संगठक…"
              : "Search: name, area, organizer…"
          }
          aria-label={isHi ? "भंडारा खोजें" : "Search bhandaras"}
          maxLength={80}
          className="flex-1 rounded-full border border-gold-500/55 bg-cream-50 px-4 py-2 text-sm text-ink-900 placeholder:text-ink-600/60 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
        />
        {q ? (
          <button
            type="button"
            onClick={() => {
              setQ("");
              trackEvent("home_search_clear", {});
            }}
            className="shrink-0 text-xs font-semibold text-sindoor-700 hover:text-saffron-600 underline decoration-dotted underline-offset-4 px-2"
          >
            {isHi ? "साफ़ करें" : "Clear"}
          </button>
        ) : null}
      </div>

      {/* If the search was inbound via ?q= (from Google's sitelinks
          search box), surface a banner so the user understands why
          the grid is filtered. */}
      {q ? (
        <p className="mt-3 text-sm text-ink-600">
          {isHi ? (
            <>
              <strong className="text-sindoor-700">{filtered.length}</strong>{" "}
              परिणाम “{q}” के लिए
            </>
          ) : (
            <>
              <strong className="text-sindoor-700">{filtered.length}</strong>{" "}
              result{filtered.length === 1 ? "" : "s"} for “{q}”
            </>
          )}
        </p>
      ) : null}

      {/* When an area filter is active, surface a deep-link to the
          dedicated /area/<slug> landing page. SEO + UX win:
            • SEO, visible internal link to a high-priority area
              page on a high-traffic source page (homepage).
            • UX, area-filtered visitors get one-tap access to a
              page that has only their area's bhandaras + adjacent
              areas + the area's FAQ. Better than scrolling here. */}
      {area !== "all" ? (
        <div className="mt-4 flex justify-end">
          <Link
            href={`/area/${areaToSlug(area)}${langSuffix}`}
            data-ga="cards_area_link"
            data-ga-area={area}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-saffron-600 hover:text-sindoor-700 transition-colors"
          >
            {isHi
              ? `${t.areas[area as keyof typeof t.areas] ?? area} का पूरा पेज देखें →`
              : `View dedicated ${t.areas[area as keyof typeof t.areas] ?? area} page →`}
          </Link>
        </div>
      ) : null}

      {filtered.length > 0 ? (
        // Per-occurrence expansion: a bhandara serving on all 8
        // Tuesdays + Bade Shanivars renders as ~10 distinct cards in
        // the grid, one per upcoming service date. Sorted chronologically
        // by `expandBhandarasByDate` so the grid reads as "what's on
        // this Tuesday, then next Tuesday, then…". The React key
        // includes the date so cards for the same slug don't collide,
        // and the BhandaraCard's own `pinnedDate` prop forces the
        // header chip to show that specific date instead of the
        // auto-picked next-upcoming Tuesday.
        //
        // When the date filter above is active (tuesday !== "all"),
        // each bhandara still expands but only its matching date
        // makes it through the filter, so each row gets one card,
        // not the full ~10. So the same code path serves both
        // "browse the season" and "browse one Tuesday" UX.
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
          {expandBhandarasByDate(filtered).map(({ bhandara, pinnedDate }) => (
            <div
              key={`${bhandara.id}-${pinnedDate ?? "none"}`}
              className="flex"
            >
              <BhandaraCard
                bhandara={bhandara}
                locale={locale}
                pinnedDate={pinnedDate}
              />
            </div>
          ))}
        </div>
      ) : (
        (() => {
          // Build a human-readable description of what's filtered, so the
          // empty state explains *why* it's empty instead of a generic
          // "no results". Example: "in Alambagh on 12 May".
          const areaLabel =
            area !== "all"
              ? t.areas[area as keyof typeof t.areas] ?? area
              : null;
          const dateLabel =
            tuesday !== "all"
              ? new Date(`${tuesday}T04:30:00Z`).toLocaleDateString(
                  isHi ? "hi-IN" : "en-IN",
                  { day: "numeric", month: "short" },
                )
              : null;
          const ctx = [
            areaLabel ? (isHi ? `${areaLabel} में` : `in ${areaLabel}`) : null,
            dateLabel ? (isHi ? `${dateLabel} को` : `on ${dateLabel}`) : null,
          ]
            .filter(Boolean)
            .join(" ");
          const headline = isHi
            ? `अभी ${ctx ? ctx + " " : ""}कोई भंडारा सूचीबद्ध नहीं है`
            : `No bhandaras listed ${ctx || "for this filter"} yet`;
          const subline = isHi
            ? "क्या आप यहाँ भंडारा कर रहे हैं? इसे सूची में जोड़ें, कुछ ही पल में लाइव।"
            : "Hosting one here? Add it to the list, goes live in a moment.";

          return (
            <div className="mt-8 overflow-hidden rounded-3xl border border-dashed border-gold-500/50 bg-gradient-to-br from-cream-50 via-white to-saffron-50/40 px-6 py-10 sm:py-12 text-center">
              {/* Decorative gada, sits above the copy as a soft hero
                  glyph; saffron halo behind it ties to the rest of the
                  card family. Aria-hidden because it's pure decoration. */}
              <div
                aria-hidden
                className="relative mx-auto mb-5 grid h-16 w-16 place-items-center"
              >
                <span className="absolute inset-0 rounded-full bg-saffron-200/50 blur-md" />
                <svg
                  viewBox="0 0 24 24"
                  className="relative h-9 w-9 text-saffron-600"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="7" r="4" />
                  <path d="M12 11v10" />
                  <path d="M9 21h6" />
                  <path d="M10 5.5l-1.2-1.2" />
                  <path d="M14 5.5l1.2-1.2" />
                  <path d="M12 3V1.5" />
                </svg>
              </div>

              <h3
                className={`text-lg sm:text-xl text-ink-700 ${
                  isHi ? "font-tiro" : "font-fraunces"
                }`}
              >
                {headline}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink-600">
                {subline}
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {/* Was a plain <a> doing a hard navigation, which meant
                    no Next.js prefetch + no in-flight feedback. Swapped
                    to <Link> so the route prefetches when the empty
                    state mounts, and added CtaPendingDot so a click on
                    a cold cache shows the spinner immediately instead
                    of looking dead for ~2 seconds. */}
                <Link
                  href={`/list-bhandara${isHi ? "" : "?lang=en"}`}
                  prefetch
                  data-ga="cta_empty_list_bhandara"
                  data-ga-source="cards_empty"
                  className="btn btn-primary btn-sm"
                >
                  {isHi ? "अपना भंडारा जोड़ें" : "List your bhandara"}
                  <CtaPendingDot />
                </Link>
                {(area !== "all" || tuesday !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setArea("all");
                      setTuesday("all");
                      trackEvent("filter_clear", {});
                    }}
                    className="text-sm text-sindoor-700 underline decoration-dotted underline-offset-4 hover:text-sindoor-800"
                  >
                    {isHi ? "फ़िल्टर साफ़ करें" : "Clear filters"}
                  </button>
                )}
              </div>
            </div>
          );
        })()
      )}
    </section>
  );
}

