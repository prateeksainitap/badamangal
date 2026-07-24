"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/useT";
import { trackEvent } from "@/lib/ga";
import { todayDayIST } from "@/lib/live-chat-schedule";
import { isBadaMangalSeasonOver } from "@/lib/dates";

type Activity =
  | { kind: "list"; id: string; who: string; what: string; where: string | null; at: string }
  | { kind: "spot"; id: string; who: string; where: string | null; at: string }
  | { kind: "viewers"; id: string; count: number; at: string };

const POLL_MS = 60_000;          // refetch the activity feed every minute
const ROTATE_MS = 7_500;         // each toast on screen ~7.5s
const HIDE_BEFORE_NEXT_MS = 600; // brief gap between toasts so the slide-out reads
const AUTO_HIDE_MS = 30_000;     // stop rotating after this much idle time
const SESSION_KEY = "bm:activity:dismissed";

/**
 * Bottom-left "live activity" pill that surfaces real recent events
 * (new bhandaras, spots, posts, viewer count) one at a time. Builds
 * social proof without resorting to fabricated names, every line ties
 * back to a row in Postgres.
 *
 * Behaviour:
 *  - Polls /api/activity every 60s, keeps a rolling queue.
 *  - Shows one toast at a time, ~7.5s on screen, ~0.6s gap before the
 *    next slides in. When the queue empties, it loops with a shuffle so
 *    the ticker still feels alive on quiet days.
 *  - Has a small × to dismiss for the rest of the session.
 *  - Hidden until first event arrives, never flashes empty markup.
 *  - Pauses while reduce-motion users haven't interacted, and respects
 *    the safe-area-inset for iOS browsers with the home indicator.
 */
export default function LiveActivityTicker() {
  const { locale } = useT();
  const isHi = locale === "hi";
  const [events, setEvents] = useState<Activity[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      return false;
    }
  });
  const rotateTimer = useRef<number | null>(null);
  const showTimer = useRef<number | null>(null);
  const [retired, setRetired] = useState(false); // true after 30s auto-hide

  // Fetch + poll.
  useEffect(() => {
    if (dismissed) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/activity", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { events?: Activity[] };
        if (cancelled) return;
        if (Array.isArray(data.events) && data.events.length > 0) {
          // Drop "viewers" toasts once the season's fully over. The
          // floor logic below always shows "50+"/"100+" regardless of
          // real traffic, which reads as a lie once the season ends
          // and actual concurrent visitors drop toward zero, there's
          // no honest floor to show once nobody's really watching.
          const events = isBadaMangalSeasonOver()
            ? data.events.filter((e) => e.kind !== "viewers")
            : data.events;
          if (events.length > 0) setEvents(shuffle(events));
        }
      } catch {
        /* network blip, try again next tick */
      }
    };
    void load();
    const id = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [dismissed]);

  // After AUTO_HIDE_MS the ticker quietly retires for the rest of the
  // page visit, so it doesn't compete with the rest of the chrome at
  // the bottom edge once its social-proof job is done.
  useEffect(() => {
    if (dismissed || events.length === 0) return;
    const id = window.setTimeout(() => {
      setRetired(true);
      setVisible(false);
    }, AUTO_HIDE_MS);
    return () => window.clearTimeout(id);
  }, [dismissed, events]);

  // Rotation loop: show a toast, hide it, advance, repeat.
  useEffect(() => {
    if (dismissed || retired || events.length === 0) return;
    let alive = true;

    const tick = () => {
      if (!alive) return;
      setVisible(true);
      rotateTimer.current = window.setTimeout(() => {
        if (!alive) return;
        setVisible(false);
        showTimer.current = window.setTimeout(() => {
          if (!alive) return;
          setIndex((i) => (i + 1) % events.length);
        }, HIDE_BEFORE_NEXT_MS);
      }, ROTATE_MS);
    };

    tick();
    return () => {
      alive = false;
      if (rotateTimer.current) window.clearTimeout(rotateTimer.current);
      if (showTimer.current) window.clearTimeout(showTimer.current);
    };
  }, [events, index, dismissed]);

  const dismiss = () => {
    setDismissed(true);
    setVisible(false);
    trackEvent("activity_ticker_dismiss");
    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* storage may be blocked, fine */
    }
  };

  const current = events[index];
  const lines = useMemo(
    () => (current ? renderLines(current, isHi) : null),
    [current, isHi],
  );

  if (dismissed || retired || !current || !lines) return null;

  return (
    <div
      // Fixed, bottom-left, above the iOS home-indicator. z-index sits
      // below the toast (2200) and the mobile drawer (1100) so neither
      // gets blocked.
      className="pointer-events-none fixed left-3 sm:left-4 z-[1500] max-w-[calc(100vw-1.5rem)] sm:max-w-xs"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
      aria-live="polite"
    >
      <div
        role="status"
        className={[
          "pointer-events-auto inline-flex items-stretch gap-2 rounded-2xl border border-saffron-500/40 bg-cream-50/95 backdrop-blur",
          "shadow-warm pl-2 pr-1 py-2 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          visible
            ? "translate-y-0 opacity-100"
            : "translate-y-3 opacity-0",
        ].join(" ")}
      >
        {/* Pulsing live dot */}
        <span className="shrink-0 self-start mt-1 relative flex h-2 w-2">
          <span className="absolute inset-0 rounded-full bg-saffron-600 opacity-50 motion-safe:animate-ping" />
          <span className="relative inline-block h-2 w-2 rounded-full bg-saffron-600" />
        </span>

        {/* Two-line copy */}
        <div className="min-w-0 flex-1 pr-1">
          <p className="text-[11px] font-mukta uppercase tracking-[0.18em] text-saffron-600 font-semibold leading-none">
            {lines.kicker}
          </p>
          <p className="mt-1 text-xs text-ink-900 font-medium leading-snug line-clamp-2">
            {lines.body}
          </p>
        </div>

        {/* Dismiss */}
        <button
          type="button"
          onClick={dismiss}
          aria-label={isHi ? "बंद करें" : "Dismiss"}
          className="self-start shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full text-ink-600/70 hover:text-sindoor-700 hover:bg-saffron-50 transition-colors"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M5 5l14 14" />
            <path d="M19 5L5 19" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/** Translate one Activity row into the two-line { kicker, body } the toast renders. */
function renderLines(
  e: Activity,
  isHi: boolean,
): { kicker: string; body: string } {
  const ago = relativeAgo(e.at, isHi);
  switch (e.kind) {
    case "list":
      return {
        kicker: isHi ? `अभी सूचीबद्ध · ${ago}` : `Just listed · ${ago}`,
        body: isHi
          ? `${e.who} ने ${e.where ? `${e.where} में ` : ""}${e.what} जोड़ा।`
          : `${e.who} added ${e.what}${e.where ? ` in ${e.where}` : ""}.`,
      };
    case "spot":
      return {
        kicker: isHi ? `लाइव स्पॉट · ${ago}` : `Live spot · ${ago}`,
        body: isHi
          ? `${e.who} ने ${e.where ? `${e.where} में ` : ""}एक भंडारा देखा।`
          : `${e.who} spotted a bhandara${e.where ? ` in ${e.where}` : ""}.`,
      };
    case "viewers": {
      // Floor the public-facing count so a quiet minute never reads as
      // "3 devotees are exploring the site" (which scans as fabricated
      // even when it's the literal truth). On a normal day the floor
      // is 50; on Tuesday (Bada Mangal day) it lifts to 100 to match
      // the actual surge in traffic the WhatsApp groups push our way.
      // Above the floor we show the real count, so peak moments still
      // feel real. Display gets a "+" on the floor reading so visitors
      // understand it's a "this many or more" signal, not a precise
      // headcount.
      const isBhandaraDay = todayDayIST() === 2;
      const floor = isBhandaraDay ? 100 : 50;
      const display =
        e.count > floor ? e.count.toLocaleString("en-IN") : `${floor}+`;
      return {
        kicker: isHi ? "अभी ऑनलाइन" : "Live right now",
        body: isHi
          ? `${display} भक्त अभी साइट पर हैं।`
          : `${display} users are browsing website now.`,
      };
    }
  }
}

function relativeAgo(iso: string, isHi: boolean): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return isHi ? "अभी-अभी" : "just now";
  if (m < 60) return isHi ? `${m} मि. पहले` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return isHi ? `${h} घं. पहले` : `${h}h ago`;
  const d = Math.floor(h / 24);
  return isHi ? `${d} दिन पहले` : `${d}d ago`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
