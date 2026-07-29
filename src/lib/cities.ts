/**
 * City registry, the single source of truth for every city BadaMangal
 * serves.
 *
 * WHY THIS EXISTS
 * Until 2026-07 the whole product was welded to Lucknow: the bounding
 * box (26.6-27.0, 80.7-81.2) was copy-pasted into eleven separate
 * files, `Area` was a TypeScript union of 36 Lucknow-only
 * neighbourhood names, and no table carried a city column. Two
 * concrete consequences, both verified before this refactor:
 *
 *   • Kanpur (26.4499, 80.3319) and Hardoi (27.4166, 80.1318) were
 *     REJECTED as invalid coordinates. A bhandara there could not be
 *     listed, geocoded, or mapped at all.
 *   • Barabanki (26.9254, 81.1862) was worse: its longitude squeaks
 *     under the 81.2 ceiling, so it silently PASSED as Lucknow. Real
 *     Barabanki listings would have been quietly filed under the wrong
 *     city rather than visibly failing, the kind of data rot you only
 *     discover a season later.
 *
 * Everything city-shaped now derives from CITIES below. Adding a fifth
 * city should be a data edit here plus a `CityConfig` row's worth of
 * areas, never a code change in a geo helper or an API route.
 */

export type CitySlug = "lucknow" | "kanpur" | "hardoi" | "barabanki";

export type BoundingBox = {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
};

export type City = {
  slug: CitySlug;
  /** Display name, English. */
  name: string;
  /** Display name, Devanagari. */
  nameHi: string;
  /** District/state context for geocoder query strings + SEO copy. */
  state: string;
  stateHi: string;
  /** Map default centre. */
  center: { lat: number; lng: number };
  /** Default map zoom. Smaller towns get a tighter default than a
   *  sprawling metro, otherwise Hardoi opens on empty farmland. */
  zoom: number;
  /**
   * Coordinate bounds used to validate geocoder output and reject
   * null-island / wrong-city rows before they reach the public map.
   * Deliberately drawn a little generous (peri-urban belts included)
   * because organisers do run bhandaras on the outskirts, but tight
   * enough that neighbouring cities do not overlap ambiguously.
   */
  bbox: BoundingBox;
  /** Curated neighbourhood tags shown in filters + the listing form.
   *  Typed as `readonly Area[]` (not `string[]`) so consumers like
   *  areaSlug.ts keep narrowing to the literal union rather than
   *  degrading to bare strings. */
  areas: readonly Area[];
  /**
   * Is this city publicly live? Non-live cities stay fully configured
   * (so we can seed, test, and geocode against them) but are hidden
   * from the public city switcher until launch. Lets the 2027
   * expansion cities sit in main, dark, until the operator flips them.
   */
  isLive: boolean;
  /** Second language paired with English for this city's UI copy. */
  secondaryLanguage: "hi";
};

/* ── Lucknow ───────────────────────────────────────────────────────── */

const LUCKNOW_AREAS = [
  "Aishbagh",
  "Alambagh",
  "Aliganj",
  "Aminabad",
  "Bakshi Ka Talab",
  "Charbagh",
  "Chinhat",
  "Chowk",
  "Daliganj",
  "Faizullaganj",
  "Gomti Nagar",
  "Gomti Nagar Extension",
  "Hanuman Setu",
  "Hazratganj",
  "IIM Road",
  "Indira Nagar",
  "Jankipuram",
  "Kaiserbagh",
  "Kalyanpur",
  "Kapoorthala",
  "Krishna Nagar",
  "Mahanagar",
  "Mohanlalganj",
  "Munshipulia",
  "Naka Hindola",
  "Nishatganj",
  "Polytechnic",
  "Rajajipuram",
  "Sarojini Nagar",
  "Sitapur Road",
  "Sushant Golf City",
  "Telibagh",
  "University Road",
  "Vibhuti Khand",
  "Vikas Nagar",
  "Vrindavan Yojna",
] as const;

/* ── Kanpur ────────────────────────────────────────────────────────── */

const KANPUR_AREAS = [
  "Arya Nagar",
  "Ashok Nagar",
  "Barra",
  "Birhana Road",
  "Chunniganj",
  "Civil Lines",
  "Fazalganj",
  "Govind Nagar",
  "Gumti No. 5",
  "Harsh Nagar",
  "Jajmau",
  "Kakadeo",
  "Kalyanpur",
  "Kidwai Nagar",
  "Lal Bangla",
  "Nawabganj",
  "Naubasta",
  "Panki",
  "Rawatpur",
  "Sarvodaya Nagar",
  "Shastri Nagar",
  "Shyam Nagar",
  "Swaroop Nagar",
  "Tilak Nagar",
  "Vijay Nagar",
] as const;

/* ── Hardoi ────────────────────────────────────────────────────────── */

const HARDOI_AREAS = [
  "Bilgram",
  "Civil Lines",
  "Court Road",
  "Gandhi Nagar",
  "Lal Bagh",
  "Mallawan",
  "Naya Ganj",
  "Pihani",
  "Railway Road",
  "Sadar Bazar",
  "Sandila",
  "Shahabad",
  "Station Road",
  "Subhash Nagar",
] as const;

/* ── Barabanki ─────────────────────────────────────────────────────── */

const BARABANKI_AREAS = [
  "Banki",
  "Civil Lines",
  "Deva",
  "Fatehpur",
  "Ghosiana",
  "Haidergarh",
  "Masauli",
  "Nawabganj",
  "Obri",
  "Ramnagar",
  "Satrikh",
  "Station Road",
  "Tikaitnagar",
  "Zaidpur",
] as const;

/* ── The registry ──────────────────────────────────────────────────── */

export const CITIES: Record<CitySlug, City> = {
  lucknow: {
    slug: "lucknow",
    name: "Lucknow",
    nameHi: "लखनऊ",
    state: "Uttar Pradesh",
    stateHi: "उत्तर प्रदेश",
    center: { lat: 26.8467, lng: 80.9462 },
    zoom: 12,
    // Historic bounds, kept as-is so no existing row is invalidated by
    // this refactor. Slightly generous on the east (81.2), which is why
    // Barabanki used to leak in, resolveCityFromCoords() below settles
    // that overlap by nearest-centre rather than by tightening this and
    // risking a previously-valid Lucknow row failing validation.
    bbox: { latMin: 26.6, latMax: 27.0, lngMin: 80.7, lngMax: 81.2 },
    areas: LUCKNOW_AREAS,
    isLive: true,
    secondaryLanguage: "hi",
  },
  kanpur: {
    slug: "kanpur",
    name: "Kanpur",
    nameHi: "कानपुर",
    state: "Uttar Pradesh",
    stateHi: "उत्तर प्रदेश",
    center: { lat: 26.4499, lng: 80.3319 },
    zoom: 12,
    bbox: { latMin: 26.32, latMax: 26.58, lngMin: 80.16, lngMax: 80.48 },
    areas: KANPUR_AREAS,
    isLive: false,
    secondaryLanguage: "hi",
  },
  hardoi: {
    slug: "hardoi",
    name: "Hardoi",
    nameHi: "हरदोई",
    state: "Uttar Pradesh",
    stateHi: "उत्तर प्रदेश",
    center: { lat: 27.4166, lng: 80.1318 },
    // Smaller town, a 12 opens on farmland; 13 frames the built-up area.
    zoom: 13,
    bbox: { latMin: 27.28, latMax: 27.55, lngMin: 79.99, lngMax: 80.28 },
    areas: HARDOI_AREAS,
    isLive: false,
    secondaryLanguage: "hi",
  },
  barabanki: {
    slug: "barabanki",
    name: "Barabanki",
    nameHi: "बाराबंकी",
    state: "Uttar Pradesh",
    stateHi: "उत्तर प्रदेश",
    center: { lat: 26.9254, lng: 81.1862 },
    zoom: 13,
    bbox: { latMin: 26.78, latMax: 27.08, lngMin: 81.03, lngMax: 81.36 },
    areas: BARABANKI_AREAS,
    isLive: false,
    secondaryLanguage: "hi",
  },
};

/**
 * Every curated area across every city, as a literal union.
 *
 * Kept as a union rather than widened to `string` on purpose: it still
 * catches typos and still autocompletes, it just no longer means
 * "Lucknow neighbourhood". Note that some names legitimately repeat
 * across cities (both Lucknow and Kanpur have a Kalyanpur; Kanpur,
 * Hardoi and Barabanki all have a Civil Lines), which is exactly why
 * an area tag alone can never identify a city, use the `city` column.
 */
export type Area =
  | (typeof LUCKNOW_AREAS)[number]
  | (typeof KANPUR_AREAS)[number]
  | (typeof HARDOI_AREAS)[number]
  | (typeof BARABANKI_AREAS)[number];

/** Every area name across all cities, deduped + alphabetical. */
export const ALL_AREAS: readonly Area[] = Array.from(
  new Set<Area>([
    ...LUCKNOW_AREAS,
    ...KANPUR_AREAS,
    ...HARDOI_AREAS,
    ...BARABANKI_AREAS,
  ]),
).sort() as Area[];

/** Every city, registry order (Lucknow first, it is the flagship). */
export const ALL_CITIES: readonly City[] = Object.values(CITIES);

/** Only the cities currently exposed to the public. */
export const LIVE_CITIES: readonly City[] = ALL_CITIES.filter((c) => c.isLive);

export const DEFAULT_CITY_SLUG: CitySlug = "lucknow";
export const DEFAULT_CITY: City = CITIES[DEFAULT_CITY_SLUG];

/* ── Lookups ───────────────────────────────────────────────────────── */

export function isCitySlug(value: unknown): value is CitySlug {
  return typeof value === "string" && value in CITIES;
}

/**
 * Resolve a slug to a City, falling back to Lucknow. Use everywhere a
 * city arrives from an untrusted edge (URL param, cookie, DB column on
 * a legacy row) so a bad value degrades to the flagship city instead
 * of throwing.
 */
export function getCity(slug: string | null | undefined): City {
  return isCitySlug(slug) ? CITIES[slug] : DEFAULT_CITY;
}

export function cityName(slug: string | null | undefined, isHi: boolean): string {
  const c = getCity(slug);
  return isHi ? c.nameHi : c.name;
}

/* ── Geo ───────────────────────────────────────────────────────────── */

export function isInBbox(
  lat: number,
  lng: number,
  bbox: BoundingBox,
): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= bbox.latMin &&
    lat <= bbox.latMax &&
    lng >= bbox.lngMin &&
    lng <= bbox.lngMax
  );
}

/** Are these coords inside the given city's bounds? */
export function isInCity(lat: number, lng: number, city: City): boolean {
  return isInBbox(lat, lng, city.bbox);
}

/**
 * Are these coords inside ANY city we serve? This is the replacement
 * for the eleven copy-pasted Lucknow bbox checks: a coordinate is
 * valid if it belongs to some city on the registry, not specifically
 * to Lucknow.
 */
export function isInAnyCity(lat: number, lng: number): boolean {
  return ALL_CITIES.some((c) => isInCity(lat, lng, c));
}

/** Cheap equirectangular distance in km. Good enough for picking the
 *  nearer of two city centres a few dozen km apart; we do not need
 *  great-circle precision here. */
function approxKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const latMid = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const dx = (a.lng - b.lng) * Math.cos(latMid) * 111.32;
  const dy = (a.lat - b.lat) * 110.57;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Which city do these coordinates belong to?
 *
 * Bounding boxes can legitimately overlap (Lucknow's generous eastern
 * edge reaches into Barabanki's western edge), so containment alone is
 * ambiguous. We take every city whose box contains the point and pick
 * the one whose CENTRE is nearest, which is the intuitively correct
 * answer for a point in the overlap strip and is stable regardless of
 * registry order. Returns null when the point is in no city at all, so
 * callers can decide between rejecting and holding for review rather
 * than being handed a wrong-but-plausible city.
 */
export function resolveCityFromCoords(
  lat: number,
  lng: number,
): City | null {
  const candidates = ALL_CITIES.filter((c) => isInCity(lat, lng, c));
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  return candidates.reduce((best, c) =>
    approxKm({ lat, lng }, c.center) < approxKm({ lat, lng }, best.center)
      ? c
      : best,
  );
}

/**
 * Suffix appended to a free-text address before sending it to a
 * forward-geocoder. Previously hardcoded as " Lucknow"; now derives
 * from the city so a Kanpur address is not resolved against Lucknow
 * streets (both cities have a Civil Lines and a Kalyanpur, so this is
 * a real correctness issue, not a cosmetic one).
 */
export function geocodeSuffix(city: City): string {
  return `, ${city.name}, ${city.state}, India`;
}

/** Curated areas for a city, alphabetical. */
export function areasFor(slug: string | null | undefined): readonly Area[] {
  return getCity(slug).areas;
}

/**
 * Does this area tag belong to this city? Used to stop a Lucknow area
 * being saved against a Kanpur listing. Case-insensitive because area
 * strings arrive from Gemini extraction as often as from a <select>.
 */
export function isAreaOfCity(area: string, city: City): boolean {
  const needle = area.trim().toLowerCase();
  return city.areas.some((a) => a.toLowerCase() === needle);
}
