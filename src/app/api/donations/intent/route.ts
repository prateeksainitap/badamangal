import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ipHash, readClientIp } from "@/lib/crypto";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/donations/intent
 *
 * Records a donation INTENT, the moment a donor taps "Sponsor this
 * bhandara". We never see the actual UPI transaction (donor's bank
 * sends money directly to the organiser's bank), so this is a
 * intent-tracking + audit row, not payment confirmation. The flow:
 *
 *   1. Donor taps "Sponsor" on bhandara X for ₹amount
 *   2. Client POSTs here BEFORE opening the UPI deep link
 *   3. We persist a DonationIntent row (status=CLICKED) and respond
 *   4. Client immediately redirects window.location to the UPI link
 *   5. Donor's UPI app handles the transfer
 *
 * Two follow-ups can flip status:
 *   • Donor self-confirmation via POST /api/donations/confirm
 *   • Future Razorpay webhook → status=PG_CONFIRMED with payment_id
 *
 * Auth: PUBLIC, donations are anonymous by default. Rate-limited
 * per IP to stop a script from polluting the audit table at 1 Hz.
 *
 * The endpoint is intentionally fast (single Prisma insert) so the
 * client doesn't have to await it before opening the UPI link. The
 * client treats this as a beacon: fire-and-forget POST, then
 * `window.location.href = upiDeepLink` regardless of whether the
 * POST resolved. If the network drops the beacon we lose ONE audit
 * row, not the user's flow.
 */
const intentSchema = z.object({
  bhandaraId: z.string().min(1).max(40),
  /** INR amount we put in the UPI deep link's `am=` param.
   *  0 = "no amount suggested, donor types whatever they want in
   *  their UPI app". We dropped the auto-suggested ₹251 because the
   *  organiser felt it was steering the donor toward a specific
   *  number; we'd rather they donate whatever feels right.
   *  Capped at ₹1,00,000, well above any real Bada Mangal donation
   *  and low enough to keep accidental typos from creating absurd
   *  audit rows. */
  amount: z.number().int().min(0).max(100_000),
  recipientType: z.enum(["organiser", "platform"]),
  recipientUpiId: z.string().min(3).max(80),
  recipientName: z.string().max(120).optional(),
  donorName: z.string().max(80).optional(),
  donorPhone: z.string().max(20).optional(),
  donorEmail: z.string().max(120).optional(),
  donorMessage: z.string().max(280).optional(),
});

export async function POST(req: NextRequest) {
  // Per-IP rate limit: 30 intents per minute is generous for legit
  // donors (even on a frantic Bada Mangal Tuesday a single device
  // won't tap Sponsor more than a few times). Above that → 429.
  const limit = checkRateLimit({
    key: ipHash(readClientIp(req.headers)),
    max: 30,
    windowMs: 60 * 1000,
    bucket: "donations-intent",
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSec: limit.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  // Parse + validate
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = intentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;

  // Verify the bhandara exists before recording, bogus IDs would
  // create dangling audit rows that the admin queue can't display.
  const bh = await prisma.bhandara.findUnique({
    where: { id: d.bhandaraId },
    select: { id: true, organizerName: true },
  });
  if (!bh) {
    return NextResponse.json({ error: "bhandara_not_found" }, { status: 404 });
  }

  // Truncate the UA so a malicious scraper can't blow up the column.
  // 240 chars covers every real browser UA string.
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 240);

  const created = await prisma.donationIntent.create({
    data: {
      bhandaraId: d.bhandaraId,
      amount: d.amount,
      recipientType: d.recipientType,
      recipientUpiId: d.recipientUpiId,
      recipientName: d.recipientName ?? bh.organizerName ?? null,
      donorName: d.donorName ?? null,
      donorPhone: d.donorPhone ?? null,
      donorEmail: d.donorEmail ?? null,
      donorMessage: d.donorMessage ?? null,
      ipHash: ipHash(readClientIp(req.headers)),
      userAgent: ua,
      status: "CLICKED",
    },
    select: { id: true, createdAt: true },
  });

  // Rebuild the canonical UPI deep link server-side so the client
  // can't smuggle a different recipient VPA into the redirect. The
  // tn (transaction note) carries our intent id so a future Razorpay
  // webhook OR a manual reconciliation can correlate.
  //
  // amount = 0 means "no suggested amount", we OMIT `am` from the
  // deep link entirely so the donor's UPI app opens with an empty
  // amount field they can fill in. (Sending `am=0` lands as a
  // ₹0 prefill in some UPI apps, which is worse UX than no prefill.)
  const params = new URLSearchParams({
    pa: d.recipientUpiId,
    pn: d.recipientName ?? "Bada Mangal seva",
    cu: "INR",
    tn: `Bada Mangal seva · ref ${created.id.slice(-8)}`,
  });
  if (d.amount > 0) params.set("am", String(d.amount));
  const upiDeepLink = `upi://pay?${params.toString()}`;

  return NextResponse.json(
    {
      ok: true,
      id: created.id,
      upiDeepLink,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
