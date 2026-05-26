"use client";

/**
 * Dark-themed search input for the new admin shell pages
 * (/admin/bhandaras, /admin/spots, etc). Functional twin of
 * AdminSearchBox but with:
 *
 *   • Dark surface, ink-900 background, cream-50 text, saffron
 *     focus ring. Designed against the AdminShell's dark canvas
 *     rather than the legacy cream paper.
 *   • No `type` prop, the new routes encode the queue in the
 *     pathname (/admin/bhandaras vs /admin/spots) instead of a
 *     `?type=` query param, so the input doesn't need to know
 *     which queue it belongs to. URL updates preserve every other
 *     query param (status, page, etc.) untouched.
 *   • Debounced 200ms via setTimeout, same UX as the legacy
 *     component, kept identical so typing feels predictable
 *     across surfaces during the migration.
 */
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const DEBOUNCE_MS = 200;

export default function AdminSearchInput({
  placeholder = "Search…",
}: {
  placeholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQ = searchParams.get("q") ?? "";

  const [value, setValue] = useState(urlQ);
  useEffect(() => {
    setValue(urlQ);
  }, [urlQ]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Build the next URL by mutating ONLY the `q` param, every other
   *  param (status, page, etc.) rides along untouched. The legacy
   *  AdminSearchBox rebuilt URLSearchParams from scratch, which
   *  silently dropped any future param we add to these routes. */
  function pushQ(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = next.trim();
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function scheduleUpdate(next: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => pushQ(next), DEBOUNCE_MS);
  }

  return (
    <label className="relative flex-1 min-w-0 max-w-md">
      <span className="sr-only">Search</span>
      <span
        aria-hidden
        className="absolute left-3 top-1/2 -translate-y-1/2 text-cream-50/45"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </span>
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          scheduleUpdate(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (timer.current) clearTimeout(timer.current);
            pushQ(value);
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-full border border-cyan-400/20 bg-[#0B0E16]/85 backdrop-blur-sm pl-9 pr-9 py-2 text-sm text-cream-50 font-mono placeholder:text-cream-50/40 focus:outline-none focus:ring-2 focus:ring-cyan-400/55 focus:border-cyan-400/55 hover:border-cyan-400/40 transition-colors"
        autoComplete="off"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setValue("");
            if (timer.current) clearTimeout(timer.current);
            pushQ("");
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-6 h-6 rounded-full text-cream-50/55 hover:text-cream-50 hover:bg-cream-50/[0.08]"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </label>
  );
}
