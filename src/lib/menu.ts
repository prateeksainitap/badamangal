// Menu options shown in the organizer form. Add to this list to expose more
// items; the form picks them up automatically and the server stores the
// English key while persisting the Devanagari label as `menuHi`.
export const MENU_ITEMS = [
  { en: "puri",     hi: "पूड़ी" },
  { en: "sabzi",    hi: "सब्ज़ी" },
  { en: "halwa",    hi: "हलवा" },
  { en: "sharbat",  hi: "शरबत" },
  { en: "water",    hi: "पानी" },
  { en: "fruit",    hi: "फल" },
  { en: "prasad",   hi: "प्रसाद" },
] as const;

export type MenuKey = (typeof MENU_ITEMS)[number]["en"];

export const MENU_KEYS: readonly MenuKey[] = MENU_ITEMS.map((m) => m.en);

export function menuHiFor(keys: readonly string[]): string[] {
  return keys.map((k) => MENU_ITEMS.find((m) => m.en === k)?.hi ?? k);
}
