// Stage 2, hand-curated banned-term seed list.
//
// IMPORTANT: this file ships a small starter set only. The real, fuller
// list (with leetspeak variants and Lucknow-specific terms) lives outside
// the public repo and is loaded at runtime from MOD_BANNED_TERMS_EXTRA
// (comma-separated). See spec §3 Stage 2.
//
// Categories covered:
//   - generic English profanity (the @2toad/profanity engine handles most;
//     this list adds Hindi and Hinglish coverage that the package misses)
//   - caste slurs (Hindi + Roman)
//   - religious slurs against any community (Hindu, Muslim, Sikh, Christian)
//   - sexual references / explicit terms
//   - communal incitement keywords

const HI_DEVANAGARI: string[] = [
  // Generic Hindi profanity (representative samples, extend privately)
  "गांडू",
  "चूतिया",
  "मादरचोद",
  "बहनचोद",
  "रंडी",
  "हरामी",
  "कुत्ती",
  "साला",
];

const HI_ROMAN: string[] = [
  "gandu",
  "chutiya",
  "chutia",
  "madarchod",
  "behenchod",
  "bhenchod",
  "mc",
  "bc",
  "randi",
  "harami",
  "haramkhor",
  "kutti",
  "saala",
  "saale",
];

// Caste / religious / communal slurs (representative, extend privately).
const SLURS: string[] = [
  // caste (Hindi + Roman)
  "chamar",
  "bhangi",
  "neech-jaat",
  "नीच जात",
  // religious / communal
  "katua",
  "kafir",
  "mulla",
  "hindutvavadi",
  // explicitly communal incitement
  "mulla-bhagao",
  "kafir-mar",
];

const SEXUAL: string[] = [
  "lund",
  "loda",
  "boobs",
  "बूब्स",
  "तेरी माँ",
  "teri ma",
];

const ALL = [...HI_DEVANAGARI, ...HI_ROMAN, ...SLURS, ...SEXUAL];

function loadEnvExtras(): string[] {
  const raw = process.env.MOD_BANNED_TERMS_EXTRA;
  if (!raw) return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function getBannedTerms(): string[] {
  return [...ALL, ...loadEnvExtras()];
}

/**
 * Cheap textual contains check after lower-casing and de-spacing.
 * Catches `f.u.c.k` and `c h u t i y a` too.
 */
export function containsBannedTerm(text: string): { hit: false } | { hit: true; term: string } {
  const lc = text.toLowerCase();
  const collapsed = lc.replace(/[\s.\-_]+/g, "");
  for (const term of getBannedTerms()) {
    const t = term.toLowerCase();
    if (lc.includes(t)) return { hit: true, term };
    if (collapsed.includes(t.replace(/\s+/g, ""))) return { hit: true, term };
  }
  return { hit: false };
}
