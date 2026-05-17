// 8 Bada Mangals of 2026 (Tuesdays of Jyeshtha + Adhik Maas).
// Stored as UTC ISO with the local Lucknow start moment (≈ 04:30 UTC = 10:00 IST).
// Using 04:30 UTC as a soft "morning of" anchor; any countdown will read sensibly
// from any timezone and still flip on the correct calendar day in IST.
export const BADA_MANGAL_DATES_2026: ReadonlyArray<Date> = [
  new Date("2026-05-05T04:30:00Z"),
  new Date("2026-05-12T04:30:00Z"),
  new Date("2026-05-19T04:30:00Z"),
  new Date("2026-05-26T04:30:00Z"),
  new Date("2026-06-02T04:30:00Z"),
  new Date("2026-06-09T04:30:00Z"),
  new Date("2026-06-16T04:30:00Z"),
  new Date("2026-06-23T04:30:00Z"),
] as const;

// ISO date strings (YYYY-MM-DD) for the 8 Bada Mangals, used as the wire
// format for tuesdayDates in form submission and the seed.
export const ALL_TUESDAY_ISO: readonly string[] = BADA_MANGAL_DATES_2026.map(
  (d) => d.toISOString().slice(0, 10),
);

// Bada Shanivars of the same Jyeshtha + Adhik Maas window, organizers
// often run a parallel Saturday bhandara, so we surface these alongside
// the Tuesdays in the form.
export const BADA_SHANIVAR_DATES_2026: ReadonlyArray<Date> = [
  new Date("2026-05-02T04:30:00Z"),
  new Date("2026-05-09T04:30:00Z"),
  new Date("2026-05-16T04:30:00Z"),
  new Date("2026-05-23T04:30:00Z"),
  new Date("2026-05-30T04:30:00Z"),
  new Date("2026-06-06T04:30:00Z"),
  new Date("2026-06-13T04:30:00Z"),
  new Date("2026-06-20T04:30:00Z"),
  new Date("2026-06-27T04:30:00Z"),
] as const;

export const ALL_SATURDAY_ISO: readonly string[] =
  BADA_SHANIVAR_DATES_2026.map((d) => d.toISOString().slice(0, 10));

/**
 * Combined preset list of season service-days (Tuesdays + Saturdays),
 * sorted chronologically. Organizers also have a free calendar picker
 * for any other date, so this list is preset-only, not the closed set.
 */
export const ALL_SEASON_ISO: readonly string[] = [
  ...ALL_TUESDAY_ISO,
  ...ALL_SATURDAY_ISO,
].sort();

/** Season window used to bound the free calendar picker. */
export const SEASON_START_ISO = "2026-05-01";
export const SEASON_END_ISO = "2026-06-30";

export function nextBadaMangal(now: Date = new Date()): Date | null {
  for (const d of BADA_MANGAL_DATES_2026) {
    if (d.getTime() > now.getTime()) return d;
  }
  return null;
}

/** Today's date as YYYY-MM-DD in IST (Asia/Kolkata, UTC+5:30).
 *  Exported so server-rendered pages can use the same calendar
 *  boundary the user sees, important when "auto-delisting past
 *  bhandaras" needs to agree with the visitor's local sense of "today".
 *  Several components have inlined copies of this; over time we'll
 *  collapse those onto this one.
 */
export function istTodayIso(now: Date = new Date()): string {
  return new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

/**
 * Predicate: does this bhandara still have at least one service day
 * that's today or in the future (IST)?
 *
 * Used to auto-hide bhandaras whose date has fully passed from every
 * public-facing query (homepage listing, /api/bhandaras, etc.) without
 * deleting the DB row. The data stays, admins see it under the
 * /admin "All" tab, and historical share links to /bhandara/[slug]
 * keep working, but the public map and counters only reflect what's
 * still upcoming, no manual delisting needed.
 *
 * `tuesdayDates` is the unfortunate name for what's actually "all
 * service days", Tuesdays + the occasional Bade Shanivar, kept for
 * back-compat with the DB column.
 */
export function hasUpcomingDate(
  b: { tuesdayDates: string[] },
  now: Date = new Date(),
): boolean {
  const today = istTodayIso(now);
  return b.tuesdayDates.some((d) => d >= today);
}

/**
 * Card-instance returned by expandByDate: a single bhandara may
 * generate multiple instances (one per upcoming service date) so the
 * homepage + area grids can show "Tuesday X bhandara" and "Tuesday Y
 * bhandara" as separate cards even when X and Y are the same physical
 * row in the DB. `pinnedDate` overrides the card's default
 * "next-upcoming Tuesday" autopick, so each rendered card shows its
 * own date label.
 *
 * A `pinnedDate` of `null` means "no specific date" (the bhandara has
 * no upcoming service days, kept in the list so the row stays
 * discoverable, but with no date chip in the header).
 */
export type BhandaraCardInstance<B extends { tuesdayDates: string[] }> = {
  bhandara: B;
  pinnedDate: string | null;
};

/**
 * Expand a list of bhandaras into one card-instance per upcoming
 * service date. The Lucknow norm is that a single banner lists every
 * Tuesday + Bade Shanivar of the Jyeshtha season (8 + 1-3 Saturdays),
 * so a faithful "what's on" listing wants one card per occurrence,
 * not one card per organiser.
 *
 * Behaviour:
 *   • Bhandara with N upcoming dates → N instances, each with its own
 *     `pinnedDate`. Past dates (< today IST) drop on the floor; same
 *     dates are deduped via the underlying Set, but a single row
 *     can't have duplicate dates in its tuesdayDates JSON anyway.
 *   • Bhandara with zero upcoming dates → one instance with
 *     `pinnedDate: null`, keeps the row visible but without a date
 *     chip. Useful while the season hasn't started, or after the last
 *     Tuesday but before admin cleanup.
 *
 * Sort: date ascending (next Tuesday first), then sponsored desc,
 * then verified desc within the same date. Date-less rows sink to
 * the bottom of the grid. Matches the user expectation "what's on
 * this Tuesday, then next Tuesday, then the one after".
 */
export function expandBhandarasByDate<
  B extends {
    tuesdayDates: string[];
    // Both flags are optional on Bhandara (the wire type). Treating
    // them as required in the constraint would force callers to
    // narrow the type and break inference of `B = Bhandara`, so
    // we keep them optional here and `?? false` them in the sort.
    isSponsored?: boolean;
    isVerified?: boolean;
  },
>(bhandaras: readonly B[], now: Date = new Date()): BhandaraCardInstance<B>[] {
  const today = istTodayIso(now);
  const instances: BhandaraCardInstance<B>[] = [];
  for (const b of bhandaras) {
    const upcoming = b.tuesdayDates
      .filter((d) => d >= today)
      .slice()
      .sort();
    if (upcoming.length === 0) {
      instances.push({ bhandara: b, pinnedDate: null });
    } else {
      for (const d of upcoming) {
        instances.push({ bhandara: b, pinnedDate: d });
      }
    }
  }
  instances.sort((a, z) => {
    // No-date instances sink to the end so the date-pinned cards
    // dominate the top of the grid.
    if (a.pinnedDate === null && z.pinnedDate === null) return 0;
    if (a.pinnedDate === null) return 1;
    if (z.pinnedDate === null) return -1;
    if (a.pinnedDate !== z.pinnedDate) {
      return a.pinnedDate.localeCompare(z.pinnedDate);
    }
    // Same date, fall back to the existing sponsored → verified
    // ordering so paid placements still rise to the top of their
    // date's slice without dragging across other Tuesdays.
    const aSp = a.bhandara.isSponsored ?? false;
    const zSp = z.bhandara.isSponsored ?? false;
    if (aSp !== zSp) return aSp ? -1 : 1;
    const aVe = a.bhandara.isVerified ?? false;
    const zVe = z.bhandara.isVerified ?? false;
    if (aVe !== zVe) return aVe ? -1 : 1;
    return 0;
  });
  return instances;
}

/**
 * If today's IST calendar date matches one of the 8 Bada Mangals,
 * returns its 1-based ordinal (1 → 1st Bada Mangal, 2 → 2nd, …, 8 → 8th).
 * Returns `null` on every other day.
 *
 * IST is the right frame: a user opening the homepage at 11 PM on a
 * Bada Mangal Tuesday should still see the "Today is …" banner, even
 * though by UTC clock it's already Wednesday.
 */
export function currentBadaMangalOrdinal(
  now: Date = new Date(),
): number | null {
  const today = istTodayIso(now);
  const idx = ALL_TUESDAY_ISO.indexOf(today);
  return idx >= 0 ? idx + 1 : null;
}

/**
 * The first Bada Mangal strictly AFTER today (IST). On live days this
 * is needed for the countdown timer, `nextBadaMangal()` would return
 * today's date earlier in the day (before its 10 AM IST anchor),
 * giving a sub-1-day countdown that flips to the next one at 10 AM.
 * This variant always points at the next future Tuesday.
 */
export function nextBadaMangalAfterToday(now: Date = new Date()): Date | null {
  const today = istTodayIso(now);
  for (let i = 0; i < BADA_MANGAL_DATES_2026.length; i += 1) {
    if (ALL_TUESDAY_ISO[i] > today) return BADA_MANGAL_DATES_2026[i];
  }
  return null;
}

export type Countdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
};

export function msUntil(target: Date, now: Date = new Date()): number {
  return Math.max(0, target.getTime() - now.getTime());
}

export function breakdownMs(totalMs: number): Countdown {
  const seconds = Math.floor(totalMs / 1000) % 60;
  const minutes = Math.floor(totalMs / (1000 * 60)) % 60;
  const hours   = Math.floor(totalMs / (1000 * 60 * 60)) % 24;
  const days    = Math.floor(totalMs / (1000 * 60 * 60 * 24));
  return { days, hours, minutes, seconds, totalMs };
}

const HINDI_MONTHS = [
  "जनवरी", "फरवरी", "मार्च", "अप्रैल", "मई", "जून",
  "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर",
];

// Format a date in IST as Hindi long form, e.g. "12 मई 2026, मंगलवार".
// Numbers stay in Western Arabic digits per project convention.
export function formatHindiDate(date: Date): string {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const day = ist.getUTCDate();
  const month = HINDI_MONTHS[ist.getUTCMonth()];
  const year = ist.getUTCFullYear();
  return `${day} ${month} ${year}, मंगलवार`;
}

export function formatEnglishDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
    timeZone: "Asia/Kolkata",
  });
}
