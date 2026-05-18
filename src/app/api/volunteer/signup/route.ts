/**
 * Public: create a new Volunteer row as PENDING.
 *
 * Approval flow (Tier A, admin-gated):
 *   1. User fills /volunteer/signup → this endpoint creates a
 *      Volunteer row with status=PENDING and code=NULL. NO code is
 *      issued or returned to the client.
 *   2. Admin sees the PENDING row in /admin/volunteers + clicks
 *      "Approve & send code on WhatsApp" → that action generates
 *      the code, flips status to PROBATIONARY, and opens a wa.me
 *      link the admin sends with one tap.
 *   3. User receives the WhatsApp message with their code +
 *      submission link, can now use /volunteer/submit?code=...
 *
 * Why admin approval (vs. auto-issue at signup):
 *   • Fraud control without OTP — admin filters out obvious junk
 *     before any code can be used.
 *   • WhatsApp delivery doubles as number validation. If wa.me
 *     fails to deliver (number's not on WhatsApp), admin can flip
 *     the row to SUSPENDED without ever issuing a code.
 *   • Slight friction is acceptable for a paid programme — the
 *     team contacts each volunteer personally before onboarding.
 *
 * Anti-abuse (unchanged from Tier A v1):
 *   • Per-IP rate limit: 3 signups per IP per 24 hours.
 *   • Phone: 10-digit Indian mobile (toIndianMobileDigits).
 *   • Name: 2-80 chars. UPI: 5-60 chars + must look like x@y.
 *   • Areas: ≤12 entries, each ≤60 chars (stringifyAreas).
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ipHash, readClientIp } from "@/lib/crypto";
import { toIndianMobileDigits, stringifyAreas } from "@/lib/volunteer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 5;

const MAX_SIGNUPS_PER_IP_PER_DAY = 3;

function jsonError(status: number, error: string, fields?: Record<string, string>) {
  return NextResponse.json({ ok: false, error, fields }, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Parse body ────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonError(400, "invalid_json");
  }

  const name = String(body.name ?? "").trim();
  const phoneRaw = String(body.phone ?? "").trim();
  const upi = String(body.upi ?? "").trim();
  const areasInput = Array.isArray(body.areas) ? body.areas : [];

  // ── 2. Validate ──────────────────────────────────────────────
  const fields: Record<string, string> = {};
  if (name.length < 2) fields.name = "Please enter your full name.";
  if (name.length > 80) fields.name = "Name is too long (max 80).";

  const phone = toIndianMobileDigits(phoneRaw);
  if (!phone) {
    fields.phone = "Please enter a valid 10-digit mobile number.";
  }

  if (upi.length < 5) fields.upi = "Please enter your UPI ID.";
  if (upi.length > 60) fields.upi = "UPI ID is too long.";
  if (upi && (!/@/.test(upi) || upi.startsWith("@") || upi.endsWith("@"))) {
    fields.upi = "UPI ID should look like name@bank (e.g. 9876543210@upi).";
  }

  if (Object.keys(fields).length > 0) {
    return jsonError(400, "validation", fields);
  }

  // ── 3. Rate limit by IP ──────────────────────────────────────
  const ip = ipHash(readClientIp(req.headers));
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.volunteer.count({
    where: { ipHash: ip, createdAt: { gte: oneDayAgo } },
  });
  if (recent >= MAX_SIGNUPS_PER_IP_PER_DAY) {
    return jsonError(429, "rate_limited", {
      _form: "Too many signups from this connection today. Try again tomorrow or contact the team.",
    });
  }

  // ── 4. Persist as PENDING (no code, no submission rights yet) ─
  const ua = req.headers.get("user-agent")?.slice(0, 240) ?? null;
  let createdId: string;
  try {
    const created = await prisma.volunteer.create({
      data: {
        // code intentionally omitted — defaults to NULL. Issued
        // later by the admin via approveAndIssueVolunteerCodeAction.
        name,
        phone: phone!,
        upi,
        areas: stringifyAreas(areasInput),
        // status defaults to PENDING in the schema — no override needed.
        ipHash: ip,
        userAgent: ua,
      },
      select: { id: true },
    });
    createdId = created.id;
  } catch (err) {
    console.error("volunteer signup failed", err);
    return jsonError(500, "server_error");
  }

  // Deliberately do NOT return the code — there is no code yet.
  // The client renders an "application under review" success
  // screen + tells the user to expect a WhatsApp message.
  return NextResponse.json({
    ok: true,
    id: createdId,
    name,
    phoneLast4: phone!.slice(-4), // tiny tail for "we'll WhatsApp xxxxxx1234" UI
  });
}
