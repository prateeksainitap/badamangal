/**
 * Bot liveness heartbeat.
 *
 * The MacBook running the WhatsApp bot (Baileys) pings this every
 * ~5 minutes via launchd / cron. We upsert a SiteCounter row whose
 * `updatedAt` is auto-managed by Prisma, becoming our "last seen"
 * timestamp. `/admin` reads it and renders "Bot last seen N min ago".
 *
 * Why we reuse SiteCounter instead of adding a new model:
 *   - zero schema changes (no `prisma db push` needed before deploy)
 *   - the existing row pattern (id="home", id="bot_heartbeat_…")
 *     scales to any future "single value" we want to track
 *
 * Bearer-gated on `BOT_INGEST_SECRET` (same secret the bot already
 * holds for /api/bot/ingest etc). Without this gate the URL is a
 * public DB-write endpoint, anyone could `while true; curl ...` to
 * pollute Vercel function logs + waste DB writes indefinitely. The
 * bot already passes the header on every other call, so requiring it
 * here is zero friction on the legitimate path.
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_SOURCES = new Set(["mbp", "vps", "test", "manual"]);

export async function GET(req: NextRequest) {
  // Bearer auth, match the other /api/bot/* routes.
  const expected = process.env.BOT_INGEST_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "ingest_disabled" },
      { status: 500 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

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
