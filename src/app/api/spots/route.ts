import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ipHash, readClientIp } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { AREAS } from "@/lib/lucknow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SPOT_TTL_HOURS = 8;
const AREA_VALUES = [...AREAS] as [string, ...string[]];

// Both `photoUrl` and `caption` are individually optional, but the
// form (SpotQuickForm) requires AT LEAST one of them. The `.refine()`
// below mirrors that gate on the server so a photo-only submission
// (the common case — someone snaps a banner and posts it without
// typing) goes through cleanly. Previously caption was required at
// the schema level, which made every photo-only POST 400 with
// "Validation failed" even though the UI explicitly labelled it
// optional.
const bodySchema = z
  .object({
    lat: z.number().min(26.6).max(27.0),
    lng: z.number().min(80.7).max(81.2),
    photoUrl: z
      .string()
      .trim()
      .max(500)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    caption: z
      .string()
      .trim()
      .min(3, "Tell us a line about it")
      .max(200)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    area: z.enum(AREA_VALUES).optional(),
    address: z.string().trim().max(200).optional(),
    reporterName: z.string().trim().min(1).max(60).optional(),
    language: z.enum(["hi", "en", "mixed"]).default("en"),
  })
  .refine((d) => Boolean(d.photoUrl) || Boolean(d.caption), {
    message: "Add a photo or write a line about the bhandara.",
    path: ["caption"],
  });

/**
 * GET /api/spots, returns the live (active + non-expired) spots.
 * Default limit 60. Supports `?bbox=minLng,minLat,maxLng,maxLat` for
 * map-bounded queries and `?area=Aliganj` for area filters.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.max(
    1,
    Math.min(120, Number(url.searchParams.get("limit") ?? "60") || 60),
  );
  const area = url.searchParams.get("area") ?? undefined;

  const records = await prisma.spot.findMany({
    where: {
      status: "APPROVED",
      expiresAt: { gt: new Date() },
      ...(area ? { area } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      bhandara: { select: { slug: true, name: true, nameHi: true } },
    },
  });

  const spots = records.map((s) => ({
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    area: s.area,
    address: s.address,
    photoUrl: s.photoUrl,
    caption: s.caption,
    language: s.language,
    reporterName: s.reporterName,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    bhandaraSlug: s.bhandara?.slug ?? null,
    bhandaraName: s.bhandara?.name ?? null,
    bhandaraNameHi: s.bhandara?.nameHi ?? null,
  }));

  return NextResponse.json(
    { count: spots.length, spots },
    {
      headers: {
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
      },
    },
  );
}

/**
 * POST /api/spots, create a spot.
 * Lightweight: only lat/lng required (photo optional). No phone OTP gate,
 * but we record an IP hash for rate-limit / abuse review.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const ip = ipHash(readClientIp(req.headers));
  const ua = req.headers.get("user-agent") ?? null;

  // Rate-limit: max 6 spots per IP per hour.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.spot.count({
    where: { ipHash: ip, createdAt: { gte: oneHourAgo } },
  });
  if (recent >= 6) {
    return NextResponse.json(
      { error: "Too many spots from this device. Try again later." },
      { status: 429 },
    );
  }

  // If a listed bhandara is within ~120m of the spot, link them automatically
  // so the spot card can show the bhandara name + open its detail page.
  let bhandaraId: string | null = null;
  try {
    // ~120m ≈ 0.0011° lat, 0.0012° lng at Lucknow's latitude
    const near = await prisma.bhandara.findFirst({
      where: {
        status: "APPROVED",
        lat: { gte: data.lat - 0.0011, lte: data.lat + 0.0011 },
        lng: { gte: data.lng - 0.0012, lte: data.lng + 0.0012 },
      },
      select: { id: true },
    });
    if (near) bhandaraId = near.id;
  } catch {
    /* ignore, best-effort link */
  }

  const expiresAt = new Date(Date.now() + SPOT_TTL_HOURS * 60 * 60 * 1000);

  const created = await prisma.spot.create({
    data: {
      lat: data.lat,
      lng: data.lng,
      area: data.area ?? null,
      address: data.address ?? null,
      photoUrl: data.photoUrl ?? null,
      caption: data.caption ?? null,
      language: data.language,
      reporterName: data.reporterName ?? null,
      reporterPhoneHash: null,
      bhandaraId,
      ipHash: ip,
      userAgent: ua,
      status: "APPROVED",
      expiresAt,
    },
  });

  return NextResponse.json(
    { ok: true, id: created.id, expiresAt: expiresAt.toISOString() },
    { status: 201 },
  );
}
