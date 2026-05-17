"use client";

/**
 * Brand-themed calendar picker wrapping react-day-picker. Used in the
 * BhandaraForm Step 3 "Pick any other date" slot, and reusable wherever
 * we need a one-off date pick inside the 2026 Bada Mangal season.
 *
 * The trigger is a saffron pill; clicking it opens a popover panel that
 * sits beneath the trigger. The DayPicker grid is restyled via the
 * `classNames` prop so every cell honours our cream/saffron/gold tokens.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { DayPicker, useDayPicker } from "react-day-picker";
import type { MonthCaptionProps } from "react-day-picker";

type Props = {
  /** Lower bound (inclusive). ISO YYYY-MM-DD. */
  minIso: string;
  /** Upper bound (inclusive). ISO YYYY-MM-DD. */
  maxIso: string;
  /** Dates that are already chosen, highlighted, but still pickable to undo. */
  selectedIsos?: string[];
  /** Fired when the user commits a fresh date. ISO YYYY-MM-DD. */
  onPick: (iso: string) => void;
  /** Optional pre-positioning hint for the popover. */
  align?: "left" | "right";
  locale?: "hi" | "en";
};

function isoFromDate(d: Date): string {
  // Use the local-Y/M/D so a tap at 11pm IST doesn't roll over to next-day UTC.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateFromIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export default function SeasonDatePicker({
  minIso,
  maxIso,
  selectedIsos = [],
  onPick,
  align = "left",
  locale = "en",
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  const min = useMemo(() => dateFromIso(minIso), [minIso]);
  const max = useMemo(() => dateFromIso(maxIso), [maxIso]);
  const selectedDates = useMemo(
    () => selectedIsos.map(dateFromIso),
    [selectedIsos],
  );
  const defaultMonth = useMemo(() => {
    // Open the calendar on the first month of the season the user can
    // still pick into, usually the current month, but pinned to the
    // season bounds.
    const today = new Date();
    if (today < min) return min;
    if (today > max) return max;
    return today;
  }, [min, max]);

  // Close on click-outside + Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
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

  const triggerLabel = locale === "hi" ? "तारीख़ चुनें" : "Pick a date";

  return (
    <div className="relative inline-block" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex items-center gap-2 rounded-full border border-saffron-500/55 bg-cream-50 px-4 py-2 text-sm font-medium text-sindoor-700 shadow-warm hover:border-saffron-600 hover:bg-saffron-50 transition-colors"
      >
        <CalendarIcon />
        <span>{triggerLabel}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={triggerLabel}
          className={`absolute z-50 mt-2 ${
            align === "right" ? "right-0" : "left-0"
          } rounded-2xl border border-gold-500/55 bg-cream-50 shadow-warm p-3 sm:p-4`}
        >
          <DayPicker
            mode="single"
            defaultMonth={defaultMonth}
            startMonth={min}
            endMonth={max}
            disabled={[{ before: min }, { after: max }]}
            // The picker is "add a date to the list", not "show one
            // selected date", so we don't pass `selected`. Already-chosen
            // dates are highlighted via a custom modifier instead.
            modifiers={{ chosen: selectedDates }}
            modifiersClassNames={{
              chosen:
                "[&_button]:bg-saffron-50 [&_button]:border [&_button]:border-saffron-500/60 [&_button]:text-sindoor-700 [&_button]:font-semibold",
            }}
            onSelect={(d) => {
              if (!d) return;
              onPick(isoFromDate(d));
              setOpen(false);
            }}
            showOutsideDays
            weekStartsOn={1}
            classNames={CLASS_NAMES}
            components={{ MonthCaption: BrandMonthCaption }}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Theme overrides for react-day-picker v9. We only set the keys we want
 * to restyle, anything left unset keeps the library's default class
 * name, which is fine because we don't load the default stylesheet.
 *
 * Brand mapping:
 *   - cell hover / focus  → saffron-50 + saffron-600 ring
 *   - selected day       → saffron-600 bg, cream-50 text
 *   - today              → sindoor-700 underline accent
 *   - disabled / outside → muted ink-600 / gold tint
 */
const CLASS_NAMES: NonNullable<
  React.ComponentProps<typeof DayPicker>["classNames"]
> = {
  root: "rdp font-mukta text-ink-900",
  months: "flex flex-col sm:flex-row gap-4",
  month: "flex flex-col",
  // Default nav is hidden, we render arrows inline inside our own
  // MonthCaption component below so the header reads `‹  Month YYYY  ›`
  // on one row.
  nav: "hidden",
  month_grid: "border-collapse",
  weekdays: "",
  weekday:
    "font-mukta uppercase tracking-[0.18em] text-[0.62rem] text-gold-500 font-semibold w-9 h-7 text-center",
  week: "",
  day: "p-0 align-middle",
  day_button:
    "w-9 h-9 inline-flex items-center justify-center rounded-full text-sm font-numerals tabular-nums text-ink-900 hover:bg-saffron-50 hover:text-sindoor-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-600 transition-colors",
  selected:
    "[&_button]:bg-saffron-600 [&_button]:text-cream-50 [&_button]:font-semibold [&_button]:shadow-warm hover:[&_button]:bg-saffron-500",
  today:
    "[&_button]:ring-1 [&_button]:ring-sindoor-700/40 [&_button]:text-sindoor-700 [&_button]:font-semibold",
  outside: "[&_button]:text-ink-600/40",
  disabled: "[&_button]:text-ink-600/30 [&_button]:cursor-not-allowed [&_button]:hover:bg-transparent",
  hidden: "invisible",
};

/**
 * Custom month-caption row: `‹  May 2026  ›`. The two nav buttons sit on
 * either side of the month label, all on a single row with a hairline
 * gold rule underneath. The arrows are disabled at season bounds so the
 * user can't navigate past May or June 2026.
 */
function BrandMonthCaption({ calendarMonth }: MonthCaptionProps) {
  const { previousMonth, nextMonth, goToMonth } = useDayPicker();
  const label = calendarMonth.date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const navBtn =
    "inline-flex items-center justify-center w-7 h-7 rounded-full border border-gold-500/45 bg-cream-50 text-sindoor-700 hover:bg-saffron-50 hover:border-saffron-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-cream-50 disabled:hover:border-gold-500/45 transition-colors";
  return (
    <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-gold-500/30">
      <button
        type="button"
        aria-label="Previous month"
        disabled={!previousMonth}
        onClick={() => previousMonth && goToMonth(previousMonth)}
        className={navBtn}
      >
        <ChevronLeft />
      </button>
      <span className="font-tiro text-base text-sindoor-700 font-numerals tabular-nums">
        {label}
      </span>
      <button
        type="button"
        aria-label="Next month"
        disabled={!nextMonth}
        onClick={() => nextMonth && goToMonth(nextMonth)}
        className={navBtn}
      >
        <ChevronRight />
      </button>
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9h17" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </svg>
  );
}
