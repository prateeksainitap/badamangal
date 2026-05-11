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
 * Format an inclusive time range with the same safety: omits the dash if
 * end-time is missing, returns the start alone if end is empty.
 */
export function formatTimeRange(start: string, end?: string | null): string {
  const s = format12h(start);
  const e = format12h(end ?? "");
  if (!s) return "";
  if (!e) return s;
  return `${s} – ${e}`;
}
