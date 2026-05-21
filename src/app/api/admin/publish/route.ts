/**
 * Admin "publish from review form" endpoint. Creates a bhandara or
 * spot row using the fields the admin just edited inside /admin/scan.
 *
 * Validation is looser than the public submit endpoint:
 *   - No phone-realism check (admin often types "9999999999" as a
 *     placeholder for bhandaras seeded from WhatsApp invites where the
 *     organizer's number is not on the banner).
 *   - Description/menu/photo are all optional.
 *   - But: area must be from the enum, dates inside the season, coords
 *     inside Lucknow's bounding box.
 *
 * Both kinds insert as APPROVED + approvedAt=now so the row goes live
 * on the next request to the homepage (which is `force-dynamic`).
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { MENU_KEYS, menuHiFor } from "@/lib/menu";
import { ensureUniqueSlug, slugify } from "@/lib/slugify";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin auth check moved to @/lib/admin-auth, see import above.
// Was a local reimplementation (one of 12 in the codebase); the
// single source means future auth changes (session expiry,
// HMAC signing, IP allowlist) are a one-file edit.

const MENU_VALUES = [...MENU_KEYS] as [string, ...string[]];

// Area is a free string (curated dictionary lives in @/lib/lucknow but
// is no longer enforced at the input boundary, Lucknow has more
// neighbourhoods than we curate, and forcing organisers / admins onto
// the short list locked out legitimate submissions).
const areaInput = z.string().trim().min(2).max(50);

// Admin date validator, wider than the public form's. The public
// /list-bhandara only accepts the season window (May–June 2026); the
// admin needs full freedom to record one-off events that fall outside
// the canonical Tuesdays (Saturday community lunches, post-season
// thanksgiving meals, Shani Jayanti overlaps, etc.). Constrain only
// to "any reasonable date in 2026" so a typo doesn't accidentally
// schedule something in 1926.
const adminDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((d) => d >= "2026-01-01" && d <= "2026-12-31", {
    message: "Pick a date inside 2026",
  });

// Phone-shaped, intentionally loose, the form already collects in a
// specific format and Indian mobile parsing has edge cases (+91, 0
// prefix, missing prefix, hyphenated). Pure store-as-typed; the admin
// reviews before publish so we don't need server-side parsing.
const optionalPhone = z
  .string()
  .trim()
  .max(20)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v === "" || v === undefined ? undefined : v));

// UPI IDs follow the pattern `<handle>@<provider>` (e.g. badamangal@upi).
// Keep validation light, collect anything that looks UPI-ish and let
// the admin sanity-check.
const optionalUpi = z
  .string()
  .trim()
  .max(80)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v === "" || v === undefined ? undefined : v));

const bhandaraInput = z.object({
  name: z.string().trim().min(2),
  nameHi: z.string().trim().min(1),
  description: z.string().trim().optional().default(""),
  descriptionHi: z.string().trim().optional().default(""),
  area: areaInput,
  address: z.string().trim().min(5),
  addressHi: z.string().trim().optional().default(""),
  landmark: z.string().trim().optional().default(""),
  lat: z.number().min(26.6).max(27.0),
  lng: z.number().min(80.7).max(81.2),
  tuesdayDates: z.array(adminDate).min(1),
  timeStart: z.string().regex(/^\d{2}:\d{2}$/),
  timeEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
  menu: z.array(z.enum(MENU_VALUES)).optional().default([]),
  menuOther: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
  organizerName: z.string().trim().min(1),
  organizerPhone: z.string().trim().min(1),
  // Optional sponsorship/contact extras carried through from the
  // admin form. Public submitSchema (lib/validation.ts) handles the
  // same fields with stricter validation for the organiser-self-
  // submission flow; here we trust the admin to enter sane values.
  organizerWhatsapp: optionalPhone,
  upiId: optionalUpi,
  photoUrl: z.string().trim().url(),
  isVerified: z.boolean().optional().default(false),
});

const spotInput = z.object({
  lat: z.number().min(26.6).max(27.0),
  lng: z.number().min(80.7).max(81.2),
  area: areaInput.optional(),
  address: z.string().trim().max(200).optional(),
  caption: z.string().trim().max(200).optional(),
  language: z.enum(["hi", "en", "mixed"]).default("en"),
  photoUrl: z.string().trim().url(),
  reporterName: z.string().trim().max(60).optional(),
});

const SPOT_TTL_HOURS = 8;

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  if (kind !== "bhandara" && kind !== "spot") {
    return NextResponse.json(
      { error: "kind must be 'bhandara' or 'spot'" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (kind === "bhandara") {
    const parsed = bhandaraInput.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const d = parsed.data;

    const slug = await ensureUniqueSlug(slugify(d.name));
    // Dedupe free-form menu items against the curated keys.
    const lowerCurated = new Set(d.menu.map((k) => k.toLowerCase()));
    const others = d.menuOther.filter(
      (s) => s && !lowerCurated.has(s.toLowerCase()),
    );
    const finalMenu = [...d.menu, ...others];
    const finalMenuHi = [...menuHiFor(d.menu), ...others];

    const created = await prisma.bhandara.create({
      data: {
        slug,
        name: d.name,
        nameHi: d.nameHi,
        description: d.description || null,
        descriptionHi: d.descriptionHi || null,
        address: d.address,
        addressHi: d.addressHi || null,
        area: d.area,
        landmark: d.landmark || null,
        lat: d.lat,
        lng: d.lng,
        tuesdayDates: JSON.stringify(d.tuesdayDates),
        timeStart: d.timeStart,
        timeEnd: d.timeEnd ?? "",
        menu: JSON.stringify(finalMenu),
        menuHi: JSON.stringify(finalMenuHi),
        organizerName: d.organizerName,
        organizerPhone: d.organizerPhone,
        // Optional WhatsApp + UPI ID for sponsorship, public listing
        // surfaces these on the bhandara detail page; admin can leave
        // blank if the invite didn't include them.
        organizerWhatsapp: d.organizerWhatsapp ?? null,
        upiId: d.upiId ?? null,
        photoUrl: d.photoUrl,
        googleMapsUrl: `https://www.google.com/maps?q=${d.lat},${d.lng}&z=18`,
        status: "APPROVED",
        approvedAt: new Date(),
        isVerified: d.isVerified,
      },
    });

    return NextResponse.json(
      { ok: true, id: created.id, slug: created.slug },
      { status: 201 },
    );
  }

  // ── kind === "spot" ───────────────────────────────────────────────
  const parsed = spotInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;

  // Auto-link to a nearby APPROVED bhandara within ~120 m, same logic
  // as the public spot endpoint, so admin-uploaded spots also pin to a
  // listed organizer when one is in range.
  let bhandaraId: string | null = null;
  try {
    const near = await prisma.bhandara.findFirst({
      where: {
        status: "APPROVED",
        lat: { gte: d.lat - 0.0011, lte: d.lat + 0.0011 },
        lng: { gte: d.lng - 0.0012, lte: d.lng + 0.0012 },
      },
      select: { id: true },
    });
    if (near) bhandaraId = near.id;
  } catch {
    /* ignore best-effort link */
  }

  const expiresAt = new Date(Date.now() + SPOT_TTL_HOURS * 60 * 60 * 1000);

  const created = await prisma.spot.create({
    data: {
      lat: d.lat,
      lng: d.lng,
      area: d.area ?? null,
      address: d.address ?? null,
      photoUrl: d.photoUrl,
      caption: d.caption ?? null,
      language: d.language,
      reporterName: d.reporterName ?? null,
      reporterPhoneHash: null,
      bhandaraId,
      ipHash: "admin-uploaded", // marker so we can audit admin-sourced spots
      userAgent: "admin-scan",
      status: "APPROVED",
      expiresAt,
    },
  });

  return NextResponse.json(
    { ok: true, id: created.id, expiresAt: expiresAt.toISOString() },
    { status: 201 },
  );
}
