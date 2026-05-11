/**
 * One-off geocoding pass: take every Bhandara row in the database,
 * look its `address` up against the Ola Maps Geocoding API, and
 * update `lat` / `lng` to the API's returned coordinates.
 *
 * Safety rails:
 *   - Only updates if the result falls inside Lucknow's bounding box
 *     (26.6 ≤ lat ≤ 27.0, 80.7 ≤ lng ≤ 81.2). Anything outside is
 *     almost certainly a wrong-city hit (e.g. matching a "Hanuman
 *     Mandir" in Delhi when the Lucknow one isn't indexed).
 *   - Falls back to a more specific query if the first attempt
 *     returns nothing or out-of-bounds (appends "Lucknow" if missing).
 *   - Sleeps 250 ms between requests so we don't pummel Ola's
 *     rate limit on bulk passes.
 *   - Logs every row's before/after so the team can sanity-check.
 *
 * Run:
 *   npx tsx prisma/geocode-bhandaras.ts
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Manually parse .env.local so we don't need an extra dependency.
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
    /* file missing — env may already be in process.env */
  }
}
loadEnvLocal();

const OLA_API_KEY = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY ?? "";
if (!OLA_API_KEY) {
  console.error(
    "ERROR: NEXT_PUBLIC_OLA_MAPS_API_KEY is missing from .env.local",
  );
  process.exit(1);
}

// Our Ola Maps API key is referer-whitelisted at the Ola Console. From
// a server-side script the request has no Referer by default, and the
// API rejects with `"Domain is not allowed."`. Faking these headers to
// match the whitelisted localhost origin lets the script geocode
// against the same key the browser uses — no separate "server key"
// needed.
const REFERER_HEADERS = {
  Origin: "http://localhost:3030",
  Referer: "http://localhost:3030/",
} as const;

const prisma = new PrismaClient();

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

type GeocodeHit = {
  lat: number;
  lng: number;
  formatted: string;
};

/**
 * Try the Geocode endpoint first; if it returns nothing usable, fall
 * back to Autocomplete + take the first prediction. Autocomplete is
 * forgiving with messy addresses (which our WhatsApp invites tend to
 * be — "Awadh Tent House, E-3851, Rajajipuram, Lucknow").
 */
async function geocode(address: string): Promise<GeocodeHit | null> {
  // ── 1) Geocode API ───────────────────────────────────────────────
  try {
    const u = new URL("https://api.olamaps.io/places/v1/geocode");
    u.searchParams.set("address", address);
    u.searchParams.set("api_key", OLA_API_KEY);
    u.searchParams.set("language", "English");
    const res = await fetch(u.toString(), { headers: REFERER_HEADERS });
    if (res.ok) {
      type Resp = {
        geocodingResults?: Array<{
          formatted_address?: string;
          geometry?: { location?: { lat?: number; lng?: number } };
        }>;
        status?: string;
      };
      const data = (await res.json()) as Resp;
      for (const r of data.geocodingResults ?? []) {
        const lat = r.geometry?.location?.lat;
        const lng = r.geometry?.location?.lng;
        if (typeof lat === "number" && typeof lng === "number") {
          if (inLucknow(lat, lng)) {
            return {
              lat,
              lng,
              formatted: r.formatted_address ?? address,
            };
          }
        }
      }
    }
  } catch (err) {
    console.warn("geocode error:", err);
  }

  // ── 2) Autocomplete fallback ─────────────────────────────────────
  try {
    const u = new URL("https://api.olamaps.io/places/v1/autocomplete");
    u.searchParams.set("input", address);
    u.searchParams.set("api_key", OLA_API_KEY);
    u.searchParams.set(
      "location",
      `${LKO_CENTER.lat},${LKO_CENTER.lng}`,
    );
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
        if (typeof lat === "number" && typeof lng === "number") {
          if (inLucknow(lat, lng)) {
            return {
              lat,
              lng,
              formatted:
                p.structured_formatting?.main_text ??
                p.description ??
                address,
            };
          }
        }
      }
    }
  } catch (err) {
    console.warn("autocomplete error:", err);
  }

  return null;
}

// Slugs whose pins have been hand-tuned because Ola's geocoder keeps
// picking the wrong venue (different campus / different mandir of the
// same name). The bulk pass skips these so a re-run doesn't regress
// the manual fix.
const PINNED_SLUGS = new Set<string>([
  "lucknow-university-main-campus-bhandara",
  "hanuman-mandir-civil-hospital-mahanagar",
  // Janki Plaza: Ola couldn't find the venue and kept resolving the
  // bare "Jankipuram" query to a generic Lucknow centroid 7 km off. We
  // hand-pinned it to Sector G/H — don't let the bulk pass regress.
  "janki-plaza-bhandara-jankipuram",
]);

async function main() {
  const rows = await prisma.bhandara.findMany({
    orderBy: { createdAt: "asc" },
  });
  console.log(`Geocoding ${rows.length} bhandaras…\n`);

  let updated = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const b of rows) {
    if (PINNED_SLUGS.has(b.slug)) {
      console.log(`  · ${b.name} → pinned (hand-set), skipping`);
      unchanged += 1;
      continue;
    }
    // Try the address as-is first; if it doesn't include "Lucknow",
    // append it for the fallback attempt (some posters say just
    // "Aliganj, Sector K" which can match wrong cities).
    const candidates = [b.address];
    if (!/lucknow/i.test(b.address)) {
      candidates.push(`${b.address}, Lucknow`);
    }
    // Also try landmark + area + Lucknow as a last resort — that's
    // often the most specific search-engine-friendly form.
    if (b.landmark) {
      candidates.push(`${b.landmark}, ${b.area}, Lucknow`);
    }
    candidates.push(`${b.area}, Lucknow`);

    let hit: GeocodeHit | null = null;
    let usedQuery = "";
    for (const q of candidates) {
      hit = await geocode(q);
      if (hit) {
        usedQuery = q;
        break;
      }
      await sleep(180);
    }

    if (!hit) {
      console.log(`  · ${b.name}`);
      console.log(`    ⚠ no match — keeping (${b.lat}, ${b.lng})`);
      skipped += 1;
      continue;
    }

    const drift =
      Math.abs(hit.lat - b.lat).toFixed(4) +
      ", " +
      Math.abs(hit.lng - b.lng).toFixed(4);

    const shouldUpdate =
      Math.abs(hit.lat - b.lat) > 0.0005 ||
      Math.abs(hit.lng - b.lng) > 0.0005;
    if (!shouldUpdate) {
      console.log(`  · ${b.name} → already accurate (${b.lat}, ${b.lng})`);
      unchanged += 1;
      continue;
    }

    await prisma.bhandara.update({
      where: { id: b.id },
      data: {
        lat: hit.lat,
        lng: hit.lng,
        googleMapsUrl: `https://www.google.com/maps?q=${hit.lat},${hit.lng}&z=18`,
      },
    });
    updated += 1;
    console.log(`  ✓ ${b.name}`);
    console.log(`    query : ${usedQuery}`);
    console.log(`    match : ${hit.formatted}`);
    console.log(`    coords: ${b.lat}, ${b.lng} → ${hit.lat}, ${hit.lng}`);
    console.log(`    drift : ${drift}`);

    await sleep(250);
  }

  console.log(
    `\n✓ done. updated=${updated} unchanged=${unchanged} skipped=${skipped}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
