/**
 * One-off: delete a Spot by id. Used to clean up the wrongly-
 * backfilled Spot that the previous `backfill-bhandara-spot.ts`
 * created for a pamphlet bhandara — pamphlets belong in the admin
 * queue only, not as Spots on the live chat panel.
 *
 * Usage:
 *   npx tsx scripts/delete-spot.ts <spot-id> [--execute]
 */
import { prisma } from "../src/lib/db";

async function main() {
  const id = process.argv[2];
  const execute = process.argv.includes("--execute");
  if (!id) {
    console.error("usage: tsx delete-spot.ts <spot-id> [--execute]");
    process.exit(1);
  }
  const row = await prisma.spot.findUnique({
    where: { id },
    select: { id: true, status: true, photoUrl: true, bhandaraId: true, caption: true },
  });
  console.log("target:", row);
  if (!row) return;
  if (!execute) {
    console.log("\n[dry-run] re-run with --execute to delete.");
    return;
  }
  await prisma.spot.delete({ where: { id } });
  console.log("deleted.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
