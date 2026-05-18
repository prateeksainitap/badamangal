/**
 * Bot-only: list OrganiseRequest rows that haven't been broadcast to
 * the WhatsApp team group yet.
 *
 * Auth:
 *   Bearer token == BOT_INGEST_SECRET. Same secret as /api/bot/ingest
 *   so the spare-Mac bot.mjs reuses one env var for everything.
 *
 * Flow:
 *   bot.mjs polls this endpoint every ~60s → receives up to 20
 *   unnotified rows (oldest first) → for each, formats and sends a
 *   WhatsApp message into the BM Ingest 2 group → POSTs the ids
 *   that succeeded to /mark-notified, which stamps `notifiedAt`.
 *
 *   Robust against bot crashes: if delivery fails the row stays
 *   `notifiedAt = NULL` and is returned again on the next poll.
 *   No duplicate WhatsApp messages on success because the bot only
 *   calls mark-notified AFTER the WhatsApp send resolves.
 *
 * Response shape:
 *   { ok: true, requests: [{ id, name, phone, ... }] }
 *
 * Limit: hard-capped at 20 rows per response so a backlog can't
 * blow up the bot's send queue or trip WhatsApp rate-limits.
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Tiny payload, no image work, no Gemini. 5s is more than enough.
export const maxDuration = 5;

const MAX_BATCH = 20;

function jsonError(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const expected = process.env.BOT_INGEST_SECRET;
  if (!expected) {
    return jsonError(500, "ingest_disabled");
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return jsonError(403, "forbidden");
  }

  const rows = await prisma.organiseRequest.findMany({
    where: { notifiedAt: null },
    orderBy: { createdAt: "asc" },
    take: MAX_BATCH,
  });

  // Strip ipHash + userAgent from the bot-facing payload — those are
  // moderation-only fields, no reason for the bot to receive them.
  // Everything else the bot needs to format a useful WhatsApp message
  // (name, phone, dates, package, etc.) stays.
  const requests = rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email,
    area: r.area,
    addressNotes: r.addressNotes,
    eventDates: r.eventDates,
    eventTime: r.eventTime,
    quantityType: r.quantityType,
    quantityValue: r.quantityValue,
    packageTier: r.packageTier,
    notes: r.notes,
    source: r.source,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));

  return NextResponse.json({ ok: true, requests });
}
