import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/seo";
import { ipHash, readClientIp } from "@/lib/crypto";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /d/[id]
 *
 * Tracked QR-scan redirect — same pattern Canva uses on their QR
 * generator. When this endpoint is the destination of a QR code,
 * every scan hits our server first, we record a DonationIntent
 * row, then 302 to the actual `upi://pay?` deep link so the
 * scanner's phone hands the payment off to their UPI app.
 *
 * Why this exists:
 *   Raw `upi://pay?…` QRs are uncatchable — they go straight from
 *   the camera into the UPI app, our server never sees the scan.
 *   By generating a QR that encodes `https://badamangal.com/d/<id>`
 *   instead, we get the same "scan to pay" UX with an audit trail.
 *
 * Compatibility notes (see commit body for full context):
 *   • Phone camera / Google Lens / iOS Camera → always opens the
 *     URL in a browser, redirect works, scan logged.
 *   • UPI-app built-in scanners (GPay / PhonePe / Paytm cameras) →
 *     often reject non-`upi://` content. Donors using those should
 *     scan the organiser's raw uploaded QR instead.
 *
 * The endpoint also serves as a graceful failure target:
 *   • Missing bhandara → home page
 *   • Bhandara found but no UPI ID configured → bhandara detail page
 *   • Bhandara not APPROVED → home page (don't leak PENDING rows)
 *
 * Rate-limited per IP so a scraper can't pollute the audit table by
 * looping the URL.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  // 60 scans per IP per minute is generous (legitimate scanners
  // never trigger this) and low enough to stop a script from
  // pumping the audit table.
  const limit = checkRateLimit({
    key: ipHash(readClientIp(req.headers)),
    max: 60,
    windowMs: 60 * 1000,
    bucket: "donations-qr-scan",
  });
  if (!limit.ok) {
    return new NextResponse("rate_limited", {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSec) },
    });
  }

  const bh = await prisma.bhandara.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      upiId: true,
      organizerName: true,
    },
  });

  // No row OR not approved — redirect to home rather than 404, so a
  // confused scanner at a venue lands somewhere useful instead of an
  // error page that looks broken in front of a queue.
  if (!bh || bh.status !== "APPROVED") {
    return NextResponse.redirect(SITE_URL, 302);
  }

  // Bhandara found but no UPI configured — send the donor to the
  // bhandara detail page where they can read details, see the
  // organiser's phone, and contact directly. Better fallback than a
  // dead 404.
  if (!bh.upiId) {
    return NextResponse.redirect(`${SITE_URL}/bhandara/${bh.slug}`, 302);
  }

  const userAgent = (req.headers.get("user-agent") ?? "").slice(0, 240);
  const defaultAmount = 251;

  // Record the scan. Best-effort: if the insert hiccups (rare
  // pooler blip), we still issue the redirect so the donor's flow
  // isn't blocked by our telemetry. Same posture as the in-page
  // beacon over at /api/donations/intent.
  try {
    await prisma.donationIntent.create({
      data: {
        bhandaraId: bh.id,
        amount: defaultAmount,
        recipientType: "organiser",
        recipientUpiId: bh.upiId,
        recipientName: bh.organizerName,
        ipHash: ipHash(readClientIp(req.headers)),
        // Prefix the UA so /admin/donations can distinguish "in-page
        // Sponsor tap" from "QR scan redirect" without adding a new
        // `source` column. If we later add structured analytics
        // (group by source, chart conversion by entry point), promote
        // this to a real enum column on DonationIntent.
        userAgent: `qr_scan · ${userAgent}`,
        status: "CLICKED",
      },
    });
  } catch (err) {
    console.warn("[/d/:id] donation intent insert failed", err);
  }

  // Canonical UPI deep link. Same shape as the in-page Sponsor
  // button uses, so the donor lands on a familiar payment screen.
  // The `tn` field carries a short reference so the organiser can
  // correlate a payment they receive back to a scan event in our
  // audit table.
  const params = new URLSearchParams({
    pa: bh.upiId,
    pn: bh.organizerName,
    am: String(defaultAmount),
    cu: "INR",
    tn: `Bada Mangal seva for ${bh.name}`.slice(0, 60),
  });
  const upiDeepLink = `upi://pay?${params.toString()}`;

  return NextResponse.redirect(upiDeepLink, 302);
}
