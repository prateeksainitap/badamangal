/**
 * Live-chat schedule helpers.
 *
 * The WhatsApp bot pipeline (BadaMangal community → bot → DB →
 * homepage live chat) only runs on the high-activity days:
 * Tuesdays + Saturdays IST. On the other 5 days a week the chat
 * panel is "offline" — recent mentions stay visible but no new
 * ones land.
 *
 * Visual contract:
 *   • On open days, the homepage shows a green pulsing "LIVE" pill
 *     next to the section heading and inside the chat-panel header.
 *   • On closed days, those pills are hidden — the community-count
 *     chip + WhatsApp deep-link remain.
 *
 * This module exists so the rule lives in ONE place. Both
 * `LiveChatterBoard.tsx` and `MapBoard.tsx` consume it; if we
 * extend the schedule (e.g. add Sunday mornings during peak
 * Sawan), only this file changes.
 */

/** IST day-of-week numbers (Sun = 0 … Sat = 6) the live chat is
 *  considered "open" on. Tuesday + Saturday today. */
export const LIVE_CHAT_OPEN_DAYS: ReadonlySet<number> = new Set([2, 6]);

/** Returns the current IST day-of-week (0–6, Sun = 0). Uses Intl
 *  rather than manual UTC math so it's robust to any future TZ
 *  reform. */
export function todayDayIST(): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "Asia/Kolkata",
  });
  const day = fmt.format(new Date());
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[day] ?? 0;
}

/** Single source of truth: is the live chat surface "on air" right
 *  now in IST? */
export function isLiveChatOpenToday(): boolean {
  return LIVE_CHAT_OPEN_DAYS.has(todayDayIST());
}

/** Most-recent open day (Tue or Sat) at or before today. Used on
 *  off-days to label the chat header as e.g. "Saturday's chat" so
 *  the visitor knows which day's conversation they're seeing.
 *  Returns 0–6 (Sun-Sat). On an open day, returns today. */
export function mostRecentOpenDayIST(): number {
  const today = todayDayIST();
  for (let offset = 0; offset < 7; offset++) {
    const d = (today - offset + 7) % 7;
    if (LIVE_CHAT_OPEN_DAYS.has(d)) return d;
  }
  // Unreachable — set is non-empty.
  return 2;
}

/** English day name for a 0–6 day number. */
export function dayNameEn(day: number): string {
  return (
    ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
      day
    ] ?? "Tuesday"
  );
}

/** Hindi day name for a 0–6 day number. */
export function dayNameHi(day: number): string {
  return (
    ["रविवार", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"][
      day
    ] ?? "मंगलवार"
  );
}
