/**
 * One-off: print the pending Bhandara that was ingested today
 * from the BM Ingest 2 WhatsApp group so I can decide whether
 * to backfill a companion Spot. Doesn't mutate anything.
 */
import { prisma } from "../src/lib/db";

async function main() {
  const slug = process.argv[2] ?? "pandey-pariwar-sundarkand-bhandara";
  const row = await prisma.bhandara.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      area: true,
      address: true,
      lat: true,
      lng: true,
      status: true,
      photoUrl: true,
      createdAt: true,
    },
  });
  console.log(row);
  if (row) {
    const existingSpot = await prisma.spot.findFirst({
      where: { bhandaraId: row.id },
      select: { id: true, status: true, photoUrl: true, expiresAt: true },
    });
    console.log("existingSpot:", existingSpot);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
