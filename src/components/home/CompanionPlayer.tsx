"use client";
import { useLocaleFromContext } from "@/lib/locale-context";

import { useEffect, useRef, useState } from "react";
import { T } from "@/components/T";
import { trackEvent } from "@/lib/ga";

function mmss(s: number): string {
  const n = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}

/**
 * Hanuman Chalisa player: gold disc, thin saffron progress, seekable.
 * Plays only on a tap. The file is the existing /audio/hanuman-chalisa.mp3
 * and is not fetched until the first play (preload none).
 */
export default function CompanionPlayer() {
  const isHi = useLocaleFromContext() === "hi";
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    const a = new Audio("/audio/hanuman-chalisa.mp3");
    a.preload = "none";
    audio.current = a;
    const onTime = () => setCur(a.currentTime);
    const onMeta = () => setDur(a.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onPause);
    // Pause when another homepage sound (Maharajji's chant) starts.
    const other = () => a.pause();
    window.addEventListener("bmh:audio", other);
    return () => {
      a.pause();
      window.removeEventListener("bmh:audio", other);
      audio.current = null;
    };
  }, []);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) {
      window.dispatchEvent(new CustomEvent("bmh:audio", { detail: "chalisa" }));
      void a.play().catch(() => {});
      trackEvent("home_chalisa_play");
    } else {
      a.pause();
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audio.current;
    if (!a || !a.duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - r.left) / r.width) * a.duration;
  };

  const pct = dur ? (cur / dur) * 100 : 0;
  return (
    <div className={`player${playing ? " playing" : ""}`} data-rv>
      <button
        type="button"
        className="disc"
        onClick={toggle}
        aria-pressed={playing}
        aria-label={isHi ? (playing ? "हनुमान चालीसा रोकें" : "हनुमान चालीसा चलाएँ") : playing ? "Pause Hanuman Chalisa" : "Play Hanuman Chalisa"}
      >
        {playing ? (
          <svg viewBox="0 0 20 20" aria-hidden>
            <rect x="5" y="4" width="3.4" height="12" rx="1" fill="currentColor" />
            <rect x="11.6" y="4" width="3.4" height="12" rx="1" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" aria-hidden>
            <path d="M6.5 4.2v11.6a.6.6 0 00.9.5l9.2-5.8a.6.6 0 000-1L7.4 3.7a.6.6 0 00-.9.5z" fill="currentColor" />
          </svg>
        )}
      </button>
      <div className="pl-meta">
        <b>
          <T en="Shri Hanuman Chalisa" hi="श्री हनुमान चालीसा" />
        </b>
        <small>
          <T en="The full path, sung" hi="पूरा पाठ, स्वर में" />
        </small>
        <div
          className="bar"
          onClick={seek}
          role="progressbar"
          aria-label={isHi ? "चालीसा कितनी चली" : "Chalisa progress"}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
        >
          <i style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="time">{dur ? `${mmss(cur)} / ${mmss(dur)}` : <T en="Listen" hi="सुनें" />}</span>
    </div>
  );
}
