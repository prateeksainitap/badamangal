"use client";

import type { MouseEvent, ReactNode } from "react";
import { trackEvent } from "@/lib/ga";

let jai: HTMLAudioElement | null = null;

/**
 * The hero's primary CTA. It scrolls to the painted map (in-page #map),
 * and, because a tap IS a user gesture, it is also the one place the
 * tiny "Jai Shree Ram" chant plays, with the words rising off the button.
 * Audio never starts on its own.
 */
export default function HeroChantCta({ label }: { label: ReactNode }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    trackEvent("cta_hero_find_bhandara", { source: "hero" });
    try {
      if (!jai) {
        jai = new Audio("/audio/jai-shree-ram.mp3");
        jai.preload = "auto";
      }
      jai.currentTime = 0;
      jai.volume = 0.9;
      void jai.play().catch(() => {});
    } catch {
      /* no audio, no problem */
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    const root = e.currentTarget.closest(".bmh") ?? document.body;
    const s = document.createElement("span");
    s.className = "bmh-chant";
    s.setAttribute("aria-hidden", "true");
    s.textContent = "जय श्री राम";
    s.style.left = `${r.left + r.width / 2}px`;
    s.style.top = `${r.top - 34}px`;
    root.appendChild(s);
    window.setTimeout(() => s.remove(), 1700);
  };
  return (
    <a href="#map" className="b b-p" onClick={onClick} data-ga-source="hero">
      <svg viewBox="0 0 24 24" className="ic" aria-hidden>
        <path d="M9 4.5 3.8 6.3v13.2L9 17.7l6 1.8 5.2-1.8V4.5L15 6.3z M9 4.5v13.2 M15 6.3v13.2" />
      </svg>
      {label}
    </a>
  );
}
