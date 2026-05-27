/**
 * One-off: geocode the 5 entries in `src/content/temples.ts` and print
 * the corrected lat/lng for each. Output is hand-applied to the file
 * since the temple list is static TypeScript content (not a DB table).
 *
 * Same referer-spoofing trick as `geocode-bhandaras.ts` - see that
 * file for the full explanation.
 *
 * Run:
 *   npx tsx prisma/geocode-temples.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TEMPLES } from "../src/content/temples";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(__dirname, "..", ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}
loadEnvLocal();

const OLA_API_KEY = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY ?? "";
if (!OLA_API_KEY) {
  console.error("ERROR: NEXT_PUBLIC_OLA_MAPS_API_KEY missing.");
  process.exit(1);
}

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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type Hit = { lat: number; lng: number; matched: string };

async function geocode(q: string): Promise<Hit | null> {
  // Geocode endpoint
  try {
    const u = new URL("https://api.olamaps.io/places/v1/geocode");
    u.searchParams.set("address", q);
    u.searchParams.set("api_key", OLA_API_KEY);
    u.searchParams.set("language", "English");
    const res = await fetch(u.toString(), { headers: REFERER_HEADERS });
    if (res.ok) {
      type Resp = {
        geocodingResults?: Array<{
          formatted_address?: string;
          name?: string;
          geometry?: { location?: { lat?: number; lng?: number } };
        }>;
      };
      const data = (await res.json()) as Resp;
      for (const r of data.geocodingResults ?? []) {
        const lat = r.geometry?.location?.lat;
        const lng = r.geometry?.location?.lng;
        if (typeof lat === "number" && typeof lng === "number" && inLucknow(lat, lng)) {
          return {
            lat,
            lng,
            matched: r.formatted_address ?? r.name ?? q,
          };
        }
      }
    }
  } catch {}

  // Autocomplete fallback
  try {
    const u = new URL("https://api.olamaps.io/places/v1/autocomplete");
    u.searchParams.set("input", q);
    u.searchParams.set("api_key", OLA_API_KEY);
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
        if (typeof lat === "number" && typeof lng === "number" && inLucknow(lat, lng)) {
          return {
            lat,
            lng,
            matched:
              p.structured_formatting?.main_text ?? p.description ?? q,
          };
        }
      }
    }
  } catch {}

  return null;
}

async function main() {
  console.log(`Geocoding ${TEMPLES.length} temples…\n`);
  for (const t of TEMPLES) {
    // Walk through progressively more general queries - the temple's
    // English name first (most specific), then with area, then just
    // the area as a last resort.
    const queries = [
      `${t.name.en}, ${t.area}, Lucknow`,
      t.altName ? `${t.altName}, ${t.area}, Lucknow` : null,
      `${t.name.en}, Lucknow`,
      `${t.area}, Lucknow`,
    ].filter((x): x is string => Boolean(x));

    let hit: Hit | null = null;
    let usedQuery = "";
    for (const q of queries) {
      hit = await geocode(q);
      if (hit) {
        usedQuery = q;
        break;
      }
      await sleep(180);
    }

    if (!hit) {
      console.log(`  ⚠ ${t.slug}: no match, keep ${t.lat}, ${t.lng}`);
      continue;
    }

    const drift =
      Math.abs(hit.lat - t.lat).toFixed(4) +
      ", " +
      Math.abs(hit.lng - t.lng).toFixed(4);

    console.log(`  ✓ ${t.slug}`);
    console.log(`    query : ${usedQuery}`);
    console.log(`    match : ${hit.matched}`);
    console.log(`    coords: ${t.lat}, ${t.lng} → ${hit.lat}, ${hit.lng}`);
    console.log(`    drift : ${drift}`);
    console.log();

    await sleep(250);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
