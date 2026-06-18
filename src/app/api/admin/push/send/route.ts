import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/push/send  (admin only)
 *
 * Broadcasts a notification to every registered device via the Expo Push
 * API. Used from /admin/push, e.g. an "after Bada Mangal" thank-you or a
 * "next Bada Mangal is <date>" reminder. Batches of 100 per Expo limits.
 */
const schema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(400),
});

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const { title, body } = parsed.data;

  const rows = await prisma.pushToken.findMany({ select: { token: true } });
  const tokens = rows.map((r) => r.token);
  if (tokens.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, failed: 0, total: 0 });
  }

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < tokens.length; i += 100) {
    const messages = tokens.slice(i, i + 100).map((to) => ({
      to,
      title,
      body,
      sound: "default",
    }));
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(messages),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: { status?: string }[];
      } | null;
      const data = json?.data ?? [];
      if (data.length === 0) {
        failed += messages.length;
      } else {
        for (const d of data) {
          if (d?.status === "ok") sent++;
          else failed++;
        }
      }
    } catch {
      failed += messages.length;
    }
  }

  return NextResponse.json({ ok: true, sent, failed, total: tokens.length });
}
