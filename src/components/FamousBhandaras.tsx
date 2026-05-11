"use client";

import Link from "next/link";
import { useState } from "react";
import type { Locale } from "@/content/strings";
import { FAMOUS_BHANDARAS, type FamousBhandara } from "@/content/famous-bhandaras";
import { JaliCorner } from "@/components/ornaments";
import { trackEvent } from "@/lib/ga";

type Props = {
  locale: Locale;
  isHi: boolean;
};

const INITIAL_VISIBLE = 6;

/**
 * "Famous bhandaras of Lucknow" — curated landmark venues. Six cards
 * render by default; the rest expand on click so the section stays
 * digestible on first paint.
 */
export default function FamousBhandaras({ locale, isHi }: Props) {
  const langSuffix = locale === "en" ? "?lang=en" : "";
  const [showAll, setShowAll] = useState(false);
  const visible = showAll
    ? FAMOUS_BHANDARAS
    : FAMOUS_BHANDARAS.slice(0, INITIAL_VISIBLE);
  const hiddenCount = FAMOUS_BHANDARAS.length - INITIAL_VISIBLE;

  return (
    <section
      aria-label={
        isHi
          ? "लखनऊ के सबसे बड़े भंडारे"
          : "Famous bhandaras of Lucknow"
      }
      className="relative overflow-hidden"
    >
      {/* Soft warm wash so the section reads as one panel */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 480px at 50% -10%, rgba(242,148,76,0.13), transparent 70%), linear-gradient(180deg, transparent 0%, rgba(255,247,235,0.6) 50%, transparent 100%)",
        }}
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-20">
        <header className="text-center max-w-2xl mx-auto">
          <p className="font-mukta uppercase tracking-[0.32em] text-saffron-600 text-xs font-semibold">
            {isHi ? "शहर की पहचान" : "City landmarks"}
          </p>
          <h2
            className={`mt-3 text-3xl sm:text-4xl ${
              isHi
                ? "font-deva font-medium text-sindoor-700"
                : "font-fraunces font-semibold text-sindoor-700"
            }`}
          >
            {isHi
              ? "लखनऊ के सबसे बड़े भंडारे"
              : "Famous bhandaras of Lucknow"}
          </h2>
          <p className="mt-3 text-ink-600 leading-relaxed">
            {isHi
              ? "हर बड़े मंगल पर लखनऊ इन्हीं जगहों के इर्द-गिर्द जुटता है। यहाँ का प्रसाद, यहाँ की कतार, यहाँ की रौनक, सब कुछ शहर की पहचान है।"
              : "Every Bada Mangal, Lucknow gathers around these places. The prasad, the queues, the throng, all of it part of the city's signature."}
          </p>
        </header>

        <ol className="mt-10 grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((b, i) => (
            <FamousCard
              key={b.name}
              bhandara={b}
              isHi={isHi}
              langSuffix={langSuffix}
              rank={i + 1}
            />
          ))}
        </ol>

        {hiddenCount > 0 ? (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => {
                setShowAll((v) => {
                  const next = !v;
                  trackEvent("famous_show_more", { expanded: next ? 1 : 0 });
                  return next;
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/55 bg-cream-50 hover:border-saffron-500/70 hover:bg-saffron-50/60 transition-colors px-5 py-2 text-sm font-mukta uppercase tracking-[0.18em] font-semibold text-sindoor-700"
            >
              {showAll
                ? isHi
                  ? "कम दिखाएँ"
                  : "Show fewer"
                : isHi
                  ? `${hiddenCount} और दिखाएँ`
                  : `Show ${hiddenCount} more`}
              <span aria-hidden>{showAll ? "↑" : "↓"}</span>
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function FamousCard({
  bhandara: b,
  isHi,
  langSuffix,
  rank,
}: {
  bhandara: FamousBhandara;
  isHi: boolean;
  langSuffix: string;
  rank: number;
}) {
  const kindAccent = {
    temple: {
      pill: "bg-sindoor-700/8 text-sindoor-700 border-sindoor-700/30",
      label: isHi ? "मंदिर" : "Temple",
    },
    intersection: {
      pill: "bg-saffron-50 text-saffron-600 border-saffron-500/45",
      label: isHi ? "चौराहा" : "Intersection",
    },
    neighbourhood: {
      pill: "bg-leaf-600/8 text-leaf-600 border-leaf-600/30",
      label: isHi ? "मोहल्ला" : "Neighbourhood",
    },
  }[b.kind];

  // Card is clickable only when there's a dedicated /bhandara/[slug]
  // page for this venue. Otherwise it renders as a static info tile —
  // the Google Maps and directions affordances were intentionally
  // removed from this list so the page stays visually quiet.
  const hasInternalPage = !!b.slug;
  const Wrapper = hasInternalPage ? Link : "div";
  const wrapperProps = hasInternalPage
    ? { href: `/bhandara/${b.slug}${langSuffix}` }
    : {};

  return (
    <li>
      <Wrapper
        {...(wrapperProps as { href: string })}
        {...(hasInternalPage
          ? { "data-ga": "famous_card_open", "data-ga-name": b.name, "data-ga-area": b.area }
          : {})}
        className={[
          "group relative block h-full rounded-3xl border border-gold-500/35 bg-cream-50 p-5 sm:p-6 shadow-warm overflow-hidden",
          hasInternalPage
            ? "transition-transform duration-200 hover:-translate-y-0.5 hover:border-saffron-500/60"
            : "",
        ].join(" ")}
      >
        <JaliCorner
          position="tl"
          className="absolute top-2 left-2 w-6 h-6 text-gold-500/55"
        />
        <JaliCorner
          position="br"
          className="absolute bottom-2 right-2 w-6 h-6 text-gold-500/55"
        />

        {/* Rank + kind row */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-numerals font-extrabold text-saffron-600/85 text-2xl tabular-nums leading-none">
            {String(rank).padStart(2, "0")}
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] font-semibold ${kindAccent.pill}`}
          >
            {kindAccent.label}
          </span>
        </div>

        {/* Name + area */}
        <h3
          className={`mt-3 text-lg leading-tight ${
            isHi
              ? "font-deva font-semibold text-sindoor-700"
              : "font-fraunces font-semibold text-sindoor-700"
          }`}
        >
          {isHi ? b.nameHi : b.name}
        </h3>
        <p className="mt-1 text-xs text-ink-600 font-mukta uppercase tracking-[0.18em]">
          {isHi ? b.areaHi : b.area}
        </p>

        {/* Descriptor */}
        <p className="mt-3 text-sm text-ink-900 leading-relaxed">
          {isHi ? b.noteHi : b.note}
        </p>
      </Wrapper>
    </li>
  );
}
