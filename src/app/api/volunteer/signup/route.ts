/**
 * Public: create a new Volunteer row with an auto-issued code.
 *
 * Flow (instant-code, Bada Mangal 2026 season):
 *   1. User fills /volunteer/signup → this endpoint creates a
 *      Volunteer row with status=PROBATIONARY and a fresh unique
 *      code (BM-LKO-XXXXXX). The code IS the auth.
 *   2. Endpoint returns the code in the response. Client renders
 *      the success card with the code visible + writes it to
 *      localStorage so the volunteer can come back anytime.
 *   3. Volunteer can immediately go to /volunteer/submit?code=...
 *      and start documenting bhandaras. No admin gate.
 *
 * Why instant (vs the previously-built admin-approval path):
 *   The admin-approval step added 24h friction without measurably
 *   improving signup quality for a pure-seva (no payout) season.
 *   The admin code path remains in the codebase
 *   (approveAndIssueVolunteerCodeAction) for edge cases like
 *   restoring a SUSPENDED row, but the normal happy path skips it.
 *
 * Anti-abuse (unchanged):
 *   • Per-IP rate limit: 3 signups per IP per 24 hours.
 *   • Phone: 10-digit Indian mobile (toIndianMobileDigits).
 *   • Name: 2-80 chars. UPI: optional, format-checked if provided.
 *   • Areas: ≤12 entries, each ≤60 chars (stringifyAreas).
 *   • Code collision retry: 5 attempts against the @@unique
 *     constraint on Volunteer.code before erroring.
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ipHash, readClientIp } from "@/lib/crypto";
import { toIndianMobileDigits, stringifyAreas } from "@/lib/volunteer";
import { generateVolunteerCode } from "@/lib/volunteer-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// No maxDuration override, default 10s on Hobby is plenty for the
// IP-cap check + single DB insert. Removing the explicit value folds
// this route into Fluid Compute's default function group instead of
// spawning its own tier (Hobby's 12-function cap counted each unique
// maxDuration as a separate group, pushing the project over).

// Per-IP signup cap, RESTORED for the public soft-launch. Without
// it, anyone can mint unlimited BM-LKO-XXXXXX codes and each code
// unlocks the 30 submissions/day + 12 MB photo + 60 MB video upload
// quota in /api/volunteer/upload-media, a free storage-cost DoS
// straight into our R2 bucket. 5/day/IP is generous for the
// "shared WiFi" cases (it'd take a whole family + admin testing on
// one IP to exhaust 5) while capping worst-case abuse at 5 quotas.
const MAX_SIGNUPS_PER_IP_PER_DAY = 5;

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
  // Write provenance: mobile app sends "mobile"; website defaults to "web".
  const source = body.source === "mobile" ? "mobile" : "web";

  // ── 2. Validate ──────────────────────────────────────────────
  const fields: Record<string, string> = {};
  if (name.length < 2) fields.name = "Please enter your full name.";
  if (name.length > 80) fields.name = "Name is too long (max 80).";

  const phone = toIndianMobileDigits(phoneRaw);
  if (!phone) {
    fields.phone = "Please enter a valid 10-digit mobile number.";
  }

  // UPI is optional for the Bada Mangal 2026 season (pure-seva mode,
  // no honorarium payouts running). Volunteers may share it for
  // future communications, but the form no longer requires it. We
  // still validate format IF they provide one, so junk doesn't end
  // up in the DB.
  if (upi.length > 60) fields.upi = "UPI ID is too long.";
  if (upi && (!/@/.test(upi) || upi.startsWith("@") || upi.endsWith("@"))) {
    fields.upi = "UPI ID should look like name@bank (e.g. 9876543210@upi).";
  }

  if (Object.keys(fields).length > 0) {
    return jsonError(400, "validation", fields);
  }

  // ── 3. IP capture + per-IP signup cap ─────────────────────────
  // The hash is persisted regardless (admin forensics: group all
  // volunteers sharing one ipHash to spot a fraud wave). On TOP of
  // that, we throttle to MAX_SIGNUPS_PER_IP_PER_DAY so a leaked /
  // bot-driven flood can't mint unlimited volunteer codes (each of
  // which would unlock the per-code submission + upload quotas
  // downstream). A genuine collision against the cap returns 429
  // with retryAfter so a real WiFi-shared family knows to retry
  // tomorrow rather than thinking the form is broken.
  const ip = ipHash(readClientIp(req.headers));
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentSignups = await prisma.volunteer.count({
    where: { ipHash: ip, createdAt: { gt: since } },
  });
  if (recentSignups >= MAX_SIGNUPS_PER_IP_PER_DAY) {
    return NextResponse.json(
      {
        ok: false,
        error: "rate_limited",
        detail: `Too many signups from this network in the last 24 hours. Try again tomorrow.`,
        retryAfterSec: 24 * 60 * 60,
      },
      {
        status: 429,
        headers: { "Retry-After": String(24 * 60 * 60) },
      },
    );
  }

  // ── 4. Generate a unique code + persist as PROBATIONARY ────────
  //
  // PROBATIONARY (not PENDING) because we're skipping the admin-
  // approval step on the happy path. The code IS issued at signup
  // and works immediately for /volunteer/submit. Admin can later
  // promote to TRUSTED after accuracy is established, or demote to
  // SUSPENDED for fraud.
  //
  // Code collision retry: theoretical ~1-in-729M from a 6-char
  // alphabet, but the @@unique constraint still needs handling. 5
  // attempts is plenty, has never tripped in practice but the
  // loop costs nothing to write.
  const ua = req.headers.get("user-agent")?.slice(0, 240) ?? null;
  let createdId: string | null = null;
  let issuedCode: string | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateVolunteerCode();
    try {
      const created = await prisma.volunteer.create({
        data: {
          code: candidate,
          name,
          phone: phone!,
          upi,
          areas: stringifyAreas(areasInput),
          status: "PROBATIONARY",
          ipHash: ip,
          userAgent: ua,
          source,
        },
        select: { id: true },
      });
      createdId = created.id;
      issuedCode = candidate;
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // P2002 = unique constraint violation on code. Retry with a
      // fresh code. Anything else is a real failure.
      if (!msg.includes("P2002") && !msg.includes("Unique constraint")) {
        console.error("volunteer signup failed", err);
        return jsonError(500, "server_error");
      }
      // else: collision, try next candidate
    }
  }

  if (!createdId || !issuedCode) {
    return jsonError(500, "code_collision_exhausted");
  }

  return NextResponse.json({
    ok: true,
    id: createdId,
    code: issuedCode,
    name,
    phoneLast4: phone!.slice(-4),
  });
}
