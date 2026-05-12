/**
 * Append-only batch: 10 fresh bhandaras curated from the WhatsApp
 * invite drop in `Live bhandara-2/`. Nine fall on 12 May 2026 (the 2nd
 * Bada Mangal); one (CG City Ansal API) is on 19 May 2026.
 *
 * Pattern matches add-may12-batch3.ts:
 *   • idempotent upsert keyed on slug (safe to re-run)
 *   • Ola Maps geocode with area-centroid fallback so we never error
 *     on a missing API key or a quiet pooler
 *   • photoUrl points to /uploads/whatsapp/<slug>.jpg — those images
 *     are committed to the repo via the `!public/uploads/whatsapp/`
 *     exception in .gitignore
 *
 *   npx tsx prisma/add-may12-batch4.ts
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { menuHiFor } from "../src/lib/menu";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(__dirname, "..", ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 0) continue;
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {}
}
loadEnvLocal();

const OLA_API_KEY = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY ?? "";
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
  if (!OLA_API_KEY) return null;
  try {
    const u = new URL("https://api.olamaps.io/places/v1/geocode");
    u.searchParams.set("address", q);
    u.searchParams.set("api_key", OLA_API_KEY);
    u.searchParams.set("language", "English");
    const res = await fetch(u.toString(), { headers: REFERER_HEADERS });
    if (res.ok) {
      const d = (await res.json()) as {
        geocodingResults?: Array<{
          formatted_address?: string;
          geometry?: { location?: { lat?: number; lng?: number } };
        }>;
      };
      for (const r of d.geocodingResults ?? []) {
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
      const d = (await res.json()) as {
        predictions?: Array<{
          description?: string;
          structured_formatting?: { main_text?: string };
          geometry?: { location?: { lat?: number; lng?: number } };
        }>;
      };
      for (const p of d.predictions ?? []) {
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
const TUE_19_MAY = "2026-05-19";

type Entry = {
  slug: string;
  name: string;
  nameHi: string;
  description: string;
  descriptionHi: string;
  address: string;
  addressHi: string;
  area: string;
  landmark?: string;
  /** Geocode queries tried in order. */
  queries: string[];
  /** Centroid fallback if no geocode hit. */
  fallback: { lat: number; lng: number };
  dates: string[];
  timeStart: string;
  timeEnd: string;
  menu: string[];
  organizerName: string;
  organizerPhone: string;
  photoUrl: string;
};

const ENTRIES: Entry[] = [
  {
    slug: "hanuman-mandir-matiyari-chinhat",
    name: "Bhandara — Hanuman Mandir, Matiyari, Chinhat",
    nameHi: "भंडारा — हनुमान मंदिर, मटियारी, चिनहट",
    description:
      "Bada Mangal bhandara at Hanuman Mandir, near Anand Lok Colony, Matiyari, Chinhat.",
    descriptionHi:
      "हनुमान मंदिर, निकट आनंद लोक कॉलोनी, मटियारी, चिनहट, लखनऊ में बड़े मंगल के अवसर पर भंडारे का आयोजन।",
    address:
      "Hanuman Mandir, near Anand Lok Colony, Matiyari, Chinhat, Lucknow",
    addressHi: "हनुमान मंदिर, निकट आनंद लोक कॉलोनी, मटियारी, चिनहट, लखनऊ",
    area: "Chinhat",
    landmark: "Near Anand Lok Colony, Matiyari",
    queries: [
      "Hanuman Mandir, Matiyari, Chinhat, Lucknow",
      "Anand Lok Colony, Matiyari, Chinhat, Lucknow",
      "Matiyari, Chinhat, Lucknow",
      "Chinhat, Lucknow",
    ],
    fallback: { lat: 26.879, lng: 81.024 },
    dates: [TUE_12_MAY],
    timeStart: "10:00",
    timeEnd: "",
    menu: ["puri", "sabzi", "prasad"],
    organizerName: "Samast Bhakta Gan",
    organizerPhone: "9999999991",
    photoUrl: "/uploads/whatsapp/hanuman-mandir-matiyari-chinhat.jpg",
  },
  {
    slug: "obsession-institute-aashiana",
    name: "Bhandara & Sundarkand — Obsession Institute, Aashiana",
    nameHi: "भंडारा एवं सुंदरकांड पाठ — ऑब्सेशन इंस्टीट्यूट, आशियाना",
    description:
      "Sundarkand path from 2 PM, vishal bhandara from 5 PM at Obsession Institute, 1/16 Ruchikhand, Sharda Nagar, Aashiana.",
    descriptionHi:
      "ऑब्सेशन इंस्टीट्यूट, 1/16 रुचिखंड, शारदानगर, आशियाना, लखनऊ में दोपहर 2 बजे से सुंदरकांड पाठ एवं शाम 5 बजे से विशाल भंडारा।",
    address:
      "Obsession Institute, 1/16 Ruchikhand, Sharda Nagar, Aashiana, Lucknow",
    addressHi:
      "ऑब्सेशन इंस्टीट्यूट, 1/16 रुचिखंड, शारदानगर, आशियाना, लखनऊ",
    area: "Sarojini Nagar",
    landmark: "1/16 Ruchikhand, Sharda Nagar, Aashiana",
    queries: [
      "Obsession Institute, Ruchikhand, Sharda Nagar, Aashiana, Lucknow",
      "Ruchikhand, Sharda Nagar, Aashiana, Lucknow",
      "Sharda Nagar, Aashiana, Lucknow",
      "Aashiana, Lucknow",
    ],
    fallback: { lat: 26.7691, lng: 80.9239 },
    dates: [TUE_12_MAY],
    timeStart: "17:00",
    timeEnd: "",
    menu: ["puri", "sabzi", "prasad"],
    organizerName: "Obsession Institute",
    organizerPhone: "9999999992",
    photoUrl: "/uploads/whatsapp/obsession-institute-aashiana.jpg",
  },
  {
    slug: "arena-animation-indiranagar-c164",
    name: "Bada Mangal Mahotsav & Sundarkand — Arena Animation, Indiranagar",
    nameHi: "बड़ा मंगल महोत्सव एवं सुंदरकांड पाठ — एरीना एनिमेशन, इंदिरानगर",
    description:
      "Sundarkand path at 10 AM, prasad distribution to follow, at C-164, Aravali Marg, Indiranagar (near Indiranagar Metro Station).",
    descriptionHi:
      "C-164, अरावली मार्ग, इंदिरानगर (इंदिरानगर मेट्रो स्टेशन के पास), लखनऊ में प्रातः 10 बजे से सुंदरकांड पाठ एवं तत्पश्चात प्रसाद वितरण।",
    address:
      "C-164, Aravali Marg, Indiranagar (near Indiranagar Metro Station), Lucknow 226016",
    addressHi:
      "C-164, अरावली मार्ग, इंदिरानगर (इंदिरानगर मेट्रो स्टेशन के पास), लखनऊ 226016",
    area: "Indira Nagar",
    landmark: "Near Indiranagar Metro Station, Aravali Marg",
    queries: [
      "C-164 Aravali Marg, Indiranagar, Lucknow",
      "Aravali Marg, Indiranagar, Lucknow",
      "Indiranagar Metro Station, Lucknow",
      "Indira Nagar, Lucknow",
    ],
    fallback: { lat: 26.8721, lng: 81.0093 },
    dates: [TUE_12_MAY],
    timeStart: "10:00",
    timeEnd: "",
    menu: ["puri", "sabzi", "prasad"],
    organizerName: "Arena Animation Lucknow Indiranagar & T-Institutes",
    organizerPhone: "9999999993",
    photoUrl: "/uploads/whatsapp/arena-animation-indiranagar-c164.jpg",
  },
  {
    slug: "sapeyul-aman-nagar-rajajipuram",
    name: "Bada Mangal Bhandara — Sapeyul Aman Nagar, Rajajipuram",
    nameHi: "बड़ा मंगल भंडारा — सपेयुल अमन नगर, राजाजीपुरम",
    description:
      "Bada Mangal bhandara at Sapeyul Aman Nagar, near the Neem Ka Ped landmark in Rajajipuram.",
    descriptionHi:
      "सपेयुल अमन नगर, राजाजीपुरम (नीम के पेड़ के पास), लखनऊ में बड़े मंगल के पावन अवसर पर भंडारा।",
    address: "Sapeyul Aman Nagar, near Neem Ka Ped, Rajajipuram, Lucknow",
    addressHi: "सपेयुल अमन नगर, नीम के पेड़ के पास, राजाजीपुरम, लखनऊ",
    area: "Rajajipuram",
    landmark: "Near Neem Ka Ped",
    queries: [
      "Aman Nagar, Rajajipuram, Lucknow",
      "Neem Ka Ped, Rajajipuram, Lucknow",
      "Rajajipuram, Lucknow",
    ],
    fallback: { lat: 26.832, lng: 80.879 },
    dates: [TUE_12_MAY],
    timeStart: "10:00",
    timeEnd: "",
    menu: ["puri", "sabzi", "prasad"],
    organizerName: "Aman Nagar Pariwar",
    organizerPhone: "9999999994",
    photoUrl: "/uploads/whatsapp/sapeyul-aman-nagar-rajajipuram.jpg",
  },
  {
    slug: "janki-plaza-jankipuram",
    name: "Bada Mangal Bhandara — Janki Plaza, Jankipuram",
    nameHi: "बड़ा मंगल भंडारा — जानकी प्लाज़ा, जानकीपुरम",
    description:
      "Bada Mangal bhandara at Janki Plaza, Jankipuram, from 11 AM.",
    descriptionHi:
      "जानकी प्लाज़ा, जानकीपुरम, लखनऊ में बड़े मंगल के दिन सुबह 11 बजे से भंडारा।",
    address: "Janki Plaza, Jankipuram, Lucknow",
    addressHi: "जानकी प्लाज़ा, जानकीपुरम, लखनऊ",
    area: "Jankipuram",
    landmark: "Janki Plaza",
    queries: [
      "Janki Plaza, Jankipuram, Lucknow",
      "Jankipuram, Lucknow",
    ],
    fallback: { lat: 26.928, lng: 80.928 },
    dates: [TUE_12_MAY],
    timeStart: "11:00",
    timeEnd: "",
    menu: ["puri", "sabzi", "prasad"],
    organizerName: "Janki Plaza Pariwar",
    organizerPhone: "9999999995",
    photoUrl: "/uploads/whatsapp/janki-plaza-jankipuram.jpg",
  },
  {
    slug: "indra-dental-bhitholi",
    name: "Bada Mangal Bhandara — Indra Dental Clinic, Bhitholi",
    nameHi: "बड़ा मंगल भंडारा — इंद्रा डेंटल क्लिनिक, भिटौली",
    description:
      "Bada Mangal bhandara from 1 PM at Indra Dental Clinic, near MRF Tyre, Bhitholi. Co-hosted by Sushma Vihar Colony Pariwar.",
    descriptionHi:
      "इंद्रा डेंटल क्लिनिक, निकट एमआरएफ़ टायर, भिटौली, लखनऊ में दोपहर 1 बजे से भंडारा। सहयोग: सुषमा विहार कॉलोनी परिवार।",
    address: "Indra Dental Clinic, Near MRF Tyre, Bhitholi, Lucknow",
    addressHi: "इंद्रा डेंटल क्लिनिक, निकट एमआरएफ़ टायर, भिटौली, लखनऊ",
    area: "IIM Road",
    landmark: "Near MRF Tyre, Bhitholi",
    queries: [
      "Indra Dental Clinic, Bhitholi, Lucknow",
      "MRF Tyre, Bhitholi, Lucknow",
      "Bhitholi, Lucknow",
      "IIM Road, Lucknow",
    ],
    fallback: { lat: 26.918, lng: 80.901 },
    dates: [TUE_12_MAY],
    timeStart: "13:00",
    timeEnd: "",
    menu: ["puri", "sabzi", "prasad"],
    organizerName: "Indra Dental Clinic & Sushma Vihar Colony Pariwar",
    organizerPhone: "9999999996",
    photoUrl: "/uploads/whatsapp/indra-dental-bhitholi.jpg",
  },
  {
    slug: "fi-plaza-bada-chand-ganj",
    name: "Vishal Bhandara — FI Plaza, Bada Chand Ganj",
    nameHi: "विशाल भंडारा — एफ़आई प्लाज़ा, बड़ा चाँद गंज",
    description:
      "Vishal bhandara from 1:30 PM onwards at FI Plaza, Bada Chand Ganj. Organized by Pathseshan Diagnostic & Vimla Girls PG.",
    descriptionHi:
      "एफ़आई प्लाज़ा, बड़ा चाँद गंज, लखनऊ में दोपहर 1:30 बजे से प्रभु इच्छा तक विशाल भंडारा। आयोजन: पैथसेशन डायग्नोस्टिक एवं विमला गर्ल्स पीजी।",
    address: "FI Plaza, Bada Chand Ganj, Lucknow",
    addressHi: "एफ़आई प्लाज़ा, बड़ा चाँद गंज, लखनऊ",
    area: "Chowk",
    landmark: "FI Plaza, Bada Chand Ganj",
    queries: [
      "FI Plaza, Bada Chandganj, Lucknow",
      "Bada Chandganj, Chowk, Lucknow",
      "Chandganj, Lucknow",
      "Chowk, Lucknow",
    ],
    fallback: { lat: 26.879, lng: 80.91 },
    dates: [TUE_12_MAY],
    timeStart: "13:30",
    timeEnd: "",
    menu: ["puri", "sabzi", "prasad"],
    organizerName: "Pathseshan Diagnostic & Vimla Girls PG",
    organizerPhone: "9450300443",
    photoUrl: "/uploads/whatsapp/fi-plaza-bada-chand-ganj.jpg",
  },
  {
    slug: "shree-manas-mandir-manas-city",
    name: "Bada Mangal Bhandara — Shree Manas Mandir, Manas City",
    nameHi: "बड़ा मंगल भंडारा — श्री मानस मंदिर, मानस सिटी",
    description:
      "Bada Mangal bhandara from 12 PM at Shree Manas Mandir, Manas City (near the Peepal Tree). Hosted by Chhavi Batra & family.",
    descriptionHi:
      "श्री मानस मंदिर, मानस सिटी (पीपल के पेड़ के पास), लखनऊ में दोपहर 12 बजे से बड़ा मंगल भंडारा। आयोजक: छवि बत्रा एवं परिवार।",
    address:
      "Shree Manas Mandir, Manas City (Near Peepal Tree), Lucknow",
    addressHi:
      "श्री मानस मंदिर, मानस सिटी (पीपल के पेड़ के पास), लखनऊ",
    area: "Gomti Nagar Extension",
    landmark: "Near Peepal Tree, Manas City",
    queries: [
      "Shree Manas Mandir, Manas City, Lucknow",
      "Manas City, Lucknow",
      "Gomti Nagar Extension, Lucknow",
    ],
    fallback: { lat: 26.85, lng: 81.05 },
    dates: [TUE_12_MAY],
    timeStart: "12:00",
    timeEnd: "",
    menu: ["puri", "sabzi", "prasad"],
    organizerName: "Chhavi Batra & Family",
    organizerPhone: "9999999997",
    photoUrl: "/uploads/whatsapp/shree-manas-mandir-manas-city.jpg",
  },
  {
    slug: "cg-city-ansal-api-swati-krutika",
    name: "Dwitiya Vishal Bhandara — Swati-Krutika, CG City, Ansal API",
    nameHi: "द्वितीय विशाल भंडारा — स्वाति-कृतिका, सीजी सिटी, अंसल एपीआई",
    description:
      "Second-Bada-Mangal vishal bhandara from 9 AM at Swati-Krutika Apartment Gate, CG City, Ansal API.",
    descriptionHi:
      "स्वाति-कृतिका अपार्टमेंट गेट, सीजी सिटी, अंसल एपीआई, लखनऊ में दूसरे बड़े मंगल के अवसर पर प्रातः 9 बजे से विशाल भंडारा।",
    address:
      "Swati-Krutika Apartment Gate, CG City, Ansal API, Lucknow",
    addressHi:
      "स्वाति-कृतिका अपार्टमेंट गेट, सीजी सिटी, अंसल एपीआई, लखनऊ",
    area: "Sushant Golf City",
    landmark: "Swati-Krutika Apartment Gate, CG City",
    queries: [
      "Swati Krutika Apartment, CG City, Ansal API, Lucknow",
      "CG City, Ansal API, Lucknow",
      "Ansal API, Sushant Golf City, Lucknow",
      "Sushant Golf City, Lucknow",
    ],
    fallback: { lat: 26.76, lng: 80.99 },
    dates: [TUE_19_MAY],
    timeStart: "09:00",
    timeEnd: "",
    menu: ["puri", "sabzi", "prasad"],
    organizerName: "Swati-Krutika CG City Pariwar",
    organizerPhone: "9999999998",
    photoUrl: "/uploads/whatsapp/cg-city-ansal-api-swati-krutika.jpg",
  },
  {
    slug: "balaji-store-topkhana-cantt",
    name: "Prasad Vitran (Bhandara) — Balaji Store, Topkhana Bazar, Cantt",
    nameHi: "प्रसाद वितरण (भंडारा) — बालाजी स्टोर, तोपखाना बाज़ार, कैंट",
    description:
      "Prasad distribution from 12 PM to evening at Balaji Store, Topkhana Bazar, Cantt, Lucknow.",
    descriptionHi:
      "बालाजी स्टोर, तोपखाना बाज़ार, कैंट, लखनऊ में दोपहर 12 बजे से सायं तक प्रसाद वितरण।",
    address: "Balaji Store, Topkhana Bazar, Cantt, Lucknow",
    addressHi: "बालाजी स्टोर, तोपखाना बाज़ार, कैंट, लखनऊ",
    area: "Charbagh",
    landmark: "Topkhana Bazar, Cantt",
    queries: [
      "Balaji Store, Topkhana Bazar, Cantt, Lucknow",
      "Topkhana Bazar, Cantonment, Lucknow",
      "Lucknow Cantonment",
      "Charbagh, Lucknow",
    ],
    fallback: { lat: 26.836, lng: 80.929 },
    dates: [TUE_12_MAY],
    timeStart: "12:00",
    timeEnd: "",
    menu: ["puri", "sabzi", "prasad"],
    organizerName: "Balaji Store Pariwar",
    organizerPhone: "9999999999",
    photoUrl: "/uploads/whatsapp/balaji-store-topkhana-cantt.jpg",
  },
];

const prisma = new PrismaClient();

async function main() {
  let added = 0;
  let updated = 0;
  for (const e of ENTRIES) {
    let hit: Hit | null = null;
    let usedQuery = "";
    for (const q of e.queries) {
      hit = await geocode(q);
      if (hit) {
        usedQuery = q;
        break;
      }
      await sleep(180);
    }
    const lat = hit?.lat ?? e.fallback.lat;
    const lng = hit?.lng ?? e.fallback.lng;

    const data = {
      name: e.name,
      nameHi: e.nameHi,
      description: e.description,
      descriptionHi: e.descriptionHi,
      address: e.address,
      addressHi: e.addressHi,
      area: e.area,
      landmark: e.landmark ?? null,
      lat,
      lng,
      tuesdayDates: JSON.stringify(e.dates),
      timeStart: e.timeStart,
      timeEnd: e.timeEnd,
      menu: JSON.stringify(e.menu),
      menuHi: JSON.stringify(menuHiFor(e.menu)),
      organizerName: e.organizerName,
      organizerPhone: e.organizerPhone,
      photoUrl: e.photoUrl,
      googleMapsUrl: `https://www.google.com/maps?q=${lat},${lng}&z=18`,
      status: "APPROVED",
      approvedAt: new Date(),
      isVerified: false,
    };

    const existing = await prisma.bhandara.findUnique({
      where: { slug: e.slug },
      select: { id: true },
    });
    await prisma.bhandara.upsert({
      where: { slug: e.slug },
      update: data,
      create: { slug: e.slug, ...data },
    });
    if (existing) updated++;
    else added++;

    console.log(`  ${existing ? "↻" : "+"} ${e.slug}`);
    console.log(
      `    geocode: ${hit ? `✓ ${usedQuery} → ${hit.matched}` : `✗ fallback ${e.fallback.lat}, ${e.fallback.lng}`}`,
    );
    console.log(`    coords : ${lat}, ${lng}`);
  }
  console.log(`\n✓ batch-4 complete. ${added} added, ${updated} updated.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
