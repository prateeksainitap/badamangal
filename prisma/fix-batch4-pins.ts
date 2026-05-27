/**
 * One-off fix: two slugs from batch-4 got geocoded into the wrong
 * neighbourhood (the Ola geocoder fell through to a same-name venue
 * in another locality). Pin them to the curated area centroid instead
 * - within ~1 km of where they should be, which is close enough for
 * "show me bhandaras in this part of the city" UX.
 *
 *   npx tsx prisma/fix-batch4-pins.ts
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

const FIXES: Array<{ slug: string; lat: number; lng: number; reason: string }> = [
  {
    slug: "janki-plaza-jankipuram",
    lat: 26.92,
    lng: 80.928,
    reason:
      "Ola fell through to a 226003 (Rajajipuram) centroid for the autocomplete fallback; Jankipuram centroid is ~26.92, 80.93.",
  },
  {
    slug: "shree-manas-mandir-manas-city",
    lat: 26.855,
    lng: 81.045,
    reason:
      "Ola matched a same-name 'Shree Durga Manas Mandir' in Chinhat. Manas City sits in Gomti Nagar Extension ~26.855, 81.045.",
  },
  {
    slug: "sapeyul-aman-nagar-rajajipuram",
    lat: 26.832,
    lng: 80.879,
    reason:
      "Ola only returned the city-level centroid for the autocomplete pass. Rajajipuram-Aman Nagar lives further south-west.",
  },
];

const prisma = new PrismaClient();

async function main() {
  for (const f of FIXES) {
    const updated = await prisma.bhandara.update({
      where: { slug: f.slug },
      data: {
        lat: f.lat,
        lng: f.lng,
        googleMapsUrl: `https://www.google.com/maps?q=${f.lat},${f.lng}&z=18`,
      },
      select: { slug: true, lat: true, lng: true },
    });
    console.log(`  ✓ ${updated.slug} → ${updated.lat}, ${updated.lng}`);
    console.log(`    ${f.reason}`);
  }
  console.log("\n✓ batch-4 pins repaired.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
