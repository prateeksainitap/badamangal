"use client";

import { useEffect, useRef, useState } from "react";
import { ALL_CITIES, type City } from "@/lib/cities";
import { useCityContext } from "@/lib/city-context";
import { useLocaleFromContext } from "@/lib/locale-context";
import { trackEvent } from "@/lib/ga";

/**
 * City switcher for the header.
 *
 * Shows every city on the registry, not just the live ones. The three
 * 2027 cities (Kanpur, Hardoi, Barabanki) render as visible-but-locked
 * rows rather than being hidden, on purpose: they are a promise to the
 * out-of-town audience the analytics already show (Kanpur is the #2
 * city by traffic after Lucknow), and an organiser in Kanpur seeing
 * "coming 2027" is a far better answer than a switcher that silently
 * pretends their city does not exist. Locked rows are inert and marked
 * aria-disabled so assistive tech agrees with the visual treatment.
 */
export default function CitySwitcher({
  className = "",
}: {
  className?: string;
}) {
  const { city, setCity } = useCityContext();
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click + Escape. Both, because a dropdown that
  // only closes on one of them feels broken with the other input.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = (c: City) => (isHi ? c.nameHi : c.name);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        // Without this the control announces as an unlabelled button:
        // the visible text is just the city name, which reads as a
        // bare place name with no hint that it opens a chooser.
        aria-label={
          isHi
            ? `शहर चुनें, अभी ${label(city)}`
            : `Choose your city, currently ${label(city)}`
        }
        data-ga="city_switcher_open"
        className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/45 bg-cream-50 px-3 py-1.5 text-sm font-medium text-ink-900 transition-colors hover:border-saffron-500 hover:text-saffron-600"
      >
        <PinIcon />
        <span>{label(city)}</span>
        <ChevronIcon open={open} />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={isHi ? "शहर चुनें" : "Choose a city"}
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-gold-500/45 bg-cream-50 shadow-warm"
        >
          <p className="border-b border-gold-500/25 px-4 py-2.5 font-mukta text-[0.6rem] font-bold uppercase tracking-[0.24em] text-saffron-600">
            {isHi ? "शहर चुनें" : "Choose your city"}
          </p>
          <ul className="py-1">
            {ALL_CITIES.map((c) => {
              const active = c.slug === city.slug;
              const locked = !c.isLive;
              return (
                <li key={c.slug}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    aria-disabled={locked}
                    disabled={locked}
                    onClick={() => {
                      if (locked) return;
                      setCity(c.slug);
                      setOpen(false);
                      trackEvent("city_switch", { city: c.slug });
                    }}
                    className={[
                      "flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition-colors",
                      locked
                        ? "cursor-not-allowed text-ink-600/45"
                        : active
                          ? "bg-saffron-50 font-semibold text-sindoor-700"
                          : "text-ink-900 hover:bg-saffron-50/70",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-2">
                      {active ? (
                        <CheckIcon />
                      ) : (
                        <span aria-hidden className="w-3.5" />
                      )}
                      <span>{label(c)}</span>
                    </span>
                    {locked ? (
                      <span className="shrink-0 rounded-full border border-gold-500/40 px-2 py-0.5 font-mukta text-[0.55rem] font-bold uppercase tracking-[0.14em] text-gold-500">
                        {isHi ? "2027" : "2027"}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-gold-500/25 px-4 py-2.5 text-[0.7rem] leading-snug text-ink-600">
            {isHi
              ? "कानपुर, हरदोई और बाराबंकी अगले सीज़न आ रहे हैं।"
              : "Kanpur, Hardoi and Barabanki arrive next season."}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function PinIcon() {
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
      className="text-saffron-600"
    >
      <path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10z" />
      <circle cx="12" cy="11" r="2.2" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="text-saffron-600"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
