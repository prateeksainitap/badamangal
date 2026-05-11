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

// Bada Shanivars of the same Jyeshtha + Adhik Maas window — organizers
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
 * for any other date, so this list is preset-only — not the closed set.
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
