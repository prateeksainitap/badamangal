// One-shot diagnostic: find ALL Bhandara rows that share a bot image
// hash (extracted from the `[bot:... · hash:XXXX ...]` description
// tags) and group them. Any group with > 1 row is a race-condition
// duplicate the byte-hash dedup missed.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const rows = await prisma.bhandara.findMany({
  where: {
    status: { in: ["PENDING", "APPROVED"] },
    description: { contains: "hash:" },
  },
  select: {
    id: true,
    slug: true,
    name: true,
    area: true,
    address: true,
    tuesdayDates: true,
    organizerPhone: true,
    description: true,
    createdAt: true,
    status: true,
  },
});

const byHash = new Map();
for (const r of rows) {
  const m = r.description?.match(/hash:([a-f0-9]+)/);
  if (!m) continue;
  const h = m[1];
  if (!byHash.has(h)) byHash.set(h, []);
  byHash.get(h).push(r);
}

const dupes = [...byHash.entries()].filter(([, list]) => list.length > 1);
console.log(`Total rows with image hash: ${rows.length}`);
console.log(`Distinct hashes: ${byHash.size}`);
console.log(`Hashes with duplicates: ${dupes.length}\n`);

for (const [hash, list] of dupes) {
  console.log(`--- hash:${hash} → ${list.length} rows ---`);
  for (const r of list) {
    console.log(`  ${r.id}  ${r.status}  ${r.area}  "${r.name.slice(0, 50)}"  created ${r.createdAt.toISOString()}`);
    console.log(`    dates: ${r.tuesdayDates}`);
    console.log(`    address: ${JSON.stringify(r.address)}`);
  }
  console.log("");
}

await prisma.$disconnect();
