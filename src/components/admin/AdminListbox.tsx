"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Custom dark-themed dropdown for the admin console. Replaces the
 * native <select> on /admin/mentions with a popover-style listbox
 * that's keyboard-accessible AND fully restyleable.
 *
 * Why hand-rolled (not a library):
 *   • Zero new deps. Headless UI / Radix would add ~30 KB just for
 *     this one widget.
 *   • The visual contract (cyan-bordered dark pill trigger, popover
 *     menu with hover/focus highlights, mono labels, custom chevron)
 *     is opinionated enough that styling a generic library widget
 *     ends up being more code than building it.
 *
 * Behaviour:
 *   • Click the trigger to open. Click outside / press Escape /
 *     blur to close.
 *   • Arrow Up / Down moves the highlighted option; Enter selects;
 *     Home/End jump to first/last; typing a letter jumps to the
 *     next matching label (basic typeahead).
 *   • Renders a hidden <input type="hidden" name=…> so the listbox
 *     plays nicely with the surrounding plain <form method="get">.
 *     No JS form-state coupling needed, the page already routes
 *     filter state through the URL.
 */

export type ListboxOption = {
  value: string;
  label: string;
  /** Optional small description shown under the label inside the
   *  popover. Hidden in the trigger to keep the chip compact. */
  hint?: string;
};

type Props = {
  /** Hidden input name, what gets submitted with the surrounding form.
   *  Pass an empty string when using `onChange` to drive parent state
   *  instead of HTML form submission. */
  name: string;
  /** Tiny eyebrow label inset on the trigger (e.g. "Intent"). */
  label: string;
  /** Currently-selected value. */
  value: string;
  /** Available options. */
  options: ListboxOption[];
  /** Optional className passthrough for the outer wrapper. */
  className?: string;
  /** Optional callback fired when the operator picks a new value.
   *  When set, the listbox is "controlled" by the parent and the
   *  internal state mirrors `value` on every render. Use this in
   *  client components that don't rely on plain <form> submission. */
  onChange?: (next: string) => void;
};

export default function AdminListbox({
  name,
  label,
  value,
  options,
  className = "",
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(value);
  const [highlight, setHighlight] = useState<number>(
    Math.max(0, options.findIndex((o) => o.value === value)),
  );
  // Keep the internal selection in sync if the parent re-renders
  // with a new server-driven value (e.g. URL changes via back/forward).
  useEffect(() => {
    setInternal(value);
  }, [value]);

  const containerRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLUListElement>(null);
  const id = useId();
  const listboxId = `listbox-${id}`;

  const currentLabel = useMemo(
    () => options.find((o) => o.value === internal)?.label ?? "",
    [internal, options],
  );

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // When opening, scroll the highlighted item into view.
  useEffect(() => {
    if (!open || !optionsRef.current) return;
    const el = optionsRef.current.querySelector<HTMLLIElement>(
      `[data-idx="${highlight}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  // Typeahead, short window (450ms) so typing "ASH" jumps to "Asking".
  const buffer = useRef<{ str: string; t: number }>({ str: "", t: 0 });
  const jumpTo = useCallback(
    (ch: string) => {
      const now = Date.now();
      const str = (now - buffer.current.t < 450 ? buffer.current.str : "") + ch;
      buffer.current = { str, t: now };
      const idx = options.findIndex((o) =>
        o.label.toLowerCase().startsWith(str.toLowerCase()),
      );
      if (idx >= 0) setHighlight(idx);
    },
    [options],
  );

  function onTriggerKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
      e.preventDefault();
      setOpen(true);
    }
  }

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + options.length) % options.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      setHighlight(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setHighlight(options.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = options[highlight];
      if (opt) {
        setInternal(opt.value);
        setOpen(false);
        onChange?.(opt.value);
      }
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (e.key.length === 1) {
      jumpTo(e.key);
    }
  }

  function selectOption(opt: ListboxOption) {
    setInternal(opt.value);
    setOpen(false);
    onChange?.(opt.value);
  }

  return (
    <div
      ref={containerRef}
      className={["relative inline-block", className].join(" ")}
    >
      {/* Hidden input, what the surrounding GET form submits. */}
      <input type="hidden" name={name} value={internal} />

      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKey}
        className={[
          "group inline-flex items-center gap-1.5 rounded-full border bg-[#0B0E16]/85 backdrop-blur-sm pl-3 pr-2 py-1 text-sm font-mono transition-colors",
          open
            ? "border-cyan-400/55 shadow-[0_4px_14px_-4px_rgba(34,211,238,0.45)]"
            : "border-cyan-400/20 hover:border-cyan-400/45",
        ].join(" ")}
      >
        <span className="text-[10px] uppercase tracking-[0.16em] text-cyan-300/70 pointer-events-none select-none">
          {label}
        </span>
        <span className="text-cream-50">{currentLabel}</span>
        <svg
          aria-hidden
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={[
            "text-cyan-300/75 transition-transform duration-200",
            open ? "rotate-180 text-cyan-300" : "rotate-0",
          ].join(" ")}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Popover. Absolutely positioned right under the trigger. */}
      {open ? (
        <div
          className="absolute left-0 top-full mt-2 z-30 min-w-[12rem] origin-top admin-listbox-pop"
          // Stop the document-mousedown handler from closing us when
          // clicking inside the popover area.
          onMouseDown={(e) => e.stopPropagation()}
        >
          <ul
            id={listboxId}
            ref={optionsRef}
            role="listbox"
            aria-label={label}
            tabIndex={-1}
            onKeyDown={onListKey}
            className="rounded-2xl border border-cyan-400/25 bg-[#0B0E16]/95 backdrop-blur-md shadow-[0_24px_50px_-12px_rgba(0,0,0,0.7)] p-1 overflow-hidden focus:outline-none"
          >
            {options.map((opt, idx) => {
              const isSelected = opt.value === internal;
              const isHighlighted = idx === highlight;
              return (
                <li
                  key={opt.value}
                  data-idx={idx}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlight(idx)}
                  onClick={() => selectOption(opt)}
                  className={[
                    "relative flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors",
                    isHighlighted
                      ? "bg-cyan-400/[0.10] text-cream-50"
                      : "text-cream-50/80 hover:text-cream-50",
                  ].join(" ")}
                >
                  {/* Cyan bar on the left of the highlighted row,
                      mimics the sidebar's active-nav cue. */}
                  <span
                    aria-hidden
                    className={[
                      "absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-full transition-opacity",
                      isHighlighted
                        ? "opacity-100 bg-cyan-400 shadow-[0_0_8px_0_rgba(34,211,238,0.8)]"
                        : "opacity-0",
                    ].join(" ")}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block font-mono text-sm truncate">
                      {opt.label}
                    </span>
                    {opt.hint ? (
                      <span className="block font-mono text-[10px] text-cream-50/45 truncate mt-0.5">
                        {opt.hint}
                      </span>
                    ) : null}
                  </span>
                  {isSelected ? (
                    <svg
                      aria-hidden
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-cyan-300 shrink-0"
                    >
                      <polyline points="5 12 10 17 19 8" />
                    </svg>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
