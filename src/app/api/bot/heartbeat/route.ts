/**
 * Bot liveness heartbeat.
 *
 * The MacBook running the OpenClaw agent pings this every 5 minutes via
 * a cron entry. We upsert a SiteCounter row whose `updatedAt` is auto-
 * managed by Prisma — `updatedAt` becomes our "last seen" timestamp.
 * `/admin` reads it and renders "Bot last seen N min ago".
 *
 * Why we reuse SiteCounter instead of adding a new model:
 *   - zero schema changes (no `prisma db push` needed before deploy)
 *   - the existing row pattern (id="home", id="bot_heartbeat_…")
 *     scales to any future "single value" we want to track
 *
 * The endpoint is intentionally cheap + public-readable (no Bearer
 * required). If anyone discovers the URL and curls it, the worst they
 * do is bump `updatedAt` — same effect as the bot's normal ping.
 * We *could* gate it on BOT_INGEST_SECRET like /ingest, but missing
 * pings need to be the alarm signal, so we'd rather minimize the
 * number of ways a real ping can be rejected.
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_SOURCES = new Set(["mbp", "vps", "test", "manual"]);

export async function GET(req: NextRequest) {
  const sourceParam = req.nextUrl.searchParams.get("source") ?? "mbp";
  const source = ALLOWED_SOURCES.has(sourceParam) ? sourceParam : "mbp";
  const id = `bot_heartbeat_${source}`;

  const row = await prisma.siteCounter.upsert({
    where: { id },
    update: { count: { increment: 1 } },
    create: { id, count: 1 },
    select: { count: true, updatedAt: true },
  });

  return NextResponse.json(
    {
      ok: true,
      source,
      count: row.count,
      at: row.updatedAt.toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
