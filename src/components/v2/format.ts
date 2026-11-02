/**
 * Small display formatters for inner pages. No dashes anywhere: ranges
 * read "9 AM to 2 PM" / "सुबह 9 से दोपहर 2 बजे तक" style via "to" / "से ... तक".
 */
export type Locale = "en" | "hi";

const EN_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const EN_MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const HI_MONTH = ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];
const EN_DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HI_DAY = ["रविवार", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"];

/** "09:00" -> "9 AM", "14:30" -> "2:30 PM". "" for anything invalid. */
export function shortTime(t: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec((t ?? "").trim());
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return "";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}${min ? `:${String(min).padStart(2, "0")}` : ""} ${h >= 12 ? "PM" : "AM"}`;
}

/** "9 AM to 2 PM" (en) or "9 AM से 2 PM तक" (hi). The bot's unknown
 *  time ("00:00" with no end) returns "". */
export function timeRange(start: string | null | undefined, end: string | null | undefined, locale: Locale = "en"): string {
  if (start === "00:00" && !end) return "";
  const s = shortTime(start);
  const e = shortTime(end);
  if (!s) return e;
  if (!e || e === s) return s;
  return locale === "hi" ? `${s} से ${e} तक` : `${s} to ${e}`;
}

const parts = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
};

/** "19 May" / "19 मई". */
export function dayMonth(iso: string, locale: Locale = "en"): string {
  const { m, d } = parts(iso);
  return `${d} ${(locale === "hi" ? HI_MONTH : EN_MON)[m - 1]}`;
}

/** "Tuesday, 19 May" / "मंगलवार, 19 मई". */
export function longDate(iso: string, locale: Locale = "en", withYear = false): string {
  const { y, m, d, wd } = parts(iso);
  const day = (locale === "hi" ? HI_DAY : EN_DAY)[wd];
  const month = (locale === "hi" ? HI_MONTH : EN_MONTH)[m - 1];
  return `${day}, ${d} ${month}${withYear ? ` ${y}` : ""}`;
}

/** Today in IST as YYYY-MM-DD. */
export function istToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

/** "Served 5 May to 23 Jun 2026" / "सेवा: 5 मई से 23 जून 2026". */
export function servedSpan(dates: string[], locale: Locale = "en"): string {
  const s = dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (!s.length) return "";
  const first = s[0]!;
  const last = s[s.length - 1]!;
  const y = last.slice(0, 4);
  const span =
    first === last
      ? `${dayMonth(first, locale)} ${y}`
      : locale === "hi"
        ? `${dayMonth(first, locale)} से ${dayMonth(last, locale)} ${y}`
        : `${dayMonth(first, locale)} to ${dayMonth(last, locale)} ${y}`;
  return locale === "hi" ? `सेवा: ${span}` : `Served ${span}`;
}
