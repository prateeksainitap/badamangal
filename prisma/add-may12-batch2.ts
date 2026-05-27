/**
 * Append-only seed for the May 12 second-batch WhatsApp invites
 * (Hind Nagar Vyapar Mandal + Lucknow University Main Campus).
 *
 * Unlike `seed-whatsapp.ts` this script does NOT wipe - it only adds
 * the 2 new rows via upsert (so re-running is idempotent) and runs
 * the same Ola-Maps geocode pass we used for the first batch so the
 * pins land precisely instead of at the area centroid.
 *
 * Run:
 *   npx tsx prisma/add-may12-batch2.ts
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

const LKO_BBOX = { latMin: 26.6, latMax: 27.0, lngMin: 80.7, lngMax: 81.2 };
const LKO_CENTER = { lat: 26.8467, lng: 80.9462 };
const inLkw = (lat: number, lng: number) =>
  lat >= LKO_BBOX.latMin &&
  lat <= LKO_BBOX.latMax &&
  lng >= LKO_BBOX.lngMin &&
  lng <= LKO_BBOX.lngMax;
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
        if (typeof lat === "number" && typeof lng === "number" && inLkw(lat, lng)) {
          return {
            lat,
            lng,
            matched: p.structured_formatting?.main_text ?? p.description ?? q,
          };
        }
      }
    }
  } catch {}
  return null;
}

const TUE_12_MAY = "2026-05-12";

type Row = {
  slug: string;
  name: string;
  nameHi: string;
  description: string;
  descriptionHi: string;
  area: string;
  address: string;
  addressHi: string;
  landmark: string;
  lat: number;
  lng: number;
  geocodeQueries: string[];
  tuesdayDates: string[];
  timeStart: string;
  menu: string[];
  organizerName: string;
  organizerPhone: string;
  photoSlug: string;
};

const ROWS: Row[] = [
  {
    slug: "hind-nagar-vyapar-mandal-chungi-parag",
    name: "Bada Mangal Bhandara, Hind Nagar Vyapar Mandal",
    nameHi: "बड़ा मंगल भंडारा, हिन्द नगर व्यापार मंडल",
    description:
      "Bada Mangal Bhandara hosted by Hind Nagar Vyapar Mandal at Chungi, Parag Road, Lucknow.",
    descriptionHi:
      "बड़ा मंगल भंडारा, आयोजक: हिन्द नगर व्यापार मंडल, चुंगी पराग रोड, लखनऊ।",
    area: "Krishna Nagar",
    address: "Chungi, Parag Road, Hind Nagar, Krishna Nagar, Lucknow",
    addressHi: "चुंगी, पराग रोड, हिन्द नगर, कृष्णा नगर, लखनऊ",
    landmark: "Chungi, Parag Road",
    lat: 26.7875,
    lng: 80.8725,
    geocodeQueries: [
      "Hind Nagar Chungi, Parag Road, Lucknow",
      "Parag Chauraha, Hind Nagar, Lucknow",
      "Hind Nagar, Krishna Nagar, Lucknow",
      "Krishna Nagar, Lucknow",
    ],
    tuesdayDates: [TUE_12_MAY],
    timeStart: "11:00",
    menu: ["puri", "sabzi", "prasad"],
    organizerName: "Hind Nagar Vyapar Mandal",
    organizerPhone: "9999999986",
    photoSlug: "hind-nagar-vyapar-mandal",
  },
  {
    slug: "lucknow-university-main-campus-bhandara",
    name: "Bhandara, Lucknow University (Main Campus)",
    nameHi: "भंडारा, लखनऊ विश्वविद्यालय (मुख्य परिसर)",
    description:
      "Bada Mangal Bhandara at Lucknow University Main Campus parking between Gate No. 3 and 4. Prasad from 12 PM until Prabhu Iccha.",
    descriptionHi:
      "स्थान: लखनऊ विश्वविद्यालय (मेन कैंपस), गेट नंबर 3 और 4 की पार्किंग। समय: मंगलवार दोपहर 12 बजे से प्रभु इच्छा तक।",
    area: "University Road",
    address:
      "Lucknow University Main Campus, between Gate No. 3 & 4 parking, University Road, Lucknow",
    addressHi:
      "लखनऊ विश्वविद्यालय (मेन कैंपस), गेट नंबर 3 और 4 की पार्किंग, यूनिवर्सिटी रोड, लखनऊ",
    landmark: "LU Main Campus, between Gate No. 3 & 4",
    lat: 26.8703,
    lng: 80.9395,
    geocodeQueries: [
      "Lucknow University Main Campus Gate 3, Lucknow",
      "Lucknow University, University Road, Lucknow",
      "Lucknow University, Lucknow",
    ],
    tuesdayDates: [TUE_12_MAY],
    timeStart: "12:00",
    menu: ["puri", "sabzi", "prasad"],
    organizerName: "Samast Bhakta Gan",
    organizerPhone: "9999999985",
    photoSlug: "lucknow-university-gate-3-4",
  },
];

const prisma = new PrismaClient();

async function main() {
  for (const r of ROWS) {
    // Geocode first so we upsert with the precise pin in one shot.
    let hit: Hit | null = null;
    let usedQuery = "";
    for (const q of r.geocodeQueries) {
      hit = await geocode(q);
      if (hit) {
        usedQuery = q;
        break;
      }
      await sleep(180);
    }

    const lat = hit?.lat ?? r.lat;
    const lng = hit?.lng ?? r.lng;
    const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}&z=18`;

    if (hit) {
      console.log(`  ✓ ${r.slug}`);
      console.log(`    query : ${usedQuery}`);
      console.log(`    match : ${hit.matched}`);
      console.log(`    coords: ${lat}, ${lng}`);
    } else {
      console.log(`  ⚠ ${r.slug}: no geocode hit, using fallback ${lat}, ${lng}`);
    }

    await prisma.bhandara.upsert({
      where: { slug: r.slug },
      update: {
        name: r.name,
        nameHi: r.nameHi,
        description: r.description,
        descriptionHi: r.descriptionHi,
        address: r.address,
        addressHi: r.addressHi,
        area: r.area,
        landmark: r.landmark,
        lat,
        lng,
        tuesdayDates: JSON.stringify(r.tuesdayDates),
        timeStart: r.timeStart,
        timeEnd: "",
        menu: JSON.stringify(r.menu),
        menuHi: JSON.stringify(menuHiFor(r.menu)),
        organizerName: r.organizerName,
        organizerPhone: r.organizerPhone,
        photoUrl: `/uploads/whatsapp/${r.photoSlug}.jpg`,
        googleMapsUrl,
        status: "APPROVED",
        approvedAt: new Date(),
        isVerified: false,
      },
      create: {
        slug: r.slug,
        name: r.name,
        nameHi: r.nameHi,
        description: r.description,
        descriptionHi: r.descriptionHi,
        address: r.address,
        addressHi: r.addressHi,
        area: r.area,
        landmark: r.landmark,
        lat,
        lng,
        tuesdayDates: JSON.stringify(r.tuesdayDates),
        timeStart: r.timeStart,
        timeEnd: "",
        menu: JSON.stringify(r.menu),
        menuHi: JSON.stringify(menuHiFor(r.menu)),
        organizerName: r.organizerName,
        organizerPhone: r.organizerPhone,
        photoUrl: `/uploads/whatsapp/${r.photoSlug}.jpg`,
        googleMapsUrl,
        status: "APPROVED",
        approvedAt: new Date(),
        isVerified: false,
      },
    });
    await sleep(250);
  }
  console.log("\n✓ batch-2 add complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
