// Merge Bhandara rows that share a bot image hash. These were
// produced by the concurrent-ingest race condition where two
// /api/bot/ingest calls from different WhatsApp groups arrive within
// seconds, both query-for-duplicates before either commits, both pass
// the dedup gate, and both INSERT new rows.
//
// For each hash group:
//   * Sort by (status APPROVED first, then createdAt ascending). The
//     oldest APPROVED row is the canonical winner. If no APPROVED in
//     the group, the oldest row wins regardless.
//   * For each loser:
//       - Append a `[bot:merged-from-dup ...]` line to the winner's
//         description so the audit trail survives.
//       - Union the loser's tuesdayDates into the winner's date list.
//       - Delete the loser.
//   * For the winner: pick the longest non-empty value for address
//     and organizerName (handles the "Lucknow." vs "Lucknow" variants
//     by keeping whichever string carries more characters).
//
// Run with --dry-run to print what would happen without writing.
//
// Idempotent: re-running after a merge is a no-op (the hash groups
// will have only one row each).

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

function bestString(a, b) {
  const sa = (a ?? "").trim();
  const sb = (b ?? "").trim();
  if (!sa) return sb;
  if (!sb) return sa;
  return sa.length >= sb.length ? sa : sb;
}

function parseDates(stringOrArray) {
  // tuesdayDates is stored as a JSON-stringified array in the DB
  // column, e.g. `["2026-05-28","2026-05-29"]`. Prisma returns it as
  // a string. We parse it back to an array before unioning.
  if (!stringOrArray) return [];
  if (Array.isArray(stringOrArray)) return stringOrArray;
  try {
    const parsed = JSON.parse(stringOrArray);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function unionDates(a, b) {
  const out = new Set();
  for (const d of parseDates(a)) out.add(d);
  for (const d of parseDates(b)) out.add(d);
  return [...out].sort();
}

function extractHash(desc) {
  const m = desc?.match(/hash:([a-f0-9]+)/);
  return m ? m[1] : null;
}

async function main() {
  const rows = await prisma.bhandara.findMany({
    where: {
      status: { in: ["PENDING", "APPROVED"] },
      description: { contains: "hash:" },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      nameHi: true,
      area: true,
      address: true,
      organizerName: true,
      organizerPhone: true,
      tuesdayDates: true,
      description: true,
      createdAt: true,
      status: true,
      photoUrl: true,
    },
  });

  const byHash = new Map();
  for (const r of rows) {
    const h = extractHash(r.description);
    if (!h) continue;
    if (!byHash.has(h)) byHash.set(h, []);
    byHash.get(h).push(r);
  }

  const dupes = [...byHash.entries()].filter(([, list]) => list.length > 1);
  console.log(
    `Found ${rows.length} bot-ingested rows, ${byHash.size} distinct hashes, ` +
      `${dupes.length} hashes with duplicates.\n`,
  );

  let merged = 0;
  let deleted = 0;

  for (const [hash, list] of dupes) {
    // Sort: APPROVED first (status comes before PENDING alphabetically
    // by accident, so reverse on status), then oldest first.
    list.sort((a, b) => {
      const sa = a.status === "APPROVED" ? 0 : 1;
      const sb = b.status === "APPROVED" ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    const winner = list[0];
    const losers = list.slice(1);

    console.log(`hash:${hash}  ${list.length} rows`);
    console.log(`  winner: ${winner.id} (${winner.status}, ${winner.createdAt.toISOString()})`);
    console.log(`          "${winner.name?.slice(0, 50)}"`);

    // Reconcile winner fields from losers.
    let bestAddress = winner.address;
    let bestOrgName = winner.organizerName;
    let dates = winner.tuesdayDates;
    const mergedFromTags = [];

    for (const loser of losers) {
      bestAddress = bestString(bestAddress, loser.address);
      bestOrgName = bestString(bestOrgName, loser.organizerName);
      dates = unionDates(dates, loser.tuesdayDates);
      mergedFromTags.push(
        `[bot:merged-from-dup · id:${loser.id} · status:${loser.status} · created:${loser.createdAt.toISOString()}]`,
      );
      console.log(`  loser:  ${loser.id} (${loser.status}, ${loser.createdAt.toISOString()})`);
    }

    if (DRY_RUN) {
      console.log(`  [dry-run] would update winner address: ${JSON.stringify(bestAddress)}`);
      console.log(`  [dry-run] would update winner dates: ${JSON.stringify(dates)}`);
      console.log(`  [dry-run] would delete ${losers.length} loser row(s)\n`);
      continue;
    }

    // Update winner first, then delete losers. If we deleted losers
    // first and the update failed, we'd have lost data.
    await prisma.bhandara.update({
      where: { id: winner.id },
      data: {
        address: bestAddress,
        organizerName: bestOrgName,
        tuesdayDates: JSON.stringify(dates),
        description: `${winner.description ?? ""}\n${mergedFromTags.join("\n")}`,
      },
    });

    for (const loser of losers) {
      await prisma.bhandara.delete({ where: { id: loser.id } });
      deleted++;
    }
    merged++;
    console.log(`  ✓ merged, deleted ${losers.length} loser(s)\n`);
  }

  console.log(`\nDone. Merged ${merged} groups, deleted ${deleted} duplicate rows.`);
  if (DRY_RUN) console.log(`(DRY RUN: no changes written.)`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
