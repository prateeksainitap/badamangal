// One-shot runner for the send-tracking columns migration.
//
// Uses the same Prisma client + pooler the app uses, so it doesn't
// need the schema engine (which can't talk through pgbouncer=true).
// Statements are split and executed one at a time so each is its
// own transaction-pooled round-trip.
//
// Idempotent: every statement uses IF NOT EXISTS.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS = [
  `ALTER TABLE "Content" ADD COLUMN IF NOT EXISTS "lastSentAt" TIMESTAMP(3)`,
  `ALTER TABLE "Content" ADD COLUMN IF NOT EXISTS "lastSentTo" TEXT`,
  `ALTER TABLE "Content" ADD COLUMN IF NOT EXISTS "awaitingReply" BOOLEAN NOT NULL DEFAULT false`,
  `CREATE INDEX IF NOT EXISTS "Content_lastSentAt_idx" ON "Content" ("lastSentAt")`,
  `CREATE INDEX IF NOT EXISTS "Content_awaitingReply_lastSentAt_idx" ON "Content" ("awaitingReply", "lastSentAt")`,
];

async function main() {
  console.log("[migrate] applying Content send-tracking columns…");
  for (const sql of STATEMENTS) {
    process.stdout.write(`  • ${sql.slice(0, 80)}${sql.length > 80 ? "…" : ""} `);
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log("ok");
    } catch (err) {
      console.log("FAILED");
      console.error(err);
      process.exitCode = 1;
      break;
    }
  }
  await prisma.$disconnect();
  console.log("[migrate] done.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
