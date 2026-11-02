"use client";

import { useEffect, useState } from "react";
import { istMidnight, nextSeasonFirstTuesday } from "@/lib/season";
import { useLocaleFromContext } from "@/lib/locale-context";

const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_HI = ["जनवरी", "फरवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/**
 * Countdown to the first Tuesday of the next season that has not
 * started yet (lib/season.ts; 25 May 2027, midnight IST, as of Nov
 * 2026). The server renders the day count; the clock ticks once
 * hydrated. Renders nothing while a season is running.
 */
export default function NextMangalCountdown({ serverNow }: { serverNow: number }) {
  const isHi = useLocaleFromContext() === "hi";
  const [now, setNow] = useState(serverNow);
  const [live, setLive] = useState(false);
  useEffect(() => {
    setNow(Date.now());
    setLive(true);
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const targetIso = nextSeasonFirstTuesday(serverNow);
  if (!targetIso) return null;
  const left = istMidnight(targetIso) - now;
  if (left <= 0) return null;
  const [ty, tm, td] = targetIso.split("-").map(Number);
  const p = parts(left);
  const units = [
    { v: String(p.d), en: p.d === 1 ? "day" : "days", hi: "दिन" },
    { v: live ? pad(p.h) : "--", en: "hours", hi: "घंटे" },
    { v: live ? pad(p.m) : "--", en: "minutes", hi: "मिनट" },
    { v: live ? pad(p.s) : "--", en: "seconds", hi: "सेकंड" },
  ];
  return (
    <div className="nm">
      <p className="nm-k">
        {isHi
          ? `अगला बड़ा मंगल · मंगलवार, ${td} ${MONTHS_HI[tm - 1]} ${ty}`
          : `Next Bada Mangal · Tuesday, ${td} ${MONTHS_EN[tm - 1]} ${ty}`}
      </p>
      <div
        className="nm-row"
        role="timer"
        aria-label={isHi ? `अगले बड़े मंगल में ${p.d} दिन` : `${p.d} days to the next Bada Mangal`}
      >
        {units.map((u, i) => (
          <div className="nm-u" key={u.en}>
            <span className={`nm-n${i === 3 ? " nm-s" : ""}`} suppressHydrationWarning>
              {u.v}
            </span>
            <span className="nm-l">{isHi ? u.hi : u.en}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
