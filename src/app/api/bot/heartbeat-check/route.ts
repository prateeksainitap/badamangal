/**
 * GET /api/bot/heartbeat-check
 *
 * Server-side watchdog for the WhatsApp ingestion bot. The bot's own
 * cron (on the spare MacBook) POSTs /api/bot/heartbeat?source=mbp every
 * 5 minutes. THIS endpoint runs independently (Vercel Cron, or an
 * external uptime monitor), so it can detect a stale heartbeat EVEN
 * WHEN the MacBook is dead and the admin dashboard is closed — exactly
 * the gap that let the bot sit offline for 15 min on the 5th Bada
 * Mangal before anyone noticed.
 *
 * Behaviour:
 *   - Reads `bot_heartbeat_mbp` (SiteCounter). Computes its age.
 *   - If age >= STALE_MIN and we haven't already alerted for this
 *     outage, send ONE ops-alert email and latch a flag so we don't
 *     spam every run.
 *   - When the heartbeat is fresh again, clear the latch (and send a
 *     short "recovered" note) so the NEXT outage alerts cleanly.
 *
 * The latch lives in a SiteCounter row `bot_heartbeat_alert` (count:
 * 1 = alert active, 0 = clear) — no schema change.
 *
 * Auth: Bearer CRON_SECRET (Vercel Cron pattern), or `?token=` for an
 * external monitor. If CRON_SECRET is unset, auth is open (the endpoint
 * only reads a counter + maybe emails the operator, nothing sensitive).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendOpsAlert } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Heartbeat fires every 5 min; 12 min = two missed beats, well past
// jitter. Matches the spirit of the in-admin banner (10 min) with a
// touch more buffer since this one emails.
const STALE_MIN = 12;

const ALERT_FLAG_ID = "bot_heartbeat_alert";
const HEARTBEAT_ID = "bot_heartbeat_mbp";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured → open (non-sensitive)
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ") && auth.slice(7).trim() === secret) {
    return true;
  }
  const token = req.nextUrl.searchParams.get("token");
  return token === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let heartbeat: { updatedAt: Date } | null = null;
  let flag: { count: number } | null = null;
  try {
    [heartbeat, flag] = await Promise.all([
      prisma.siteCounter.findUnique({
        where: { id: HEARTBEAT_ID },
        select: { updatedAt: true },
      }),
      prisma.siteCounter.findUnique({
        where: { id: ALERT_FLAG_ID },
        select: { count: true },
      }),
    ]);
  } catch (err) {
    console.error("[heartbeat-check] DB read failed:", err);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 503 });
  }

  // Bot never set up its heartbeat yet — nothing to watch.
  if (!heartbeat) {
    return NextResponse.json({ ok: true, state: "no_heartbeat_row" });
  }

  const ageMin = Math.floor((Date.now() - heartbeat.updatedAt.getTime()) / 60_000);
  const stale = ageMin >= STALE_MIN;
  const alertActive = (flag?.count ?? 0) === 1;

  // Stale + not yet alerted → fire one alert, latch the flag.
  if (stale && !alertActive) {
    const lastSeen = heartbeat.updatedAt.toISOString();
    await sendOpsAlert(
      `⚠️ BadaMangal bot offline (${ageMin} min)`,
      [
        `The WhatsApp ingestion bot has not pinged in ${ageMin} minutes.`,
        `Last heartbeat: ${lastSeen}`,
        ``,
        `WhatsApp photos + locations are NOT being captured right now.`,
        ``,
        `Fix: on the bhandara Mac, run`,
        `  openclaw gateway restart`,
        `then check the heartbeat pill on https://badamangal.com/admin`,
      ].join("\n"),
    ).catch((e) => console.error("[heartbeat-check] alert email failed:", e));

    await prisma.siteCounter
      .upsert({
        where: { id: ALERT_FLAG_ID },
        update: { count: 1 },
        create: { id: ALERT_FLAG_ID, count: 1 },
      })
      .catch((e) => console.error("[heartbeat-check] latch set failed:", e));

    return NextResponse.json({ ok: true, state: "alerted", ageMin });
  }

  // Recovered → clear the latch, send a short all-clear.
  if (!stale && alertActive) {
    await sendOpsAlert(
      `✅ BadaMangal bot back online`,
      `The ingestion bot is pinging again (last heartbeat ${ageMin} min ago). Ingestion has resumed.`,
    ).catch((e) => console.error("[heartbeat-check] recovery email failed:", e));

    await prisma.siteCounter
      .upsert({
        where: { id: ALERT_FLAG_ID },
        update: { count: 0 },
        create: { id: ALERT_FLAG_ID, count: 0 },
      })
      .catch((e) => console.error("[heartbeat-check] latch clear failed:", e));

    return NextResponse.json({ ok: true, state: "recovered", ageMin });
  }

  return NextResponse.json({
    ok: true,
    state: stale ? "stale_already_alerted" : "healthy",
    ageMin,
  });
}
