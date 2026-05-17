"use client";

/**
 * First-visit "Jai Shree Ram" chant.
 *
 * Fires once per device on the very first visit. The mark is stored
 * in localStorage so it never replays for the same visitor.
 *
 * Trigger: window 'load' event, the page is fully parsed, all
 * critical resources have finished, and the browser is ready. The
 * <audio> element gets a real play() call at that point.
 *
 * Browser autoplay reality (unavoidable): Chrome, Safari, Firefox,
 * and every mobile browser hard-block JavaScript-initiated audio
 * that has no prior user-interaction context. There is no spec-level
 * workaround. If the visitor arrived from a link that recently saw
 * a click (WhatsApp / external referral within the user-activation
 * window) the browser MAY allow it; otherwise the play() promise
 * silently rejects. We do not show any fallback prompt, the
 * intent is "auto-play or nothing", as requested.
 */
import { useEffect } from "react";

const STORAGE_KEY = "bm-chant-played-v1";
const AUDIO_URL = "/audio/jai-shree-ram.mp3";

export default function FirstVisitChant() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let alreadyPlayed = false;
    try {
      alreadyPlayed = window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      /* private mode, treat as not-played; skip the storage write */
    }
    if (alreadyPlayed) return;

    const audio = new Audio(AUDIO_URL);
    audio.volume = 0.85;
    audio.preload = "auto";

    const markPlayed = () => {
      try {
        window.localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* private mode, just skip */
      }
    };

    /** Single play attempt, no retries, no gesture fallback.
     *  If the browser blocks it, the promise rejects silently. */
    const tryPlay = () => {
      const p = audio.play();
      if (p && typeof p.then === "function") {
        p.then(markPlayed).catch(() => {
          /* autoplay blocked by the browser, accept silently */
        });
      } else {
        markPlayed();
      }
    };

    // If the page is already fully loaded by the time this effect
    // runs (very likely in a client-rendered SPA navigation), fire
    // immediately. Otherwise wait for the `load` event so we hit
    // exactly "as soon as the website is loaded completely".
    if (document.readyState === "complete") {
      tryPlay();
    } else {
      window.addEventListener("load", tryPlay, { once: true });
    }

    return () => {
      window.removeEventListener("load", tryPlay);
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        /* ignore */
      }
    };
  }, []);

  return null;
}
