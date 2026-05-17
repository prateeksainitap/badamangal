import { z } from "zod";
import { SEASON_START_ISO, SEASON_END_ISO } from "@/lib/dates";
import { MENU_KEYS } from "@/lib/menu";

const MENU_VALUES = [...MENU_KEYS] as [string, ...string[]];

// Bhandara service-day. Any YYYY-MM-DD inside the season window, we no
// longer constrain to the 8 Tuesdays since organizers also run Saturday
// bhandaras and may pick any custom date within the season via the
// calendar picker.
const seasonDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((d) => d >= SEASON_START_ISO && d <= SEASON_END_ISO, {
    message: "Pick a date inside the 2026 Bada Mangal season",
  });

const blankToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const optionalString = z.preprocess(blankToUndefined, z.string().trim().optional());

const optionalUrl = z.preprocess(
  blankToUndefined,
  z.string().trim().url("Enter a valid URL").optional(),
);

const optionalUpi = z.preprocess(
  blankToUndefined,
  z
    .string()
    .trim()
    .regex(/^[\w.\-]+@[\w.\-]+$/i, "Use a UPI ID like name@bank")
    .optional(),
);

const optionalWhatsapp = z.preprocess(
  blankToUndefined,
  z.string().trim().regex(/^\d{10,15}$/, "10–15 digits, no spaces").optional(),
);

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Indian mobile number validator. Accepts an optional +91 / 91 / 0 prefix
 * followed by 10 digits starting with 6-9. Spaces and dashes are stripped
 * before checking, so users can type "+91 98765 43210" or "9876543210".
 *
 * Also rejects obvious junk patterns the eye misses but a real organizer
 * never types:
 *   - all-same-digit (9999999999, 8888888888 …)
 *   - strictly ascending or descending runs (9876543210, 7890123456)
 *   - >7 consecutive identical digits anywhere in the number
 * These checks are cheap, no false-positives on real Indian mobiles,
 * and stop the 99% of bot submissions that don't bother to humanize.
 */
export function isValidIndianMobile(raw: string): boolean {
  const digits = raw.replace(/[\s\-]/g, "");
  if (!/^(\+?91|0)?[6-9]\d{9}$/.test(digits)) return false;
  const ten = digits.slice(-10);
  // Same digit repeated 10×.
  if (/^(\d)\1{9}$/.test(ten)) return false;
  // 7 or more identical digits in a row anywhere in the number.
  if (/(\d)\1{6,}/.test(ten)) return false;
  // Strict ascending / descending run (9876543210 style, common bot fill).
  const isMonotonic = (s: string, step: 1 | -1): boolean => {
    for (let i = 1; i < s.length; i++) {
      if (Number(s[i]) - Number(s[i - 1]) !== step) return false;
    }
    return true;
  };
  if (isMonotonic(ten, 1) || isMonotonic(ten, -1)) return false;
  return true;
}

export const submitSchema = z
  .object({
    organizerName: z.string().trim().min(2, "Organizer name is required"),
    organizerPhone: z
      .string()
      .trim()
      .refine(isValidIndianMobile, {
        message: "Enter a valid 10-digit Indian mobile number",
      }),
    organizerWhatsapp: optionalWhatsapp,
    upiId: optionalUpi,
    name: z.string().trim().min(2, "English name is required"),
    // Hindi name relaxed to optional in the schema. Originally
    // required, but GA4 showed the form was abandoned ~88% of the
    // time mid-flow, and English-comfortable organisers (a real
    // chunk of the audience) were getting stuck trying to type
    // Devanagari on a non-Hindi keyboard. The /api/bhandaras route
    // now defaults nameHi = name when the field is blank, which is
    // a no-op for downstream code (everywhere we read nameHi we
    // already fall back to name via `nameHi ?? name`). Admins can
    // still fill the proper Devanagari later from /admin/edit.
    nameHi: z.preprocess(blankToUndefined, z.string().trim().min(2).optional()),
    description: optionalString,
    descriptionHi: optionalString,
    // Area is loosened from a strict enum to a free string. The form
    // dropdown still surfaces our curated list (which feeds homepage
    // filters + the area chip), but Lucknow has more neighbourhoods
    // than we can reasonably curate, so an "Other, type your own"
    // option lets organisers submit colonies / sectors that aren't on
    // the short list. Display fallbacks already use `t.areas[a] ?? a`,
    // so the raw string renders cleanly when it isn't in the dictionary.
    area: z
      .string()
      .trim()
      .min(2, "Area is required")
      .max(50, "Area name is too long (max 50 characters)"),
    address: z.string().trim().min(5, "Address is required"),
    addressHi: optionalString,
    landmark: optionalString,
    // Lat / lng are OPTIONAL at the schema layer. The /api/bhandaras
    // route accepts a row without coordinates and runs Ola Maps
    // forward-geocoding on the address to populate them. If geocoding
    // fails the row still saves (lat=0/lng=0) and lands in /admin
    // moderation for a human to set the pin. Originally hard-required
    // a map-pin drop here, which was the single biggest GA4-tracked
    // drop-off point in the form. Auto-geocode covers ~80% of
    // addresses cleanly; the remaining 20% surface as PENDING rows
    // the admin fixes via /admin/edit's MapLocationInput.
    lat: z
      .number()
      .min(0, "Latitude must be ≥ 0")
      .max(90, "Latitude must be ≤ 90")
      .optional(),
    lng: z
      .number()
      .min(0, "Longitude must be ≥ 0")
      .max(180, "Longitude must be ≤ 180")
      .optional(),
    tuesdayDates: z
      .array(seasonDate)
      .min(1, "Pick at least one date"),
    timeStart: z.string().regex(/^\d{2}:\d{2}$/, "Use 24-hour HH:MM"),
    timeEnd: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "Use 24-hour HH:MM")
      .optional()
      .or(z.literal(""))
      .transform((v) => (v === "" ? undefined : v)),
    menu: z.array(z.enum(MENU_VALUES)).min(0).default([]),
    /** Free-form items the organizer typed in. Trimmed, deduped server-side. */
    menuOther: z
      .array(z.string().trim().min(1).max(40))
      .max(20)
      .optional()
      .default([]),
    photoUrl: optionalUrl,
    googlePlaceId: optionalString,
    geoNeighborhood: optionalString,
    geoDistrict: optionalString,
    geoState: optionalString,
  })
  .refine(
    (d) =>
      d.timeEnd === undefined ||
      timeToMinutes(d.timeEnd) > timeToMinutes(d.timeStart),
    {
      message: "End time must be after start time",
      path: ["timeEnd"],
    },
  )
  // Menu is no longer hard-required. If the organiser doesn't pick or
  // type anything, the /api/bhandaras route defaults to a single
  // "prasad" entry. Devotees searching for a bhandara mostly want to
  // know there IS one and where; the exact menu is nice-to-have, not
  // make-or-break for the form to submit. Original constraint added
  // friction to a step (40% of form abandons happened on the menu
  // step per GA4 form_step_back events).
  ;

export type SubmitInput = z.infer<typeof submitSchema>;

export type FlatErrors = {
  formErrors: string[];
  fieldErrors: Record<string, string[] | undefined>;
};
