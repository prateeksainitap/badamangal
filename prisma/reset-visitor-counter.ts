/**
 * Reset the homepage visitor counter to 0.
 *
 * Why: dev + preview traffic during the build phase has inflated
 * the counter past whatever launch milestone the team wants the
 * public to see ("welcome, visitor #1"). This zeroes it so the
 * very first production hit reads as visitor #1 and the number
 * grows organically from there.
 *
 * The counter is otherwise fully live - every server-side render
 * of the homepage increments it via `getHomepageStats()` in
 * src/lib/stats.ts (a Prisma upsert + increment, atomic). So
 * after this reset, no further code change is needed - production
 * traffic just builds it back up.
 *
 * Safe to re-run. Idempotent - if the counter is already 0 it
 * stays 0; if it's bigger, it goes to 0.
 *
 * Run:
 *   npx tsx prisma/reset-visitor-counter.ts
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(__dirname, "..", ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^"(.*)"$/, "$1");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}
loadEnvLocal();

const prisma = new PrismaClient();

async function main() {
  const before = await prisma.siteCounter.findUnique({
    where: { id: "home" },
    select: { count: true },
  });
  console.log(`  before: ${before?.count ?? 0}`);

  await prisma.siteCounter.upsert({
    where: { id: "home" },
    update: { count: 0 },
    create: { id: "home", count: 0 },
  });

  const after = await prisma.siteCounter.findUnique({
    where: { id: "home" },
    select: { count: true },
  });
  console.log(`  after:  ${after?.count ?? 0}`);
  console.log("✓ visitor counter reset");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
