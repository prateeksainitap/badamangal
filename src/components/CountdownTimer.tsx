"use client";

import { Suspense, useEffect, useState } from "react";
import {
  breakdownMs,
  formatEnglishDate,
  formatHindiDate,
  msUntil,
  nextBadaMangal,
  type Countdown,
} from "@/lib/dates";
import { useT } from "@/lib/useT";

function CountdownInner() {
  const { locale, t } = useT();
  const [target, setTarget] = useState<Date | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const next = nextBadaMangal();
    setTarget(next);
    setNow(new Date());
    if (!next) return;

    const id = window.setInterval(() => setNow(new Date()), 1000);
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

  return (
    <div className="flex flex-col items-center gap-4">
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
