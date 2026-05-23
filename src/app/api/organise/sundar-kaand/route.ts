/**
 * POST /api/organise/sundar-kaand
 *
 * Public intake endpoint for "Organise a Sundar Kaand / Hanuman puja
 * at your place" requests. Same store-and-triage shape as the
 * existing /contact and /organise-bhandara endpoints, we never email
 * synchronously so a flaky SMTP doesn't break submissions, and the
 * team works the queue from /admin.
 *
 * Light validation: name + phone are required, everything else is
 * optional. The team picks up the call to fill in gaps. A loose
 * IP-hash rate limit (5 per hour) protects against the cheapest
 * scripted abuse; real spam will need a captcha bolted on later.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ipHash, readClientIp } from "@/lib/crypto";
import { toIndianMobileDigits } from "@/lib/volunteer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Default 10s is more than enough for the simple form-insert path;
// dropping the explicit override folds this into the default tier
// instead of carving out its own 5s function group.

const SERVICE_VALUES = [
  "PANDIT",
  "MANDALI",
  "TABLA",
  "HARMONIUM",
  "TENT",
  "CHAIRS",
  "SOUND",
  "PRASAD",
  "PHOTOGRAPHY",
] as const;

const bodySchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(10).max(20),
  email: z
    .string()
    .trim()
    .email()
    .max(120)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  eventType: z
    .enum(["SUNDAR_KAAND", "HANUMAN_PUJA", "BOTH"])
    .default("SUNDAR_KAAND"),
  area: z.string().trim().max(60).optional(),
  addressNotes: z.string().trim().max(400).optional(),
  preferredDates: z.array(z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/)).max(5).optional().default([]),
  preferredTime: z.string().trim().max(60).optional(),
  audienceSize: z
    .number()
    .int()
    .positive()
    .max(10000)
    .optional()
    .or(
      z.string().transform((s) => {
        const n = Number(s);
        return Number.isFinite(n) && n > 0 ? n : undefined;
      }),
    ),
  servicesNeeded: z.array(z.enum(SERVICE_VALUES)).max(SERVICE_VALUES.length).optional().default([]),
  notes: z.string().trim().max(800).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // Normalise + validate phone
  const phone = toIndianMobileDigits(data.phone);
  if (!phone) {
    return NextResponse.json(
      { ok: false, error: "validation", issues: { fieldErrors: { phone: ["Enter a valid 10-digit Indian mobile."] } } },
      { status: 400 },
    );
  }

  // Loose per-IP rate limit (5 per hour) so a single fat-fingered
  // submit-then-edit-then-submit doesn't accidentally store 12 rows.
  const ip = ipHash(readClientIp(req.headers));
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.sundarKaandRequest.count({
    where: { ipHash: ip, createdAt: { gte: oneHourAgo } },
  });
  if (recent >= 5) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "Too many submissions. Try again later." },
      { status: 429 },
    );
  }

  const ua = req.headers.get("user-agent")?.slice(0, 240) ?? null;
  const created = await prisma.sundarKaandRequest.create({
    data: {
      name: data.name,
      phone,
      email: data.email ?? null,
      eventType: data.eventType,
      area: data.area ?? null,
      addressNotes: data.addressNotes ?? null,
      preferredDates: JSON.stringify(data.preferredDates ?? []),
      preferredTime: data.preferredTime ?? null,
      audienceSize:
        typeof data.audienceSize === "number" ? data.audienceSize : null,
      servicesNeeded: JSON.stringify(data.servicesNeeded ?? []),
      notes: data.notes ?? null,
      status: "NEW",
      ipHash: ip,
      userAgent: ua,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
