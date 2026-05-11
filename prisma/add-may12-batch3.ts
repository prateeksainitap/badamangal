/**
 * Append-only: Hanuman Mandir, Civil Hospital, Mahanagar (May 12, 11 AM).
 * Same idempotent upsert + Ola geocode pattern as add-may12-batch2.
 *
 *   npx tsx prisma/add-may12-batch3.ts
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { menuHiFor } from "../src/lib/menu";

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
if (!OLA_API_KEY) {
  console.error("ERROR: NEXT_PUBLIC_OLA_MAPS_API_KEY missing.");
  process.exit(1);
}
const REFERER_HEADERS = {
  Origin: "http://localhost:3030",
  Referer: "http://localhost:3030/",
} as const;
const LKO_BBOX = { latMin: 26.6, latMax: 27.0, lngMin: 80.7, lngMax: 81.2 };
const LKO_CENTER = { lat: 26.8467, lng: 80.9462 };
const inLkw = (lat: number, lng: number) =>
  lat >= LKO_BBOX.latMin && lat <= LKO_BBOX.latMax &&
  lng >= LKO_BBOX.lngMin && lng <= LKO_BBOX.lngMax;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Hit = { lat: number; lng: number; matched: string };
async function geocode(q: string): Promise<Hit | null> {
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
      for (const r of data.geocodingResults ?? []) {
        const lat = r.geometry?.location?.lat;
        const lng = r.geometry?.location?.lng;
        if (typeof lat === "number" && typeof lng === "number" && inLkw(lat, lng)) {
          return { lat, lng, matched: r.formatted_address ?? q };
        }
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
      for (const p of data.predictions ?? []) {
        const lat = p.geometry?.location?.lat;
        const lng = p.geometry?.location?.lng;
        if (typeof lat === "number" && typeof lng === "number" && inLkw(lat, lng)) {
          return {
            lat, lng,
            matched: p.structured_formatting?.main_text ?? p.description ?? q,
          };
        }
      }
    }
  } catch {}
  return null;
}

const TUE_12_MAY = "2026-05-12";
const slug = "hanuman-mandir-civil-hospital-mahanagar";
const queries = [
  // Mahanagar's "Civil Hospital" colloquially refers to Lokbandhu Raj
  // Narayan Combined Hospital on Kanpur Rd side, but the Mahanagar
  // landmark is Ram Manohar Lohia Hospital. Try both, then fall back
  // to the Hanuman Mandir + Mahanagar area centroid.
  "Hanuman Mandir, Civil Hospital, Mahanagar, Lucknow",
  "Hanuman Mandir, Mahanagar, Lucknow",
  "Ram Manohar Lohia Hospital, Mahanagar, Lucknow",
  "Mahanagar, Lucknow",
];

const prisma = new PrismaClient();

async function main() {
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

  const lat = hit?.lat ?? 26.879;
  const lng = hit?.lng ?? 80.954;
  if (hit) {
    console.log(`  ✓ ${slug}`);
    console.log(`    query : ${usedQuery}`);
    console.log(`    match : ${hit.matched}`);
    console.log(`    coords: ${lat}, ${lng}`);
  } else {
    console.log(`  ⚠ no geocode hit — fallback ${lat}, ${lng}`);
  }

  const menu = ["puri", "sabzi", "prasad"];
  const data = {
    name: "Vishal Bhandara — Hanuman Mandir, Mahanagar",
    nameHi: "विशाल भंडारा — हनुमान मंदिर, महानगर",
    description:
      "Vishal Bhandara on the second Bada Mangal at Hanuman Mandir, near Civil Hospital, Mahanagar.",
    descriptionHi:
      "ज्येष्ठ माह के दूसरे मंगलवार पर हनुमान मंदिर, निकट सिविल हॉस्पिटल, महानगर में विशाल भंडारे का आयोजन।",
    address: "Hanuman Mandir, near Civil Hospital, Mahanagar, Lucknow",
    addressHi: "हनुमान मंदिर, निकट सिविल हॉस्पिटल, महानगर, लखनऊ",
    area: "Mahanagar",
    landmark: "Near Civil Hospital, Mahanagar",
    lat, lng,
    tuesdayDates: JSON.stringify([TUE_12_MAY]),
    timeStart: "11:00",
    timeEnd: "",
    menu: JSON.stringify(menu),
    menuHi: JSON.stringify(menuHiFor(menu)),
    organizerName: "Samast Bhakta Gan",
    organizerPhone: "9999999984",
    photoUrl: "/uploads/whatsapp/hanuman-mandir-mahanagar.jpg",
    googleMapsUrl: `https://www.google.com/maps?q=${lat},${lng}&z=18`,
    status: "APPROVED",
    approvedAt: new Date(),
    isVerified: false,
  };

  await prisma.bhandara.upsert({
    where: { slug },
    update: data,
    create: { slug, ...data },
  });
  console.log("\n✓ batch-3 add complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
