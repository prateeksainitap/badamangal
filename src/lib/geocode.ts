/**
 * Thin wrappers around the Ola Maps REST APIs we use from the browser:
 *   - Autocomplete  → address-bar suggestions
 *   - Reverse Geocode → coords → human-readable area name
 *
 * Both functions are debounced + cached so a user hammering keys in the
 * address bar doesn't drain the wallet. The cache is an in-memory Map
 * keyed by the normalised query / coordinates; it lives for the page
 * session and is cleared on page navigation.
 *
 * If the API ever 4xxs or 5xxs (quota exhausted, network failure, etc.),
 * these helpers return `null` / `[]` so the caller can degrade
 * gracefully instead of breaking the form.
 */

"use client";

import { OLA_API_KEY } from "@/lib/olaMaps";

const AUTOCOMPLETE_URL = "https://api.olamaps.io/places/v1/autocomplete";
const REVERSE_URL = "https://api.olamaps.io/places/v1/reverse-geocode";

// Lucknow bounding box — biases autosuggest results to the city.
// Same box the previous Nominatim queries used, so search relevance is
// at least as good as before.
const LUCKNOW_BBOX = {
  latMin: 26.6,
  latMax: 27.0,
  lngMin: 80.7,
  lngMax: 81.2,
};
const LUCKNOW_CENTER = { lat: 26.8467, lng: 80.9462 };

// Cap how many cached entries we hold in memory. 200 covers a typical
// session's worth of unique searches without ballooning memory if a bot
// or test loop hammers the SDK.
const MAX_CACHE = 200;

export type AutocompleteHit = {
  /** Stable id for React keys; Ola returns place_id. */
  id: string;
  /** Primary display label (e.g. "Aliganj Police Chowki, Lucknow"). */
  label: string;
  /** Secondary description if available. */
  secondary?: string;
  lat: number;
  lng: number;
};

const autocompleteCache = new Map<string, AutocompleteHit[]>();
const reverseCache = new Map<string, string | null>();

function normaliseQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

function trimCache<K, V>(cache: Map<K, V>): void {
  if (cache.size <= MAX_CACHE) return;
  // Drop the oldest ~25% so we don't trim on every insert.
  const toDelete = Math.ceil(MAX_CACHE * 0.25);
  let i = 0;
  for (const key of cache.keys()) {
    cache.delete(key);
    if (++i >= toDelete) break;
  }
}

/**
 * Free-text place autocomplete. Returns up to 5 suggestions biased to
 * Lucknow. Empty/short inputs return `[]` without hitting the network.
 *
 * Caller is responsible for debouncing the user's keystrokes; we do
 * cache identical queries so a fast typer doesn't blow through quota.
 */
export async function olaAutocomplete(
  query: string,
  opts?: { signal?: AbortSignal },
): Promise<AutocompleteHit[]> {
  const q = normaliseQuery(query);
  if (q.length < 2) return [];
  if (!OLA_API_KEY) return [];

  const cached = autocompleteCache.get(q);
  if (cached) return cached;

  const params = new URLSearchParams({
    input: q,
    api_key: OLA_API_KEY,
    location: `${LUCKNOW_CENTER.lat},${LUCKNOW_CENTER.lng}`,
    radius: "15000", // 15 km — covers the whole Lucknow built-up area
  });
  const url = `${AUTOCOMPLETE_URL}?${params.toString()}`;

  try {
    const res = await fetch(url, { signal: opts?.signal });
    if (!res.ok) return [];
    type Prediction = {
      place_id?: string;
      description?: string;
      structured_formatting?: {
        main_text?: string;
        secondary_text?: string;
      };
      geometry?: {
        location?: { lat?: number; lng?: number };
      };
    };
    const data = (await res.json()) as { predictions?: Prediction[] };
    // Dedupe by label+secondary signature so we don't render the same
    // "Tiwari Chauraha" three times in a row when Ola returns multiple
    // place_ids with identical descriptions.
    const seen = new Set<string>();
    const hits: AutocompleteHit[] = (data.predictions ?? [])
      .map((p, i): AutocompleteHit | null => {
        const lat = p.geometry?.location?.lat;
        const lng = p.geometry?.location?.lng;
        if (typeof lat !== "number" || typeof lng !== "number") return null;

        // Ola's response shape is inconsistent — sometimes
        // structured_formatting carries both main+secondary, sometimes
        // only main, sometimes only `description`. Walk through every
        // shape so the user always sees the most useful pair.
        const mainRaw = p.structured_formatting?.main_text?.trim();
        const secondaryRaw = p.structured_formatting?.secondary_text?.trim();
        const descRaw = p.description?.trim();

        let label: string;
        let secondary: string | undefined;
        if (mainRaw) {
          label = mainRaw;
          if (secondaryRaw) {
            secondary = secondaryRaw;
          } else if (descRaw && descRaw !== mainRaw) {
            // Description usually reads "Main, Area, City" — strip the
            // leading `main, ` so the secondary line is just the rest.
            const trimmed = descRaw.replace(
              new RegExp(`^${escapeRegex(mainRaw)}\\s*,?\\s*`, "i"),
              "",
            );
            secondary = trimmed && trimmed !== descRaw ? trimmed : descRaw;
          }
        } else if (descRaw) {
          // No structured fields at all → split the description on
          // commas: first chunk becomes the primary label, the rest
          // becomes the secondary line.
          const parts = descRaw.split(",").map((s) => s.trim()).filter(Boolean);
          label = parts[0] ?? descRaw;
          secondary = parts.slice(1).join(", ") || undefined;
        } else {
          label = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }

        const dedupeKey = `${label.toLowerCase()}|${secondary?.toLowerCase() ?? ""}`;
        if (seen.has(dedupeKey)) return null;
        seen.add(dedupeKey);

        return {
          id: p.place_id ?? `${i}-${lat},${lng}`,
          label,
          secondary,
          lat,
          lng,
        };
      })
      .filter((h): h is AutocompleteHit => h !== null);

    autocompleteCache.set(q, hits);
    trimCache(autocompleteCache);
    return hits;
  } catch {
    // Network error, abort, parse failure — degrade silently.
    return [];
  }
}

export type ReverseGeocodeResult = {
  /** Full formatted address ("Sec 23, Aliganj, Lucknow, UP 226024, India"). */
  formatted: string;
  /** Best-effort short locality name for the "near …" chip. */
  area: string | null;
  geoNeighborhood?: string;
  geoDistrict?: string;
  geoState?: string;
};

/**
 * Coordinates → human-readable place name. Returns `null` if the API
 * fails or returns no results — callers always fall back to the raw
 * coordinate string in that case.
 */
export async function olaReverseGeocode(
  lat: number,
  lng: number,
  opts?: { signal?: AbortSignal },
): Promise<ReverseGeocodeResult | null> {
  if (!OLA_API_KEY) return null;
  // Cache key rounded to ~10m so tiny pin nudges don't re-fire the API.
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = reverseCache.get(key);
  if (cached !== undefined) {
    return cached
      ? { formatted: cached, area: extractAreaFromFormatted(cached) }
      : null;
  }

  const params = new URLSearchParams({
    latlng: `${lat},${lng}`,
    api_key: OLA_API_KEY,
  });
  const url = `${REVERSE_URL}?${params.toString()}`;

  try {
    const res = await fetch(url, { signal: opts?.signal });
    if (!res.ok) {
      reverseCache.set(key, null);
      trimCache(reverseCache);
      return null;
    }
    type Component = { types?: string[]; long_name?: string; short_name?: string };
    type ResultEntry = {
      formatted_address?: string;
      address_components?: Component[];
    };
    const data = (await res.json()) as { results?: ResultEntry[] };
    const first = data.results?.[0];
    if (!first) {
      reverseCache.set(key, null);
      trimCache(reverseCache);
      return null;
    }

    const formatted =
      first.formatted_address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    // Pluck the most useful named components for our "near …" + geo
    // fields. Ola follows Google-style address_components, so the
    // `types` arrays mirror Google's vocabulary.
    const components = first.address_components ?? [];
    const byType = (...types: string[]): string | undefined => {
      for (const t of types) {
        const hit = components.find((c) => c.types?.includes(t));
        if (hit?.long_name) return hit.long_name;
      }
      return undefined;
    };

    const geoNeighborhood = byType("sublocality_level_1", "sublocality", "neighborhood");
    const geoDistrict = byType("locality", "administrative_area_level_2");
    const geoState = byType("administrative_area_level_1");
    const area =
      geoNeighborhood ?? geoDistrict ?? extractAreaFromFormatted(formatted);

    reverseCache.set(key, formatted);
    trimCache(reverseCache);
    return { formatted, area, geoNeighborhood, geoDistrict, geoState };
  } catch {
    reverseCache.set(key, null);
    trimCache(reverseCache);
    return null;
  }
}

/** Escape a string for safe use inside a `new RegExp(...)` literal. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Fallback: pull the first segment of a comma-separated address as the area. */
function extractAreaFromFormatted(formatted: string): string | null {
  const parts = formatted.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  // First segment is often a building/road; second is usually the
  // neighbourhood, which is what we want.
  return parts[1] ?? parts[0];
}

/** Bbox check — used to flag pins dropped outside Lucknow. */
export function isInLucknow(lat: number, lng: number): boolean {
  return (
    lat >= LUCKNOW_BBOX.latMin &&
    lat <= LUCKNOW_BBOX.latMax &&
    lng >= LUCKNOW_BBOX.lngMin &&
    lng <= LUCKNOW_BBOX.lngMax
  );
}
