"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/ga";

/**
 * Global click-delegate for analytics. Any element rendered anywhere on the
 * page can opt into tracking by adding a `data-ga` attribute (event name)
 * plus optional `data-ga-*` parameter attributes. We attach a single
 * capture-phase listener at the document root so server components get
 * tracking "for free" without needing to become client components.
 *
 * Example:
 *   <Link href="#map" data-ga="cta_hero_find_bhandara" data-ga-source="hero">
 *
 * The `data-ga-*` keys become event params, with `-` collapsed to `_`.
 */
export default function GAClickDelegate() {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const el = target.closest<HTMLElement>("[data-ga]");
      if (!el) return;
      const name = el.getAttribute("data-ga");
      if (!name) return;
      const params: Record<string, string> = {};
      for (const attr of el.attributes) {
        if (attr.name === "data-ga") continue;
        if (!attr.name.startsWith("data-ga-")) continue;
        const key = attr.name.slice("data-ga-".length).replace(/-/g, "_");
        params[key] = attr.value;
      }
      trackEvent(name, params);
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
