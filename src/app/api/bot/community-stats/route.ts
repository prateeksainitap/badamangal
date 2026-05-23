/**
 * Bot-pushed community-size snapshot.
 *
 * The BadaMangal WhatsApp bot is a participant in multiple bhandara
 * groups + the channel. It alone knows the live participant counts
 * (via Baileys `groupMetadata().participants.length`), and the
 * homepage's "what people are talking about" section wants to surface
 * a "X members across communities" badge so visitors see the scale of
 * the conversation they can join.
 *
 * Flow:
 *   1. Bot polls each group's metadata on a slow interval (every ~10
 *      min is plenty — group sizes change at the speed of human
 *      invites).
 *   2. Bot sums the counts and POSTs the total here.
 *   3. We upsert a SiteCounter row (`community_total_members`). The
 *      homepage SSR reads that row and renders the value with a soft
 *      "live" animation.
 *
 * Same SiteCounter table the existing heartbeat endpoint writes to,
 * so no schema change. Bearer-token gated like every other bot
 * endpoint.
 *
 * Why upsert vs increment: the bot reports the AUTHORITATIVE total
 * each call. We replace `count` rather than adding to it; otherwise
 * a daily ping would balloon the number into nonsense. The endpoint
 * is idempotent — pinging twice with the same number is a no-op
 * besides bumping updatedAt.
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COUNTER_ID = "community_total_members";

type Body = {
  /** Total participants summed across all allowlisted groups/channels
   *  the bot is a member of. Bot computes via
   *  `sum(groupMetadata(jid).participants.length for jid in allowlist)`. */
  count?: number;
  /** Per-group/-channel counts keyed by a stable string id that
   *  matches the entries in the homepage's WHATSAPP_CTAS array (see
   *  src/components/LiveChatterBoard.tsx). Each becomes its own
   *  SiteCounter row (`community_count_<id>`), so the homepage can
   *  render the exact member count next to each "Join" CTA card.
   *  Known ids:
   *    - "bada_mangal_community"
   *    - "balaji_bhandara_community"
   *    - "bhandara_group"
   *    - "bada_mangal_channel"
   *  Unknown ids are written too (forward-compat) — admin can read
   *  any SiteCounter row by id. */
  byGroup?: Record<string, number>;
};

function jsonError(
  status: number,
  error: string,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

export async function POST(req: NextRequest) {
  const expected = process.env.BOT_INGEST_SECRET;
  if (!expected) {
    return jsonError(500, "ingest_disabled", {
      detail: "BOT_INGEST_SECRET is not configured on the server.",
    });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return jsonError(403, "forbidden");
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError(400, "invalid_json");
  }
  const count = Number(body.count);
  if (!Number.isFinite(count) || count < 0 || count > 1_000_000) {
    return jsonError(400, "invalid_count", {
      detail: "count must be a finite number between 0 and 1,000,000",
    });
  }

  const row = await prisma.siteCounter.upsert({
    where: { id: COUNTER_ID },
    update: { count: Math.round(count) },
    create: { id: COUNTER_ID, count: Math.round(count) },
    select: { count: true, updatedAt: true },
  });

  // Per-group counts (optional). One SiteCounter row per known id.
  // Validate sanity (positive integers within a reasonable range) so a
  // mistyped payload doesn't pollute the table. Errors on individual
  // entries don't fail the whole call — we report which ones landed.
  const perGroupWritten: Record<string, number> = {};
  if (body.byGroup && typeof body.byGroup === "object") {
    for (const [key, value] of Object.entries(body.byGroup)) {
      const c = Number(value);
      if (
        !key ||
        key.length > 64 ||
        !/^[a-z0-9_]+$/i.test(key) ||
        !Number.isFinite(c) ||
        c < 0 ||
        c > 1_000_000
      ) {
        continue; // skip silently — bot logs whatever it pushed
      }
      const groupRow = await prisma.siteCounter.upsert({
        where: { id: `community_count_${key}` },
        update: { count: Math.round(c) },
        create: { id: `community_count_${key}`, count: Math.round(c) },
        select: { count: true },
      });
      perGroupWritten[key] = groupRow.count;
    }
  }

  return NextResponse.json({
    ok: true,
    id: COUNTER_ID,
    count: row.count,
    byGroup: perGroupWritten,
    at: row.updatedAt.toISOString(),
  });
}

/** GET so the bot (or anyone debugging) can read the current value
 *  without writing. Public — the count is already going to be
 *  displayed publicly on the homepage. */
export async function GET() {
  const row = await prisma.siteCounter.findUnique({
    where: { id: COUNTER_ID },
    select: { count: true, updatedAt: true },
  });
  return NextResponse.json({
    ok: true,
    id: COUNTER_ID,
    count: row?.count ?? 0,
    at: row?.updatedAt?.toISOString() ?? null,
  });
}
