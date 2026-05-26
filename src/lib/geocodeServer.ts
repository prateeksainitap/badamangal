/**
 * Server-side Ola Maps geocoder. Same pattern as the one-off scripts
 * in /prisma/geocode-*.ts, geocode endpoint first, autocomplete
 * fallback, Lucknow bounding-box filter so we never return
 * wrong-city hits.
 *
 * Key separation (Code-P1-12 resolved 22 May):
 *   The browser-side helper uses NEXT_PUBLIC_OLA_MAPS_API_KEY which
 *   has an HTTP-referrer allowlist (badamangal.com, etc.). Browsers
 *   send a Referer header so the allowlist check passes naturally.
 *
 *   This module uses a SEPARATE key, OLA_MAPS_SERVER_KEY, that has
 *   NO referrer restrictions on the Ola dashboard. Vercel functions
 *   don't have a real Referer to send, so any restricted key would
 *   reject every server call. Previously we spoofed `Referer:
 *   http://localhost:3030` on every server call, a fragile lie
 *   that worked only as long as Ola's allowlist accepted spoofed
 *   origins. With the separate-key model, the spoof is gone and
 *   the public key's allowlist can be tightened to only the
 *   production origin.
 *
 *   OLA_MAPS_SERVER_KEY must be marked Sensitive on Vercel (server-
 *   only, never NEXT_PUBLIC_). Keep the referrer allowlist EMPTY on
 *   that key's dashboard settings.
 */

const LKO_BBOX = {
  latMin: 26.6,
  latMax: 27.0,
  lngMin: 80.7,
  lngMax: 81.2,
};
import { AREAS } from "@/lib/lucknow";

const LKO_CENTER = { lat: 26.8467, lng: 80.9462 };

/** Lowercased lookup of the curated Lucknow area list, used to bias
 *  reverse-geocode toward recognizable neighbourhood names over OSM's
 *  generic residential labels ("Sector 4" → prefer "Aliganj" if the
 *  same response has both). */
const KNOWN_AREAS_LC = new Set<string>(AREAS.map((a) => a.toLowerCase()));
/** Substring check too: "Jankipuram Extension" should match the
 *  curated "Jankipuram", and the chatter card shows "Jankipuram" as a
 *  cleaner label than the verbose extension name. */
function matchesKnownArea(s: string): string | null {
  const lc = s.trim().toLowerCase();
  if (KNOWN_AREAS_LC.has(lc)) return s.trim();
  for (const a of AREAS) {
    const al = a.toLowerCase();
    if (lc.includes(al) || al.includes(lc)) return a;
  }
  return null;
}

function inLucknow(lat: number, lng: number): boolean {
  return (
    lat >= LKO_BBOX.latMin &&
    lat <= LKO_BBOX.latMax &&
    lng >= LKO_BBOX.lngMin &&
    lng <= LKO_BBOX.lngMax
  );
}

export type ServerGeocodeHit = {
  lat: number;
  lng: number;
  matched: string;
  source: "geocode" | "autocomplete";
};

export async function geocodeLucknow(
  address: string,
): Promise<ServerGeocodeHit | null> {
  // Prefer the dedicated server key. Fall back to the public key
  // (with the legacy spoof, which only works if `localhost:3030`
  // is still on the public key's allowlist) so dev environments
  // without OLA_MAPS_SERVER_KEY set continue to function. Once
  // every environment has the server key set, the fallback path
  // can be deleted and the public-key import dropped.
  const serverKey = process.env.OLA_MAPS_SERVER_KEY ?? "";
  const publicKey = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY ?? "";
  const key = serverKey || publicKey;
  if (!key) return null;
  // Only send the spoofed Referer when we're falling back to the
  // public key (which requires the allowlist match). The dedicated
  // server key works without any Referer.
  const headers: Record<string, string> | undefined = serverKey
    ? undefined
    : {
        Origin: "http://localhost:3030",
        Referer: "http://localhost:3030/",
      };

  // ── 1) Geocode API ───────────────────────────────────────────────
  try {
    const u = new URL("https://api.olamaps.io/places/v1/geocode");
    u.searchParams.set("address", address);
    u.searchParams.set("api_key", key);
    u.searchParams.set("language", "English");
    // 5s timeout, if Ola hangs the caller's Vercel function (10s
    // default) would burn its budget waiting. Better to fail fast and
    // fall back to the no-coords path than to 504 the caller.
    const res = await fetch(u.toString(), {
      ...(headers ? { headers } : {}),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      type Resp = {
        geocodingResults?: Array<{
          formatted_address?: string;
          geometry?: { location?: { lat?: number; lng?: number } };
        }>;
      };
      const data = (await res.json()) as Resp;
      for (const r of data.geocodingResults ?? []) {
        const lat = r.geometry?.location?.lat;
        const lng = r.geometry?.location?.lng;
        if (
          typeof lat === "number" &&
          typeof lng === "number" &&
          inLucknow(lat, lng)
        ) {
          return {
            lat,
            lng,
            matched: r.formatted_address ?? address,
            source: "geocode",
          };
        }
      }
    }
  } catch (err) {
    console.warn("server geocode error:", err);
  }

  // ── 2) Autocomplete fallback ─────────────────────────────────────
  try {
    const u = new URL("https://api.olamaps.io/places/v1/autocomplete");
    u.searchParams.set("input", address);
    u.searchParams.set("api_key", key);
    u.searchParams.set("location", `${LKO_CENTER.lat},${LKO_CENTER.lng}`);
    u.searchParams.set("radius", "15000");
    // 5s timeout (see Ola geocode call above for rationale).
    const res = await fetch(u.toString(), {
      ...(headers ? { headers } : {}),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      type Resp = {
        predictions?: Array<{
          description?: string;
          structured_formatting?: { main_text?: string };
          geometry?: { location?: { lat?: number; lng?: number } };
        }>;
      };
      const data = (await res.json()) as Resp;
      for (const p of data.predictions ?? []) {
        const lat = p.geometry?.location?.lat;
        const lng = p.geometry?.location?.lng;
        if (
          typeof lat === "number" &&
          typeof lng === "number" &&
          inLucknow(lat, lng)
        ) {
          return {
            lat,
            lng,
            matched:
              p.structured_formatting?.main_text ?? p.description ?? address,
            source: "autocomplete",
          };
        }
      }
    }
  } catch (err) {
    console.warn("server autocomplete error:", err);
  }
  return null;
}

export type ReverseGeocodeHit = {
  /** Best human-friendly area label, e.g. "Aliganj", "Hazratganj". Used
   *  as the area pill on the homepage chatter card + the heatmap cell
   *  tooltip. ≤ 60 chars; trimmed if Ola Maps returns something longer. */
  label: string;
  /** The full address Ola Maps formatted, kept for the admin moderation
   *  queue where the operator may want to see the exact pin context
   *  before approving. */
  formattedAddress: string;
};

/**
 * Reverse geocode a Lucknow lat/lng to a human-friendly area label.
 *
 * Used by /api/bot/message when a WhatsApp Location share lands with
 * no caption, the raw "Location shared: 26.87, 80.92" text is unhelpful
 * on the public feed, so we ask Ola Maps "what neighbourhood is this?"
 * and set `locationLabel` from the answer. Falls back to null silently
 * on any failure (the mention still gets created, just without a
 * pretty label).
 *
 * Why a separate function from geocodeLucknow:
 *   • Different endpoint (reverse-geocode vs geocode/autocomplete)
 *   • Different output shape (we want an area label, not coords)
 *   • Different failure handling (forward-geocode failure means
 *     "no coords"; reverse-geocode failure means "no label", both
 *     are fine, neither blocks the mention insert)
 *
 * Key separation: same OLA_MAPS_SERVER_KEY / NEXT_PUBLIC fallback +
 * spoofed-Referer logic as geocodeLucknow above (kept symmetric so the
 * key-rotation story is one knob, not two).
 */
export async function reverseGeocodeLucknow(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeHit | null> {
  // Try Nominatim FIRST. Ola Maps' reverse-geocode endpoint is
  // unreliable (during testing it returned consistent `zero_results`
  // for known-good Lucknow coords, even though forward geocode worked
  //, likely a per-day quota on that specific endpoint that we hit
  // quickly). Nominatim is free, key-less, and returned the right
  // suburb name ("Hazratganj") on the same coords Ola couldn't
  // resolve. Etiquette: 1 req/sec ceiling, a real User-Agent, and
  // we cache results in-process so repeat shares of the same pin
  // don't re-hit the API. Both are easy at our volume (a few hundred
  // bot messages/day at peak).
  const nominatim = await reverseGeocodeNominatim(lat, lng);
  if (nominatim) return nominatim;

  // ── Ola Maps fallback ───────────────────────────────────────────
  // Kept so we have two-provider resilience. If Nominatim is rate
  // limited / down / network-partitioned, Ola at least gets a chance.
  // If/when Ola fixes the reverse-geocode quota issue, this fallback
  // becomes the actual workhorse and Nominatim drops to backup.
  const serverKey = process.env.OLA_MAPS_SERVER_KEY ?? "";
  const publicKey = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY ?? "";
  const key = serverKey || publicKey;
  if (!key) return null;
  const headers: Record<string, string> | undefined = serverKey
    ? undefined
    : {
        Origin: "http://localhost:3030",
        Referer: "http://localhost:3030/",
      };

  try {
    // CRITICAL: do NOT use URL.searchParams for the `latlng` param.
    // URLSearchParams URL-encodes the comma between lat and lng to
    // `%2C`, and Ola Maps' reverse-geocode endpoint treats the
    // encoded form as a malformed coord pair, it silently returns
    // `zero_results` with HTTP 404 instead of a useful response.
    const url =
      `https://api.olamaps.io/places/v1/reverse-geocode` +
      `?latlng=${lat},${lng}` +
      `&api_key=${encodeURIComponent(key)}` +
      `&language=English`;
    // 5s timeout (see forward-geocode call above for rationale).
    const res = await fetch(url, {
      ...(headers ? { headers } : {}),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    type Comp = {
      short_name?: string;
      long_name?: string;
      types?: string[];
    };
    type Resp = {
      results?: Array<{
        formatted_address?: string;
        address_components?: Comp[];
      }>;
    };
    const data = (await res.json()) as Resp;
    const first = data.results?.[0];
    if (!first) return null;

    const components = first.address_components ?? [];
    const formatted = first.formatted_address ?? "";
    const findByType = (type: string): string | undefined => {
      const c = components.find((x) => x.types?.includes(type));
      return c?.short_name || c?.long_name;
    };
    const label = (
      findByType("sublocality_level_1") ||
      findByType("sublocality") ||
      findByType("neighborhood") ||
      findByType("sublocality_level_2") ||
      (formatted.split(",")[0] || "").trim() ||
      ""
    ).trim();
    if (!label) return null;
    return {
      label: label.slice(0, 60),
      formattedAddress: formatted,
    };
  } catch (err) {
    console.warn("server reverse-geocode error (ola):", err);
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────
// Nominatim (OpenStreetMap) reverse-geocode
// ────────────────────────────────────────────────────────────────────
//
// Free + no API key, etiquette-bound to 1 req/sec + a real User-Agent.
// Returns OSM's `address` object which has well-defined keys:
//   suburb, neighbourhood, city_district, city, …
// For our use case the suburb is exactly the "Aliganj"/"Hazratganj"
// label we want on the homepage card.
//
// In-process cache keyed on rounded lat/lng (~110m grid) so multiple
// shares in the same cell don't re-hit the API. Cache is bounded by
// LRU-style trim to avoid memory growth across a long-running dev
// session.

type CacheEntry = { ts: number; hit: ReverseGeocodeHit | null };
const nominatimCache = new Map<string, CacheEntry>();
const NOMINATIM_CACHE_MAX = 500;
const NOMINATIM_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
// Rate-limit shim: track last request time, await the difference if
// we're <1s behind. Per-process; multiple Next.js dev rebuilds reset
// it, which is fine, Nominatim's policy is per-server-pair anyway.
let nominatimLastReqAt = 0;
const NOMINATIM_MIN_INTERVAL_MS = 1100;

function nominatimCacheKey(lat: number, lng: number): string {
  // ~3 decimal places ≈ 110m grid. Sufficient for "what neighbourhood
  // is this in", adjacent pins inside the same neighbourhood share
  // the same suburb anyway.
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

async function reverseGeocodeNominatim(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeHit | null> {
  const key = nominatimCacheKey(lat, lng);
  const cached = nominatimCache.get(key);
  if (cached && Date.now() - cached.ts < NOMINATIM_CACHE_TTL_MS) {
    return cached.hit;
  }

  // Multi-zoom strategy with a preference for KNOWN curated areas:
  //
  //   • zoom 16 (block-level) → usually returns the most specific
  //     name. For dense areas this is the curated suburb ("Hazratganj");
  //     for sparser outer Lucknow it's a generic "Sector 4".
  //   • zoom 14 (ward-level) → OSM rolls up to the parent suburb
  //     ("Aliganj"), which is often a curated name.
  //   • zoom 13 (district-level) → final fallback.
  //
  // We walk zoom 16 → 14 → 13 and stop as soon as we get a hit that
  // matches the curated AREAS list. If no zoom yields a known area,
  // we fall back to the most-specific useful label across the zooms
  // (typically zoom 16's residential). That's why the inner attempt
  // returns BOTH classifications instead of just the first useful
  // label, the outer loop arbitrates.
  let knownAreaHit: ReverseGeocodeHit | null = null;
  let anyUsefulHit: ReverseGeocodeHit | null = null;
  for (const zoom of [16, 14, 13] as const) {
    // OSM etiquette throttle, shared across the chain.
    const sinceLast = Date.now() - nominatimLastReqAt;
    if (sinceLast < NOMINATIM_MIN_INTERVAL_MS) {
      await new Promise((r) =>
        setTimeout(r, NOMINATIM_MIN_INTERVAL_MS - sinceLast),
      );
    }
    nominatimLastReqAt = Date.now();
    const result = await nominatimAttemptAtZoom(lat, lng, zoom);
    if (!result) continue;
    if (result.knownArea && !knownAreaHit) {
      knownAreaHit = result.knownArea;
      break; // best possible label found; no point checking broader zooms
    }
    if (result.anyUseful && !anyUsefulHit) {
      anyUsefulHit = result.anyUseful;
    }
  }
  const finalHit = knownAreaHit ?? anyUsefulHit;
  // LRU-trim + cache (including the null case so a sparse-OSM pin
  // doesn't re-query every poll).
  if (nominatimCache.size >= NOMINATIM_CACHE_MAX) {
    const oldest = nominatimCache.keys().next().value;
    if (oldest) nominatimCache.delete(oldest);
  }
  nominatimCache.set(key, { ts: Date.now(), hit: finalHit });
  return finalHit;
}

/** One Nominatim call at a specific zoom level. Returns two
 *  classifications so the multi-zoom outer loop can arbitrate:
 *
 *    • `knownArea`  → a hit whose label matches the curated AREAS
 *      list (exact OR substring). The outer loop accepts this and
 *      stops walking zoom levels.
 *    • `anyUseful`  → a hit whose label is non-generic but doesn't
 *      match a curated area. The outer loop saves this and keeps
 *      walking, if a deeper zoom yields a `knownArea`, that wins.
 *      Otherwise the saved `anyUseful` is the final answer.
 *
 *  Returns null on HTTP errors, parse failures, or all-generic
 *  responses. Does NOT throttle; the caller is expected to space
 *  requests per OSM etiquette. */
async function nominatimAttemptAtZoom(
  lat: number,
  lng: number,
  zoom: number,
): Promise<{ knownArea: ReverseGeocodeHit | null; anyUseful: ReverseGeocodeHit | null } | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?lat=${lat}&lon=${lng}` +
      `&format=json` +
      `&zoom=${zoom}&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "BadaMangal/1.0 (https://badamangal.com)",
        Accept: "application/json",
      },
      // 5s timeout, Nominatim's public endpoint can be slow under
      // load. Falling through to the no-area-label path is fine.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    type Resp = {
      address?: {
        suburb?: string;
        neighbourhood?: string;
        city_district?: string;
        residential?: string;
        quarter?: string;
        city?: string;
        town?: string;
      };
      display_name?: string;
    };
    const data = (await res.json()) as Resp;
    const a = data.address ?? {};
    // Prefer the most specific name. suburb is exactly "Aliganj" /
    // "Hazratganj" grade for most Lucknow pins. BUT some addresses
    // (markets without a registered neighbourhood, outskirts pins)
    // return `suburb: "Lucknow"`, the city name itself, useless on
    // a Lucknow-only site. We blocklist those generic labels and
    // fall through to the next more-specific candidate, ending with
    // display_name's first chunk which is usually the place name
    // ("Tiwari Market", "Patrakar Puram", etc).
    const GENERIC_BLOCKLIST = new Set([
      "lucknow",
      "uttar pradesh",
      "india",
      "sadar",
      "north",
      "south",
      "east",
      "west",
    ]);
    const isUsefulLabel = (s: string | undefined | null): s is string => {
      if (!s) return false;
      const t = s.trim();
      if (!t) return false;
      // Skip pure-numeric chunks. Indian postal codes are 6 digits;
      // building-number chunks are 1-4 digits. None of them are a
      // useful area label on a homepage chatter card. Without this,
      // a Jankipuram Extension share whose display_name starts with
      // "12, Sector G, Jankipuram Extension, …, 226026, India" ends
      // up labelled "12" or, after the address fields are empty
      // walks to "226026" and surfaces that as the "area".
      if (/^\d+$/.test(t)) return false;
      // Skip building-letter-number patterns like "A-12", "B/26",
      // "C 34" that some Lucknow display_names lead with. Same
      // reasoning as above, they're not area names. The regex is
      // loose on purpose (any letter, any separator, any digits)
      // so we don't have to enumerate every building schema.
      if (/^[A-Z]{1,3}[\s\-/]\d+$/i.test(t)) return false;
      return !GENERIC_BLOCKLIST.has(t.toLowerCase());
    };
    const candidates: (string | undefined)[] = [
      a.suburb,
      a.neighbourhood,
      a.city_district,
      a.quarter,
      a.residential,
      // First non-generic chunk of display_name. Splits on comma,
      // walks through them, picks the first that isn't on the
      // blocklist. Catches cases where ALL the address fields said
      // "Lucknow" but the display_name starts with the place name.
      ...(data.display_name?.split(",").map((s) => s.trim()) ?? []),
    ];

    // Walk candidates once, classify into known-area vs any-useful.
    // The outer multi-zoom loop reads both fields and arbitrates.
    let knownArea: ReverseGeocodeHit | null = null;
    let anyUseful: ReverseGeocodeHit | null = null;
    for (const c of candidates) {
      if (!c || !isUsefulLabel(c)) continue;
      if (!anyUseful) {
        anyUseful = {
          label: c.trim().slice(0, 60),
          formattedAddress: data.display_name?.slice(0, 300) ?? c.trim(),
        };
      }
      if (!knownArea) {
        const known = matchesKnownArea(c);
        if (known) {
          knownArea = {
            label: known.slice(0, 60),
            formattedAddress: data.display_name?.slice(0, 300) ?? known,
          };
        }
      }
      // Stop scanning once we have both classifications, no zoom
      // call would benefit from walking further candidates here.
      if (knownArea && anyUseful) break;
    }
    if (!knownArea && !anyUseful) return null;
    return { knownArea, anyUseful };
  } catch (err) {
    console.warn("server reverse-geocode error (nominatim):", err);
    return null;
  }
}
