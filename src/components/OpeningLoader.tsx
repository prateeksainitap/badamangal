"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * OpeningLoader
 *
 * Full-screen welcome splash that fires once per device on the very
 * first visit. Designed to feel like the threshold moment of walking
 * into a Hindu temple: a brief reverential pause, the चंत chime
 * playing, then a slow withdrawal that opens onto the homepage like
 * the inner sanctum.
 *
 * Behaviour:
 *
 *   • Appears ~80 ms after first paint so the homepage peeks first.
 *   • Tries to autoplay /audio/jai-shree-ram.mp3 immediately. If the
 *     browser's autoplay policy blocks it, the failure is silent, a
 *     subsequent tap anywhere on the splash will play it (capturing
 *     the user gesture), but we never *require* a click.
 *   • Stays at full opacity for ~3.5 s (long enough for the chime to
 *     register and for the rotating halo to feel devotional, not
 *     impatient).
 *   • Then fades out over 1.4 s with a soft scale-up, so the splash
 *     reads as "opening into" the page rather than "wiping away".
 *   • Tapping anywhere accelerates the dismiss + plays audio if it
 *     was previously blocked. Escape key does the same minus audio.
 *
 * Visual:
 *
 *   • The ram-name halo SVG from /illustrations rotates slowly behind
 *     the headline, using the same `bm-spiral-spin` 180 s keyframe
 *     the hero illustration uses. So the loader and the homepage
 *     hero feel like one continuous devotional gesture, the rotation
 *     literally carries over.
 *   • Layered saffron + sindoor + cream paper gradient backdrop with
 *     hairline gold rules top and bottom (same editorial frame the
 *     rest of the homepage's quiet bands use).
 *
 * Persistence:
 *
 *   • localStorage key `bm.loader.seen.v1` marks the splash as seen.
 *     Once dismissed (auto or manual), it never reappears on this
 *     device. The existing FirstVisitGreeting handles return-session
 *     top-right badges from then on.
 */

const STORAGE_KEY = "bm.loader.seen.v1";
const AUDIO_URL = "/audio/jai-shree-ram.mp3";
const VISIBLE_MS = 3500;    // dwell time at full opacity before fade begins
const FADE_OUT_MS = 1400;   // slow temple-exit fade
const APPEAR_DELAY_MS = 80; // tiny delay so the page paints first

type Stage = "hidden" | "showing" | "dismissing";

export default function OpeningLoader() {
  const [stage, setStage] = useState<Stage>("hidden");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dismissTimerRef = useRef<number | null>(null);
  const removeTimerRef = useRef<number | null>(null);

  // Decide on mount whether to show. Defaults to hidden so SSR + the
  // initial paint never flash an overlay.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let seen = false;
    try {
      seen = window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // private mode / storage blocked, still show the loader; it's
      // a friendly welcome, not something we need to suppress.
    }
    if (seen) return;
    const t = window.setTimeout(() => setStage("showing"), APPEAR_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  const markSeen = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const startDismiss = useCallback(() => {
    setStage((s) => (s === "showing" ? "dismissing" : s));
    markSeen();
    if (removeTimerRef.current) window.clearTimeout(removeTimerRef.current);
    // Hard-unmount after fade so the overlay no longer eats clicks
    removeTimerRef.current = window.setTimeout(
      () => setStage("hidden"),
      FADE_OUT_MS + 60,
    );
  }, [markSeen]);

  // When showing: try autoplay + schedule auto-dismiss
  useEffect(() => {
    if (stage !== "showing") return;

    // Attempt autoplay. Browser autoplay policies vary, Chrome /
    // Safari typically block, but if the visitor arrived from a
    // freshly-clicked link (WhatsApp share, external referral) the
    // browser may allow it within the user-activation window. We
    // accept whichever outcome silently; the splash's fade-out
    // runs regardless of whether sound played.
    if (audioRef.current) {
      audioRef.current.volume = 0.85;
      try {
        const p = audioRef.current.play();
        if (p && typeof p.then === "function") {
          p.catch(() => {
            /* autoplay blocked, a subsequent tap anywhere on the
               splash will play it via the onClick fallback below. */
          });
        }
      } catch {
        /* ignore */
      }
    }

    dismissTimerRef.current = window.setTimeout(startDismiss, VISIBLE_MS);
    return () => {
      if (dismissTimerRef.current) window.clearTimeout(dismissTimerRef.current);
    };
  }, [stage, startDismiss]);

  // Escape key dismisses immediately (silent)
  useEffect(() => {
    if (stage !== "showing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") startDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, startDismiss]);

  // On any tap during the splash: if audio is paused (autoplay was
  // blocked), capture the user gesture to play it now, then start
  // the dismiss. Doesn't run when stage is already dismissing.
  const handleTap = useCallback(() => {
    if (stage !== "showing") return;
    if (audioRef.current && audioRef.current.paused) {
      try {
        const p = audioRef.current.play();
        if (p && typeof p.then === "function") p.catch(() => {});
      } catch {
        /* ignore */
      }
    }
    startDismiss();
  }, [stage, startDismiss]);

  if (stage === "hidden") return null;

  const dismissing = stage === "dismissing";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to BadaMangal"
      onClick={handleTap}
      className="fixed inset-0 z-[200] overflow-hidden cursor-pointer"
      style={{
        transition: `opacity ${FADE_OUT_MS}ms cubic-bezier(0.45, 0.05, 0.25, 1)`,
        opacity: dismissing ? 0 : 1,
        pointerEvents: dismissing ? "none" : "auto",
      }}
    >
      {/* Warm radial backdrop: saffron sun above, sindoor wash below,
          cream paper base. Same gradient family as the hero so the
          transition into the page feels seamless. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 700px at 50% 28%, rgba(242,148,76,0.55), transparent 70%), radial-gradient(800px 600px at 50% 85%, rgba(156,42,42,0.20), transparent 70%), linear-gradient(180deg, #FFF7EB 0%, #FFE4BC 65%, #F8D4A0 100%)",
        }}
      />

      {/* Hairline gold rules for editorial framing */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent"
      />

      {/* Ram-name halo, slowly rotating behind the headline. Identical
          treatment to the hero's HeroIllustrationFrame: same SVG, same
          `bm-spiral-spin 180s linear infinite` keyframe, same opacity
          band. So the loader and the homepage hero share one
          continuous devotional gesture, the rotation literally
          carries over from splash → page. */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(86vmin,760px)] aspect-square pointer-events-none opacity-55"
      >
        <div
          className="w-full h-full"
          style={{ animation: "bm-spiral-spin 180s linear infinite" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/illustrations/ram-name-halo.svg"
            alt=""
            className="w-full h-full object-contain"
          />
        </div>
      </div>

      {/* Content stack. Just the bilingual chant in bold, dead centre.
          No eyebrow, no tagline, no instructional hint, the rotating
          ram-name halo behind the text carries the entire ambient
          context. During the dismiss the headline scales up slightly
          (1.045×) so the splash reads as "opening into the sanctum"
          rather than a flat wipe.

          Hindi switches from font-tiro (display weight 400 only) to
          font-mukta font-extrabold (weight 800) because the user
          asked for bold letters, Tiro's single weight couldn't
          actually render bold. English uses font-fraunces font-bold
          italic to carry the editorial register the rest of the
          homepage uses while still reading visibly heavier. */}
      <div
        className="relative h-full w-full flex items-center justify-center px-6 text-center"
        style={{
          transition: `transform ${FADE_OUT_MS}ms cubic-bezier(0.45, 0.05, 0.25, 1)`,
          transform: dismissing ? "scale(1.045)" : "scale(1)",
        }}
      >
        <div>
          <h1
            className="font-mukta font-extrabold text-[3.8rem] sm:text-8xl text-sindoor-700 leading-[1.05] motion-safe:animate-pulse"
            style={{ animationDuration: "3.5s" }}
          >
            जय श्री राम
          </h1>
          <p className="mt-4 sm:mt-5 font-fraunces font-bold italic text-2xl sm:text-4xl text-sindoor-700">
            Jai Shri Ram
          </p>
        </div>
      </div>

      {/* Hidden audio element, preloaded. Attempted on mount via the
          effect above; tap-to-play fallback handles autoplay-blocked
          cases. */}
      <audio ref={audioRef} src={AUDIO_URL} preload="auto" />
    </div>
  );
}
