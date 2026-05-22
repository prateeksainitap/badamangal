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
 *   http://localhost:3030` on every server call — a fragile lie
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
  // Prefer the dedicated server key. Fall back to the public key
  // (with the legacy spoof — which only works if `localhost:3030`
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
    const res = await fetch(u.toString(), headers ? { headers } : {});
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
    const res = await fetch(u.toString(), headers ? { headers } : {});
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
