/**
 * Audit pass: for every Bhandara row, compute the Haversine distance
 * between its stored lat/lng and the rough centroid of the area it
 * claims to be in. Anything > 3 km is almost certainly geocoded into
 * the wrong neighbourhood (Ola occasionally resolves Aliganj's "TD
 * Girls College" to a same-name venue in another locality).
 *
 *   npx tsx prisma/verify-pins.ts
 */
import { PrismaClient } from "@prisma/client";

// Rough centroid per Lucknow area. Hand-picked from satellite — accurate
// to ±1 km, which is what we need for "is this pin in the right
// neighbourhood?" sanity checks.
const AREA_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  Aishbagh: { lat: 26.840, lng: 80.905 },
  Alambagh: { lat: 26.815, lng: 80.890 },
  Aliganj: { lat: 26.895, lng: 80.940 },
  Aminabad: { lat: 26.847, lng: 80.925 },
  "Bakshi Ka Talab": { lat: 26.998, lng: 80.945 },
  Charbagh: { lat: 26.830, lng: 80.920 },
  Chinhat: { lat: 26.890, lng: 81.060 },
  Chowk: { lat: 26.860, lng: 80.910 },
  Daliganj: { lat: 26.870, lng: 80.930 },
  Faizullaganj: { lat: 26.913, lng: 80.917 },
  "Gomti Nagar": { lat: 26.860, lng: 80.995 },
  "Gomti Nagar Extension": { lat: 26.855, lng: 81.030 },
  "Hanuman Setu": { lat: 26.860, lng: 80.940 },
  Hazratganj: { lat: 26.853, lng: 80.946 },
  "IIM Road": { lat: 26.928, lng: 80.890 },
  "Indira Nagar": { lat: 26.873, lng: 80.998 },
  Jankipuram: { lat: 26.920, lng: 80.940 },
  Kaiserbagh: { lat: 26.857, lng: 80.927 },
  Kalyanpur: { lat: 26.917, lng: 80.973 },
  Kapoorthala: { lat: 26.884, lng: 80.950 },
  "Krishna Nagar": { lat: 26.795, lng: 80.890 },
  Mahanagar: { lat: 26.880, lng: 80.953 },
  Mohanlalganj: { lat: 26.685, lng: 81.010 },
  Munshipulia: { lat: 26.882, lng: 80.990 },
  "Naka Hindola": { lat: 26.838, lng: 80.918 },
  Nishatganj: { lat: 26.865, lng: 80.950 },
  Polytechnic: { lat: 26.860, lng: 81.005 },
  Rajajipuram: { lat: 26.840, lng: 80.870 },
  "Sarojini Nagar": { lat: 26.740, lng: 80.860 },
  "Sitapur Road": { lat: 26.940, lng: 80.945 },
  "Sushant Golf City": { lat: 26.770, lng: 80.985 },
  Telibagh: { lat: 26.760, lng: 80.910 },
  "University Road": { lat: 26.870, lng: 80.940 },
  "Vibhuti Khand": { lat: 26.857, lng: 81.005 },
  "Vikas Nagar": { lat: 26.917, lng: 80.948 },
  "Vrindavan Yojna": { lat: 26.770, lng: 80.970 },
};

const THRESHOLD_KM = 3;

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

async function main() {
  const rows = await prisma.bhandara.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      slug: true,
      name: true,
      area: true,
      lat: true,
      lng: true,
      address: true,
    },
  });

  console.log(`Auditing ${rows.length} bhandaras against area centroids…\n`);

  let suspects = 0;
  let ok = 0;
  for (const r of rows) {
    const c = AREA_CENTROIDS[r.area];
    if (!c) {
      console.log(`  ? ${r.slug}: no centroid for area "${r.area}"`);
      continue;
    }
    const km = haversineKm(c, { lat: r.lat, lng: r.lng });
    if (km > THRESHOLD_KM) {
      suspects += 1;
      console.log(`  ⚠ ${r.slug}`);
      console.log(`    area    : ${r.area}`);
      console.log(`    address : ${r.address}`);
      console.log(`    pinned  : ${r.lat}, ${r.lng}`);
      console.log(`    distance: ${km.toFixed(2)} km from area centroid`);
      console.log();
    } else {
      ok += 1;
    }
  }
  console.log(
    `\nDone. ${ok} look fine, ${suspects} need attention (>${THRESHOLD_KM} km off).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
