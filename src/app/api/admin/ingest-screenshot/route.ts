/**
 * Admin-only screenshot → BhandaraMention pipeline.
 *
 * Lets the admin upload a screenshot of a WhatsApp conversation and
 * have the system extract every chat bubble, classify each message
 * via Gemini, resolve any locations (WhatsApp share / Google Maps URL
 * / extracted address), and insert APPROVED BhandaraMention rows so
 * the homepage LiveChatterBoard + heatmap populate immediately.
 *
 * Why APPROVED (not PENDING) for this path:
 *   The admin is in the loop on every screenshot, they pasted it in,
 *   they reviewed Gemini's classification output inline, they hit
 *   "ingest". Routing through the moderation queue would force them
 *   to switch tabs and re-approve every row, which defeats the
 *   "screenshot → heatmap" feedback loop they're after. They can
 *   still reject individual rows from /admin/mentions after the fact.
 *
 * This is a TEST + ONBOARDING path. Production traffic goes through
 * /api/bot/message (OpenClaw agent forwarding live messages). Both
 * write to the same BhandaraMention table; the public-facing
 * difference is only that this path bypasses the PENDING moderation
 * gate, which is justified by the explicit admin-in-the-loop step.
 *
 * Auth: admin cookie. Rate limit: 12 / hour per IP (Gemini Vision
 * + classifier × N messages is heavier than a plain bot/message call).
 */
import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import {
  extractWhatsAppConversationFromImage,
  classifyBhandaraMessage,
} from "@/lib/vision";
import { geocodeLucknow } from "@/lib/geocodeServer";
import { isAdmin } from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ipHash, readClientIp } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB before normalisation
/** Floor for inserting a mention. Same value as /api/bot/message. Tune
 *  alongside that endpoint, if a real-traffic screenshot test reveals
 *  the floor is too aggressive, raise both together. */
const MIN_CONFIDENCE = 0.4;
/** Public-feed cutoff for screenshot-ingested mentions. 24h matches
 *  /api/bot/message; keeps the rolling window consistent across
 *  ingest paths. */
const MENTION_TTL_HOURS = 24;
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

/** Inline Google-Maps-URL regex extractor (copy of the helper in
 *  /api/bot/message). Kept inline so the screenshot endpoint stays
 *  self-contained, extracting to a shared util can come later when
 *  a third caller needs it. */
function extractCoordsFromText(
  text: string,
): { lat: number; lng: number } | null {
  const urlMatch = text.match(/https?:\/\/[^\s]*(?:google\.[^\s/]+\/maps|maps\.google)[^\s]*/i);
  if (!urlMatch) return null;
  const url = urlMatch[0];
  const place = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (place) {
    const lat = Number(place[1]);
    const lng = Number(place[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  const at = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) {
    const lat = Number(at[1]);
    const lng = Number(at[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return null;
}

type IngestBody = {
  /** Base64-encoded image bytes (no data: prefix). */
  photoBase64?: string;
  mime?: string;
  /** Optional override for the group name Gemini extracted (e.g.
   *  when the screenshot's header is cropped off). */
  groupNameOverride?: string;
};

/** Per-message result returned in the API response so the admin can
 *  see what happened to each bubble in their screenshot, useful for
 *  debugging classifier behaviour during the testing phase. */
type ProcessedMessage = {
  sender: string;
  text: string;
  status:
    | "created"
    | "skipped_unrelated"
    | "skipped_low_confidence"
    | "skipped_empty"
    | "error";
  intent?: string;
  confidence?: number;
  locationSource?: string;
  mentionId?: string;
  errorDetail?: string;
};

function jsonError(
  status: number,
  error: string,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return jsonError(401, "unauthorized");
  }

  // Heavier-than-bot/message: Gemini Vision + Gemini text × N. Limit
  // tighter to protect the free-tier quota even when the admin is
  // iterating on test screenshots.
  const limit = checkRateLimit({
    key: ipHash(readClientIp(req.headers)),
    max: 12,
    windowMs: 60 * 60 * 1000,
    bucket: "admin-ingest-screenshot",
  });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterSec: limit.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  let body: IngestBody;
  try {
    body = (await req.json()) as IngestBody;
  } catch {
    return jsonError(400, "invalid_json");
  }
  if (!body.photoBase64) return jsonError(400, "missing_photo");

  const declaredMime = body.mime ?? "image/jpeg";
  const sourceMime: "image/jpeg" | "image/png" | "image/webp" =
    declaredMime === "image/png"
      ? "image/png"
      : declaredMime === "image/webp"
        ? "image/webp"
        : "image/jpeg";

  let inputBuffer: Buffer;
  try {
    inputBuffer = Buffer.from(body.photoBase64, "base64");
  } catch {
    return jsonError(400, "bad_base64");
  }
  if (inputBuffer.length === 0) return jsonError(400, "empty_photo");
  if (inputBuffer.length > MAX_IMAGE_BYTES) {
    return jsonError(413, "photo_too_large", {
      detail: `Max ${MAX_IMAGE_BYTES} bytes`,
    });
  }

  // Normalise to WebP. Saves tokens on the Gemini Vision call (smaller
  // payload) and ensures consistent mime regardless of what the admin
  // pasted in. Keep the long-edge generous (2000px) because chat
  // screenshots compress badly: shrinking too aggressively makes tiny
  // text bubbles unreadable for the OCR step.
  let webp: Buffer;
  try {
    webp = await sharp(inputBuffer, { failOn: "error" })
      .rotate()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85, effort: 4 })
      .toBuffer();
  } catch (err) {
    console.error("[admin/ingest-screenshot] sharp normalise failed", err);
    return jsonError(422, "image_unreadable");
  }
  const base64Webp = webp.toString("base64");

  // ── Extract messages via Gemini Vision ──────────────────────────
  let conversation;
  try {
    conversation = await extractWhatsAppConversationFromImage(
      base64Webp,
      "image/webp",
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[admin/ingest-screenshot] extract failed:", detail);
    return jsonError(502, "extract_failed", { detail });
  }
  if (conversation.messages.length === 0) {
    return NextResponse.json({
      ok: true,
      groupName: conversation.groupName || null,
      processed: [],
      summary:
        "No chat bubbles found in this screenshot. (Settings pages, contact lists, and call screens are skipped intentionally.)",
    });
  }

  const groupName =
    (body.groupNameOverride ?? "").trim() ||
    conversation.groupName.trim() ||
    null;

  // ── Process each message: classify + locate + insert ────────────
  // We run them sequentially (not Promise.all) so a Gemini blocking
  // event on one message doesn't take down the whole screenshot, and
  // so the rate of Gemini calls stays smooth (parallel firing on a
  // 20-message screenshot could trip per-second quotas).
  //
  // A run-id ties every BhandaraMention from this screenshot together
  // in the provenance tag, makes it easy to spot in the admin queue
  // and bulk-reject if a test goes sideways.
  const runId = `scr-${randomUUID().slice(0, 8)}`;
  const expiresAt = new Date(Date.now() + MENTION_TTL_HOURS * 60 * 60 * 1000);
  const processed: ProcessedMessage[] = [];

  for (const msg of conversation.messages) {
    const text = (msg.text ?? "").trim();
    if (!text) {
      processed.push({
        sender: msg.sender,
        text: "",
        status: "skipped_empty",
      });
      continue;
    }

    let classified;
    try {
      classified = await classifyBhandaraMessage(text);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      processed.push({
        sender: msg.sender,
        text,
        status: "error",
        errorDetail: detail,
      });
      continue;
    }

    if (classified.intent === "UNRELATED") {
      processed.push({
        sender: msg.sender,
        text,
        status: "skipped_unrelated",
        intent: classified.intent,
        confidence: classified.confidence,
      });
      continue;
    }
    if (classified.confidence < MIN_CONFIDENCE) {
      processed.push({
        sender: msg.sender,
        text,
        status: "skipped_low_confidence",
        intent: classified.intent,
        confidence: classified.confidence,
      });
      continue;
    }

    // ── Resolve location ──────────────────────────────────────────
    // Screenshots can't carry WhatsApp-share lat/lng directly (the
    // map thumbnail is rendered, not encoded). We fall back to:
    //   • Google Maps URL inside the message text
    //   • Forward-geocode of the address Gemini extracted (or the
    //     bubble text itself when isLocationShare flagged it as an
    //     address-share)
    let lat: number | null = null;
    let lng: number | null = null;
    let locationSource:
      | "whatsapp_share"
      | "google_maps_url"
      | "extracted_address"
      | "none" = "none";

    const fromUrl = extractCoordsFromText(text);
    if (fromUrl && inLucknow(fromUrl.lat, fromUrl.lng)) {
      lat = fromUrl.lat;
      lng = fromUrl.lng;
      locationSource = "google_maps_url";
    } else {
      // Pick the best address candidate:
      //   - classifier-extracted address takes priority (Gemini text
      //     model is more precise at extracting the location phrase
      //     out of free-form chat than the vision-pass label)
      //   - bubble text itself when isLocationShare flagged (the
      //     vision pass put the address line into text, so geocoding
      //     it directly works)
      const candidateAddress =
        classified.extractedAddress ||
        (msg.isLocationShare ? text : "");
      if (candidateAddress.length >= 5) {
        try {
          const hit = await geocodeLucknow(candidateAddress);
          if (hit && inLucknow(hit.lat, hit.lng)) {
            lat = hit.lat;
            lng = hit.lng;
            locationSource = "extracted_address";
          }
        } catch (err) {
          // Non-fatal, insert without coords; the mention will
          // appear on the feed but not on the heatmap.
          console.warn("[admin/ingest-screenshot] geocode error:", err);
        }
      }
    }

    // Provenance tag mirrors the /api/bot/message format. Adding the
    // runId lets the admin filter for "everything from this
    // screenshot upload" in /admin/mentions later.
    const timestamp = `${new Date().toISOString().slice(0, 19)}Z`;
    const tagParts = [
      "bot:whatsapp",
      msg.sender ? `from:${msg.sender}` : "from:unknown",
      groupName ? `group:${groupName.slice(0, 40)}` : null,
      `run:${runId}`,
      timestamp,
      `intent:${classified.intent}`,
      `conf:${classified.confidence.toFixed(2)}`,
      `loc:${locationSource}`,
      "src:screenshot",
    ].filter(Boolean);
    const provenanceTag = `[${tagParts.join(" · ")}]`;
    const cleanedText = (classified.cleanedText || text).slice(0, 2000);

    let row;
    try {
      row = await prisma.bhandaraMention.create({
        data: {
          originalText: `${text}\n\n${provenanceTag}`.slice(0, 2200),
          cleanedText,
          language: classified.language,
          intent: classified.intent,
          confidence: classified.confidence,
          lat,
          lng,
          locationSource,
          locationLabel: classified.locationLabel || null,
          groupName,
          senderName: msg.sender || null,
          // No WhatsApp msgId on screenshot-extracted messages, so
          // dedup via msgId can't fire, by design. Admins can
          // upload the same screenshot twice without colliding;
          // duplicates surface on /admin/mentions for cleanup.
          msgId: null,
          status: "APPROVED", // explicit: see top-of-file rationale
          approvedAt: new Date(),
          expiresAt,
        },
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      processed.push({
        sender: msg.sender,
        text,
        status: "error",
        errorDetail: detail,
      });
      continue;
    }

    processed.push({
      sender: msg.sender,
      text,
      status: "created",
      intent: classified.intent,
      confidence: classified.confidence,
      locationSource,
      mentionId: row.id,
    });
  }

  const createdCount = processed.filter((p) => p.status === "created").length;
  return NextResponse.json({
    ok: true,
    groupName,
    runId,
    summary: `Extracted ${conversation.messages.length} message${conversation.messages.length === 1 ? "" : "s"}, created ${createdCount} mention${createdCount === 1 ? "" : "s"}.`,
    processed,
    homepageUrl: SITE_URL,
    adminQueueUrl: `${SITE_URL}/admin/mentions?status=APPROVED`,
  });
}
