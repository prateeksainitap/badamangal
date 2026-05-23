/**
 * Volunteer-only: create a new VolunteerSubmission row.
 *
 * Called by /volunteer/submit after the volunteer has finished
 * uploading all media via /api/volunteer/upload-media. The body
 * carries the bhandara fields + the URLs of already-uploaded
 * photos/videos/spot.
 *
 * Auth: volunteer code (in body), validated against the Volunteer
 * table. Same SUSPENDED check as the upload endpoint.
 *
 * Anti-abuse:
 *   • 30 submissions per code per 24 hours (configurable). Hard cap
 *     so a compromised code can't blow up the queue.
 *   • All-or-nothing validation: bhandara name + area + address are
 *     required; we don't half-accept incomplete rows because admin
 *     can't review a row that's missing identifying info.
 *
 * Note: this endpoint just persists the submission. Bhandara + Spot
 * rows are NOT created here, those come from the admin's APPROVE
 * action in /admin/volunteer-submissions which can also reject /
 * mark partial. Keeps moderation in admin's hands and avoids
 * polluting the public site with un-reviewed listings.
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ipHash, readClientIp } from "@/lib/crypto";
import {
  isValidVolunteerCodeShape,
  normaliseVolunteerCode,
  toIndianMobileDigits,
} from "@/lib/volunteer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 10s matches Hobby's default, drop the explicit override so this
// route folds into the default function group rather than creating
// its own tier. See volunteer/signup for the same rationale.

const MAX_PHOTOS = 10;
const MAX_VIDEOS = 2;
const MAX_SUBMITS_PER_CODE_PER_DAY = 30;

function jsonError(
  status: number,
  error: string,
  fields?: Record<string, string>,
) {
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

  // ── 2. Validate volunteer code ───────────────────────────────
  const rawCode = String(body.code ?? "").trim();
  if (!isValidVolunteerCodeShape(rawCode)) {
    return jsonError(401, "invalid_code");
  }
  const code = normaliseVolunteerCode(rawCode);
  const volunteer = await prisma.volunteer.findUnique({
    where: { code },
    select: { id: true, status: true },
  });
  if (!volunteer) {
    return jsonError(401, "unknown_code");
  }
  if (volunteer.status === "SUSPENDED") {
    return jsonError(403, "suspended");
  }

  // ── 3. Validate bhandara fields ──────────────────────────────
  const bhandaraName = String(body.bhandaraName ?? "").trim();
  const area = String(body.area ?? "").trim();
  const address = String(body.address ?? "").trim();
  const organizerName = String(body.organizerName ?? "").trim();
  const organizerPhoneRaw = String(body.organizerPhone ?? "").trim();
  const startTime = String(body.startTime ?? "").trim();
  const menu = String(body.menu ?? "").trim();
  const volunteerNotes = String(body.volunteerNotes ?? "").trim();
  const mapsUrl = String(body.mapsUrl ?? "").trim();
  const spotPhotoUrl = String(body.spotPhotoUrl ?? "").trim();

  const photoUrls = Array.isArray(body.photoUrls) ? body.photoUrls : [];
  const videoUrls = Array.isArray(body.videoUrls) ? body.videoUrls : [];

  const cleanPhotoUrls = photoUrls
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .slice(0, MAX_PHOTOS);
  const cleanVideoUrls = videoUrls
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .slice(0, MAX_VIDEOS);

  const fields: Record<string, string> = {};
  if (bhandaraName.length < 2)
    fields.bhandaraName = "Please enter the bhandara name.";
  if (bhandaraName.length > 120) fields.bhandaraName = "Bhandara name too long.";
  if (area.length < 2) fields.area = "Please enter the area.";
  if (area.length > 80) fields.area = "Area too long.";
  if (address.length < 5)
    fields.address = "Please enter the full address.";
  if (address.length > 400) fields.address = "Address too long.";
  if (organizerName.length > 120) fields.organizerName = "Organizer name too long.";

  // Phone is optional, if provided, must be valid 10 digits.
  let organizerPhone: string | null = null;
  if (organizerPhoneRaw) {
    organizerPhone = toIndianMobileDigits(organizerPhoneRaw);
    if (!organizerPhone) {
      fields.organizerPhone = "Phone must be 10 digits.";
    }
  }

  if (Object.keys(fields).length > 0) {
    return jsonError(400, "validation", fields);
  }

  // GPS, both must be present + look like real numbers in
  // Lucknow's broad bounding box. We're not strict about exact
  // bounds (volunteers might be at the edge of the metro) but we
  // reject obvious 0,0 or huge wrong values.
  const gpsLatRaw = body.gpsLat;
  const gpsLngRaw = body.gpsLng;
  const gpsLat =
    typeof gpsLatRaw === "number" && Number.isFinite(gpsLatRaw)
      ? gpsLatRaw
      : null;
  const gpsLng =
    typeof gpsLngRaw === "number" && Number.isFinite(gpsLngRaw)
      ? gpsLngRaw
      : null;

  // ── 4. Rate limit per code (per 24h) ─────────────────────────
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.volunteerSubmission.count({
    where: { volunteerId: volunteer.id, createdAt: { gte: oneDayAgo } },
  });
  if (recent >= MAX_SUBMITS_PER_CODE_PER_DAY) {
    return jsonError(429, "rate_limited", {
      _form: `You've hit the daily submission cap (${MAX_SUBMITS_PER_CODE_PER_DAY}/day). Resume tomorrow.`,
    });
  }

  // ── 5. Persist ───────────────────────────────────────────────
  const ip = ipHash(readClientIp(req.headers));
  const ua = req.headers.get("user-agent")?.slice(0, 240) ?? null;

  const saved = await prisma.volunteerSubmission.create({
    data: {
      volunteerId: volunteer.id,
      volunteerCode: code,
      bhandaraName,
      area,
      address,
      organizerName: organizerName || null,
      organizerPhone: organizerPhone || null,
      startTime: startTime || null,
      menu: menu || null,
      photoUrls: JSON.stringify(cleanPhotoUrls),
      videoUrls: JSON.stringify(cleanVideoUrls),
      spotPhotoUrl: spotPhotoUrl || null,
      gpsLat,
      gpsLng,
      mapsUrl: mapsUrl || null,
      volunteerNotes: volunteerNotes || null,
      ipHash: ip,
      userAgent: ua,
    },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json({
    ok: true,
    id: saved.id,
    submittedAt: saved.createdAt.toISOString(),
  });
}
