"use client";

import { useEffect } from "react";

/**
 * Forces window scroll to (0, 0) on first client-side mount.
 *
 * Use on pages where Next.js App Router's default scroll-restoration
 * (which restores the previous scroll position when you navigate
 * back-then-forward to a page you've already visited) lands the
 * visitor in a confusing position. Bhandara detail pages are the
 * canonical case: a user opens bhandara A, scrolls to the bottom
 * to read the map / others-nearby section, hits back, then opens
 * bhandara B from a card. Without this component, bhandara B
 * lands near its OWN footer because Next.js restored bhandara A's
 * scroll position to the new page.
 *
 * Mount once anywhere in the page tree (it just runs an effect on
 * mount and renders null). Safe to mount in a server component — it
 * itself is a client component, so React handles the boundary.
 *
 * If you ever need to OPT OUT of this behaviour (e.g. an in-page
 * link with a #section anchor that should land mid-page), do not
 * mount this; let Next.js's default anchor-aware scroll restoration
 * take over.
 */
export default function ScrollToTopOnMount() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return null;
}
