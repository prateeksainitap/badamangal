/**
 * Pre-launch cleanup: remove test BhandaraMention rows + Spot rows
 * created during the WhatsApp text-ingest test phase.
 *
 * Test rows are identified by sender / group / msgId patterns that
 * only the test harness ever produced:
 *   - senderName starts with "multi-loc-test", "merge-seq-", "merge-final-"
 *   - groupName equals "BM Ingest 2" or "Bada Mangal 2" (bot's working
 *     channels, not public groups)
 *   - msgId starts with "multi-loc-test", "merge-seq", "merge-final"
 *
 * Spot rows have no sender column, so we identify them via:
 *   - caption contains "[bot:whatsapp-text" AND reporterName matches
 *     one of the test sender patterns, OR
 *   - caption contains a known test marker (msgId fragment)
 *
 * Two-pass: dry-run prints what would be deleted; pass --execute
 * to actually delete.
 *
 * Usage:
 *   bun run scripts/clean-test-mentions.ts            (dry-run)
 *   bun run scripts/clean-test-mentions.ts --execute  (delete)
 */
import { prisma } from "../src/lib/db";

const TEST_SENDER_PATTERNS = [
  "multi-loc-test",
  "merge-seq-",
  "merge-final-",
  "merge-final ",
  "merge-seq ",
  "claude-", // dev-time test inserts from this Claude session
];
const TEST_GROUP_NAMES = [
  "BM Ingest 2",
  "Bada Mangal 2",
  "smoke", // synthetic group label used during text-ingest smoke tests
  "merge-test",
  "merge-final",
];

async function main() {
  const execute = process.argv.includes("--execute");

  // ── BhandaraMention rows ────────────────────────────────────────
  const mentions = await prisma.bhandaraMention.findMany({
    where: {
      OR: [
        ...TEST_SENDER_PATTERNS.map((p) => ({
          senderName: { startsWith: p },
        })),
        { groupName: { in: TEST_GROUP_NAMES } },
        ...TEST_SENDER_PATTERNS.map((p) => ({
          msgId: { startsWith: p },
        })),
      ],
    },
    select: {
      id: true,
      senderName: true,
      groupName: true,
      cleanedText: true,
      lat: true,
      lng: true,
      createdAt: true,
      status: true,
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`\n[mentions] matched ${mentions.length} test rows:`);
  for (const m of mentions) {
    const text = (m.cleanedText ?? "").slice(0, 60).replace(/\n/g, " ");
    console.log(
      `  ${m.id}  sender=${m.senderName ?? "?"}  group=${m.groupName ?? "?"}  status=${m.status}  "${text}"`,
    );
  }

  // ── Spot rows created via the text-ingest bridge ────────────────
  const spots = await prisma.spot.findMany({
    where: {
      OR: [
        { ipHash: "bot:whatsapp:text" },
        ...TEST_SENDER_PATTERNS.map((p) => ({
          reporterName: { startsWith: p },
        })),
      ],
    },
    select: {
      id: true,
      reporterName: true,
      caption: true,
      area: true,
      createdAt: true,
      status: true,
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`\n[spots] matched ${spots.length} test rows:`);
  for (const s of spots) {
    const cap = (s.caption ?? "").slice(0, 60).replace(/\n/g, " ");
    console.log(
      `  ${s.id}  reporter=${s.reporterName ?? "?"}  area=${s.area ?? "?"}  status=${s.status}  "${cap}"`,
    );
  }

  if (!execute) {
    console.log(
      `\n[dry-run] no deletes performed. Re-run with --execute to delete ${mentions.length} mentions + ${spots.length} spots.`,
    );
    return;
  }

  if (mentions.length === 0 && spots.length === 0) {
    console.log("\n[execute] nothing to delete.");
    return;
  }

  const delMentions = await prisma.bhandaraMention.deleteMany({
    where: { id: { in: mentions.map((m) => m.id) } },
  });
  const delSpots = await prisma.spot.deleteMany({
    where: { id: { in: spots.map((s) => s.id) } },
  });
  console.log(
    `\n[execute] deleted ${delMentions.count} mentions + ${delSpots.count} spots.`,
  );
}

main()
  .catch((err) => {
    console.error("FATAL:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
