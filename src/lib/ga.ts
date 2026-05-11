// Google Analytics 4 helpers.
//
// Configure via env: `NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX`. The Script tag in
// `app/layout.tsx` only renders when GA_ID is set, so trackEvent is a safe
// no-op in dev/preview where no measurement ID is configured.
//
// EVENT NAMING: every custom event is namespaced with the `bm_` prefix
// before it goes to GA. Call-sites pass the unprefixed name (e.g.
// `trackEvent("spot_submit_success")`) and `normaliseEventName()` adds
// `bm_` automatically. This lets us:
//   • cleanly separate our events from GA4's built-ins (page_view,
//     scroll, etc.) in the GA console;
//   • write a single GA4 filter `event_name CONTAINS bm_` to slice
//     out only first-party signal;
//   • not have to touch every call-site if we ever change the prefix.
// GA built-ins (page_view, scroll, click, etc.) are detected by name
// and passed through unchanged.

export const GA_ID =
  process.env.NEXT_PUBLIC_GA_ID && process.env.NEXT_PUBLIC_GA_ID.startsWith("G-")
    ? process.env.NEXT_PUBLIC_GA_ID
    : null;

type GAParams = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    // gtag is injected by the GA snippet at runtime.
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const EVENT_PREFIX = "bm_";

// GA4 built-in event names — never re-prefixed since GA tracks these
// natively and double-naming them would split reports.
// https://support.google.com/analytics/answer/9234069 lists the full set;
// the ones we actually fire from this codebase are listed here.
const GA_BUILTIN_EVENTS = new Set([
  "page_view",
  "scroll",
  "click",
  "session_start",
  "first_visit",
  "user_engagement",
  "view_search_results",
  "search",
  "share",
  "select_content",
  "view_item",
  "view_item_list",
  "select_item",
]);

/** Normalise an event name to the prefixed form, leaving GA built-ins alone. */
export function normaliseEventName(name: string): string {
  if (!name) return name;
  if (name.startsWith(EVENT_PREFIX)) return name;
  if (GA_BUILTIN_EVENTS.has(name)) return name;
  return `${EVENT_PREFIX}${name}`;
}

/**
 * Fire a custom GA4 event. Silently no-ops if gtag is not loaded (e.g. dev
 * or when the user has DNT / an ad-blocker active). Always pass a stable
 * snake_case event name and a flat params bag — the `bm_` prefix is
 * applied automatically.
 */
export function trackEvent(name: string, params?: GAParams): void {
  if (typeof window === "undefined") return;
  if (!window.gtag) return;
  try {
    window.gtag("event", normaliseEventName(name), params ?? {});
  } catch {
    /* never let analytics break the page */
  }
}

/**
 * Fire a manual page_view. Useful when client-side route changes happen
 * without a full reload, Next App Router covers this with its automatic
 * `router.events`-equivalent, but we keep this for explicit calls.
 *
 * `page_view` is a GA4 built-in and intentionally NOT prefixed.
 */
export function trackPageView(path: string, title?: string): void {
  if (!GA_ID) return;
  trackEvent("page_view", {
    page_location: typeof window !== "undefined" ? window.location.href : path,
    page_path: path,
    page_title: title ?? (typeof document !== "undefined" ? document.title : ""),
  });
}
