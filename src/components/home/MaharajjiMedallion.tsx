"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { T } from "@/components/T";
import { HOME_ART } from "@/content/home-art";
import { trackEvent } from "@/lib/ga";

/** Archimedean spiral around the portrait, rounded so server and client
 *  produce the identical path string. */
function spiral(r0: number, r1: number, turns: number): string {
  const steps = Math.round(turns * 90);
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const th = (i / 90) * Math.PI * 2;
    const r = r0 + ((r1 - r0) * i) / steps;
    d += `${i ? "L" : "M"}${(200 + r * Math.cos(th)).toFixed(1)} ${(200 + r * Math.sin(th)).toFixed(1)}`;
  }
  return d;
}
const SPIRAL_A = spiral(158, 174, 3);
const SPIRAL_B = spiral(180, 194, 2);

/**
 * Maharajji medallion: the MaharajjiBlessing behaviour, restyled.
 * Hover (or tap on touch screens, or Enter / Space) and the two gold
 * spirals speed up while the Maharajji Ram Ram chant plays; leaving
 * fades it out in about 240 ms so it never clips mid syllable. The
 * audio file is created lazily and only plays on a user gesture.
 */
export default function MaharajjiMedallion() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const fade = useRef<number | null>(null);
  const btn = useRef<HTMLButtonElement | null>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const a = new Audio("/audio/maharajji-ram-ram.mp3");
    a.preload = "none";
    a.volume = 0.85;
    a.addEventListener("ended", () => setOn(false));
    audio.current = a;
    const other = (e: Event) => {
      if ((e as CustomEvent).detail !== "maharajji") stop();
    };
    window.addEventListener("bmh:audio", other);
    return () => {
      a.pause();
      window.removeEventListener("bmh:audio", other);
      if (fade.current) window.clearInterval(fade.current);
      audio.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Speed the spirals by changing the CSS animations' playback rate.
  useEffect(() => {
    const el = btn.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.querySelectorAll<SVGGElement>(".ra, .rb").forEach((g) =>
      g.getAnimations?.().forEach((anim) => {
        anim.playbackRate = on ? 5 : 1;
      }),
    );
  }, [on]);

  function start() {
    setOn(true);
    const a = audio.current;
    if (!a) return;
    if (fade.current) {
      window.clearInterval(fade.current);
      fade.current = null;
    }
    a.volume = 0.85;
    if (a.paused) {
      try {
        a.currentTime = 0;
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new CustomEvent("bmh:audio", { detail: "maharajji" }));
      void a.play().catch(() => {});
      trackEvent("maharajji_blessing_play");
    }
  }

  function stop() {
    setOn(false);
    const a = audio.current;
    if (!a || a.paused) return;
    const v0 = a.volume;
    let i = 0;
    if (fade.current) window.clearInterval(fade.current);
    fade.current = window.setInterval(() => {
      i += 1;
      a.volume = Math.max(0, v0 * (1 - i / 8));
      if (i >= 8) {
        a.pause();
        a.volume = 0.85;
        if (fade.current) window.clearInterval(fade.current);
        fade.current = null;
      }
    }, 30);
  }

  const hoverable = () => window.matchMedia("(hover: hover)").matches;

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`medal${on ? " on" : ""}`}
        aria-pressed={on}
        aria-label="Neem Karoli Baba. Hover or tap to hear the Ram Ram chant"
        onPointerEnter={(e) => e.pointerType === "mouse" && start()}
        onPointerLeave={(e) => e.pointerType === "mouse" && stop()}
        onClick={(e) => {
          // Mouse users already started on hover; taps and keys toggle.
          if (hoverable() && e.detail !== 0) {
            if (!on) start();
            return;
          }
          if (on) stop();
          else start();
        }}
        onBlur={stop}
      >
        <svg viewBox="0 0 400 400" aria-hidden>
          <defs>
            <linearGradient id="bmh-gg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#E9C977" />
              <stop offset=".5" stopColor="#C9A24A" />
              <stop offset="1" stopColor="#E0B866" />
            </linearGradient>
          </defs>
          <g className="ra">
            <path d={SPIRAL_A} fill="none" stroke="url(#bmh-gg)" strokeWidth="1.6" strokeLinecap="round" />
          </g>
          <g className="rb">
            <path d={SPIRAL_B} fill="none" stroke="#E0B866" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="1 7" />
          </g>
        </svg>
        <span className="face">
          <Image
            src={HOME_ART.maharajji.src}
            alt="Neem Karoli Baba, Maharajji, painted portrait wrapped in his checked blanket"
            fill
            sizes="(min-width: 768px) 260px, 60vw"
          />
        </span>
      </button>
      <p className={`hint${on ? " on" : ""}`}>
        <span className="eq" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <T en="Hover or tap Maharajji to hear Ram Ram" hi="राम राम सुनने के लिए महाराज जी को छुएँ" />
      </p>
    </>
  );
}
