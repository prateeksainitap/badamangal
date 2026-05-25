"use client";

/**
 * Global click tracker — turns every `data-ga="event_name"` attribute
 * scattered across the app into an actual GA4 event.
 *
 * Why this exists (2026-05-26 audit finding):
 *   The codebase had 100+ `data-ga="..."` attributes on CTAs, links,
 *   and buttons, originally added as a convention for click-tracking.
 *   But there was no listener reading them, so they were all silent
 *   no-ops. Adding GA call-sites one-by-one is fragile (every new
 *   button has to remember to import + call trackEvent). One global
 *   delegated click handler fixes ALL existing convention-based
 *   call-sites at once + every new one going forward.
 *
 * Behaviour:
 *   • On any click, walk up the DOM looking for the nearest ancestor
 *     with a `data-ga` attribute.
 *   • If found, fire `trackEvent(data-ga, params)` where params
 *     is built from every other `data-ga-*` attribute on the same
 *     element (e.g. `data-ga-source="hero"` → `source: "hero"`).
 *   • Use capture-phase + passive, so the click still proceeds
 *     normally even if the target navigates away.
 *
 * Mount: <GAClickTracker /> sits in the root layout, right next to
 * GAPageview, so it auto-tracks every page including admin.
 */

import { useEffect } from "react";
import { trackEvent } from "@/lib/ga";

export default function GAClickTracker() {
  useEffect(() => {
    function onClick(ev: MouseEvent) {
      // Walk up from the click target looking for the closest
      // ancestor carrying data-ga. closest() returns null if none
      // found, in which case we silently do nothing.
      const target = (ev.target as Element | null)?.closest?.(
        "[data-ga]",
      ) as HTMLElement | null;
      if (!target) return;

      const name = target.getAttribute("data-ga");
      if (!name) return;

      // Collect every other data-ga-* attribute as a params bag.
      // e.g. data-ga-source="hero" → { source: "hero" }
      //      data-ga-network="instagram" → { network: "instagram" }
      const params: Record<string, string> = {};
      for (const attr of Array.from(target.attributes)) {
        if (attr.name.startsWith("data-ga-")) {
          const key = attr.name.slice("data-ga-".length);
          if (key) params[key] = attr.value;
        }
      }

      // For links we also stamp the destination so GA reports group
      // by "where did the user end up" without needing per-link
      // wiring. Honours target.href (Next <Link> + <a>) but skips
      // javascript: schemes.
      const href =
        target.tagName === "A" && (target as HTMLAnchorElement).href
          ? (target as HTMLAnchorElement).href
          : undefined;
      if (href && !href.startsWith("javascript:")) {
        // Only stamp if call-site didn't already specify data-ga-href
        if (!params.href) params.href = href;
      }

      trackEvent(name, params);
    }

    // Capture-phase so the listener fires before the click propagates
    // to handlers that might preventDefault + navigate. Passive: true
    // tells the browser we won't preventDefault, letting it optimise.
    document.addEventListener("click", onClick, { capture: true, passive: true });
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
    };
  }, []);

  return null;
}
