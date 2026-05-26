import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ipHash, readClientIp } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { stripBotProvenance } from "@/lib/sanitize";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SPOT_TTL_HOURS = 8;

/**
 * Allowlist of host suffixes the public `/api/spots` POST may accept
 * for `photoUrl` / `extraPhotoUrls`. Without this, an attacker can
 * submit a Spot pointing `photoUrl` at any tracker / IP-logger /
 * NSFW image; the homepage's HappeningNow + LiveChatterBoard would
 * then render `<img src="<attacker URL>">` until the row was caught
 * in moderation.
 *
 * Allowed sources are exactly the hosts our upload pipeline writes
 * to (R2 + Supabase Storage + our own /uploads path). Relative URLs
 * starting with "/" are accepted as legacy local-uploaded files.
 *
 * Update carefully — adding a host here means we trust its content
 * to render on the public homepage.
 */
const PHOTO_URL_ALLOWED_HOST_SUFFIXES = [
  ".supabase.co",
  ".r2.cloudflarestorage.com",
  ".r2.dev",
  ".badamangal.com",
  "badamangal.com",
];

function isAllowedPhotoUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  // Same-origin uploads (legacy /public/uploads/...).
  if (trimmed.startsWith("/uploads/") || trimmed.startsWith("/_next/")) {
    return true;
  }
  if (!/^https:\/\//i.test(trimmed)) return false;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  return PHOTO_URL_ALLOWED_HOST_SUFFIXES.some(
    (suffix) => host === suffix.replace(/^\./, "") || host.endsWith(suffix),
  );
}

// Both `photoUrl` and `caption` are individually optional, but the
// form (SpotQuickForm) requires AT LEAST one of them. The `.refine()`
// below mirrors that gate on the server so a photo-only submission
// (the common case, someone snaps a banner and posts it without
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
      .refine(isAllowedPhotoUrl, {
        message:
          "Photo URL must point at an allowed host (Supabase / R2 / same-origin).",
      })
      .optional()
      .or(z.literal("").transform(() => undefined)),
    // Optional extra photo URLs beyond the primary `photoUrl`. The
    // client (SpotQuickForm) uploads multi-selected images one by
    // one and passes the resulting URLs here. Capped at 5 because
    // the live-spot detail view only needs a thumbnail strip, not
    // an album; more than 5 starts to feel like a different feature
    // (a gallery, which we ARE building separately). Same host
    // allowlist as the primary photoUrl so an attacker can't sneak
    // a tracker URL in via the secondary array.
    extraPhotoUrls: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(500)
          .refine(isAllowedPhotoUrl, {
            message:
              "Extra photo URL must point at an allowed host.",
          }),
      )
      .max(5)
      .optional()
      .default([]),
    caption: z
      .string()
      .trim()
      .min(3, "Tell us a line about it")
      .max(200)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    // Free-string area, no longer enum-restricted. Spot's area is
    // typically auto-derived from the visitor's GPS (closest curated
    // bhandara → reverse-geocoded neighbourhood) so the value can be
    // anything Ola Maps returns.
    area: z.string().trim().min(2).max(50).optional(),
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
 *
 * The clamp ceiling was bumped from 120 to 500 so the HappeningNow
 * client poll (which the homepage hits every 15 s) can request the
 * same full set the SSR fetches with `take: 500`. The previous 120
 * ceiling silently capped the heading counter to "24 spotted" on the
 * homepage as soon as the first poll fired, even though the SSR
 * had handed down a correct count of 60+.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.max(
    1,
    Math.min(500, Number(url.searchParams.get("limit") ?? "60") || 60),
  );
  const area = url.searchParams.get("area") ?? undefined;

  // Try/catch around the DB read so a transient EMAXCONN at Tuesday
  // peak doesn't 500 the homepage poll. HappeningNow fires this every
  // 15s; one 500 in a poll cycle is invisible (the next tick succeeds),
  // but the user saw `net::ERR_ABORTED 500` red banners in console
  // every time the pool tightened. Returning an empty list with 200 is
  // the right degradation: the client merges (not replaces) on each
  // poll, so an empty payload just means "no new spots since last
  // tick", same as a quiet 5-second window.
  //
  // .catch returns an empty array on rejection. TypeScript infers
  // `records` as the include-augmented row type | never[], with the
  // `s.bhandara?` chain in the .map below staying type-safe. (An
  // earlier `let records: Awaited<ReturnType<...>> = []` pre-declared
  // a BARE-typed variable that lost the include shape and broke the
  // build at s.bhandara.)
  const records = await prisma.spot
    .findMany({
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
    })
    .catch((err: unknown) => {
      console.error(
        "[api/spots] DB read failed, serving empty:",
        err instanceof Error ? err.message : err,
      );
      return [];
    });

  const spots = records.map((s) => {
    // Parse the extraPhotoUrls JSON-string column defensively. We
    // never trust this round-trips correctly without a guard, older
    // rows may have it null, brand-new ones may have malformed JSON
    // from a (very unlikely) write race.
    let extraPhotoUrls: string[] = [];
    try {
      const parsed = JSON.parse(s.extraPhotoUrls || "[]");
      if (Array.isArray(parsed)) {
        extraPhotoUrls = parsed.filter(
          (x): x is string => typeof x === "string" && x.length > 0,
        );
      }
    } catch {
      /* leave as [] */
    }
    return {
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    area: s.area,
    address: s.address,
    photoUrl: s.photoUrl,
    extraPhotoUrls,
    // Strip [bot:whatsapp …] from public JSON, see lib/sanitize.ts.
    caption: stripBotProvenance(s.caption) || null,
    language: s.language,
    reporterName: s.reporterName,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    bhandaraSlug: s.bhandara?.slug ?? null,
    bhandaraName: s.bhandara?.name ?? null,
    bhandaraNameHi: s.bhandara?.nameHi ?? null,
    };
  });

  return NextResponse.json(
    { count: spots.length, spots },
    {
      headers: {
        // Disable the CDN cache entirely. The previous
        //   `public, s-maxage=10, stale-while-revalidate=30`
        // looked correct in isolation, but Netlify's edge cache
        // normalises the URL for cache-keying (query strings get
        // stripped/collapsed in practice), so a poll for
        // `?limit=24` from an old tab poisoned the cache and
        // subsequent `?limit=500` requests from the new
        // HappeningNow client kept getting served the 24-spot
        // response. End-user symptom: the homepage headline
        // ("N bhandaras spotted live") randomly dropped to 24
        // every poll, depending on which cache entry the CDN
        // happened to serve. Public-facing damage from skipping
        // the 10 s edge cache is tiny, the route is a single
        // Prisma query over an 8h-bounded table (~60-100 rows
        // peak), runs ~150 ms warm, polled every 15 s by each
        // homepage tab.
        "Cache-Control": "private, no-store, must-revalidate",
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
      // JSON-stringified per the schema's TEXT column choice (see
      // schema.prisma comment on Spot.extraPhotoUrls for why).
      extraPhotoUrls: JSON.stringify(data.extraPhotoUrls ?? []),
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
