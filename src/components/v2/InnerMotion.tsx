"use client";

import { useEffect, useLayoutEffect } from "react";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Reveal motion for inner pages, the homepage's recipe (HomeMotion):
 * browsers with CSS scroll-driven animations need nothing from here;
 * others get an IntersectionObserver that adds `.in`, with an in-view
 * pass before the first paint so nothing above the fold ever blinks.
 * Reduced motion: everything is shown at once. Rendered by InnerShell.
 */
export default function InnerMotion() {
  useIsoLayoutEffect(() => {
    const roots = document.querySelectorAll<HTMLElement>(".bmi");
    const sda = typeof CSS !== "undefined" && CSS.supports?.("animation-timeline: view()");
    roots.forEach((root) => {
      if (!sda) {
        root.querySelectorAll<HTMLElement>("[data-rv], .words").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.top < window.innerHeight && r.bottom > 0) el.classList.add("in");
        });
      }
      root.setAttribute("data-js", "");
    });
  }, []);

  useEffect(() => {
    const sda = typeof CSS !== "undefined" && CSS.supports?.("animation-timeline: view()");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (sda && !reduce) return;
    const els = document.querySelectorAll<HTMLElement>(".bmi [data-rv]:not(.in), .bmi .words:not(.in)");
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
