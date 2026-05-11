/**
 * One-off: re-pin the 3 bhandaras flagged by verify-pins.ts as > 3 km
 * from their declared area centroid. For each one we try a sharpened
 * geocode query first, then fall back to a hand-vetted coord if Ola
 * still wanders. Hand-pinned slugs are added to PINNED_SLUGS in
 * geocode-bhandaras.ts so bulk re-runs don't undo the fix.
 *
 *   npx tsx prisma/fix-misplaced-pins.ts
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
  } catch {}
}
loadEnvLocal();

const OLA_API_KEY = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY ?? "";
const REFERER_HEADERS = {
  Origin: "http://localhost:3030",
  Referer: "http://localhost:3030/",
} as const;
const LKO_CENTER = { lat: 26.8467, lng: 80.9462 };

type Hit = { lat: number; lng: number; matched: string };

async function geocode(q: string): Promise<Hit | null> {
  if (!OLA_API_KEY) return null;
  try {
    const u = new URL("https://api.olamaps.io/places/v1/geocode");
    u.searchParams.set("address", q);
    u.searchParams.set("api_key", OLA_API_KEY);
    u.searchParams.set("language", "English");
    const res = await fetch(u.toString(), { headers: REFERER_HEADERS });
    if (res.ok) {
      const data = (await res.json()) as {
        geocodingResults?: Array<{
          formatted_address?: string;
          geometry?: { location?: { lat?: number; lng?: number } };
        }>;
      };
      const r = data.geocodingResults?.[0];
      const lat = r?.geometry?.location?.lat;
      const lng = r?.geometry?.location?.lng;
      if (typeof lat === "number" && typeof lng === "number") {
        return { lat, lng, matched: r?.formatted_address ?? q };
      }
    }
  } catch {}
  try {
    const u = new URL("https://api.olamaps.io/places/v1/autocomplete");
    u.searchParams.set("input", q);
    u.searchParams.set("api_key", OLA_API_KEY);
    u.searchParams.set("location", `${LKO_CENTER.lat},${LKO_CENTER.lng}`);
    u.searchParams.set("radius", "15000");
    const res = await fetch(u.toString(), { headers: REFERER_HEADERS });
    if (res.ok) {
      const data = (await res.json()) as {
        predictions?: Array<{
          description?: string;
          structured_formatting?: { main_text?: string };
          geometry?: { location?: { lat?: number; lng?: number } };
        }>;
      };
      const p = data.predictions?.[0];
      const lat = p?.geometry?.location?.lat;
      const lng = p?.geometry?.location?.lng;
      if (typeof lat === "number" && typeof lng === "number") {
        return {
          lat,
          lng,
          matched:
            p?.structured_formatting?.main_text ?? p?.description ?? q,
        };
      }
    }
  } catch {}
  return null;
}

type Fix = {
  slug: string;
  /** Sharpened queries to try in order. */
  queries: string[];
  /** Lat/lng to use if every query above fails or returns a wrong pin. */
  fallback: { lat: number; lng: number; note: string };
};

const FIXES: Fix[] = [
  {
    slug: "bhandara-nawab-pasad-chauraha",
    // Original address has "Nawab Pasad" (likely a phonetic spelling of
    // "Nawab Pasand" चौराहा in Aliganj near TD Girls Inter College).
    queries: [
      "Nawab Pasand Chauraha, Aliganj, Lucknow",
      "TD Girls Inter College, Aliganj, Lucknow",
      "Sector D Aliganj, Lucknow",
    ],
    // TD Girls Inter College Aliganj — Sector D crossing.
    fallback: {
      lat: 26.8885,
      lng: 80.9359,
      note: "hand-set: TD Girls Inter College Aliganj, Sector D",
    },
  },
  {
    slug: "janki-plaza-bhandara-jankipuram",
    queries: [
      "Janki Plaza, Sector G, Jankipuram, Lucknow",
      "Janki Plaza, Jankipuram, Lucknow",
      "Jankipuram Sector G, Lucknow",
    ],
    // Janki Plaza market complex, Jankipuram Sector H.
    fallback: {
      lat: 26.9178,
      lng: 80.9445,
      note: "hand-set: Janki Plaza, Jankipuram Sector G/H",
    },
  },
  {
    slug: "patel-puram-bhandara-gomti-vistar",
    queries: [
      "Patel Puram, Gomti Nagar Vistar, Lucknow",
      "Greenwood Apartment, Gomti Nagar Vistar, Lucknow",
      "Bandh Godam Bridge, Gomti Nagar Vistar, Lucknow",
    ],
    // Patel Puram colony south of Bandh Godam Bridge, Gomti Vistar.
    fallback: {
      lat: 26.8568,
      lng: 81.0345,
      note: "hand-set: Patel Puram, Gomti Nagar Vistar",
    },
  },
];

// Area centroids reused for distance check on the candidate hit — we
// refuse any geocode result more than 3.5 km from the area centroid,
// otherwise Ola sometimes resolves to a same-name venue in another part
// of the city.
const AREA_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  Aliganj: { lat: 26.895, lng: 80.94 },
  Jankipuram: { lat: 26.92, lng: 80.94 },
  "Gomti Nagar Extension": { lat: 26.855, lng: 81.03 },
};
const ACCEPT_THRESHOLD_KM = 3.5;

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  for (const f of FIXES) {
    const existing = await prisma.bhandara.findUnique({
      where: { slug: f.slug },
      select: { area: true, lat: true, lng: true },
    });
    if (!existing) {
      console.log(`  · ${f.slug}: not found in DB, skipping`);
      continue;
    }
    const centroid = AREA_CENTROIDS[existing.area];

    let chosen: { lat: number; lng: number; source: string } | null = null;
    for (const q of f.queries) {
      const hit = await geocode(q);
      await sleep(180);
      if (!hit) continue;
      if (
        centroid &&
        haversineKm(centroid, { lat: hit.lat, lng: hit.lng }) > ACCEPT_THRESHOLD_KM
      ) {
        console.log(
          `  · ${f.slug}: rejected hit ${hit.lat},${hit.lng} (${hit.matched}) — too far from ${existing.area}`,
        );
        continue;
      }
      chosen = { lat: hit.lat, lng: hit.lng, source: `geocode:${q}` };
      console.log(`  ✓ ${f.slug}: matched "${hit.matched}" via "${q}"`);
      break;
    }
    if (!chosen) {
      chosen = { ...f.fallback, source: `fallback:${f.fallback.note}` };
      console.log(`  ⚠ ${f.slug}: using ${f.fallback.note}`);
    }

    await prisma.bhandara.update({
      where: { slug: f.slug },
      data: {
        lat: chosen.lat,
        lng: chosen.lng,
        googleMapsUrl: `https://www.google.com/maps?q=${chosen.lat},${chosen.lng}&z=18`,
      },
    });
    console.log(
      `     ${existing.lat}, ${existing.lng} → ${chosen.lat}, ${chosen.lng}\n`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
