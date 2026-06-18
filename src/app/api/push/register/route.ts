import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { ipHash, readClientIp } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/push/register
 *
 * The mobile app sends its Expo push token here after the user opts in
 * to notifications. Upserted by token so re-registers (token rotation,
 * reinstall) don't pile up duplicates. These rows are the broadcast
 * targets for /admin/push (e.g. an "after Bada Mangal" thank-you, or a
 * "next Bada Mangal is on <date>" reminder).
 */
const schema = z.object({
  token: z.string().min(10).max(200),
  platform: z.enum(["ios", "android"]).optional(),
  locale: z.string().max(8).optional(),
});

export async function POST(req: NextRequest) {
  const limit = checkRateLimit({
    key: ipHash(readClientIp(req.headers)),
    max: 20,
    windowMs: 60 * 1000,
    bucket: "push-register",
  });
  if (!limit.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const d = parsed.data;

  // Only accept real Expo push tokens; ignore device garbage / probes.
  if (
    !d.token.startsWith("ExponentPushToken[") &&
    !d.token.startsWith("ExpoPushToken[")
  ) {
    return NextResponse.json({ error: "not_an_expo_token" }, { status: 400 });
  }

  await prisma.pushToken.upsert({
    where: { token: d.token },
    update: {
      platform: d.platform ?? null,
      locale: d.locale ?? null,
      updatedAt: new Date(),
    },
    create: {
      token: d.token,
      platform: d.platform ?? null,
      locale: d.locale ?? null,
    },
  });

  return NextResponse.json(
    { ok: true },
    { headers: { "cache-control": "no-store" } },
  );
}
