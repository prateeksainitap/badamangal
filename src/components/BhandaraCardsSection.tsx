"use client";

import { useMemo, useState } from "react";
import BhandaraCard from "@/components/BhandaraCard";
import FancySelect from "@/components/FancySelect";
import { trackEvent } from "@/lib/ga";
import type { Bhandara } from "@/types/bhandara";
import type { Locale } from "@/content/strings";
import { strings } from "@/content/strings";
import { AREAS } from "@/lib/lucknow";
import { useLocaleFromContext } from "@/lib/locale-context";

type Props = {
  listings: Bhandara[];
  locale: Locale;
  heading: string;
  isHi: boolean;
};

type DateFilter = "all" | string;

export default function BhandaraCardsSection({
  listings,
  heading,
}: Props) {
  // Locale from client context (cookie-aware). Props locale/isHi are
  // kept on Props for type-compat but intentionally not destructured.
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const t = strings[locale];
  const [area, setArea] = useState<"all" | string>("all");
  const [tuesday, setTuesday] = useState<DateFilter>("all");

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

  const filtered = useMemo(
    () =>
      listings.filter((b) => {
        if (area !== "all" && b.area !== area) return false;
        if (tuesday !== "all" && !b.tuesdayDates.includes(tuesday)) return false;
        return true;
      }),
    [listings, area, tuesday],
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
    <section className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <h2
          className={`text-3xl sm:text-4xl ${
            isHi
              ? "font-tiro text-sindoor-700"
              : "font-fraunces font-bold text-sindoor-700"
          }`}
        >
          {/* Live count prefix — saffron coloured, but otherwise
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
            {listings.length}
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

      {filtered.length > 0 ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
          {filtered.map((b) => (
            <div key={b.id} className="flex">
              <BhandaraCard bhandara={b} locale={locale} />
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
              {/* Decorative gada — sits above the copy as a soft hero
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
                <a href="/list-bhandara" className="btn btn-primary btn-sm">
                  {isHi ? "अपना भंडारा जोड़ें" : "List your bhandara"}
                </a>
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

