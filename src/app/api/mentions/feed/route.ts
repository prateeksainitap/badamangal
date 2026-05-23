/**
 * Public unified feed for the homepage LiveChatterBoard.
 *
 * Emits a single ordered stream of "chatter items" mixing two source
 * types:
 *   1. BhandaraMention — text/location messages from the WhatsApp bot
 *      (intent: ASKING / SHARING / MENTIONING). The original mention
 *      feed.
 *   2. Spot              — image-with-coords messages the bot ingested
 *      into the spotted-bhandara queue (status APPROVED). These carry
 *      a real photo URL + lat/lng, so the chat panel can render a
 *      thumbnail and the heatmap gets a high-fidelity cell.
 *
 * Unification rationale: a "shared a pin" event in WhatsApp usually
 * accompanies an image of the same bhandara. From the visitor's
 * perspective, both belong to the same live conversation — the
 * homepage shouldn't split them across two separate widgets. By
 * merging server-side, the chat panel renders one stream with photo
 * thumbnails inline where they exist.
 *
 * Type discrimination: each item carries `kind: "mention" | "spot"`
 * + ID is prefixed (`mention:<id>` / `spot:<id>`) so the client can
 * route per-kind UI behaviour without leaking the underlying schema.
 *
 * Cache: SWR with 5s s-maxage. The 12s client poll combined with edge
 * caching keeps fetch volume low without making the feed feel stale.
 */
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { stripBotProvenance } from "@/lib/sanitize";
import { checkRateLimit } from "@/lib/rate-limit";
import { ipHash, readClientIp } from "@/lib/crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Cap the `?since=` lookback. Mirror of /api/feed's defense, scrapers
 *  pasting `?since=2020-01-01` get clamped to the last 24h. */
const MAX_SINCE_LOOKBACK_MS = 24 * 60 * 60 * 1000;

type PublicMention = {
  /** Always "mention:" prefix + db id, so the client can route per-kind. */
  id: string;
  /** Discriminator. Drives the chat-bubble layout (photo, badges, links). */
  kind: "mention";
  text: string;
  language: string;
  intent: "ASKING" | "SHARING" | "MENTIONING";
  locationLabel: string | null;
  lat: number | null;
  lng: number | null;
  locationSource: string;
  /** Mentions never carry a photo (they're text/location-share events). */
  photoUrl: null;
  /** Mentions never carry any photos. Always empty for kind="mention". */
  photoUrls: string[];
  /** Mentions never link to a specific bhandara slug yet (admin can
   *  match in moderation; until then, null). */
  bhandaraSlug: null;
  bhandaraName: null;
  /** WhatsApp pushName of the sender. EXPOSED on the public feed by
   *  design — the homepage chat panel shows usernames + avatars for
   *  live-chat feel. These are the same names the sender uses
   *  publicly in their WhatsApp groups (no profile photo, no phone
   *  number — only the display string they themselves chose to be
   *  visible). May be null when the bot couldn't read it. */
  senderName: string | null;
  createdAt: string;
};

type PublicSpot = {
  id: string;
  kind: "spot";
  text: string;
  language: string;
  /** Spots always represent "I am here, this is a bhandara" — same
   *  semantic as a SHARING mention. The intent column on Spot doesn't
   *  exist; we hardcode SHARING so the chat panel's intent-pill UI
   *  can render uniformly across both kinds. */
  intent: "SHARING";
  locationLabel: string | null;
  /** Spots always have coords (the bot's spot path requires them). */
  lat: number;
  lng: number;
  /** Spots originate from a WA image + caption; the locationSource on
   *  the Spot table doesn't exist — we tag as "spot_photo" so the
   *  chat panel can show a "with photo" affordance. */
  locationSource: "spot_photo";
  /** Always set — that's the whole point of including Spots in this
   *  unified feed. The primary photo. */
  photoUrl: string;
  /** All photos for the spot (primary first, then up to 4 from
   *  Spot.extraPhotoUrls). The chat-bubble renders this as an
   *  in-card carousel when length > 1. Always length ≥ 1 because
   *  the spot is only included when photoUrl is non-null. */
  photoUrls: string[];
  /** When admin has matched the spot to a curated bhandara row, the
   *  slug surfaces here so the chat bubble can link to the detail page. */
  bhandaraSlug: string | null;
  bhandaraName: string | null;
  /** Spot.reporterName — the WhatsApp pushName of whoever forwarded
   *  the image. Same privacy posture as PublicMention.senderName:
   *  exposed on the public feed for live-chat feel. */
  senderName: string | null;
  createdAt: string;
};

type PublicItem = PublicMention | PublicSpot;

export async function GET(req: NextRequest) {
  // ── Rate limit (same shape as /api/feed) ────────────────────────
  // Two homepage consumers polling at 12s = 10 requests/min/tab. 60/min
  // gives 6 tabs of headroom per IP before throttling, plenty for
  // normal multi-tab use without making slug-iterating scrapers cheap.
  const limit = checkRateLimit({
    key: ipHash(readClientIp(req.headers)),
    max: 60,
    windowMs: 60 * 1000,
    bucket: "mentions-feed-get",
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSec: limit.retryAfterSec },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSec) },
      },
    );
  }

  const url = new URL(req.url);
  const sinceParam = url.searchParams.get("since");
  const limitParam = url.searchParams.get("limit");
  const limitN = Math.max(1, Math.min(60, Number(limitParam ?? "30") || 30));
  /** When `withCoords=1` is passed, restrict the feed to items with
   *  non-null lat/lng. The heatmap component uses this to skip the
   *  no-location text-only mentions it can't render. */
  const withCoordsOnly = url.searchParams.get("withCoords") === "1";

  // Parse + clamp `since`. We filter mentions by approvedAt (so newly
  // admin-approved old PENDING rows surface to the poll) and Spots by
  // createdAt (they're auto-approved at ingest, so createdAt is also
  // their "moment of going live").
  let sinceDate: Date | null = sinceParam ? new Date(sinceParam) : null;
  if (sinceDate && Number.isNaN(sinceDate.getTime())) sinceDate = null;
  if (sinceDate) {
    const oldest = new Date(Date.now() - MAX_SINCE_LOOKBACK_MS);
    if (sinceDate < oldest) sinceDate = oldest;
  }

  // Fire both queries in parallel — they hit different tables so
  // there's no contention, and serialising would just add latency.
  //
  // `serverNow` is captured BEFORE the queries run and returned to
  // the client as `fetchedAt`. The client uses it for the next
  // `?since=…` instead of its own `new Date()`, closing a real race:
  // if the client set `lastFetchAt` to the response-receive moment,
  // any mention whose `approvedAt` fell between query-run and
  // response-receive (typical RTT 200-500 ms) would be skipped by
  // the next poll. Using a server-clock timestamp from BEFORE the
  // query guarantees nothing in (serverNow, …) is lost — at worst
  // a row gets fetched twice and the client's id-based dedup
  // collapses it.
  const serverNow = new Date();
  const now = serverNow;
  const [mentionRows, spotRows] = await Promise.all([
    prisma.bhandaraMention.findMany({
      where: {
        status: "APPROVED",
        expiresAt: { gt: now },
        approvedAt: { not: null },
        ...(withCoordsOnly ? { lat: { not: null }, lng: { not: null } } : {}),
        ...(sinceDate ? { approvedAt: { gt: sinceDate } } : {}),
      },
      orderBy: { approvedAt: "desc" },
      take: limitN,
      select: {
        id: true,
        cleanedText: true,
        originalText: true,
        language: true,
        intent: true,
        locationLabel: true,
        lat: true,
        lng: true,
        locationSource: true,
        senderName: true,
        createdAt: true,
        approvedAt: true,
      },
    }),
    prisma.spot.findMany({
      where: {
        status: "APPROVED",
        expiresAt: { gt: now },
        // Only include spots that actually have a photo — the whole
        // point of merging them into this feed is to surface the
        // thumbnail. Spots without photoUrl belong in the existing
        // /api/feed marquee, not here.
        photoUrl: { not: null },
        // Spot has lat + lng as required Float columns (not nullable),
        // so withCoordsOnly is implicit. We still drop spots whose
        // coords landed at the 0,0 "null island" — bot-ingested spots
        // sometimes default to 0,0 before the admin fixes coords; we
        // shouldn't surface those on the public heatmap.
        lat: { not: 0 },
        lng: { not: 0 },
        ...(sinceDate ? { createdAt: { gt: sinceDate } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limitN,
      select: {
        id: true,
        caption: true,
        language: true,
        area: true,
        lat: true,
        lng: true,
        photoUrl: true,
        extraPhotoUrls: true,
        reporterName: true,
        createdAt: true,
        bhandara: { select: { slug: true, name: true } },
      },
    }),
  ]);

  const mentionItems: PublicMention[] = mentionRows.map((m) => ({
    id: `mention:${m.id}`,
    kind: "mention",
    // `cleanedText` is PII-redacted + bot-tag-stripped. The fallback
    // path used to ship raw `originalText` (minus the [bot:…] prefix)
    // which still contained phone numbers and the bot's group / msg-id
    // provenance on rows where the classifier didn't produce a clean
    // version. Run it through stripBotProvenance so a null cleanedText
    // still produces sanitised public output.
    text:
      m.cleanedText ??
      stripBotProvenance(m.originalText.split("\n\n[bot:")[0] ?? "") ??
      "",
    language: m.language,
    intent:
      m.intent === "ASKING" || m.intent === "SHARING"
        ? m.intent
        : "MENTIONING",
    locationLabel: m.locationLabel,
    lat: m.lat,
    lng: m.lng,
    locationSource: m.locationSource,
    photoUrl: null,
    photoUrls: [],
    bhandaraSlug: null,
    bhandaraName: null,
    senderName: m.senderName,
    // Use approvedAt as the "appears on feed at" timestamp so the
    // chat-bubble's relative time matches what the polling logic uses.
    createdAt: (m.approvedAt ?? m.createdAt).toISOString(),
  }));

  const spotItems: PublicSpot[] = spotRows.map((s) => {
    // Build the photo list: primary first, then up to 4 extras from
    // the JSON-encoded Spot.extraPhotoUrls column. Defensive parse so
    // a malformed row can't crash the feed.
    let extras: string[] = [];
    try {
      const parsed = JSON.parse(s.extraPhotoUrls || "[]") as unknown;
      if (Array.isArray(parsed)) {
        extras = parsed.filter(
          (u): u is string => typeof u === "string" && u.length > 0,
        );
      }
    } catch {
      extras = [];
    }
    const photoUrls = [s.photoUrl!, ...extras];
    return {
      id: `spot:${s.id}`,
      kind: "spot",
      // Strip the [bot:…] provenance tag from the caption — same hygiene
      // as the existing /api/feed endpoint.
      text: stripBotProvenance(s.caption) || "Bhandara spotted",
      language: s.language,
      intent: "SHARING",
      locationLabel: s.area,
      lat: s.lat,
      lng: s.lng,
      locationSource: "spot_photo",
      photoUrl: s.photoUrl!, // not-null filter above guarantees this
      photoUrls,
      bhandaraSlug: s.bhandara?.slug ?? null,
      bhandaraName: s.bhandara?.name ?? null,
      senderName: s.reporterName,
      createdAt: s.createdAt.toISOString(),
    };
  });

  // Merge + sort by createdAt desc, then trim to limitN. We over-fetch
  // (limitN from EACH source) so the merge can fairly pick the most
  // recent across both. Worst case wastes a row read; trivial.
  const merged: PublicItem[] = [...mentionItems, ...spotItems]
    .sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
    )
    .slice(0, limitN);

  return NextResponse.json(
    {
      count: merged.length,
      mentions: merged,
      // Server-clock timestamp captured BEFORE the query ran; the
      // client passes this back as `?since=` next tick. See the
      // serverNow comment above.
      fetchedAt: serverNow.toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15",
      },
    },
  );
}
