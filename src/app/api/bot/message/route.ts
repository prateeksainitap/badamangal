/**
 * Silent text-message ingestion endpoint for the OpenClaw WhatsApp
 * agent. Sibling of /api/bot/ingest (which handles images) — same
 * Bearer-token gate, same silent-in-the-group contract, same admin
 * queue as the publication surface.
 *
 * Flow:
 *   1. The OpenClaw agent watches allowlisted bhandara WhatsApp
 *      groups and forwards EVERY text message here. (No client-side
 *      filtering — the classifier is our filter, and it's better than
 *      a regex when "kahan ho raha hai bhandara" can be mistyped 20
 *      different ways.)
 *   2. We classify via Gemini Flash: intent (ASKING / SHARING /
 *      MENTIONING / UNRELATED), confidence, language, and best-effort
 *      address extraction.
 *   3. UNRELATED messages (or confidence < 0.4) short-circuit with
 *      `ok:true, kind:"ignored"`. No DB row, no admin noise.
 *   4. For the rest, we resolve a location three ways (in priority
 *      order): a direct lat/lng on the WhatsApp payload (location
 *      share), a Google Maps URL pasted in the message body, or a
 *      forward-geocode of the extracted address. All three fall
 *      back to "no location" gracefully — the mention still shows up
 *      on the public feed, just not on the heatmap.
 *   5. Insert a PENDING BhandaraMention row with a 24-hour expiry,
 *      embed a provenance tag so admins can see sender/group/intent
 *      at a glance.
 *
 * The bot never replies in the WhatsApp group; the admin moderation
 * queue at /admin?type=mentions is the only consumption surface for
 * the result. Once approved, mentions appear on the homepage's
 * LiveChatterBoard + bhandara-density heatmap.
 *
 * ## Expected payload (for OpenClaw wiring)
 *
 * ```json
 * POST /api/bot/message
 * Authorization: Bearer ${BOT_INGEST_SECRET}
 * Content-Type: application/json
 *
 * {
 *   "text":         "Aliganj sector E me bhandara ho raha hai 11 baje se", // required, ≤ 2000 chars
 *   "groupName":    "BadaMangal Connect 2026",  // optional, ≤ 80 chars
 *   "senderName":   "Sharma ji",                // optional, ≤ 80 chars
 *   "msgId":        "wa-abc-123",               // optional, ≤ 120 chars — used for dedup
 *   "locationLat":  26.876,                     // optional — set when sender shared a WA location pin
 *   "locationLng":  80.929                      // optional — paired with locationLat
 * }
 * ```
 *
 * ## Response shapes
 *
 *   `{ ok:true, kind:"created", id, intent, reviewUrl }`   row inserted
 *   `{ ok:true, kind:"duplicate", duplicateOf, reviewUrl }` msgId already seen
 *   `{ ok:true, kind:"ignored", reason }`                  classified UNRELATED
 *                                                          / low confidence /
 *                                                          off-topic
 *   `{ ok:false, error, detail? }` on any failure (4xx / 5xx)
 *
 * The OpenClaw agent should treat all four `ok:true` shapes as success
 * (no retry); only retry on 5xx + network errors.
 *
 * ## Auth
 *
 * Same secret as /api/bot/ingest: `BOT_INGEST_SECRET`. Treat as a
 * password — anyone with it can spam the admin queue but can't publish
 * (publication requires the separate admin cookie). Rotate at the first
 * sign of leakage; the OpenClaw agent reads it from its own env file.
 */
import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { classifyBhandaraMessage } from "@/lib/vision";
import { geocodeLucknow, reverseGeocodeLucknow } from "@/lib/geocodeServer";
import { hasProfanity } from "@/lib/profanity-filter";
import { checkRateLimit } from "@/lib/rate-limit";
import { ipHash, readClientIp } from "@/lib/crypto";
import { invalidateHomepageStatsCache } from "@/lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 25s matches the existing tier used by bot/ingest + admin/scan +
// pamphlet so this route folds into that function group instead of
// carving out its own 20s tier (Hobby's 12-function cap counts each
// unique maxDuration as a separate group). Budget covers classify
// (~3-4s on Gemini + retries) + reverse-geocode (~5s) + DB writes
// (~2s) with comfortable headroom; the Baileys bot caller doesn't
// care about the extra 5s ceiling.
export const maxDuration = 25;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";
const MAX_TEXT_LEN = 2000;
/** Mentions stay on the public feed + heatmap for 24h after creation.
 *  Long enough for the next-day "did you see yesterday's chatter?" view,
 *  short enough that the heatmap reflects "right now" not "this week". */
const MENTION_TTL_HOURS = 24;
/** Spots created from text+location messages live on the main MapBoard
 *  / HappeningNow / stats counter for 8 hours, matching the TTL the
 *  user-facing /spot form uses. After that they age out of the live
 *  surface but remain in the lifetime "Bhandaras spotted" tally. */
const SPOT_TTL_HOURS = 8;
/** Dedup window for cross-message Spot creation. A SHARING message that
 *  arrives within this window of an earlier Spot from the same sender
 *  at the same (~110m) coords is treated as a follow-up, not a new
 *  sighting. Tuned a bit wider than the BhandaraMention merge window so
 *  a user typing the text, then the pin, then a clarifying message
 *  (each ~30-60s apart) doesn't produce three identical map pins. */
const SPOT_DEDUP_WINDOW_MS = 10 * 60 * 1000;
/** Half-side of the bounding box used for Spot dedup. 0.001° ≈ 110m at
 *  Lucknow's latitude — tight enough that two genuinely-different
 *  bhandaras a block apart still count as separate, loose enough that
 *  a re-shared pin from the same venue (which can drift by a few
 *  metres) is recognised as a duplicate. */
const SPOT_DEDUP_HALF_DEG = 0.001;
/** Below this Gemini-reported confidence we drop the mention silently
 *  even if `intent` looks promising. Tuned at 0.4 to over-admit during
 *  initial roll-out; raise after the admin gives feedback on false
 *  positives in the queue. */
const MIN_CONFIDENCE = 0.4;
/** Lucknow bounding box (matches geocodeServer + admin/resolve-coords).
 *  Any lat/lng outside this is treated as "no location" — pasting a
 *  share-pin from Delhi shouldn't put a dot on Lucknow's heatmap. */
const LKO_BBOX = {
  latMin: 26.6,
  latMax: 27.0,
  lngMin: 80.7,
  lngMax: 81.2,
};
function inLucknow(lat: number, lng: number): boolean {
  return (
    lat >= LKO_BBOX.latMin &&
    lat <= LKO_BBOX.latMax &&
    lng >= LKO_BBOX.lngMin &&
    lng <= LKO_BBOX.lngMax
  );
}

type IngestBody = {
  text?: string;
  groupName?: string;
  senderName?: string;
  msgId?: string;
  /** Optional, set when the WhatsApp message included a location share. */
  locationLat?: number;
  locationLng?: number;
  /** Optional sliding window of the most recent messages the bot saw
   *  in the SAME group (oldest first, excluding the current). Lets
   *  the classifier read short replies in the context of the
   *  conversation they're answering. The bot caps this at 5 entries
   *  and 200 chars each; the classifier re-caps + sanitises before
   *  shipping to Gemini. */
  recentContext?: { senderName?: string; text?: string }[];
  /** When the WhatsApp message was a reply (Baileys' contextInfo.
   *  quotedMessage), the bot sends the quoted text + best-effort
   *  sender so the chat panel can render "↳ <quoted> — <sender>"
   *  above the reply bubble. Both fields capped server-side. */
  quotedText?: string;
  quotedSender?: string;
};

function jsonError(
  status: number,
  error: string,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

/**
 * Extract the first Google Maps URL from a chat message and pull
 * coordinates out of it. Mirrors the subset of extraction patterns in
 * /api/admin/resolve-coords#extractFromUrl, kept inline here so the
 * bot endpoint doesn't have a dependency on the admin route.
 *
 * Returns null on no URL, malformed URL, or no recognised coord pattern.
 * Only handles full URLs (`@LAT,LNG` or `!3dLAT!4dLNG`); short
 * `maps.app.goo.gl` URLs aren't followed here because the bot endpoint
 * is a hot path and shouldn't issue outbound HTTP for every chatty
 * group message. If admins consistently see short-URL mentions land
 * without coords, we can promote that resolution to a background job
 * later.
 */
function extractCoordsFromMessage(
  text: string,
): { lat: number; lng: number } | null {
  // Find the first URL that looks like a Google Maps share.
  const urlMatch = text.match(/https?:\/\/[^\s]*(?:google\.[^\s/]+\/maps|maps\.google)[^\s]*/i);
  if (!urlMatch) return null;
  const url = urlMatch[0];
  // !3dLAT!4dLNG: the canonical "place pin" pattern
  const place = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (place) {
    const lat = Number(place[1]);
    const lng = Number(place[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  // /@LAT,LNG: viewport / map-center pattern
  const at = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) {
    const lat = Number(at[1]);
    const lng = Number(at[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return null;
}

export async function POST(req: NextRequest) {
  // ── 1. Auth ─────────────────────────────────────────────────────
  const expected = process.env.BOT_INGEST_SECRET;
  if (!expected) {
    return jsonError(500, "ingest_disabled", {
      detail:
        "BOT_INGEST_SECRET is not configured on the server. Add it on Vercel and redeploy.",
    });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return jsonError(403, "forbidden");
  }

  // ── 2. Rate limit (per IP, generous — chatty groups can be bursty)
  // The OpenClaw agent batches forwards in 1s windows, so even a
  // very active group rarely exceeds 30 messages/min. 120/min gives
  // headroom for multi-group bursts during a Bada Mangal Tuesday
  // morning without making a leaked secret a quota-burning DoS vector.
  const limit = checkRateLimit({
    key: ipHash(readClientIp(req.headers)),
    max: 120,
    windowMs: 60 * 1000,
    bucket: "bot-message",
  });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterSec: limit.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  // ── 3. Parse + validate body ───────────────────────────────────
  let body: IngestBody;
  try {
    body = (await req.json()) as IngestBody;
  } catch {
    return jsonError(400, "invalid_json");
  }
  const text = (body.text ?? "").trim();
  if (!text) return jsonError(400, "missing_text");
  if (text.length > MAX_TEXT_LEN) {
    return jsonError(413, "text_too_long", {
      detail: `Max ${MAX_TEXT_LEN} characters`,
    });
  }
  // Profanity gate — strict, short-circuits before any DB / Gemini /
  // geocode work. The homepage chatter feed is family-facing and the
  // moderation queue shouldn't fill with slurs. Rejected messages
  // return `ok:true, kind:"ignored", reason:"profanity"` so the bot
  // doesn't retry (the message will never be acceptable; admin can't
  // un-reject it because no row exists). If false-positive rate
  // becomes a problem, lib/profanity-filter.ts is where to tune.
  if (hasProfanity(text)) {
    return NextResponse.json({
      ok: true,
      kind: "ignored",
      reason: "profanity",
    });
  }
  const senderName = (body.senderName ?? "").slice(0, 80) || null;
  const groupName = (body.groupName ?? "").slice(0, 80) || null;
  const msgId = (body.msgId ?? "").slice(0, 120) || null;

  // ── 4. Dedup on msgId (cross-group re-forwards collapse to one row)
  if (msgId) {
    const existing = await prisma.bhandaraMention.findUnique({
      where: { msgId },
      select: { id: true, status: true },
    });
    if (existing) {
      return NextResponse.json({
        ok: true,
        kind: "duplicate",
        duplicateOf: existing.id,
        reviewUrl: `${SITE_URL}/admin/mentions`,
        message: "This msgId was already ingested.",
      });
    }
  }

  // ── 5. Detect WhatsApp Location share (skip classifier path) ───
  // A pin shared into an allowlisted bhandara group IS the intent
  // signal — the user wouldn't drop a Lucknow pin in this kind of
  // group unless they meant "here's a bhandara" or "anyone serving
  // around here?". Running the classifier on the synthetic text
  // "Location shared: 26.xx, 80.xx" reliably yields UNRELATED with
  // ~0.9 confidence (it reads as generic chat, not bhandara chat),
  // which silently kills every location-share into the heatmap.
  //
  // We short-circuit to SHARING + confidence 1.0 when we see real
  // Lucknow coords on the payload. The admin can re-classify in
  // moderation if a location share turns out to be off-topic.
  const hasLucknowShare =
    typeof body.locationLat === "number" &&
    typeof body.locationLng === "number" &&
    inLucknow(body.locationLat, body.locationLng);

  let lat: number | null = null;
  let lng: number | null = null;
  let locationSource: "whatsapp_share" | "google_maps_url" | "extracted_address" | "none" =
    "none";
  // Classified-output stand-ins. These get either Gemini's values (text
  // path) or hard-coded SHARING / 1.0 / "mixed" (location-share path).
  let intent: "ASKING" | "SHARING" | "MENTIONING" | "UNRELATED" = "MENTIONING";
  let confidence = 0;
  let language: "hi" | "en" | "mixed" = "mixed";
  let cleanedText = text;
  let locationLabel: string | null = null;

  // ── Sequential message grouping window ────────────────────────
  // When the same WA sender, in the same WA group, sends multiple
  // related messages back-to-back (text, then pin, then a follow-up
  // detail), we treat them as ONE bhandara mention and merge into a
  // single row instead of fanning out N cards on the homepage. The
  // window is short (30s) so unrelated messages from the same sender
  // later in the day don't accidentally fold together.
  const GROUP_MERGE_WINDOW_MS = 30_000;

  if (hasLucknowShare) {
    // Trust the share. No Gemini call, no token spend, no risk of
    // false-UNRELATED on a pin that's plainly bhandara-relevant.
    lat = body.locationLat!;
    lng = body.locationLng!;
    locationSource = "whatsapp_share";
    intent = "SHARING";
    confidence = 1.0;
    // Reverse-geocode the pin for a human-friendly area label
    // ("Aliganj") + cleaner card text. Failures are non-fatal:
    // mention still gets created with the raw coords, just without
    // the pretty label. Ola Maps reverse-geocode is one HTTP call,
    // ~150-400ms inside Lucknow, no Gemini cost.
    try {
      const rev = await reverseGeocodeLucknow(lat, lng);
      if (rev) {
        locationLabel = rev.label;
        // Only rewrite the card text if the bot sent the synthetic
        // "Location shared: lat, lng" fallback. When the user typed a
        // real caption alongside the pin, keep their words verbatim
        // — they wrote something meaningful and we shouldn't smother
        // it. Regex matches the bot-side template exactly so we
        // don't accidentally overwrite a human caption that happens
        // to mention coordinates.
        const isSyntheticLocText = /^Location shared:\s*-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?$/.test(
          text.trim(),
        );
        if (isSyntheticLocText) {
          cleanedText = `Shared a location near ${rev.label}`;
        }
      }
    } catch (err) {
      console.warn("[bot/message] reverse-geocode error:", err);
    }

    // ── Photo-burst location binding ───────────────────────────────
    // Pattern (added 2026-05-26): the WhatsApp sender just posted a
    // batch of photos to /api/bot/ingest, then sent a location pin
    // here as the SAME bhandara's coords. Without binding, we end up
    // with one photo Spot at lat=0 (WhatsApp strips EXIF GPS from
    // imageMessage) plus one separate text Mention with the coords.
    // The chat panel + heatmap show them as two unrelated entries.
    //
    // Fix: if the same WA sender posted a bot Spot in the last 5
    // minutes that still lacks coords (lat===0 && lng===0, the
    // bot's no-EXIF fallback), bind THESE coords + area + address
    // onto that Spot and skip creating a separate Mention. The
    // multi-image burst grouping in /api/bot/ingest will already
    // have folded any additional photos into the same row, so this
    // single update closes the loop: one row, full carousel + real
    // pin, no duplicate Mention.
    //
    // If no recent photo Spot matches, fall through to the normal
    // Mention-creation path below — the pin still lands as a chat
    // mention, just unbound, same as today.
    const PHOTO_BURST_BIND_WINDOW_MS = 5 * 60 * 1000;
    if (senderName && lat !== null && lng !== null) {
      const recentPhotoSpot = await prisma.spot.findFirst({
        where: {
          reporterName: senderName,
          ipHash: "bot:whatsapp",
          status: "APPROVED",
          lat: 0,
          lng: 0,
          createdAt: {
            gte: new Date(Date.now() - PHOTO_BURST_BIND_WINDOW_MS),
          },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, area: true, address: true },
      });
      if (recentPhotoSpot) {
        await prisma.spot.update({
          where: { id: recentPhotoSpot.id },
          data: {
            lat,
            lng,
            area: recentPhotoSpot.area || locationLabel || null,
            address: recentPhotoSpot.address || locationLabel || null,
          },
        });
        // Mention is NOT created — this pin became the photo Spot's
        // coords. The homepage chat panel will show one row (the
        // photo Spot, now with a real map pin) instead of one photo
        // card + one location-share card.
        invalidateHomepageStatsCache();
        revalidatePath("/admin", "layout");
        revalidatePath("/");
        return NextResponse.json({
          ok: true,
          kind: "spot-location-bound",
          spotId: recentPhotoSpot.id,
          lat,
          lng,
          area: locationLabel ?? null,
          message: `Location pin folded into recent photo Spot ${recentPhotoSpot.id} from same sender (${PHOTO_BURST_BIND_WINDOW_MS / 1000}s window).`,
        });
      }
    }
  }

  // ── 6. Classify via Gemini (text-only path) ─────────────────────
  // Only fires when this isn't a WA Location share. Sets intent,
  // confidence, language, cleanedText, locationLabel for the text
  // path and exposes classified.extractedAddresses for the
  // multi-location resolver in step 8 below.
  let classified: import("@/lib/vision").ClassifiedText | null = null;
  if (!hasLucknowShare) {
    try {
      // Pass groupName + the bot's recent-message window so the
      // classifier can charitably interpret short replies in the
      // context of the conversation they're answering. "Golf city"
      // right after someone asked "polytechnic ke pass?" reads as
      // SHARING; "Acha" / "Ji" stays UNRELATED even if the chat
      // around them is hot.
      const recentContext = Array.isArray(body.recentContext)
        ? body.recentContext
            .filter(
              (m): m is { senderName?: string; text: string } =>
                !!m && typeof m.text === "string" && m.text.length > 0,
            )
            .map((m) => ({
              senderName: (m.senderName || "").slice(0, 80),
              text: m.text.slice(0, 200),
            }))
        : undefined;
      classified = await classifyBhandaraMessage(
        text,
        groupName || undefined,
        recentContext,
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error("[bot/message] gemini classify failed", detail);
      return jsonError(502, "classify_failed", { detail });
    }

    // ── 7. Short-circuit on UNRELATED / low confidence ────────────
    if (
      classified.intent === "UNRELATED" ||
      classified.confidence < MIN_CONFIDENCE
    ) {
      return NextResponse.json({
        ok: true,
        kind: "ignored",
        reason:
          classified.intent === "UNRELATED"
            ? "off_topic"
            : "low_confidence",
        intent: classified.intent,
        confidence: classified.confidence,
      });
    }

    intent = classified.intent;
    confidence = classified.confidence;
    language = classified.language;
    cleanedText = classified.cleanedText || text;
    locationLabel = classified.locationLabel || null;
  }

  // ── 8. Build the list of locations to materialise ────────────────
  // Most messages yield ONE location (lat/lng set or null). SHARING
  // messages that list multiple bhandaras yield several — we
  // materialise one BhandaraMention per location so the heatmap shows
  // a separate cell for each.
  //
  // Sources priority for each location, in order of fidelity:
  //   (a) Direct WhatsApp Location share (lat/lng on the payload)
  //   (b) Google Maps URL inside the message body (no network)
  //   (c) Forward-geocode of an extracted address via Ola Maps
  // The first hit wins; remaining addresses are geocoded one by one.
  type LocationSource =
    | "whatsapp_share"
    | "google_maps_url"
    | "extracted_address"
    | "none";
  type ResolvedLocation = {
    lat: number | null;
    lng: number | null;
    label: string | null;
    source: LocationSource;
  };
  const locations: ResolvedLocation[] = [];

  if (hasLucknowShare || !classified) {
    // WA Location share is always single-location. The !classified
    // case can't actually happen at runtime (we'd have errored or
    // short-circuited above) but TS doesn't know that — narrowing
    // here keeps the next branch's `classified` non-null.
    locations.push({ lat, lng, label: locationLabel, source: locationSource });
  } else {
    // Pull the classifier's multi-location array, falling back to the
    // singular field for back-compat when Gemini only returned the
    // legacy shape.
    const addresses =
      classified.extractedAddresses.length > 0
        ? classified.extractedAddresses
        : classified.extractedAddress
          ? [classified.extractedAddress]
          : [];
    const labels =
      classified.locationLabels.length > 0
        ? classified.locationLabels
        : classified.locationLabel
          ? [classified.locationLabel]
          : [];

    const fromUrl = extractCoordsFromMessage(text);
    let urlClaimed = false;

    if (addresses.length === 0) {
      // No addresses extracted — single mention, with URL coords if
      // we found a Google Maps link in the body.
      if (fromUrl && inLucknow(fromUrl.lat, fromUrl.lng)) {
        locations.push({
          lat: fromUrl.lat,
          lng: fromUrl.lng,
          label: null,
          source: "google_maps_url",
        });
      } else {
        locations.push({ lat: null, lng: null, label: null, source: "none" });
      }
    } else {
      for (let i = 0; i < addresses.length; i++) {
        const addr = addresses[i];
        const lbl = labels[i]?.trim() || null;
        // First address gets dibs on the URL coords if one is present
        // in the message body. Later addresses fall through to
        // forward-geocoding.
        if (
          i === 0 &&
          !urlClaimed &&
          fromUrl &&
          inLucknow(fromUrl.lat, fromUrl.lng)
        ) {
          locations.push({
            lat: fromUrl.lat,
            lng: fromUrl.lng,
            label: lbl,
            source: "google_maps_url",
          });
          urlClaimed = true;
          continue;
        }
        try {
          const hit = await geocodeLucknow(addr);
          if (hit && inLucknow(hit.lat, hit.lng)) {
            locations.push({
              lat: hit.lat,
              lng: hit.lng,
              label: lbl,
              source: "extracted_address",
            });
          } else if (i === 0) {
            // Couldn't geocode AND it's the first/only address:
            // still create one row (text-only mention) so the
            // mention itself surfaces on the feed.
            locations.push({
              lat: null,
              lng: null,
              label: lbl,
              source: "none",
            });
          }
          // Non-first addresses that fail to geocode are dropped
          // silently — we already have the first one on the feed and
          // adding a no-coords row per failed lookup would create
          // duplicate-looking text cards.
        } catch (err) {
          console.warn("[bot/message] geocode error:", err);
          if (i === 0) {
            locations.push({
              lat: null,
              lng: null,
              label: lbl,
              source: "none",
            });
          }
        }
      }
    }
  }

  // Guarantee at least one location entry so the insert loop below
  // doesn't degenerate to zero rows on a weird edge.
  if (locations.length === 0) {
    locations.push({ lat: null, lng: null, label: null, source: "none" });
  }

  // ── 9. Build provenance tag (one per row, recomputed in loop) ───
  const timestamp = `${new Date().toISOString().slice(0, 19)}Z`;
  const buildTag = (loc: ResolvedLocation): string => {
    const parts = [
      "bot:whatsapp",
      senderName ? `from:${senderName}` : "from:unknown",
      groupName ? `group:${groupName.slice(0, 40)}` : null,
      msgId ? `msg:${msgId.slice(0, 24)}` : null,
      timestamp,
      `intent:${intent}`,
      `conf:${confidence.toFixed(2)}`,
      `loc:${loc.source}`,
    ].filter(Boolean);
    return `[${parts.join(" · ")}]`;
  };
  const finalCleanedText = cleanedText.slice(0, MAX_TEXT_LEN);
  const expiresAt = new Date(
    Date.now() + MENTION_TTL_HOURS * 60 * 60 * 1000,
  );

  // ── 9b. Cross-group forward dedup ─────────────────────────────────
  // If the SAME sender already posted the same (normalised)
  // cleanedText anywhere within FORWARD_DEDUP_WINDOW_MS, treat the
  // new arrival as a duplicate forward. Admins routinely broadcast
  // a listing share into 10+ WhatsApp groups; without this check
  // each forward produced its own BhandaraMention row and the live
  // chat panel showed the same card N times in a row.
  //
  // We dedup on (senderName, NORMALISED cleanedText) NOT
  // (senderName, msgId) because WhatsApp assigns a fresh msgId to
  // every re-forwarded message, so the existing msgId dedup at
  // step 4 can't catch these. Normalisation collapses every
  // whitespace run to a single space, trims edges, and lower-cases
  // so a forward whose newlines flattened to spaces (or whose
  // sender retyped with slightly different capitalisation) still
  // matches the original. Previous version did an exact equality
  // compare in SQL — three Shyam "ONLY BHANDARA ON FRIDAY"
  // forwards slipped through because msg 1 was single-line and
  // msgs 2/3 had `\n` line breaks.
  //
  // Same-group repeats with EVOLVING text (text → pin → follow-up)
  // are handled by the merge logic immediately below — that's a
  // shorter window and only fires when the rows would naturally
  // fold together; this forward-dedup uses a wider window and a
  // normalised text match.
  const FORWARD_DEDUP_WINDOW_MS = 30 * 60 * 1000;
  const normaliseForDedup = (s: string) =>
    s.replace(/\s+/g, " ").trim().toLowerCase();
  if (senderName && finalCleanedText.length > 0) {
    const cutoff = new Date(Date.now() - FORWARD_DEDUP_WINDOW_MS);
    // Fetch recent same-sender rows and normalise them client-side
    // rather than try to do whitespace-collapse in a SQL WHERE.
    // Bounded by sender + window so this is cheap (typically <20
    // rows). The cleanedText column is indexed via the existing
    // `(status, expiresAt)` composite, but a sender-restricted
    // scan is faster than any regexp on Postgres for our row count.
    const recent = await prisma.bhandaraMention.findMany({
      where: {
        senderName,
        status: "APPROVED",
        createdAt: { gt: cutoff },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, cleanedText: true, groupName: true },
    });
    const target = normaliseForDedup(finalCleanedText);
    const dup = recent.find(
      (r) => r.cleanedText && normaliseForDedup(r.cleanedText) === target,
    );
    if (dup) {
      return NextResponse.json({
        ok: true,
        kind: "duplicate",
        duplicateOf: dup.id,
        reason: "cross_group_forward",
        message: `Same content from "${senderName}" already ingested${
          dup.groupName ? ` (first seen in "${dup.groupName}")` : ""
        }; suppressing this re-forward.`,
      });
    }
  }

  // ── 10. Sequential-message merge (only on single-location path) ──
  // When the same sender, in the same group, posted a mention within
  // the last GROUP_MERGE_WINDOW_MS, we update THAT row instead of
  // creating a new one. Common scenario: user types
  //   1) "Bhandara at Aliganj sector E"   (text → mention row)
  //   2) <shares the pin>                  (location share)
  //   3) "Both starting 11 AM"             (text follow-up)
  // The three POSTs collapse to ONE bhandara card on the feed with
  // the best-available info from each.
  //
  // Skipped on multi-location messages (locations.length > 1) because
  // merging multi-loc into a single existing row would lose the
  // separate cells the user explicitly intended. Skipped when sender
  // OR group is unknown — can't safely fold anonymous traffic.
  const canMerge =
    locations.length === 1 && !!senderName && !!groupName;

  if (canMerge) {
    const cutoff = new Date(Date.now() - GROUP_MERGE_WINDOW_MS);
    const recent = await prisma.bhandaraMention.findFirst({
      where: {
        senderName,
        groupName,
        status: "APPROVED",
        createdAt: { gt: cutoff },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        cleanedText: true,
        originalText: true,
        intent: true,
        confidence: true,
        lat: true,
        lng: true,
        locationSource: true,
        locationLabel: true,
      },
    });
    if (recent) {
      const loc = locations[0];
      const merged = mergeFields(
        {
          cleanedText: recent.cleanedText,
          originalText: recent.originalText,
          intent: recent.intent,
          confidence: recent.confidence,
          lat: recent.lat,
          lng: recent.lng,
          locationSource: recent.locationSource,
          locationLabel: recent.locationLabel,
        },
        {
          cleanedText: finalCleanedText,
          rawText: text,
          intent,
          confidence,
          lat: loc.lat,
          lng: loc.lng,
          locationSource: loc.source,
          locationLabel: loc.label,
          provenanceTag: buildTag(loc),
        },
      );
      const updated = await prisma.bhandaraMention.update({
        where: { id: recent.id },
        data: {
          ...merged,
          approvedAt: new Date(), // bump to top of feed
          expiresAt,
        },
        select: { id: true },
      });

      // Merge path can promote a previously-text-only mention into a
      // located bhandara when the follow-up message brings coords +
      // SHARING intent. Mirror that into the public Spot stream so
      // the map / HappeningNow / stats counters all reflect it in
      // real time, same dedup window protects against double-spotting
      // when the user pings the same location twice in quick succession.
      let mergedSpotId: string | null = null;
      try {
        mergedSpotId = await ensureBhandaraSpot({
          intent: merged.intent,
          lat: merged.lat,
          lng: merged.lng,
          locationSource: merged.locationSource,
          locationLabel: merged.locationLabel,
          cleanedText: merged.cleanedText,
          language,
          senderName,
          groupName,
          msgId,
        });
      } catch (err) {
        console.warn("[bot/message] merge-path spot create failed:", err);
      }
      if (mergedSpotId) {
        // Bust SSR caches so the next homepage render sees the new
        // counters / pins immediately rather than waiting for the
        // 60s revalidate window.
        try {
          revalidatePath("/");
          revalidatePath("/live");
          invalidateHomepageStatsCache();
        } catch {
          // revalidatePath is best-effort; never fatal for ingestion.
        }
      }

      return NextResponse.json({
        ok: true,
        kind: "merged",
        id: updated.id,
        mergedInto: recent.id,
        spotId: mergedSpotId,
        reviewUrl: `${SITE_URL}/admin/mentions`,
      });
    }
  }

  // ── 11. Insert one row per location ──────────────────────────────
  // Single-location path inserts one row (no merge match above).
  // Multi-location path inserts N rows, each carrying the same text
  // but its own coords/label/source. msgId is unique so only the
  // FIRST row gets it; subsequent rows pass null (allowed by schema).
  const createdRows: Array<{ id: string }> = [];
  const createdSpotIds: string[] = [];
  // Sanitise quoted-reply context once for the insert path. Trim
  // hard so a malicious bot can't blow up a column with a huge
  // string. Empty strings normalise to null so the schema column
  // stays sparse.
  let quotedTextSan: string | null =
    (body.quotedText ?? "").trim().slice(0, 300) || null;
  let quotedSenderSan: string | null =
    (body.quotedSender ?? "").trim().slice(0, 80) || null;

  // When the sender DIDN'T use WhatsApp's reply gesture but the
  // message is plainly a conversational reply ("Malhaur" right
  // after someone asked "Amity konsa wala?"), Baileys gives us no
  // contextInfo to attribute. We still want the chat panel to
  // render the question above the answer — otherwise short
  // location-only shares look like context-free shouts.
  //
  // Fallback: when no formal quote and the message is short +
  // SHARING + we have recentContext, find the most-recent
  // question-shaped message from a DIFFERENT sender and persist
  // IT as the inferred quoted context. Same column, no special
  // marker — the reader doesn't care whether the reply was
  // tapped-and-quoted or just typed.
  if (!quotedTextSan && intent === "SHARING") {
    const shortReply =
      finalCleanedText.trim().length > 0 &&
      finalCleanedText.trim().length <= 40;
    const ctx = Array.isArray(body.recentContext) ? body.recentContext : [];
    if (shortReply && ctx.length > 0) {
      const questionLike =
        /\?$|kahan|kaha\b|kahaan|konsa|kaun|which|where|koi\b|bataa?o|btao|kya hai|kya h|kahin/i;
      // Walk the recent window newest-first; bot sends oldest-first.
      for (let i = ctx.length - 1; i >= 0; i--) {
        const m = ctx[i];
        const t = (m?.text ?? "").trim();
        const s = (m?.senderName ?? "").trim();
        if (!t || !s) continue;
        if (s === (senderName || "").trim()) continue;
        if (!questionLike.test(t)) continue;
        quotedTextSan = t.slice(0, 300);
        quotedSenderSan = s.slice(0, 80);
        break;
      }
    }
  }
  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i];
    const row = await prisma.bhandaraMention.create({
      data: {
        originalText: `${text}\n\n${buildTag(loc)}`.slice(0, MAX_TEXT_LEN + 200),
        cleanedText: finalCleanedText,
        language,
        intent,
        confidence,
        lat: loc.lat,
        lng: loc.lng,
        locationSource: loc.source,
        locationLabel: loc.label,
        groupName,
        senderName,
        msgId: i === 0 ? msgId : null,
        quotedText: quotedTextSan,
        quotedSender: quotedSenderSan,
        status: "APPROVED",
        approvedAt: new Date(),
        expiresAt,
      },
      select: { id: true },
    });
    createdRows.push(row);

    // Promote SHARING + good-coords mentions into the public Spot
    // stream so they immediately appear on the main MapBoard +
    // HappeningNow + "Bhandaras spotted" counter. Each location in a
    // multi-location message gets its own Spot (one pin per place).
    try {
      const spotId = await ensureBhandaraSpot({
        intent,
        lat: loc.lat,
        lng: loc.lng,
        locationSource: loc.source,
        locationLabel: loc.label,
        cleanedText: finalCleanedText,
        language,
        senderName,
        groupName,
        msgId: i === 0 ? msgId : null,
      });
      if (spotId) createdSpotIds.push(spotId);
    } catch (err) {
      console.warn("[bot/message] insert-path spot create failed:", err);
    }
  }

  // If any of the locations produced a Spot, refresh the SSR caches
  // so the homepage's stats panel + MapBoard counters update right
  // away rather than waiting on the 60s revalidate window.
  if (createdSpotIds.length > 0) {
    try {
      revalidatePath("/");
      revalidatePath("/live");
      invalidateHomepageStatsCache();
    } catch {
      // revalidatePath is best-effort; never fatal for ingestion.
    }
  }

  return NextResponse.json({
    ok: true,
    kind: "created",
    id: createdRows[0].id,
    ids: createdRows.map((r) => r.id),
    spotIds: createdSpotIds,
    intent,
    confidence,
    locations: locations.length,
    reviewUrl: `${SITE_URL}/admin/mentions`,
  });
}

// ────────────────────────────────────────────────────────────────────
// Merge helpers
// ────────────────────────────────────────────────────────────────────

/** Returns true when `text` looks like the bot's synthetic
 *  "Location shared: lat, lng" or the server's reverse-geocoded
 *  "Shared a location near X" — neither of which is the user's own
 *  prose. Merging prefers a real user-typed text over either. */
function isSyntheticLocationText(t: string): boolean {
  const trimmed = t.trim();
  if (/^Location shared:\s*-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?$/i.test(trimmed)) return true;
  if (/^Shared a location near\s/i.test(trimmed)) return true;
  return false;
}

/** Score for "how good are these coords" — higher wins on merge.
 *  Mirrors the locationSource priority used by the location resolver. */
function coordsRank(source: string, hasCoords: boolean): number {
  if (!hasCoords) return 0;
  switch (source) {
    case "whatsapp_share":
      return 4;
    case "google_maps_url":
      return 3;
    case "extracted_address":
      return 2;
    default:
      return 1;
  }
}

/** Score for "how informative is this intent" — SHARING beats
 *  MENTIONING beats ASKING. Used when merging two messages with
 *  different intents from the same sender. */
function intentRank(intent: string): number {
  switch (intent) {
    case "SHARING":
      return 3;
    case "MENTIONING":
      return 2;
    case "ASKING":
      return 1;
    default:
      return 0;
  }
}

type MergeExisting = {
  cleanedText: string | null;
  originalText: string;
  intent: string;
  confidence: number;
  lat: number | null;
  lng: number | null;
  locationSource: string;
  locationLabel: string | null;
};
type MergeIncoming = {
  cleanedText: string;
  rawText: string;
  intent: string;
  confidence: number;
  lat: number | null;
  lng: number | null;
  locationSource: string;
  locationLabel: string | null;
  provenanceTag: string;
};

/** Compute the merged Prisma `data` object for an upsert into an
 *  existing BhandaraMention row. Per-field rules:
 *
 *  - cleanedText: prefer non-synthetic. Existing synthetic + new real
 *    → use new. Both real → concat with " · ". Both synthetic → keep
 *    existing.
 *  - intent: take whichever ranks higher (SHARING > MENTIONING > ASKING).
 *  - confidence: max of both.
 *  - lat/lng/locationSource: take whichever's source ranks higher
 *    (WhatsApp share > Maps URL > extracted address > none).
 *  - locationLabel: prefer non-empty, prefer newer when both set.
 *  - originalText: append the new provenance tag so the admin queue
 *    keeps a per-merge audit trail.
 */
function mergeFields(existing: MergeExisting, incoming: MergeIncoming) {
  const existingClean = (existing.cleanedText ?? "").trim();
  const incomingClean = incoming.cleanedText.trim();
  const existingSynth = isSyntheticLocationText(existingClean);
  const incomingSynth = isSyntheticLocationText(incomingClean);
  let cleanedText: string;
  if (!existingClean) {
    cleanedText = incomingClean;
  } else if (existingSynth && !incomingSynth) {
    cleanedText = incomingClean;
  } else if (!existingSynth && incomingSynth) {
    cleanedText = existingClean;
  } else if (existingClean === incomingClean) {
    cleanedText = existingClean;
  } else {
    cleanedText = `${existingClean} · ${incomingClean}`;
  }

  const existingRank = coordsRank(
    existing.locationSource,
    existing.lat !== null && existing.lng !== null,
  );
  const incomingRank = coordsRank(
    incoming.locationSource,
    incoming.lat !== null && incoming.lng !== null,
  );
  const useIncomingCoords = incomingRank > existingRank;
  const lat = useIncomingCoords ? incoming.lat : existing.lat;
  const lng = useIncomingCoords ? incoming.lng : existing.lng;
  const locationSource = useIncomingCoords
    ? incoming.locationSource
    : existing.locationSource;
  const locationLabel =
    incoming.locationLabel?.trim() || existing.locationLabel?.trim() || null;

  const intent =
    intentRank(incoming.intent) > intentRank(existing.intent)
      ? incoming.intent
      : existing.intent;
  const confidence = Math.max(existing.confidence, incoming.confidence);

  return {
    cleanedText: cleanedText.slice(0, 2000),
    originalText: `${existing.originalText}\n\n${incoming.rawText}\n\n${incoming.provenanceTag}`.slice(
      0,
      2200,
    ),
    intent,
    confidence,
    lat,
    lng,
    locationSource,
    locationLabel,
  };
}

// ────────────────────────────────────────────────────────────────────
// Spot promotion
// ────────────────────────────────────────────────────────────────────

type EnsureSpotInput = {
  intent: string;
  lat: number | null;
  lng: number | null;
  locationSource: string;
  locationLabel: string | null;
  cleanedText: string | null;
  language: string;
  senderName: string | null;
  groupName: string | null;
  msgId: string | null;
};

/**
 * Insert an APPROVED Spot row when a WhatsApp message turns out to be
 * a real-time sighting of a bhandara. Returns the new Spot id, or null
 * when nothing was inserted (wrong intent, no coords, weak source, or
 * an existing Spot from the same sender at the same place already
 * covered it).
 *
 * Why this exists:
 *   The bot's text-ingest pipeline creates BhandaraMention rows, which
 *   are great for the LiveChatterBoard heatmap and chat panel but don't
 *   show up on the main homepage MapBoard / HappeningNow / lifetime
 *   "Bhandaras spotted" counter — those read from the Spot table. A
 *   SHARING message ("bhandara at sector E, free for everyone") with
 *   a real Lucknow lat/lng IS a spot in every meaningful sense; this
 *   helper bridges the two so the counter and the map don't lag behind
 *   the chatter feed.
 *
 * Strict gating, no false positives:
 *   - intent MUST be SHARING. ASKING ("anyone know where") and
 *     MENTIONING ("we went last year") explicitly are not spots.
 *   - lat/lng must be inside Lucknow's bbox (same check as the rest
 *     of the bot pipeline).
 *   - locationSource MUST be either whatsapp_share or google_maps_url.
 *     `extracted_address` is too unreliable — Gemini sometimes pulls
 *     an old reference address out of historical chat ("when we met
 *     last year at Aliganj") and we don't want stale-context messages
 *     planting fake pins on the live map.
 *
 * Dedup window:
 *   Same sender + same coords (~110m bbox) inside SPOT_DEDUP_WINDOW_MS
 *   → return the existing Spot id without creating a new row. Avoids
 *   double-spotting when the user types the text, then the pin, then
 *   a clarifying message in rapid succession (each could otherwise
 *   trip the helper independently).
 */
async function ensureBhandaraSpot(
  input: EnsureSpotInput,
): Promise<string | null> {
  const { intent, lat, lng, locationSource, locationLabel, cleanedText, senderName, groupName, msgId } = input;

  if (intent !== "SHARING") return null;
  if (lat === null || lng === null) return null;
  if (!inLucknow(lat, lng)) return null;
  if (locationSource !== "whatsapp_share" && locationSource !== "google_maps_url") {
    return null;
  }

  // Dedup: same sender + same approximate coords inside the window.
  // Reporter name is the cheapest distinguishing key we have on Spot
  // (we don't carry msgId / groupName there). When senderName is
  // unknown we skip the dedup query entirely — anonymous shares are
  // rare enough that occasional duplicates are an acceptable cost vs
  // a global all-sender lookup that could spuriously suppress real
  // back-to-back drops from different people standing at the same
  // venue.
  if (senderName) {
    const cutoff = new Date(Date.now() - SPOT_DEDUP_WINDOW_MS);
    const existing = await prisma.spot.findFirst({
      where: {
        reporterName: senderName,
        lat: { gte: lat - SPOT_DEDUP_HALF_DEG, lte: lat + SPOT_DEDUP_HALF_DEG },
        lng: { gte: lng - SPOT_DEDUP_HALF_DEG, lte: lng + SPOT_DEDUP_HALF_DEG },
        createdAt: { gt: cutoff },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (existing) return existing.id;
  }

  // Normalise the language code to the {hi, en, mixed} alphabet the
  // Spot schema expects; classifier sometimes emits other labels.
  const lang = input.language === "hi" || input.language === "en" ? input.language : "mixed";

  const captionBase = (cleanedText ?? "").trim().slice(0, 200);
  const provenance = [
    "bot:whatsapp-text",
    senderName ? `from:${senderName}` : null,
    groupName ? `group:${groupName.slice(0, 40)}` : null,
    msgId ? `msg:${msgId.slice(0, 24)}` : null,
    `loc:${locationSource}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const caption = [captionBase, `[${provenance}]`].filter(Boolean).join("\n\n");
  const expiresAt = new Date(Date.now() + SPOT_TTL_HOURS * 60 * 60 * 1000);

  const created = await prisma.spot.create({
    data: {
      lat,
      lng,
      area: locationLabel,
      address: locationLabel,
      photoUrl: null,
      caption,
      language: lang,
      reporterName: senderName,
      reporterPhoneHash: null,
      // Auto-publish — the upstream profanity gate + classifier already
      // gave us a high-confidence SHARING + real coords, and the whole
      // point of this promotion is real-time. The 8h TTL is the safety
      // net if a bad spot slips through; admin can still purge via
      // /admin if needed.
      status: "APPROVED",
      expiresAt,
      ipHash: "bot:whatsapp:text",
      userAgent: "openclaw/ingest-text",
    },
    select: { id: true },
  });
  return created.id;
}
