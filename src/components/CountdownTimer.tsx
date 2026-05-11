"use client";

import { Suspense, useEffect, useState } from "react";
import {
  breakdownMs,
  currentBadaMangalOrdinal,
  formatEnglishDate,
  formatHindiDate,
  msUntil,
  nextBadaMangalAfterToday,
  type Countdown,
} from "@/lib/dates";
import { useT } from "@/lib/useT";

function CountdownInner() {
  const { locale, t } = useT();
  const [target, setTarget] = useState<Date | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  /** 1-8 if today (IST) is a Bada Mangal Tuesday; else null. Lifted
   *  into state so it's stable across renders without re-computing
   *  every tick — IST day boundary rolls over once per day so we only
   *  need to refresh this on mount + at midnight. */
  const [liveOrdinal, setLiveOrdinal] = useState<number | null>(null);

  useEffect(() => {
    // Always count down to the NEXT future Bada Mangal — never today's,
    // even when today IS a Bada Mangal (the banner above handles that
    // case visually so the timer doesn't shrink to zero mid-day).
    const next = nextBadaMangalAfterToday();
    setTarget(next);
    setNow(new Date());
    setLiveOrdinal(currentBadaMangalOrdinal());
    if (!next) return;

    const id = window.setInterval(() => {
      const n = new Date();
      setNow(n);
      // Cheap: recompute the live flag every tick so the banner
      // appears/disappears at the IST midnight boundary without
      // needing a separate timer.
      setLiveOrdinal(currentBadaMangalOrdinal(n));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!now) {
    return <div className="h-32" aria-hidden />;
  }

  if (!target) {
    return (
      <p className="text-ink-600 text-lg font-tiro text-center">
        {t.countdown.seasonComplete}
      </p>
    );
  }

  const cd: Countdown = breakdownMs(msUntil(target, now));
  const dateLabel = locale === "hi" ? formatHindiDate(target) : formatEnglishDate(target);

  // Build the live-day headline when applicable: "Today is the 2nd
  // Bada Mangal" / "आज दूसरा बड़ा मंगल है". `{ordinal}` is the
  // placeholder both string variants share.
  const liveHeadline =
    liveOrdinal !== null
      ? t.countdown.liveToday.replace(
          "{ordinal}",
          t.countdown.liveOrdinals[liveOrdinal - 1] ?? String(liveOrdinal),
        )
      : null;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Live-day headline. Big, bold, saffron-pulsed dot so the visitor
          instantly registers "this is happening today" before their eyes
          drop to the timer-to-next-one below. Hidden on non-live days. */}
      {liveHeadline ? (
        // Sized up to `text-3xl sm:text-4xl` to match the page's
        // standardised section-heading scale — on a Bada Mangal day
        // this should be the loudest element in the band, not equal
        // to the date pill or the trivia kicker above it.
        <div className="flex items-center gap-3 max-w-full px-2">
          <span
            aria-hidden
            className="relative inline-flex h-3 w-3 shrink-0"
          >
            <span className="absolute inset-0 rounded-full bg-saffron-500 opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-saffron-600" />
          </span>
          <h3
            className={`text-center text-3xl sm:text-4xl leading-tight ${
              locale === "hi"
                ? "font-tiro text-sindoor-700"
                : "font-fraunces font-bold text-sindoor-700"
            }`}
          >
            {liveHeadline}
          </h3>
        </div>
      ) : null}

      {/* Date pill — saffron-bordered editorial chip so the "next
          Tuesday" date reads as a proper headline, not a tiny caption.
          Two-line layout: a small uppercase kicker on top, the date
          itself below in sindoor at a larger size with Tiro for the
          weekday so the row feels intentional. */}
      <div className="inline-flex flex-col items-center rounded-2xl border border-saffron-500/45 bg-saffron-50/60 px-4 py-2 shadow-warm">
        <span className="font-mukta uppercase tracking-[0.28em] text-[0.65rem] text-saffron-600 font-semibold">
          {t.countdown.nextBadaMangal}
        </span>
        <span className="mt-0.5 text-sindoor-700 text-base sm:text-lg font-semibold font-numerals tabular-nums leading-tight">
          {dateLabel}
        </span>
      </div>
      <div className="flex flex-wrap items-end justify-center gap-4 sm:gap-6">
        <Unit value={cd.days} label={t.countdown.days} />
        <Separator />
        <Unit value={cd.hours} label={t.countdown.hours} />
        <Separator />
        <Unit value={cd.minutes} label={t.countdown.minutes} />
        <Separator />
        <Unit value={cd.seconds} label={t.countdown.seconds} />
      </div>
    </div>
  );
}

function Unit({ value, label }: { value: number; label: string }) {
  const padded = String(value).padStart(2, "0");
  return (
    <div className="flex flex-col items-center min-w-[68px]">
      <span className="font-numerals font-extrabold text-5xl sm:text-7xl text-saffron-600 leading-[0.95] tabular-nums flex tracking-tight">
        <ScrollDigit char={padded.charAt(0)} />
        <ScrollDigit char={padded.charAt(1)} />
      </span>
      <span className="text-ink-600 text-xs sm:text-sm mt-2 uppercase tracking-[0.2em] font-medium">
        {label}
      </span>
    </div>
  );
}

/**
 * Odometer-style digit. Renders a vertical strip of 0..9 inside a 1em-tall
 * window and translates the strip so the active digit sits in view. The
 * transform animates with a soft ease, giving a continuous "scroll/roll"
 * motion when the value changes, replaces the prior 3D flip-card.
 */
function ScrollDigit({ char }: { char: string }) {
  const n = /^\d$/.test(char) ? Number(char) : 0;
  return (
    <span
      className="inline-block overflow-hidden align-baseline tabular-nums"
      style={{ height: "1em", lineHeight: 1 }}
      aria-hidden
    >
      <span
        className="block will-change-transform"
        style={{
          transform: `translateY(-${n * 10}%)`,
          transition: "transform 600ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className="block"
            style={{ height: "1em", lineHeight: 1 }}
          >
            {i}
          </span>
        ))}
      </span>
    </span>
  );
}

function Separator() {
  return <span className="font-numerals font-bold text-5xl text-gold-500 leading-none">·</span>;
}

export default function CountdownTimer() {
  return (
    <Suspense fallback={<div className="h-32" />}>
      <CountdownInner />
    </Suspense>
  );
}
