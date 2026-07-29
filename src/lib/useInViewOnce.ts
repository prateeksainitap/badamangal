"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "Has this element come near the viewport yet?" Latches true on first
 * intersection and never flips back.
 *
 * WHY THIS EXISTS (2026-07, Ola Maps cost work):
 * The homepage map was wrapped in next/dynamic, which code-splits the
 * ~200 KB MapLibre bundle but does NOT stop the component from
 * mounting. It rendered as soon as the page did, so every single
 * homepage visit initialised a map and pulled a screenful of vector
 * tiles, including for the large share of visitors who bounce at the
 * hero and never scroll far enough to see it.
 *
 * Vector Tiles are ~98.5% of all Ola Maps usage on this project
 * (272,738 of 276,826 requests in the June 2026 peak), so wasted map
 * initialisations are essentially the entire bill. Gating the mount on
 * actual visibility converts "every pageview" into "every pageview
 * that reaches the map".
 *
 * `rootMargin` defaults to 200px so the map still starts loading just
 * before it scrolls into view and feels instant rather than janky.
 */
export function useInViewOnce<T extends HTMLElement = HTMLDivElement>(
  rootMargin = "200px",
): { ref: React.MutableRefObject<T | null>; inView: boolean } {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    const el = ref.current;
    if (!el) return;

    // No IntersectionObserver (very old browser, some in-app webviews):
    // fail OPEN and render the map immediately. A slightly higher tile
    // bill for a rounding-error share of traffic beats a blank slot
    // where the map should be.
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView, rootMargin]);

  return { ref, inView };
}
