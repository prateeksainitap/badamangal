/**
 * Bada Mangal seasons, one config per year. The single source for
 * "which Tuesdays and Saturdays are Bada Mangal days" and "which season
 * do people list bhandaras for right now".
 *
 * All dates are IST calendar days (YYYY-MM-DD). Pure module: no server
 * imports, so client components can use it too.
 *
 * To roll over to a new year, add its config to SEASONS after checking
 * the Jyeshtha window (Purnimanta, as Lucknow keeps it) against a
 * published panchang. Never guess dates.
 */

export type BadaMangalSeason = {
  year: number;
  /** Bada Mangal Tuesdays, in order. */
  tuesdays: readonly string[];
  /** Bada Shanivar Saturdays, in order. Preset chips only. */
  saturdays: readonly string[];
  /** First and last day an organiser can list a bhandara for (inclusive). */
  startISO: string;
  endISO: string;
};

/**
 * 2026: Jyeshtha plus Adhik Maas, eight Tuesdays. History: powers the
 * 2026 recap, the archive and the season section. Do not edit.
 */
export const SEASON_2026: BadaMangalSeason = {
  year: 2026,
  tuesdays: [
    "2026-05-05",
    "2026-05-12",
    "2026-05-19",
    "2026-05-26",
    "2026-06-02",
    "2026-06-09",
    "2026-06-16",
    "2026-06-23",
  ],
  saturdays: [
    "2026-05-02",
    "2026-05-09",
    "2026-05-16",
    "2026-05-23",
    "2026-05-30",
    "2026-06-06",
    "2026-06-13",
    "2026-06-20",
    "2026-06-27",
  ],
  startISO: "2026-05-01",
  endISO: "2026-06-30",
};

/**
 * 2027: Purnimanta Jyeshtha runs from Pratipada on Fri 21 May 2027
 * (Vaishakha Purnima ends 20 May, 4:28 PM IST) to Jyeshtha Purnima on
 * Fri 18 June 2027 (the tithi ends 19 June, 6:13 AM IST). Source:
 * drikpanchang.com Purnima calendar 2027. Tuesdays cross checked with
 * bhaktibharat.com (Bada Mangal 2027: 25 May, 1, 8, 15 June).
 * Saturdays are the four Saturdays fully inside that window. Sat
 * 19 June is NOT a Bada Shanivar (Founder, 2 Nov 2026): Purnima ends
 * at 6:13 AM that day. Checked 1 Nov 2026.
 */
export const SEASON_2027: BadaMangalSeason = {
  year: 2027,
  tuesdays: ["2027-05-25", "2027-06-01", "2027-06-08", "2027-06-15"],
  saturdays: ["2027-05-22", "2027-05-29", "2027-06-05", "2027-06-12"],
  startISO: "2027-05-21",
  endISO: "2027-06-19",
};

/** Every configured season, oldest first. */
export const SEASONS: readonly BadaMangalSeason[] = [SEASON_2026, SEASON_2027];

const IST_MS = 5.5 * 60 * 60 * 1000;

/** Today's IST calendar date (YYYY-MM-DD). */
export function istIso(now: Date | number = new Date()): string {
  const t = typeof now === "number" ? now : now.getTime();
  return new Date(t + IST_MS).toISOString().slice(0, 10);
}

/** Midnight IST at the start of an IST calendar day, as epoch ms. */
export function istMidnight(iso: string): number {
  return Date.parse(`${iso}T00:00:00+05:30`);
}

/** The season whose listing window contains this IST day, if any. */
export function seasonForDate(iso: string): BadaMangalSeason | null {
  return SEASONS.find((s) => iso >= s.startISO && iso <= s.endISO) ?? null;
}

export function seasonForYear(year: number): BadaMangalSeason | null {
  return SEASONS.find((s) => s.year === year) ?? null;
}

/** The season running today (IST), or null between seasons. */
export function currentSeason(now: Date | number = new Date()): BadaMangalSeason | null {
  return seasonForDate(istIso(now));
}

/** True while a season's window (start to end, IST) contains today. */
export function isInSeason(now: Date | number = new Date()): boolean {
  return currentSeason(now) !== null;
}

/**
 * The season people list for now: the running season, else the next
 * one to start. Null only when every configured season is over (add
 * the next year's config).
 */
export function upcomingSeason(now: Date | number = new Date()): BadaMangalSeason | null {
  const today = istIso(now);
  return SEASONS.find((s) => s.endISO >= today) ?? null;
}

/** The most recent season that has fully ended, or null. */
export function lastCompletedSeason(now: Date | number = new Date()): BadaMangalSeason | null {
  const today = istIso(now);
  const done = SEASONS.filter((s) => s.endISO < today);
  return done.length ? done[done.length - 1] : null;
}

/**
 * The season the listing forms offer: the upcoming one, falling back to
 * the latest configured season so a form never renders empty.
 */
export function listingSeason(now: Date | number = new Date()): BadaMangalSeason {
  return upcomingSeason(now) ?? SEASONS[SEASONS.length - 1];
}

/**
 * The season the homepage features: the running season, else the last
 * completed one (the recap), else the first configured season.
 */
export function featuredSeason(now: Date | number = new Date()): BadaMangalSeason {
  return currentSeason(now) ?? lastCompletedSeason(now) ?? SEASONS[0];
}

/** Every Bada Mangal Tuesday across all seasons, in order. */
export const ALL_SEASON_TUESDAYS: readonly string[] = SEASONS.flatMap((s) => s.tuesdays);

/** Tuesday and Saturday preset days of a season, in order. */
export function seasonServiceDays(s: BadaMangalSeason): string[] {
  return [...s.tuesdays, ...s.saturdays].sort();
}

/**
 * If today (IST) is a Bada Mangal Tuesday, its season and 1 based
 * ordinal inside that season. Null on every other day.
 */
export function badaMangalToday(
  now: Date | number = new Date(),
): { season: BadaMangalSeason; ordinal: number; iso: string } | null {
  const today = istIso(now);
  for (const s of SEASONS) {
    const i = s.tuesdays.indexOf(today);
    if (i >= 0) return { season: s, ordinal: i + 1, iso: today };
  }
  return null;
}

/** True when today (IST) is a Bada Mangal Tuesday or Bada Shanivar. */
export function isServiceDayToday(now: Date | number = new Date()): boolean {
  const today = istIso(now);
  return SEASONS.some((s) => s.tuesdays.includes(today) || s.saturdays.includes(today));
}

/** The next Bada Mangal Tuesday strictly after today (IST), or null. */
export function nextTuesdayAfterToday(now: Date | number = new Date()): string | null {
  const today = istIso(now);
  return ALL_SEASON_TUESDAYS.find((d) => d > today) ?? null;
}

/**
 * First Tuesday of the next season that has not started yet (IST), or
 * null while a season is running or when none is configured. Drives the
 * off season countdown.
 */
export function nextSeasonFirstTuesday(now: Date | number = new Date()): string | null {
  const today = istIso(now);
  const next = SEASONS.find((s) => s.startISO > today);
  return next ? next.tuesdays[0] : null;
}

/**
 * Can a public organiser list a bhandara on this day? Any day inside
 * the window of a season that has not ended yet (IST). Days of finished
 * seasons and days outside every season are refused. Days already gone
 * inside the running season stay accepted (as in 2026) so a late or
 * offline queued submission on the day itself never bounces.
 */
export function isListableDate(iso: string, now: Date | number = new Date()): boolean {
  const s = seasonForDate(iso);
  return s !== null && s.endISO >= istIso(now);
}

/**
 * Dev only clock override for checking season states locally, e.g.
 * `?now=2027-05-25T09:00:00%2B05:30`. Always returns null in
 * production builds, so it can never change what visitors see.
 */
export function devNowOverride(raw: string | string[] | undefined | null): Date | null {
  if (process.env.NODE_ENV === "production") return null;
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t) : null;
}
