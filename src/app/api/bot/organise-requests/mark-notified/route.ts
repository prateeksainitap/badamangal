/**
 * Bot-only: confirm that the WhatsApp team alert was delivered for
 * one or more OrganiseRequest rows. Stamps `notifiedAt = now()` so
 * the next /pending poll won't return them again.
 *
 * Auth: Bearer BOT_INGEST_SECRET (same secret as /api/bot/ingest).
 *
 * Body: { ids: string[] }   — list of OrganiseRequest IDs the bot
 *                              just successfully sent into the group.
 *
 * Why a separate endpoint vs auto-marking on /pending:
 *   If the bot fetched + auto-marked, then crashed before sending,
 *   the team would never be alerted but the row would look
 *   "notified" forever. Explicit mark-after-send eliminates that
 *   silent-loss class of bugs. Cost: one extra HTTP call per poll
 *   cycle, sub-100ms each.
 *
 * Idempotent: re-marking an already-notified row is a no-op
 * (Prisma updateMany matches WHERE notifiedAt IS NULL → updates 0).
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 5;

const MAX_IDS_PER_CALL = 50;

function jsonError(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const expected = process.env.BOT_INGEST_SECRET;
  if (!expected) {
    return jsonError(500, "ingest_disabled");
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return jsonError(403, "forbidden");
  }

  let body: { ids?: unknown };
  try {
    body = (await req.json()) as { ids?: unknown };
  } catch {
    return jsonError(400, "invalid_json");
  }

  const rawIds = Array.isArray(body.ids) ? body.ids : [];
  const ids = rawIds
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .slice(0, MAX_IDS_PER_CALL);

  if (ids.length === 0) {
    return jsonError(400, "missing_ids");
  }

  // updateMany + WHERE notifiedAt IS NULL → only flips rows that are
  // genuinely pending. Lets the bot safely re-send the same id list
  // without double-counting or overwriting an earlier timestamp.
  const result = await prisma.organiseRequest.updateMany({
    where: { id: { in: ids }, notifiedAt: null },
    data: { notifiedAt: new Date() },
  });

  return NextResponse.json({
    ok: true,
    requestedIds: ids.length,
    markedNotified: result.count,
  });
}
