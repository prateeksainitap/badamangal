import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ipHash, readClientIp } from "@/lib/crypto";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/donations/confirm
 *
 * Donor self-confirmation hook. After the UPI deep-link closes and
 * the donor returns to the bhandara page, we (optionally) prompt:
 *
 *   "Did your payment go through?"   [Yes, paid]  [Didn't go through]
 *
 * Tapping Yes posts here with status="DONOR_CONFIRMED"; the cancel
 * button posts status="DISPUTED" so we can investigate the deep-link
 * generation if a real organiser-side issue is reported.
 *
 * Note: this is NOT proof of payment in any legal sense, it's just
 * the donor's word. Real proof needs either a Razorpay webhook
 * (Phase 2) or an organiser-side reconciliation. The status field
 * makes the chain of evidence visible: CLICKED → DONOR_CONFIRMED is
 * one party's claim; CLICKED → ORGANISER_CONFIRMED is the other
 * party's claim; both = strong informal evidence.
 *
 * Auth: PUBLIC, but rate-limited per IP. Anyone with an intent id
 * (a 25-char cuid, effectively unguessable) can flip its status.
 * The intent id is returned only to the donor that created it, so
 * the only realistic abuse vector is the donor themselves changing
 * their own status, which is fine.
 */
const confirmSchema = z.object({
  intentId: z.string().min(20).max(40),
  status: z.enum(["DONOR_CONFIRMED", "DISPUTED"]),
});

export async function POST(req: NextRequest) {
  const limit = checkRateLimit({
    key: ipHash(readClientIp(req.headers)),
    max: 30,
    windowMs: 60 * 1000,
    bucket: "donations-confirm",
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSec: limit.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { intentId, status } = parsed.data;

  // findFirst (not Unique) so a missing id returns null, not a
  // PrismaClientKnownRequestError. Lets us 404 cleanly.
  const existing = await prisma.donationIntent.findFirst({
    where: { id: intentId },
    select: { id: true, status: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "intent_not_found" }, { status: 404 });
  }

  // Idempotency: don't downgrade a row that already settled to a
  // more authoritative status (ORGANISER_CONFIRMED, PG_CONFIRMED).
  // Donor self-confirmations after one of those have already landed
  // become no-ops, returning the existing status so the client UI
  // can show "we already have your payment on file".
  const TERMINAL = new Set([
    "ORGANISER_CONFIRMED",
    "PG_CONFIRMED",
    "DISPUTED",
  ]);
  if (TERMINAL.has(existing.status) && existing.status !== status) {
    return NextResponse.json(
      { ok: true, id: existing.id, status: existing.status, changed: false },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const updated = await prisma.donationIntent.update({
    where: { id: intentId },
    data: {
      status,
      donorConfirmedAt: status === "DONOR_CONFIRMED" ? new Date() : undefined,
    },
    select: { id: true, status: true },
  });

  return NextResponse.json(
    { ok: true, id: updated.id, status: updated.status, changed: true },
    { headers: { "cache-control": "no-store" } },
  );
}
