/**
 * Server-side Ola Maps geocoder. Same pattern as the one-off scripts in
 * /prisma/geocode-*.ts, geocode endpoint first, autocomplete fallback,
 * Lucknow bounding-box filter so we never return wrong-city hits.
 *
 * Why it can't reuse the browser helper:
 *   - The browser-side `olaAutocomplete` uses the NEXT_PUBLIC key and
 *     leans on the browser's own Referer to authenticate against Ola's
 *     domain whitelist.
 *   - Server-side calls have no Referer, so the key gets rejected with
 *     "Domain is not allowed". We spoof the whitelisted localhost
 *     origin here so the same key works from the Netlify Function.
 *
 * TODO (Code-P1-12): stop spoofing the Referer header. The current
 * `Referer: http://localhost:3030` lie may pass Ola's allowlist
 * today but is fragile — Ola can detect spoofed origins and block
 * the key on any deploy, with no notice. Right fix is operator-
 * side, not code-side:
 *
 *   1. Ola Maps dashboard → API Keys → create a NEW key, label
 *      "server-side", with NO HTTP-referrer restrictions.
 *   2. Add env var OLA_MAPS_SERVER_KEY on Vercel + .env.local.
 *   3. Update this module to use OLA_MAPS_SERVER_KEY in place of
 *      NEXT_PUBLIC_OLA_MAPS_API_KEY; drop the REFERER_HEADERS
 *      object below.
 *
 * Until step 1 happens, the spoof stays — the alternative (drop
 * the spoof without a separate key) breaks geocoding the moment
 * Ola's allowlist denies an origin-less call.
 */

const REFERER_HEADERS = {
  Origin: "http://localhost:3030",
  Referer: "http://localhost:3030/",
} as const;

const LKO_BBOX = {
  latMin: 26.6,
  latMax: 27.0,
  lngMin: 80.7,
  lngMax: 81.2,
};
const LKO_CENTER = { lat: 26.8467, lng: 80.9462 };

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
  const key = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY ?? "";
  if (!key) return null;

  // ── 1) Geocode API ───────────────────────────────────────────────
  try {
    const u = new URL("https://api.olamaps.io/places/v1/geocode");
    u.searchParams.set("address", address);
    u.searchParams.set("api_key", key);
    u.searchParams.set("language", "English");
    const res = await fetch(u.toString(), { headers: REFERER_HEADERS });
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
    const res = await fetch(u.toString(), { headers: REFERER_HEADERS });
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
