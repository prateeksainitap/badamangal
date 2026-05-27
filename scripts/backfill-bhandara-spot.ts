/**
 * One-off: backfill an APPROVED companion Spot for a Bhandara that
 * the bot ingested before the spot-promotion fix landed. The pending
 * Bhandara already carries the photo + geocoded lat/lng; we just
 * need to mirror it into the Spot table so the homepage live-chat
 * panel + map pick it up.
 *
 * Skips if a Spot for this bhandara already exists.
 *
 * Usage:
 *   npx tsx scripts/backfill-bhandara-spot.ts <bhandara-id> [--execute]
 */
import { prisma } from "../src/lib/db";

const SPOT_TTL_HOURS = 8;

async function main() {
  const id = process.argv[2];
  const execute = process.argv.includes("--execute");
  if (!id) {
    console.error("usage: tsx backfill-bhandara-spot.ts <bhandara-id> [--execute]");
    process.exit(1);
  }

  const row = await prisma.bhandara.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      area: true,
      address: true,
      lat: true,
      lng: true,
      photoUrl: true,
      status: true,
    },
  });
  if (!row) {
    console.error(`bhandara not found: ${id}`);
    process.exit(1);
  }
  console.log("source:", row);

  if (!row.photoUrl) {
    console.error("no photoUrl on bhandara, cannot backfill spot");
    process.exit(1);
  }
  if (row.lat === 0 || row.lng === 0) {
    console.error("lat/lng is 0,0, refuse to plant a wrong pin");
    process.exit(1);
  }

  const existing = await prisma.spot.findFirst({
    where: { bhandaraId: row.id },
    select: { id: true, status: true },
  });
  if (existing) {
    console.log("existing spot:", existing, "- nothing to do");
    return;
  }

  if (!execute) {
    console.log("\n[dry-run] would create APPROVED Spot with:");
    console.log({
      lat: row.lat,
      lng: row.lng,
      area: row.area,
      address: row.address,
      photoUrl: row.photoUrl,
      caption: row.name,
      bhandaraId: row.id,
      expiresAt: new Date(Date.now() + SPOT_TTL_HOURS * 60 * 60 * 1000),
    });
    console.log("\nRe-run with --execute to actually create.");
    return;
  }

  const expiresAt = new Date(Date.now() + SPOT_TTL_HOURS * 60 * 60 * 1000);
  const created = await prisma.spot.create({
    data: {
      lat: row.lat,
      lng: row.lng,
      area: row.area || null,
      address: row.address || null,
      photoUrl: row.photoUrl,
      caption: row.name,
      language: "mixed",
      reporterName: "Prateek Saini",
      reporterPhoneHash: null,
      status: "APPROVED",
      expiresAt,
      ipHash: "bot:whatsapp:bhandara-poster",
      bhandaraId: row.id,
    },
    select: { id: true, expiresAt: true },
  });
  console.log("created spot:", created);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
