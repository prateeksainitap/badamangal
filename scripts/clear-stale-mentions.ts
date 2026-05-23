/**
 * One-shot: clear stale BhandaraMention rows that are showing on the
 * homepage LiveChatterBoard but no longer reflect live activity (e.g.
 * leftover starter rows from a previous Bada Mangal Tuesday whose 24h
 * TTL hasn't elapsed yet). New rows from the live bot ingest are
 * untouched if they arrived in the last 30 minutes.
 *
 * Run with --execute to actually delete; otherwise dry-run.
 */
import { prisma } from "../src/lib/db";

const FRESH_WINDOW_MIN = 30;

async function main() {
  const execute = process.argv.includes("--execute");
  const cutoff = new Date(Date.now() - FRESH_WINDOW_MIN * 60 * 1000);

  const stale = await prisma.bhandaraMention.findMany({
    where: { createdAt: { lt: cutoff } },
    select: {
      id: true,
      senderName: true,
      groupName: true,
      cleanedText: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(
    `\n[mentions] ${stale.length} row(s) older than ${FRESH_WINDOW_MIN}m (cutoff ${cutoff.toISOString()}):`,
  );
  for (const m of stale) {
    const text = (m.cleanedText ?? "").slice(0, 70).replace(/\n/g, " ");
    console.log(
      `  ${m.id}  ${m.createdAt.toISOString()}  sender=${m.senderName ?? "?"}  group=${m.groupName ?? "?"}  "${text}"`,
    );
  }

  if (!execute) {
    console.log(
      `\n[dry-run] no deletes performed. Re-run with --execute to delete ${stale.length} rows.`,
    );
    return;
  }

  if (stale.length === 0) {
    console.log("\n[execute] nothing to delete.");
    return;
  }

  const del = await prisma.bhandaraMention.deleteMany({
    where: { id: { in: stale.map((m) => m.id) } },
  });
  console.log(`\n[execute] deleted ${del.count} mention row(s).`);
}

main()
  .catch((err) => {
    console.error("FATAL:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
