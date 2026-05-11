"use client";

/**
 * Instant-search input for the admin moderation page.
 *
 * The page itself is a server component — `/admin` reads from Prisma
 * on every request (force-dynamic) and renders the filtered list
 * server-side. To make typing feel snappy without abandoning that
 * URL-driven model, this client component updates `router.replace`
 * with the new `?q=...` on every keystroke (debounced by 200 ms).
 * Next.js then re-runs the server component with the new searchParams
 * and streams a fresh row list.
 *
 * Why `replace` (not `push`)?
 *   - We don't want the back button to step through every keystroke;
 *     one "search session" should be a single history entry.
 *
 * Why debounce?
 *   - Without it, typing "Aliganj" fires 7 navigations in 400 ms; the
 *     last one wins anyway but the intermediates clog the network panel
 *     and momentarily flash empty/partial result states.
 *   - 200 ms is the sweet spot: shorter than human re-read time, long
 *     enough to coalesce a fast typist's bursts into one round-trip.
 */
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const DEBOUNCE_MS = 200;

export default function AdminSearchBox({
  /** Active tab — passed in so we preserve `?status=` on every URL update. */
  status,
  /** Active moderation mode ("bhandara" default, or "spot"). Preserved
   *  on every URL update so typing in the Spots queue doesn't bounce
   *  the admin back to the Bhandara queue. */
  type = "bhandara",
}: {
  status: string;
  type?: "bhandara" | "spot";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQ = searchParams.get("q") ?? "";

  /** Local controlled state so typing feels instant, decoupled from
   *  the debounced router push. */
  const [value, setValue] = useState(urlQ);

  /**
   * Keep local state in sync with the URL when the URL changes
   * externally — e.g. when the admin clicks "Clear" or hits a "All"
   * tab link that strips `?q=`. Without this the input would still
   * display the old query.
   */
  useEffect(() => {
    setValue(urlQ);
  }, [urlQ]);

  /** Hold the timer between renders so the latest keystroke wins. */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function buildParams(next: string): URLSearchParams {
    const params = new URLSearchParams();
    // `type` always rides along so a search inside the Spots queue
    // doesn't silently kick the admin back to the Bhandara queue.
    if (type === "spot") params.set("type", "spot");
    params.set("status", status);
    const trimmed = next.trim();
    if (trimmed) params.set("q", trimmed);
    return params;
  }

  function scheduleUpdate(next: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      // `scroll: false` keeps the user's scroll position — useful when
      // they're typing while looking at a row in the list below.
      router.replace(`${pathname}?${buildParams(next).toString()}`, {
        scroll: false,
      });
    }, DEBOUNCE_MS);
  }

  return (
    <label className="relative flex-1 max-w-md">
      <span className="sr-only">Search bhandaras</span>
      <span
        aria-hidden
        className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-600"
      >
        <svg
          width="16"
          height="16"
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
        // Pressing Enter should also fire immediately — flush the
        // debounced timer so the user doesn't wait 200 ms for nothing.
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (timer.current) clearTimeout(timer.current);
            router.replace(`${pathname}?${buildParams(value).toString()}`, {
              scroll: false,
            });
          }
        }}
        placeholder="Search name, area, address, organizer, phone…"
        className="w-full rounded-full border border-gold-500/40 bg-cream-50 pl-9 pr-9 py-2 text-sm text-ink-900 placeholder:text-ink-600 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
        autoComplete="off"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setValue("");
            if (timer.current) clearTimeout(timer.current);
            router.replace(`${pathname}?${buildParams("").toString()}`, {
              scroll: false,
            });
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-6 h-6 rounded-full text-ink-600 hover:text-sindoor-700 hover:bg-cream-50"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
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
