"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/useT";
import { trackEvent } from "@/lib/ga";

export type DevotionalPlayerProps = {
  /** Self-hosted audio (preferred). When set, the player surface renders
   *  a minimal native <audio> element with our brand-styled play disc. */
  audioUrl?: string | null;
  /** Legacy: YouTube embed video ID. Used only when there's no audioUrl. */
  videoId?: string | null;
  /** Title shown above the player. */
  title: string;
  /** Title in Devanagari for the over-line. */
  titleHi?: string;
  /** Source attribution caption. */
  sourceCaption: string;
};

/**
 * Player for the Chalisa / Aarti / Ashtak / Bajrang-Baan pages.
 *
 * Two surfaces share a single `<audio>` element:
 *   1. The full saffron-band player at the top of the page (always
 *      rendered, holds the actual <audio> tag + native controls).
 *   2. A mini sticky player that appears at the bottom of the viewport
 *      when the user scrolls past the full player AND the audio has
 *      been touched at least once. Contains play/pause, time, scrubber,
 *      mute. Sharing one audio element means playback state is unified
 *     , no duplicate streams, no out-of-sync controls.
 */
export default function DevotionalPlayer({
  audioUrl,
  videoId,
  title,
  titleHi,
  sourceCaption,
}: DevotionalPlayerProps) {
  const { t } = useT();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const scrubberRef = useRef<HTMLInputElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  // Whether the user has ever interacted with the audio. Used to decide
  // if the mini sticky player should show. We don't surface it on a
  // brand-new page load, only after they've actually played once.
  const [touched, setTouched] = useState(false);
  // Whether the main player band is visible in the viewport.
  const [mainVisible, setMainVisible] = useState(true);

  const hasAudio = !!audioUrl;
  const embedSrc =
    !hasAudio && videoId
      ? `https://www.youtube-nocookie.com/embed/${videoId}?modestbranding=1&rel=0`
      : null;
  const hasMedia = hasAudio || !!embedSrc;

  /* ── Intersection observer: track main-player visibility ────────────── */
  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setMainVisible(entry.isIntersecting);
        }
      },
      { threshold: 0, rootMargin: "-80px 0px 0px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    setTouched(true);
    if (a.paused) {
      void a.play().catch(() => {
        /* autoplay blocked or asset missing, ignore */
      });
    } else {
      a.pause();
    }
  };

  const toggleMute = () => {
    const a = audioRef.current;
    if (!a) return;
    const next = !a.muted;
    a.muted = next;
    setMuted(next);
    trackEvent("audio_mute_toggle", { title, muted: next ? 1 : 0 });
  };

  const onVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    const v = Number(e.target.value);
    setVolume(v);
    if (!a) return;
    a.volume = v;
    // If user drags volume above 0 while muted, un-mute so they hear it.
    if (v > 0 && a.muted) {
      a.muted = false;
      setMuted(false);
    }
  };

  const onAudioPlay = () => {
    setPlaying(true);
    setTouched(true);
    trackEvent("audio_play", { title });
  };
  const onAudioPause = () => {
    setPlaying(false);
    trackEvent("audio_pause", { title });
  };
  const onAudioEnded = () => {
    setPlaying(false);
    trackEvent("audio_ended", { title });
  };
  const onTimeUpdate = () => {
    const a = audioRef.current;
    if (!a) return;
    setCurrentTime(a.currentTime);
  };
  const onLoadedMetadata = () => {
    const a = audioRef.current;
    if (!a) return;
    setDuration(a.duration);
  };
  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (!a) return;
    const next = Number(e.target.value);
    a.currentTime = next;
    setCurrentTime(next);
  };

  // The mini sticky player shows when:
  //  • we have an audio element (not the YouTube fallback)
  //  • the user has touched the audio at least once
  //  • the main player band is no longer visible in the viewport
  const showMini = hasAudio && touched && !mainVisible;

  return (
    <>
      <section
        ref={containerRef}
        aria-label={`${title} player`}
        className="relative isolate rounded-3xl border border-gold-500/40 bg-cream-50 paper shadow-warm overflow-hidden"
      >
        {/* Top brand strip */}
        <div className="textured-saffron px-6 py-5 flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            {titleHi ? (
              <p className="font-deva text-cream-50 text-lg sm:text-xl leading-tight">
                {titleHi}
              </p>
            ) : null}
            <h3 className="font-fraunces font-medium text-cream-50/95 text-sm tracking-wide">
              {title}
            </h3>
          </div>
          <p className="font-mukta uppercase tracking-[0.32em] text-cream-50/70 text-[0.65rem]">
            {sourceCaption}
          </p>
        </div>

        {/* Player surface */}
        <div className="px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
            {/* Big play / pause disc */}
            <button
              type="button"
              aria-label={
                playing ? t.resources.player.pause : t.resources.player.play
              }
              disabled={!hasMedia}
              onClick={() => {
                if (hasAudio) {
                  togglePlay();
                } else if (embedSrc) {
                  document
                    .getElementById("devotional-iframe")
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                }
              }}
              className={[
                "group relative inline-flex items-center justify-center shrink-0",
                "h-20 w-20 sm:h-24 sm:w-24 rounded-full",
                "bg-saffron-600 text-cream-50 shadow-warm",
                "transition-transform duration-200",
                hasMedia
                  ? "hover:scale-[1.04] hover:bg-saffron-500 cursor-pointer"
                  : "opacity-60 cursor-not-allowed",
              ].join(" ")}
            >
              {playing ? <IconPause big /> : <IconPlay big />}
              <span
                aria-hidden
                className="absolute inset-0 rounded-full ring-2 ring-gold-500/50 group-hover:ring-gold-500/80 transition"
              />
            </button>

            {/* Native audio element. We expose its controls (scrubber +
                volume + speed via overflow menu) inline; the same
                element is also the source of truth for the sticky
                mini player below. */}
            {hasAudio ? (
              <audio
                ref={audioRef}
                src={audioUrl ?? undefined}
                controls
                preload="metadata"
                onPlay={onAudioPlay}
                onPause={onAudioPause}
                onEnded={onAudioEnded}
                onTimeUpdate={onTimeUpdate}
                onLoadedMetadata={onLoadedMetadata}
                onVolumeChange={() =>
                  setMuted(audioRef.current?.muted ?? false)
                }
                className="w-full sm:flex-1 max-w-full"
              >
                Your browser does not support the audio element.
              </audio>
            ) : (
              <p className="text-sm text-ink-600 sm:flex-1 text-center sm:text-left">
                {embedSrc
                  ? t.resources.player.play
                  : t.resources.player.audioComingSoon}
              </p>
            )}
          </div>

          {/* YouTube fallback embed (only if no MP3) */}
          {!hasAudio && embedSrc ? (
            <div className="mt-6 relative w-full overflow-hidden rounded-2xl border border-gold-500/40 bg-black/5 aspect-video">
              <iframe
                id="devotional-iframe"
                src={embedSrc}
                title={`${title}, audio`}
                loading="lazy"
                allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="absolute inset-0 h-full w-full"
              />
            </div>
          ) : null}

          {!hasMedia ? (
            <div className="mt-6 rounded-2xl border border-dashed border-gold-500/50 bg-saffron-50/50 px-5 py-6 text-center">
              <p className="font-fraunces italic text-ink-900/85 leading-relaxed">
                {t.resources.player.audioComingSoon}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {/* ── STICKY MINI PLAYER ─────────────────────────────────────────
          Appears at the bottom of the viewport once the user scrolls
          past the main player AND has hit play at least once. Sits
          above the iOS home indicator via `safe-area-inset-bottom`,
          and below the toast (z-2200) / above SpotFloatingCta (z-900). */}
      {showMini ? (
        <div
          className="fixed inset-x-0 z-[1200] pointer-events-none"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 0px)" }}
          aria-live="off"
        >
          <div className="mx-auto max-w-3xl px-3 pb-3 sm:px-4 sm:pb-4">
            {/* Dark sindoor → saffron gradient so the bar is
                unmistakably foreground against the cream page paper.
                The cream-50 controls + text inside read with high
                contrast at any scroll position. */}
            <div
              role="region"
              aria-label={`${title} mini player`}
              className="pointer-events-auto relative isolate overflow-hidden rounded-2xl border border-sindoor-700/70 shadow-warm flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3 text-cream-50"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 15% 0%, rgba(242,148,76,0.35), transparent 55%), radial-gradient(circle at 85% 100%, rgba(20,8,6,0.45), transparent 55%), linear-gradient(180deg, #9C2A2A 0%, #6E1E1E 100%)",
              }}
            >
              {/* Title block (truncates on narrow viewports). Uses
                  `leading-snug` instead of `leading-none` so Devanagari
                  matras above the baseline (ी, ै, ं etc.) don't get
                  clipped by the row's tight vertical box. */}
              <div className="hidden sm:flex flex-col min-w-0 max-w-[10rem]">
                {titleHi ? (
                  <p className="font-deva text-cream-50 text-sm leading-snug truncate">
                    {titleHi}
                  </p>
                ) : null}
                <p className="font-mukta uppercase tracking-[0.18em] text-[0.6rem] text-cream-50/75 mt-0.5 leading-snug truncate">
                  {title}
                </p>
              </div>

              {/* Play / pause */}
              <button
                type="button"
                onClick={togglePlay}
                aria-label={
                  playing ? t.resources.player.pause : t.resources.player.play
                }
                className="shrink-0 inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 shadow-warm transition-colors"
              >
                {playing ? <IconPause /> : <IconPlay />}
              </button>

              {/* Time */}
              <p className="hidden sm:block shrink-0 text-[11px] text-cream-50/85 font-numerals tabular-nums whitespace-nowrap">
                {fmtTime(currentTime)} / {fmtTime(duration)}
              </p>

              {/* Scrubber */}
              <input
                ref={scrubberRef}
                type="range"
                min={0}
                max={Number.isFinite(duration) && duration > 0 ? duration : 0}
                step={0.1}
                value={Number.isFinite(currentTime) ? currentTime : 0}
                onChange={onScrub}
                aria-label="Audio scrubber"
                className="flex-1 min-w-0 h-1 accent-saffron-500 cursor-pointer"
              />

              {/* Volume slider, desktop+ only (mobile keeps just the
                  mute toggle to save horizontal space). The track uses
                  the same saffron accent as the scrubber for visual
                  consistency. */}
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={onVolume}
                aria-label="Volume"
                className="hidden md:block shrink-0 w-20 h-1 accent-saffron-500 cursor-pointer"
              />

              {/* Mute */}
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? "Unmute" : "Mute"}
                className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full text-cream-50 hover:bg-cream-50/15 transition-colors"
              >
                {muted ? <IconMuted /> : <IconVolume />}
              </button>

              {/* Jump back to top, useful for getting back to the
                  context the player is paired with. */}
              <button
                type="button"
                onClick={() => {
                  trackEvent("audio_back_to_player", { title });
                  containerRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                }}
                aria-label="Back to player"
                title="Back to player"
                className="hidden sm:inline-flex shrink-0 items-center justify-center w-9 h-9 rounded-full border border-cream-50/35 text-cream-50 hover:bg-cream-50/15 transition-colors"
              >
                <IconArrowUp />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ── Icons + helpers ─────────────────────────────────────────────────── */

function IconPlay({ big }: { big?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={big ? "h-9 w-9 translate-x-0.5" : "h-4 w-4 translate-x-px"}
      aria-hidden
    >
      <path d="M7 5v14l12-7z" fill="currentColor" />
    </svg>
  );
}
function IconPause({ big }: { big?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={big ? "h-9 w-9" : "h-4 w-4"} aria-hidden>
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </svg>
  );
}
function IconVolume() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}
function IconMuted() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
  );
}
function IconArrowUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
