/**
 * One-off: re-run classifyBhandaraMessage over every active
 * BhandaraMention row using the NEW prompt + groupName context.
 * For each row, compare the new classification against the stored
 * intent / locationLabel / cleanedText. When the new output is more
 * useful (landmark-precise label, corrected intent), UPDATE the row.
 *
 * Costs one Gemini Flash text-classify call per active row. Cheap
 * (~6 calls for a typical live feed) and isolated to admin-run.
 *
 * Usage:
 *   npx tsx scripts/reclassify-mentions.ts            (dry-run)
 *   npx tsx scripts/reclassify-mentions.ts --execute  (apply updates)
 */
import { readFileSync } from "node:fs";
import path from "node:path";
// Next.js auto-loads .env at runtime; standalone tsx doesn't, and
// dotenv isn't in the project's deps. Parse the file manually -
// enough KEY="value" / KEY=value handling for our subset
// (DATABASE_URL, GEMINI_API_KEY).
function loadEnv(filename: string) {
  try {
    const raw = readFileSync(path.resolve(process.cwd(), filename), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      const [, k, v] = m;
      if (process.env[k]) continue; // don't clobber already-set values
      process.env[k] = v.replace(/^["']|["']$/g, "");
    }
  } catch {
    /* file missing → fall through to existing env */
  }
}
loadEnv(".env.local");
loadEnv(".env");

import { prisma } from "../src/lib/db";
import { classifyBhandaraMessage } from "../src/lib/vision";

async function main() {
  const execute = process.argv.includes("--execute");
  const rows = await prisma.bhandaraMention.findMany({
    where: { status: "APPROVED", expiresAt: { gt: new Date() } },
    select: {
      id: true,
      cleanedText: true,
      originalText: true,
      groupName: true,
      senderName: true,
      intent: true,
      locationLabel: true,
      locationSource: true,
    },
    orderBy: { createdAt: "desc" },
  });
  console.log(`\nactive mentions to reclassify: ${rows.length}\n`);

  let updateCount = 0;
  for (const r of rows) {
    const sourceText = r.cleanedText ?? r.originalText.split("\n\n[bot:")[0] ?? "";
    if (!sourceText.trim()) continue;
    let classified;
    try {
      classified = await classifyBhandaraMessage(
        sourceText,
        r.groupName ?? undefined,
      );
    } catch (err) {
      console.log(`  ${r.id}  CLASSIFY ERROR:`, (err as Error).message);
      continue;
    }
    const newIntent =
      classified.intent === "ASKING" ||
      classified.intent === "SHARING" ||
      classified.intent === "MENTIONING"
        ? classified.intent
        : r.intent;
    // Guard against the multi-location overwrite bug: when the
    // classifier returns more than one location, the existing row
    // is one slice of a split (locationLabels[i]) and we can't tell
    // which i it was. Skip the label update and keep the existing
    // value - at worst we miss a precision bump on a multi-location
    // row, which is far better than collapsing Chinhat/Amity rows
    // onto Kamta the way the first run did.
    const isMultiLocation = (classified.locationLabels?.length ?? 0) > 1;
    const newLabel = isMultiLocation
      ? r.locationLabel
      : classified.locationLabel?.trim() || r.locationLabel;
    const changed =
      newIntent !== r.intent || (newLabel || "") !== (r.locationLabel || "");
    console.log(`--`);
    console.log(`  ${r.id}  ${r.senderName ?? "?"} @ ${r.groupName ?? "?"}`);
    console.log(`  text:    "${sourceText.slice(0, 80)}"`);
    console.log(`  intent:  ${r.intent}  →  ${newIntent}${changed ? "  *" : ""}`);
    console.log(`  loc:     ${r.locationLabel ?? "-"}  →  ${newLabel ?? "-"}${changed ? "  *" : ""}`);
    if (changed && execute) {
      await prisma.bhandaraMention.update({
        where: { id: r.id },
        data: {
          intent: newIntent,
          locationLabel: newLabel,
        },
      });
      updateCount += 1;
    } else if (changed) {
      updateCount += 1;
    }
  }
  console.log(
    `\n${execute ? "[execute] updated" : "[dry-run] would update"} ${updateCount} row(s).`,
  );
  if (!execute) console.log("Re-run with --execute to apply.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
