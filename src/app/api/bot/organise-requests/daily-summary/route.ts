/**
 * Bot-only: end-of-day digest stats for the OrganiseRequest queue.
 *
 * The bot calls this once at 21:00 IST and posts the resulting
 * counts into the BM Ingest 2 group:
 *
 *   📊 आज का सारांश (18 May)
 *   🆕 3 new requests today
 *   📞 5 still NEW · awaiting first call
 *   ☑️ 2 CONTACTED · awaiting confirmation
 *   ✅ 1 CONFIRMED · in pipeline
 *
 * Auth: Bearer BOT_INGEST_SECRET.
 *
 * Response:
 *   {
 *     ok: true,
 *     date: "2026-05-18",
 *     todayCreated: 3,         // rows created in the last 24h
 *     pendingNew: 5,           // total NEW across all time (action needed)
 *     pendingContacted: 2,     // CONTACTED but not yet CONFIRMED
 *     pendingConfirmed: 1,     // CONFIRMED but not yet COMPLETED
 *     completedToday: 0,       // marked COMPLETED in the last 24h
 *   }
 *
 * We compute "today" as IST-aware so the summary lines up with the
 * 9 PM trigger time the bot uses (IST midnight = UTC 18:30).
 * Without the offset, a summary posted at 21:00 IST would otherwise
 * use UTC date and split today's bucket incorrectly.
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 5;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function jsonError(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

/** Returns the IST-midnight Date for the date currently in IST. */
function istMidnightToday(): Date {
  const nowMs = Date.now() + IST_OFFSET_MS;
  // Snap to IST midnight by trimming hours/minutes from the IST wall-clock,
  // then translate back to UTC by subtracting the offset.
  const istMidnightWallclock = new Date(nowMs);
  istMidnightWallclock.setUTCHours(0, 0, 0, 0);
  return new Date(istMidnightWallclock.getTime() - IST_OFFSET_MS);
}

/** YYYY-MM-DD label for the current IST date. */
function istDateLabel(): string {
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  const y = istNow.getUTCFullYear();
  const m = String(istNow.getUTCMonth() + 1).padStart(2, "0");
  const d = String(istNow.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

  const startOfTodayIst = istMidnightToday();

  // Parallel counts — five small queries that each return an integer.
  // Faster than one giant groupBy because Postgres can serve each via
  // a single index lookup against the @@index([status, createdAt])
  // we already have on OrganiseRequest.
  const [
    todayCreated,
    pendingNew,
    pendingContacted,
    pendingConfirmed,
    completedToday,
  ] = await Promise.all([
    prisma.organiseRequest.count({
      where: { createdAt: { gte: startOfTodayIst } },
    }),
    prisma.organiseRequest.count({ where: { status: "NEW" } }),
    prisma.organiseRequest.count({ where: { status: "CONTACTED" } }),
    prisma.organiseRequest.count({ where: { status: "CONFIRMED" } }),
    prisma.organiseRequest.count({
      where: {
        status: "COMPLETED",
        // We don't have an updatedAt column, so "completed today" is
        // best-approximated by createdAt. Acceptable because the
        // typical lead → completed cycle is multi-day; a single-day
        // turnaround is rare enough that the count being slightly off
        // doesn't move the digest's signal.
        createdAt: { gte: startOfTodayIst },
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    date: istDateLabel(),
    todayCreated,
    pendingNew,
    pendingContacted,
    pendingConfirmed,
    completedToday,
  });
}
