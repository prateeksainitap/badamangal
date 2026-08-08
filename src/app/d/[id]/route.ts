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
 * Tracked QR-scan redirect, same pattern Canva uses on their QR
 * generator. When this endpoint is the destination of a QR code,
 * every scan hits our server first, we record a DonationIntent
 * row, then 302 to the actual `upi://pay?` deep link so the
 * scanner's phone hands the payment off to their UPI app.
 *
 * Why this exists:
 *   Raw `upi://pay?…` QRs are uncatchable, they go straight from
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
/**
 * Every response from this route carries `X-Robots-Tag: noindex`.
 *
 * robots.txt already disallows /d/ (added 2026-08 after Search Console
 * reported "Blocked due to other 4xx issue", which was this route's
 * 429 rate-limit response). This header is the belt to that braces:
 * robots.txt only stops well-behaved crawlers from FETCHING, whereas
 * this tells anything that does fetch not to index the result. Cheap,
 * and it covers crawlers that ignore robots.txt as well as the window
 * before a robots.txt change propagates.
 */
const NOINDEX = { "X-Robots-Tag": "noindex, nofollow" } as const;

function redirectNoIndex(to: string): NextResponse {
  const res = NextResponse.redirect(to, 302);
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

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
      headers: {
        "Retry-After": String(limit.retryAfterSec),
        ...NOINDEX,
      },
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

  // No row OR not approved, redirect to home rather than 404, so a
  // confused scanner at a venue lands somewhere useful instead of an
  // error page that looks broken in front of a queue.
  if (!bh || bh.status !== "APPROVED") {
    return redirectNoIndex(SITE_URL);
  }

  // Bhandara found but no UPI configured, send the donor to the
  // bhandara detail page where they can read details, see the
  // organiser's phone, and contact directly. Better fallback than a
  // dead 404.
  if (!bh.upiId) {
    return redirectNoIndex(`${SITE_URL}/bhandara/${bh.slug}`);
  }

  const userAgent = (req.headers.get("user-agent") ?? "").slice(0, 240);

  // Record the scan. Best-effort: if the insert hiccups (rare
  // pooler blip), we still issue the redirect so the donor's flow
  // isn't blocked by our telemetry. Same posture as the in-page
  // beacon over at /api/donations/intent.
  //
  // amount = 0 is our sentinel for "no suggested amount", the donor
  // types whatever feels right in their UPI app. Earlier we baked
  // ₹251 into both the deep link and the audit row; the organiser
  // felt the prefilled number was steering donors. /admin/donations
  // now shows ₹0 for these rows, which the operator reads as "donor
  // chose their own amount".
  try {
    await prisma.donationIntent.create({
      data: {
        bhandaraId: bh.id,
        amount: 0,
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
  // audit table. We intentionally omit `am` so the donor's UPI app
  // opens with an empty amount field they can fill in.
  const params = new URLSearchParams({
    pa: bh.upiId,
    pn: bh.organizerName,
    cu: "INR",
    tn: `Bada Mangal seva for ${bh.name}`.slice(0, 60),
  });
  const upiDeepLink = `upi://pay?${params.toString()}`;

  return redirectNoIndex(upiDeepLink);
}
