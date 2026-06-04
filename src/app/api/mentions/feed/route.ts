/**
 * Public unified feed for the homepage LiveChatterBoard.
 *
 * Emits a single ordered stream of "chatter items" mixing two source
 * types:
 *   1. BhandaraMention, text/location messages from the WhatsApp bot
 *      (intent: ASKING / SHARING / MENTIONING). The original mention
 *      feed.
 *   2. Spot             , image-with-coords messages the bot ingested
 *      into the spotted-bhandara queue (status APPROVED). These carry
 *      a real photo URL + lat/lng, so the chat panel can render a
 *      thumbnail and the heatmap gets a high-fidelity cell.
 *
 * Unification rationale: a "shared a pin" event in WhatsApp usually
 * accompanies an image of the same bhandara. From the visitor's
 * perspective, both belong to the same live conversation, the
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

/** Cap the `?since=` lookback. Mirror of /api/feed's 7-day defense.
 *  Bumped from 24h on 2026-05-28 so the mobile app's Live tab can
 *  ask for "last Tuesday's chat archive" on off-days (Wed-Sun).
 *  Scrapers pasting `?since=2020-01-01` still get clamped, just to
 *  the last 7 days instead of 24h. The data exposed (public chat
 *  posts) was already serveable via the same endpoint on the open
 *  day, so this just widens the read window, not the privacy
 *  surface. */
const MAX_SINCE_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

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
  /** Companion-image URL stitched onto the mention by the feed handler
   *  when a WhatsApp forward arrived with both image AND text (the
   *  image hits /api/bot/ingest → Bhandara, the text hits
   *  /api/bot/message → BhandaraMention; the feed re-links them by
   *  groupName + ±10-min time window). Null when no companion was
   *  found, ASKING mentions, old mentions whose companion aged out,
   *  or text-only chatter. */
  photoUrl: string | null;
  /** Mentions never carry their own photos array. Always empty for
   *  kind="mention", the optional companion is on `photoUrl`. */
  photoUrls: string[];
  /** When the WA message was a REPLY, the quoted message it's
   *  answering. The chat bubble renders this as a small indented
   *  strip above the main text so a reply like "Malhaur" doesn't
   *  read as an unrelated stray word. Either field may be null;
   *  both null = not a reply. */
  quotedText: string | null;
  quotedSender: string | null;
  /** Slug + display name of the companion Bhandara when the feed
   *  handler stitches a mention to its image-ingest companion. Lets
   *  the chat bubble tap-through to the full bhandara detail page.
   *  Null when there's no companion. */
  bhandaraSlug: string | null;
  bhandaraName: string | null;
  /** WhatsApp pushName of the sender. EXPOSED on the public feed by
   *  design, the homepage chat panel shows usernames + avatars for
   *  live-chat feel. These are the same names the sender uses
   *  publicly in their WhatsApp groups (no profile photo, no phone
   *  number, only the display string they themselves chose to be
   *  visible). May be null when the bot couldn't read it. */
  senderName: string | null;
  createdAt: string;
};

type PublicSpot = {
  id: string;
  kind: "spot";
  text: string;
  language: string;
  /** Spots always represent "I am here, this is a bhandara", same
   *  semantic as a SHARING mention. The intent column on Spot doesn't
   *  exist; we hardcode SHARING so the chat panel's intent-pill UI
   *  can render uniformly across both kinds. */
  intent: "SHARING";
  locationLabel: string | null;
  /** Spots always have coords (the bot's spot path requires them). */
  lat: number;
  lng: number;
  /** Spots originate from a WA image + caption; the locationSource on
   *  the Spot table doesn't exist, we tag as "spot_photo" so the
   *  chat panel can show a "with photo" affordance. */
  locationSource: "spot_photo";
  /** Always set, that's the whole point of including Spots in this
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
  /** Spot.reporterName, the WhatsApp pushName of whoever forwarded
   *  the image. Same privacy posture as PublicMention.senderName:
   *  exposed on the public feed for live-chat feel. */
  senderName: string | null;
  /** Spots never carry quoted context. Always null. */
  quotedText: null;
  quotedSender: null;
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
  // Default 500 + max 500 covers a peak Tuesday with full headroom.
  // Bumped from default 200 / max 300 after Bada Mangal #4 of 2026
  // hit 244+ live signals in the first 12 hours and operators saw
  // the chat panel cap out. The 24h TTL on mention rows still bounds
  // the absolute upper end so this never grows unbounded.
  const rawLimit = Number(limitParam ?? "500") || 500;
  const limitN = Math.max(1, Math.min(500, rawLimit));
  if (rawLimit > 500) {
    console.warn(
      `[api/mentions/feed] cap hit: client requested limit=${rawLimit}, clamped to 500. ` +
        `Bump the 500 ceiling above if real demand exceeds this.`,
    );
  }
  /** When `withCoords=1` is passed, restrict the feed to items with
   *  non-null lat/lng. The heatmap component uses this to skip the
   *  no-location text-only mentions it can't render. */
  const withCoordsOnly = url.searchParams.get("withCoords") === "1";
  // all=1 drops the live 8h/24h expiry filter so off-day consumers
  // (the mobile app's Live tab + home chat preview on Wed-Sun) can
  // pull the last Bada Mangal's archive instead of an empty stream.
  // Mirrors /api/feed?all=1 and /api/spots?all=1. Combine with
  // `?since=<last Tuesday>` to bound the archive to that day. Default
  // (no param) is unchanged: live window only.
  const includeExpired = url.searchParams.get("all") === "1";

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

  // Fire both queries in parallel, they hit different tables so
  // there's no contention, and serialising would just add latency.
  //
  // `serverNow` is captured BEFORE the queries run and returned to
  // the client as `fetchedAt`. The client uses it for the next
  // `?since=…` instead of its own `new Date()`, closing a real race:
  // if the client set `lastFetchAt` to the response-receive moment,
  // any mention whose `approvedAt` fell between query-run and
  // response-receive (typical RTT 200-500 ms) would be skipped by
  // the next poll. Using a server-clock timestamp from BEFORE the
  // query guarantees nothing in (serverNow, …) is lost, at worst
  // a row gets fetched twice and the client's id-based dedup
  // collapses it.
  const serverNow = new Date();
  const now = serverNow;
  // Promise.allSettled (not Promise.all) so a single EMAXCONN on one
  // table doesn't 500 the entire homepage poll. The chat panel polls
  // this every 12s; serving an empty bucket for the failed half and
  // the live bucket for the surviving half is invisible to the user
  //, next tick recovers. Was throwing `net::ERR_ABORTED 500` red
  // banners in browser console under peak Tuesday load.
  const settled = await Promise.allSettled([
    prisma.bhandaraMention.findMany({
      where: {
        status: "APPROVED",
        ...(includeExpired ? {} : { expiresAt: { gt: now } }),
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
        groupName: true,
        createdAt: true,
        approvedAt: true,
        quotedText: true,
        quotedSender: true,
      },
    }),
    prisma.spot.findMany({
      where: {
        status: "APPROVED",
        ...(includeExpired ? {} : { expiresAt: { gt: now } }),
        // Only include spots that actually have a photo, the whole
        // point of merging them into this feed is to surface the
        // thumbnail. Spots without photoUrl belong in the existing
        // /api/feed marquee, not here.
        photoUrl: { not: null },
        // STRICT WHATSAPP-ONLY CONTRACT (2026-05):
        // The live chat is a window into the WhatsApp community feed.
        // We previously also merged in /spot-form submissions and
        // admin-scan uploads, which violated visitor expectation:
        // "if I see a row here, someone posted in WhatsApp". Now we
        // filter Spots to only those the WhatsApp bot ingested, by
        // requiring the `[bot:` provenance tag the bot stamps onto
        // every caption it writes. User-submitted spots still live in
        // the Spots queue and the homepage map heatmap, just not in
        // this conversational stream.
        caption: { contains: "[bot:" },
        // NOTE: we used to drop spots at the "null island" 0,0 here.
        // That filtered out bot-ingested spots which auto-publish with
        // lat=0/lng=0 (WhatsApp strips EXIF GPS, so the bot has no
        // coords until an admin fills them in). The chat panel still
        // wants the photo + caption, only the heatmap should refuse
        // to pin 0,0. The MentionHeatmap consumer filters those out
        // client-side; the feed itself stays generous.
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
  // Unwrap each settled result with a safe empty fallback. Logged so
  // we can spot real outages in Vercel logs, but the route still
  // returns 200 with whatever survived. The generic helper preserves
  // the include-augmented row type (e.g. spotRows[].bhandara) that
  // would be lost with `[] as Awaited<ReturnType<typeof prisma...>>`
  //, that bare-type assertion was what broke the build.
  function unwrap<T>(r: PromiseSettledResult<T[]>, label: string): T[] {
    if (r.status === "fulfilled") return r.value;
    console.error(
      `[api/mentions/feed] ${label} query failed:`,
      r.reason instanceof Error ? r.reason.message : r.reason,
    );
    return [];
  }
  const mentionRows = unwrap(settled[0], "mentions");
  const spotRows = unwrap(settled[1], "spots");

  // ── Companion-Bhandara enrichment for mentions ─────────────────
  // WhatsApp forwards with an image AND a text caption hit the bot
  // as two separate messages. The image lands in /api/bot/ingest →
  // creates a Bhandara row with a photoUrl. The caption lands in
  // /api/bot/message → creates a BhandaraMention row with NO image.
  // Without a stitch, the live chat panel showed only the text and
  // the visitor never saw the invite poster the sender actually
  // forwarded. Match each mention to its companion Bhandara by
  // groupName + time-window, then surface the Bhandara's photoUrl /
  // slug / name on the mention's feed entry so LiveChatterBoard
  // renders the thumbnail (it already supports `photoUrl` on
  // mention rows, just wasn't being populated).
  const COMPANION_WINDOW_MS = 10 * 60 * 1000; // 10 min either side
  const mentionGroups = Array.from(
    new Set(mentionRows.map((m) => m.groupName).filter((g): g is string => !!g)),
  );
  type CompanionBh = {
    id: string;
    slug: string;
    name: string;
    photoUrl: string | null;
    description: string | null;
    createdAt: Date;
  };
  let companionBhandaras: CompanionBh[] = [];
  if (mentionRows.length > 0 && mentionGroups.length > 0) {
    const mentionTimes = mentionRows.map((m) => m.createdAt.getTime());
    const earliest = new Date(Math.min(...mentionTimes) - COMPANION_WINDOW_MS);
    const latest = new Date(Math.max(...mentionTimes) + COMPANION_WINDOW_MS);
    try {
      companionBhandaras = await prisma.bhandara.findMany({
      where: {
        // Bot-ingested only, the [bot:whatsapp tag is the marker
        // /api/bot/ingest stamps onto every description it writes.
        description: { contains: "[bot:whatsapp" },
        // Photo is the whole reason we're stitching, skip rows that
        // never got one.
        photoUrl: { not: null },
        createdAt: { gte: earliest, lte: latest },
      },
      select: {
        id: true,
        slug: true,
        name: true,
        photoUrl: true,
        description: true,
        createdAt: true,
      },
      // Bounded list: 200 candidates per feed refresh is plenty even
      // on the busiest Tuesday morning (bot averages 5–15 image
      // ingests per hour).
      take: 200,
      });
    } catch (err) {
      console.error(
        "[api/mentions/feed] companion-bhandara enrichment failed:",
        err instanceof Error ? err.message : err,
      );
      // Keep companionBhandaras as []. The mention rows still ship
      // unenriched; photo-stitching just doesn't happen this tick.
    }
  }

  // Parse the `[bot:whatsapp · in:<groupName>` fragment out of each
  // Bhandara's description so we can match by groupName. The full bot
  // tag is `[bot:whatsapp · from:<sender> · in:<group> · msg:… …]`
  // and the in:<group> fragment may not exist on legacy ingests that
  // pre-date task #110's groupName plumbing.
  function parseBhandaraGroup(desc: string | null): string | null {
    if (!desc) return null;
    const m = desc.match(/\[bot:whatsapp[^\]]*?· in:([^·\]]+)/);
    return m ? m[1].trim() : null;
  }

  // Build groupName → list of candidate Bhandaras (newest first).
  const companionsByGroup = new Map<string, CompanionBh[]>();
  for (const b of companionBhandaras) {
    const g = parseBhandaraGroup(b.description);
    if (!g) continue;
    const arr = companionsByGroup.get(g) ?? [];
    arr.push(b);
    companionsByGroup.set(g, arr);
  }
  for (const arr of companionsByGroup.values()) {
    arr.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // For a given mention, find the closest-in-time companion within
  // ±COMPANION_WINDOW_MS that came from the same WhatsApp group.
  function findCompanion(
    mention: { groupName: string | null; createdAt: Date },
  ): CompanionBh | null {
    if (!mention.groupName) return null;
    const candidates = companionsByGroup.get(mention.groupName);
    if (!candidates || candidates.length === 0) return null;
    const tMention = mention.createdAt.getTime();
    let best: CompanionBh | null = null;
    let bestDelta = Infinity;
    for (const c of candidates) {
      const delta = Math.abs(c.createdAt.getTime() - tMention);
      if (delta < bestDelta && delta <= COMPANION_WINDOW_MS) {
        best = c;
        bestDelta = delta;
      }
    }
    return best;
  }

  const mentionItems: PublicMention[] = mentionRows.map((m) => {
    const companion = findCompanion({
      groupName: m.groupName,
      createdAt: m.createdAt,
    });
    return {
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
    // Companion image, surfaces the invite poster the sender forwarded
    // alongside this caption. Null when there's no Bhandara in the
    // ±10-min window from the same group, which is the right behavior
    // for ASKING mentions ("kab tak chalega bhandara?") and for old
    // mentions whose companion ingest has aged out.
    photoUrl: companion?.photoUrl ?? null,
    photoUrls: [],
    quotedText: m.quotedText,
    quotedSender: m.quotedSender,
    // Same source as photoUrl, let visitors tap through to the full
    // bhandara detail page when the mention is matched.
    bhandaraSlug: companion?.slug ?? null,
    bhandaraName: companion?.name ?? null,
    senderName: m.senderName,
    // Use approvedAt as the "appears on feed at" timestamp so the
    // chat-bubble's relative time matches what the polling logic uses.
    createdAt: (m.approvedAt ?? m.createdAt).toISOString(),
    };
  });

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
      // Strip the [bot:…] provenance tag from the caption, same hygiene
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
      quotedText: null,
      quotedSender: null,
      bhandaraSlug: s.bhandara?.slug ?? null,
      bhandaraName: s.bhandara?.name ?? null,
      senderName: s.reporterName,
      createdAt: s.createdAt.toISOString(),
    };
  });

  // Merge + sort by createdAt desc, then trim to limitN. We over-fetch
  // (limitN from EACH source) so the merge can fairly pick the most
  // recent across both. Worst case wastes a row read; trivial.
  const combinedLen = mentionItems.length + spotItems.length;
  if (combinedLen > limitN) {
    // Cap-hit: real available signal exceeded the client's limit
    // request. Surfacing the gap so a future Tuesday where the cap
    // is too tight is visible in Vercel logs rather than silently
    // truncating the chat panel.
    console.warn(
      `[api/mentions/feed] cap hit: ${combinedLen} combined items trimmed to ${limitN} ` +
        `(mentions=${mentionItems.length}, spots=${spotItems.length}). ` +
        `Older rows dropped from this response.`,
    );
  }
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
