"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from "@headlessui/react";

export type FancySelectOption = {
  value: string;
  label: string;
  /** Optional secondary label (e.g. transliteration) shown small under primary. */
  hint?: string;
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  options: FancySelectOption[];
  ariaLabel: string;
  /** "sm" matches `.btn-sm` height (36px). "md" matches default `.btn` (44px). */
  size?: "sm" | "md";
  /**
   * "pill" is the rounded-full chip used in homepage filters.
   * "input" is the rounded-xl white-background style that matches form
   * `<input>` and `<textarea>` controls, use this inside `<Field>` rows.
   */
  variant?: "pill" | "input";
  /** Called when no option matches the current value. Defaults to first option. */
  placeholder?: string;
  className?: string;
  /** Show a search input at the top of the panel. Auto-on for >=8 options. */
  searchable?: boolean;
  /** Localised placeholder for the search input. */
  searchPlaceholder?: string;
  /** When true, the trigger is unclickable and visually muted. */
  disabled?: boolean;
};

/**
 * Brand-styled select built on Headless UI's Listbox. Used everywhere we
 * previously had a native `<select>`, keeps look + behavior consistent
 * across the homepage filters, the multi-step form, and any other dropdown.
 */
export default function FancySelect({
  value,
  onChange,
  options,
  ariaLabel,
  size = "sm",
  variant = "pill",
  placeholder,
  className,
  searchable,
  searchPlaceholder = "Search…",
  disabled,
}: Props) {
  const [query, setQuery] = useState("");
  const showSearch = searchable ?? options.length >= 8;
  const filtered = useMemo(() => {
    if (!showSearch || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        (o.hint ? o.hint.toLowerCase().includes(q) : false),
    );
  }, [options, query, showSearch]);

  const current =
    options.find((o) => o.value === value) ??
    (placeholder
      ? { value: "", label: placeholder }
      : (options[0] ?? { value: "", label: "" }));

  const sizeClasses =
    size === "md"
      ? // Mirrors the form `<input>` exactly (px-3 py-2, 1rem text) so a
        // FancySelect[variant="input"] sits flush with sibling text fields.
        "px-3 py-2 text-base"
      : "min-h-[36px] px-3 py-2 text-[0.8rem]";

  // Visual variants:
  // - "pill" = rounded chip (filters, header)
  // - "input" = rounded-xl white control matching <input> in forms
  const variantClasses =
    variant === "input"
      ? "rounded-xl bg-white"
      : "rounded-full bg-cream-50 shadow-warm";

  return (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      <div className={`relative ${className ?? ""}`}>
        <ListboxButton
          aria-label={ariaLabel}
          className={`inline-flex w-full items-center justify-between gap-2 border border-gold-500/50 ${variantClasses} ${sizeClasses} text-ink-900 hover:border-saffron-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-600 focus:border-saffron-600 transition-colors data-[disabled]:opacity-70 data-[disabled]:cursor-not-allowed data-[disabled]:bg-saffron-50/50`}
        >
          <span
            className={`truncate text-left ${
              current.value === "" ? "text-ink-600/70" : "font-medium"
            }`}
          >
            {current.label}
          </span>
          <ChevronDown />
        </ListboxButton>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-150"
          enterFrom="opacity-0 -translate-y-1"
          enterTo="opacity-100 translate-y-0"
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 -translate-y-1"
        >
          <ListboxOptions
            anchor={{ to: "bottom start", gap: 6 }}
            className="z-[2000] w-[var(--button-width)] min-w-[220px] max-h-80 overflow-hidden rounded-2xl border border-gold-500/50 bg-cream-50 shadow-warm focus:outline-none flex flex-col"
          >
            {showSearch ? (
              <div className="sticky top-0 z-10 bg-cream-50 border-b border-gold-500/30 p-2">
                <div className="relative">
                  <SearchIcon />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      // Don't let Headless UI hijack typing; only stop here for
                      // typing-related keys, leave Up/Down/Enter/Escape alone.
                      if (
                        e.key.length === 1 ||
                        e.key === "Backspace" ||
                        e.key === "Delete"
                      ) {
                        e.stopPropagation();
                      }
                    }}
                    placeholder={searchPlaceholder}
                    className="w-full rounded-lg border border-gold-500/40 bg-white pl-8 pr-3 py-1.5 text-xs text-ink-900 placeholder:text-ink-600/60 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
                    autoComplete="off"
                  />
                </div>
              </div>
            ) : null}
            <div className="overflow-auto p-1 flex-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-3 text-xs text-ink-600 text-center">
                  No matches
                </p>
              ) : null}
              {filtered.map((o) => (
              <ListboxOption
                key={o.value}
                value={o.value}
                className={({ active, selected }) =>
                  [
                    "cursor-pointer select-none rounded-xl px-3 py-2 text-xs flex items-center justify-between gap-2 transition-colors",
                    active ? "bg-saffron-50 text-sindoor-700" : "text-ink-900",
                    selected ? "font-semibold" : "font-medium",
                  ].join(" ")
                }
              >
                {({ selected }) => (
                  <>
                    <span className="min-w-0 flex flex-col">
                      <span className="truncate">{o.label}</span>
                      {o.hint ? (
                        <span className="text-[10px] text-ink-600/70 leading-tight">
                          {o.hint}
                        </span>
                      ) : null}
                    </span>
                    {selected ? (
                      <span aria-hidden className="text-saffron-600 shrink-0">
                        ✓
                      </span>
                    ) : null}
                  </>
                )}
              </ListboxOption>
            ))}
            </div>
          </ListboxOptions>
        </Transition>
      </div>
    </Listbox>
  );
}

function SearchIcon() {
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
      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-600/70"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function ChevronDown() {
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
      className="text-ink-600 shrink-0"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
