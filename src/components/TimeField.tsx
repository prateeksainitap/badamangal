"use client";

import { Fragment } from "react";
import { Popover, PopoverButton, PopoverPanel, Transition } from "@headlessui/react";

type Props = {
  /** 24-hour "HH:MM" string, e.g. "11:00" or "" when unset. */
  value: string;
  onChange: (next: string) => void;
  ariaLabel?: string;
  /** Placeholder text when no time is picked yet. */
  placeholder?: string;
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = ["00", "15", "30", "45"]; // common bhandara cadences

function parse(value: string): {
  hour12: number;
  minute: string;
  period: "AM" | "PM";
} | null {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2];
  if (Number.isNaN(h)) return null;
  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  const hour12 = ((h + 11) % 12) + 1;
  return { hour12, minute: min, period };
}

function build(hour12: number, minute: string, period: "AM" | "PM"): string {
  const h24 = period === "AM" ? hour12 % 12 : (hour12 % 12) + 12;
  return `${String(h24).padStart(2, "0")}:${minute}`;
}

function pretty(value: string): string {
  const p = parse(value);
  if (!p) return "";
  return `${String(p.hour12).padStart(2, "0")}:${p.minute} ${p.period}`;
}

/**
 * Brand-styled time picker. A single button shows the picked time
 * ("11:00 AM"); clicking it opens a popover with three small grids:
 * hours, minutes, and AM/PM. No native OS time wheel, looks identical
 * to the rest of the form's selects.
 */
export default function TimeField({
  value,
  onChange,
  ariaLabel = "Time",
  placeholder = "Pick a time",
}: Props) {
  const parsed = parse(value);
  // Sensible defaults so a single column tap produces a valid time.
  const hour12 = parsed?.hour12 ?? 11;
  const minute = parsed?.minute ?? "00";
  const period: "AM" | "PM" = parsed?.period ?? "AM";

  const update = (next: {
    hour12?: number;
    minute?: string;
    period?: "AM" | "PM";
  }) => {
    onChange(
      build(
        next.hour12 ?? hour12,
        next.minute ?? minute,
        next.period ?? period,
      ),
    );
  };

  const display = pretty(value);

  return (
    <Popover className="relative">
      <PopoverButton
        aria-label={ariaLabel}
        className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-base text-ink-900 hover:border-saffron-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-600 focus:border-saffron-600 transition-colors data-[open]:border-saffron-600 data-[open]:ring-2 data-[open]:ring-saffron-600"
      >
        <span className="inline-flex items-center gap-2">
          <ClockIcon />
          {display ? (
            <span className="font-numerals tabular-nums tracking-wide">
              {display}
            </span>
          ) : (
            <span className="text-ink-600/70">{placeholder}</span>
          )}
        </span>
        <ChevronDown />
      </PopoverButton>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-150"
        enterFrom="opacity-0 -translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-100"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 -translate-y-1"
      >
        <PopoverPanel
          anchor={{ to: "bottom start", gap: 6 }}
          className="z-[2000] w-[300px] rounded-2xl border border-gold-500/50 bg-cream-50 shadow-warm focus:outline-none p-3"
        >
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2">
            {/* Hours */}
            <Column label="Hour">
              <div className="grid grid-cols-3 gap-1">
                {HOURS.map((h) => {
                  const active = value !== "" && hour12 === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => update({ hour12: h })}
                      className={cellClass(active)}
                    >
                      {String(h).padStart(2, "0")}
                    </button>
                  );
                })}
              </div>
            </Column>

            {/* Minutes */}
            <Column label="Min">
              <div className="grid grid-cols-1 gap-1">
                {MINUTES.map((m) => {
                  const active = value !== "" && minute === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => update({ minute: m })}
                      className={cellClass(active)}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </Column>

            {/* Period */}
            <Column label="">
              <div className="grid grid-cols-1 gap-1">
                {(["AM", "PM"] as const).map((p) => {
                  const active = value !== "" && period === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => update({ period: p })}
                      className={cellClass(active)}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </Column>
          </div>

          {/* Quick-pick presets */}
          <div className="mt-3 pt-3 border-t border-gold-500/30">
            <p className="text-[10px] uppercase tracking-[0.22em] text-ink-600 font-semibold mb-1.5">
              Quick pick
            </p>
            <div className="flex flex-wrap gap-1">
              {[
                { label: "10 AM", v: "10:00" },
                { label: "11 AM", v: "11:00" },
                { label: "12 PM", v: "12:00" },
                { label: "1 PM", v: "13:00" },
                { label: "3 PM", v: "15:00" },
                { label: "5 PM", v: "17:00" },
              ].map((p) => (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => onChange(p.v)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                    value === p.v
                      ? "bg-saffron-600 border-saffron-600 text-cream-50"
                      : "bg-cream-50 border-gold-500/45 text-ink-900 hover:border-saffron-500"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </PopoverPanel>
      </Transition>
    </Popover>
  );
}

function Column({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      {label ? (
        <p className="text-[10px] uppercase tracking-[0.22em] text-ink-600 font-semibold mb-1.5">
          {label}
        </p>
      ) : (
        <p className="h-3 mb-1.5" aria-hidden />
      )}
      {children}
    </div>
  );
}

function cellClass(active: boolean): string {
  return [
    "py-1.5 px-2 rounded-lg text-sm font-numerals tabular-nums font-semibold transition-colors",
    active
      ? "bg-saffron-600 text-cream-50 shadow-warm"
      : "bg-cream-50 border border-gold-500/35 text-ink-900 hover:border-saffron-500 hover:bg-saffron-50",
  ].join(" ");
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
      className="text-saffron-600 shrink-0">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
      className="text-ink-600 shrink-0">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
