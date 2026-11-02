/**
 * Format an "HH:MM" 24-hour string as a 12-hour label, e.g.
 * `"15:00"` → `"3:00 PM"`. Returns `""` for empty/invalid input so that
 * callers building share / OG / display text can safely append it.
 */
export function format12h(time: string | null | undefined): string {
  if (!time) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min) || h < 0 || h > 23 || min < 0 || min > 59) {
    return "";
  }
  const period = h >= 12 ? "PM" : "AM";
  const display = ((h + 11) % 12) + 1;
  return `${display}:${String(min).padStart(2, "0")} ${period}`;
}

/**
 * Join two already formatted times into a range. The site never shows a
 * dash (founder, 29 Oct 2026), so English reads "6:00 AM to 2:00 PM" and
 * Hindi reads "6:00 AM से 2:00 PM तक". Returns whichever side exists when
 * one is empty. Every public time range goes through this.
 */
export function joinTimeRange(
  start: string,
  end?: string | null,
  locale: "en" | "hi" = "en",
): string {
  const s = (start ?? "").trim();
  const e = (end ?? "").trim();
  if (!s) return e;
  if (!e) return s;
  return locale === "hi" ? `${s} से ${e} तक` : `${s} to ${e}`;
}

/**
 * Format an inclusive "HH:MM" range: returns the start alone if the end
 * time is missing or invalid, and "" if the start is invalid.
 */
export function formatTimeRange(
  start: string | null | undefined,
  end?: string | null,
  locale: "en" | "hi" = "en",
): string {
  const s = format12h(start);
  if (!s) return "";
  return joinTimeRange(s, format12h(end), locale);
}
