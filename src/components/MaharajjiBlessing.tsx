"use client";

import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/ga";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * Closing-benediction portrait of Neem Karoli Baba (Maharajji), framed by
 * two counter-rotating gold spiral rings. The illustration sits inside a
 * circular cream medallion with a soft saffron halo; on hover (or focus,
 * for keyboard users) the spirals accelerate and the Maharajji-Ram-Ram
 * aarti chant plays once.
 *
 * Audio is created lazily on the first interaction so the asset isn't
 * fetched on initial page load. Hover-out fades the chant out gracefully
 * rather than chopping mid-syllable.
 */
export default function MaharajjiBlessing({
  alt,
}: {
  alt?: string;
}) {
  // Reads locale from context so the "Hover for blessing" caption +
  // accessible label swap to Hindi the moment the toggle fires.
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);
  const resolvedAlt =
    alt ??
    (isHi
      ? "नीम करोली बाबा, बड़ामंगल के लिए चित्रित"
      : "Neem Karoli Baba, illustrated for BadaMangal");
  const ariaLabel = isHi
    ? "नीम करोली बाबा। आरती सुनने के लिए माउस लाएँ"
    : "Neem Karoli Baba. Hover to hear the aarti chant";
  const hintLabel = isHi ? "आशीर्वाद के लिए माउस लाएँ" : "Hover for blessing";

  // Build the Audio element once, on the client only.
  useEffect(() => {
    const a = new Audio("/audio/maharajji-ram-ram.mp3");
    a.preload = "none";
    a.volume = 0.85;
    audioRef.current = a;
    return () => {
      a.pause();
      audioRef.current = null;
      if (fadeTimerRef.current) window.clearInterval(fadeTimerRef.current);
    };
  }, []);

  const start = () => {
    setActive(true);
    const a = audioRef.current;
    if (!a) return;
    if (fadeTimerRef.current) {
      window.clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    a.volume = 0.85;
    // If already playing, just keep going. Otherwise rewind so a quick
    // hover-out / hover-in starts from the top of the chant.
    if (a.paused) {
      try {
        a.currentTime = 0;
      } catch {
        /* ignore, some browsers gate currentTime on unloaded media */
      }
      void a.play().catch(() => {
        /* autoplay blocked, silent fail */
      });
      trackEvent("maharajji_blessing_play");
    }
  };

  const stop = () => {
    setActive(false);
    const a = audioRef.current;
    if (!a || a.paused) return;
    // Quick 240ms volume fade so the chant doesn't clip.
    const steps = 8;
    const startVol = a.volume;
    let i = 0;
    if (fadeTimerRef.current) window.clearInterval(fadeTimerRef.current);
    fadeTimerRef.current = window.setInterval(() => {
      i += 1;
      const v = startVol * (1 - i / steps);
      a.volume = Math.max(0, v);
      if (i >= steps) {
        a.pause();
        try {
          a.currentTime = 0;
        } catch {
          /* ignore */
        }
        a.volume = 0.85;
        if (fadeTimerRef.current) {
          window.clearInterval(fadeTimerRef.current);
          fadeTimerRef.current = null;
        }
      }
    }, 30);
  };

  return (
    <div className="mt-8 mb-10 sm:mb-12 flex justify-center">
      {/* Wrapper drives the active/idle state via CSS custom props so the
          spirals can read the same animation duration. */}
      <button
        type="button"
        onMouseEnter={start}
        onMouseLeave={stop}
        onFocus={start}
        onBlur={stop}
        aria-label={ariaLabel}
        className="group relative inline-flex items-center justify-center w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-saffron-600/60 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50"
      >
        {/* Soft saffron halo behind everything */}
        <span
          aria-hidden
          className={[
            "absolute inset-[-14%] rounded-full transition-opacity duration-500",
            active ? "opacity-100" : "opacity-70",
          ].join(" ")}
          style={{
            background:
              "radial-gradient(closest-side, rgba(242,148,76,0.30), rgba(242,148,76,0.08) 60%, transparent 75%)",
          }}
        />

        {/* Outer spiral ring, clockwise. Speeds up on hover. */}
        <span
          aria-hidden
          className="absolute inset-[-9%] rounded-full"
          style={{
            animation: `bm-spiral-spin ${active ? "9s" : "32s"} linear infinite`,
            transition: "animation-duration 600ms ease",
          }}
        >
          <SpiralRing variant="outer" />
        </span>

        {/* Inner spiral ring, counter-clockwise, tighter. */}
        <span
          aria-hidden
          className="absolute inset-[-3%] rounded-full"
          style={{
            animation: `bm-spiral-spin-rev ${active ? "12s" : "44s"} linear infinite`,
          }}
        >
          <SpiralRing variant="inner" />
        </span>

        {/* Cream medallion holding the portrait. The portrait uses
            object-contain so the painted scene reads in full instead of
            being cropped at the sides; a soft saffron wash fills any
            sliver of background that the contain leaves behind. */}
        <span
          className={[
            "relative inline-flex items-center justify-center w-[78%] h-[78%] rounded-full overflow-hidden",
            "bg-saffron-50 border border-gold-500/55 shadow-warm",
            "transition-transform duration-500 ease-out",
            active ? "scale-[1.04]" : "scale-100",
          ].join(" ")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/illustrations/nim-karoli-baba.webp"
            alt={resolvedAlt}
            width={320}
            height={320}
            className="w-[86%] h-[86%] object-contain object-center"
            // Graceful fallback while the asset is being generated:
            // swap to a saffron silhouette block so the page never breaks.
            onError={(e) => {
              const img = e.currentTarget;
              img.style.display = "none";
              const parent = img.parentElement;
              if (parent && !parent.querySelector("[data-baba-fallback]")) {
                const f = document.createElement("span");
                f.dataset.babaFallback = "1";
                f.className =
                  "flex items-center justify-center w-full h-full bg-saffron-50 text-sindoor-700 font-tiro text-2xl sm:text-3xl";
                f.textContent = "बाबा";
                parent.appendChild(f);
              }
            }}
          />
        </span>

        {/* Tiny hover hint, fades in only when idle. Pushed further below
            the medallion so the spirals around the disc never collide
            with the caption. */}
        <span
          aria-hidden
          className={[
            "absolute -bottom-12 sm:-bottom-14 left-1/2 -translate-x-1/2 whitespace-nowrap",
            "font-mukta uppercase tracking-[0.28em] text-[0.55rem] text-gold-500 font-semibold",
            "transition-opacity duration-300",
            active ? "opacity-0" : "opacity-80",
          ].join(" ")}
        >
          {hintLabel}
        </span>
      </button>
    </div>
  );
}

/**
 * Decorative ring of gold spirals laid out around a circle. Rendered as a
 * single SVG with `currentColor` so the parent can theme it. Eight spirals
 * for the outer ring (matching the eight Bada Mangals) and twelve for the
 * inner one, a calmer, denser whorl when the rings are stacked.
 */
function SpiralRing({ variant }: { variant: "outer" | "inner" }) {
  const count = variant === "outer" ? 8 : 12;
  const radius = variant === "outer" ? 46 : 47;
  const spiralSize = variant === "outer" ? 7 : 4.5;

  return (
    <svg
      viewBox="0 0 100 100"
      className="w-full h-full text-gold-500"
      fill="none"
      stroke="currentColor"
      strokeWidth={variant === "outer" ? 1.1 : 0.85}
      strokeLinecap="round"
      aria-hidden
    >
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2;
        // All numbers in the transform string are rounded to 3 decimals
        // so the server-rendered HTML and the client-side hydration both
        // produce identical strings. Without this, Math.cos/Math.sin can
        // return values that differ by 1 ULP between Node's and Chrome's
        // V8 builds, breaking hydration with floating-point noise.
        const cx = (50 + Math.cos(angle) * radius).toFixed(3);
        const cy = (50 + Math.sin(angle) * radius).toFixed(3);
        // Tangent direction so each spiral leans into the ring.
        const rot = ((angle * 180) / Math.PI + 90).toFixed(2);
        const scale = (spiralSize / 7).toFixed(3);
        // A simple 1.25-turn logarithmic-ish spiral, pre-baked as a path.
        // Path is centred at (0,0) and scaled via the transform below.
        const d =
          "M 0 0 " +
          "c 0.6 -0.6 1.6 -0.6 2.2 0 " +
          "c 0.9 0.9 0.9 2.4 0 3.3 " +
          "c -1.3 1.3 -3.4 1.3 -4.7 0 " +
          "c -1.7 -1.7 -1.7 -4.5 0 -6.2 " +
          "c 2.1 -2.1 5.5 -2.1 7.6 0";
        return (
          <g
            key={`${variant}-${i}`}
            transform={`translate(${cx} ${cy}) rotate(${rot}) scale(${scale})`}
            style={{
              opacity: variant === "outer" ? 0.85 : 0.7,
            }}
          >
            <path d={d} />
            <circle cx="0" cy="0" r="0.6" fill="currentColor" stroke="none" />
          </g>
        );
      })}
    </svg>
  );
}
