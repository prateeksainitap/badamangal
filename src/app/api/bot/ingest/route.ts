/**
 * Silent bhandara ingestion endpoint for the OpenClaw WhatsApp agent.
 *
 * Flow:
 *   1. The OpenClaw agent sitting on the spare MacBook receives an
 *      image message in the allowlisted bhandara WhatsApp group.
 *   2. Its `ingest-bhandara` skill POSTs here with a Bearer secret
 *      and the image as base64.
 *   3. We sharp-normalize the image to WebP (same pipeline as
 *      /api/uploads), upload to Supabase Storage, then send the
 *      same bytes to Gemini for structured extraction (same path as
 *      /api/admin/scan).
 *   4. We create a PENDING Bhandara or Spot row, embedding a small
 *      provenance tag in the `description` so the admin can see at
 *      a glance where it came from.
 *   5. Return JSON with `ok`, `kind`, `id`, `reviewUrl`. The agent
 *      stays silent in the WhatsApp group, no replies, no DMs.
 *      The admin queue is the notification surface.
 *
 * The endpoint is Bearer-token gated by BOT_INGEST_SECRET. Treat that
 * secret like a password: anyone with it can create unlimited PENDING
 * rows. They can't publish (only the admin password can flip
 * APPROVED), so the blast radius of a leak is bounded, an attacker
 * can clutter the admin queue, nothing more. Rotate at the first sign
 * of trouble.
 *
 * `kind`:
 *   - "bhandara" → invite poster with structured details (date/time/
 *     address). Becomes a PENDING Bhandara row.
 *   - "spot"     → a live photo of a serving pandal. Becomes a PENDING
 *     Spot row that auto-expires after 8 hours like every other spot.
 *
 * The agent classifies via its prompt; we trust the kind it sends.
 */
import { NextResponse, type NextRequest } from "next/server";
import { randomUUID, createHash } from "node:crypto";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import {
  classifyImage,
  extractBhandaraFromImage,
  extractSpotFromImage,
  type ExtractedBhandara,
  type ExtractedSpot,
} from "@/lib/vision";
import { getSupabaseAdmin, PHOTO_BUCKET } from "@/lib/supabase";
import { uploadToR2, deleteFromR2 } from "@/lib/r2";
import { slugify, ensureUniqueSlug } from "@/lib/slugify";
import { menuHiFor } from "@/lib/menu";
import { resolveBhandaraCoords } from "@/lib/geocodeFallback";
import { geocodeLucknow } from "@/lib/geocodeServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 60s = Vercel Pro maximum. Bumped from 25s on 2026-05-25 (the eve
// of the season's first Bada Mangal Tuesday) after the bot started
// surfacing "Ingest failed (504)" for forwarded pamphlets. Root
// cause: a single Gemini Vision call times out at 22s; classify +
// extract back-to-back plus a slow R2 upload was tipping total
// request time past the old 25s cap → Vercel killed the function
// before the audit row was written, so the photo was lost.
//
// 60s gives us roughly:
//   • ~2s image download from the bot URL
//   • ~5s sharp normalisation + R2 upload
//   • ~22s classify (worst case timeout)
//   • ~22s extract  (worst case timeout)
//   • ~9s overhead, DB writes, and the fallback PENDING save below
//
// Even if BOTH Gemini calls time out, we still finish under the cap
// and at least land a PENDING row with the photo, so the operator
// can manually fix details from /admin/bhandaras?status=PENDING.
//
// The bigger picture: this should be replaced with a queued
// background-job pattern (return 202 immediately, run vision out of
// band) before next year's season. For now, 60s + a graceful
// fallback is the right size of fix.
export const maxDuration = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB before normalisation
const SPOT_TTL_HOURS = 8;

/** Allowed outcome values for BotIngestionLog.outcome. Kept as a
 *  const union so callers can't accidentally write a typo'd outcome
 *  string that breaks the /admin/bot-log filter chips. */
type IngestionOutcome =
  | "SUCCESS_BHANDARA"
  | "SUCCESS_SPOT"
  | "DUPLICATE_HASH"
  | "DUPLICATE_CONTENT"
  | "IGNORED_NON_BHANDARA"
  | "FAILED_CLASSIFY"
  | "FAILED_EXTRACT"
  | "FAILED_UPLOAD"
  | "FAILED_OTHER";

/** Fire-and-forget audit-row write. Wrapped in try/catch so a log
 *  write failure NEVER crashes the actual ingest, losing one audit
 *  row is acceptable; losing a real Bhandara/Spot create is not.
 *
 *  Diagnostic counters added 2026-05-25 after we noticed BotIngestionLog
 *  staying empty in production despite Bhandara/Spot rows being created.
 *  Three SiteCounter rows now bump alongside this function so the
 *  failure mode is visible from a single SQL query, no Vercel log
 *  trawling required:
 *    • bot_log_attempts , every time logIngestion is called
 *    • bot_log_successes, every successful insert
 *    • bot_log_failures , every caught error
 *  attempts === successes + failures should always hold; if it doesn't,
 *  some other layer (Next runtime cold start, Prisma client init) is
 *  silently dropping the call. The most recent error message is also
 *  written to `bot_log_last_error` as a row description (count column
 *  is just a placeholder bump) so the actual Prisma error text is
 *  retrievable. */
async function logIngestion(args: {
  outcome: IngestionOutcome;
  senderName?: string | null;
  msgId?: string | null;
  groupName?: string | null;
  resultRowId?: string | null;
  resultRowKind?: "bhandara" | "spot" | null;
  reason?: string | null;
  imageHash?: string | null;
  extractedName?: string | null;
}): Promise<void> {
  // Bump the attempts counter FIRST so even a runtime crash in the
  // try block leaves a trace. Wrapped in its own try so a SiteCounter
  // hiccup never affects the real ingest path.
  try {
    await prisma.siteCounter.upsert({
      where: { id: "bot_log_attempts" },
      update: { count: { increment: 1 } },
      create: { id: "bot_log_attempts", count: 1 },
    });
  } catch {
    /* counter write failed; downstream is still attempted */
  }

  try {
    await prisma.botIngestionLog.create({
      data: {
        outcome: args.outcome,
        senderName: args.senderName?.slice(0, 200) ?? null,
        msgId: args.msgId?.slice(0, 200) ?? null,
        groupName: args.groupName?.slice(0, 200) ?? null,
        resultRowId: args.resultRowId ?? null,
        resultRowKind: args.resultRowKind ?? null,
        reason: args.reason?.slice(0, 500) ?? null,
        imageHash: args.imageHash ?? null,
        extractedName: args.extractedName?.slice(0, 200) ?? null,
      },
    });
    // Success path: bump success counter so the ratio
    // (successes / attempts) is observable.
    try {
      await prisma.siteCounter.upsert({
        where: { id: "bot_log_successes" },
        update: { count: { increment: 1 } },
        create: { id: "bot_log_successes", count: 1 },
      });
    } catch {
      /* ignore */
    }
  } catch (err) {
    // Loud + structured: console.error survives Vercel filtering
    // better than console.warn, and the JSON shape is greppable from
    // function logs.
    const errMsg = err instanceof Error ? err.message : String(err);
    const errName = err instanceof Error ? err.name : "Unknown";
    console.error(
      "[bot/ingest] logIngestion FAILED",
      JSON.stringify({
        errName,
        errMsg,
        outcome: args.outcome,
        senderName: args.senderName?.slice(0, 40),
        groupName: args.groupName?.slice(0, 40),
        msgId: args.msgId?.slice(0, 40),
      }),
    );
    try {
      await prisma.siteCounter.upsert({
        where: { id: "bot_log_failures" },
        update: { count: { increment: 1 } },
        create: { id: "bot_log_failures", count: 1 },
      });
    } catch {
      /* counter write failed too; we've lost all observability for this */
    }
  }
}

/** Normalise a bhandara name for content-dedup comparison. Lowercases,
 *  collapses whitespace, strips the common "Shri" / "Sri" prefix and
 *  the trailing "Bhandara" / "Bhandare" suffix that 95% of posters
 *  carry. Returns "" when the input has fewer than ~3 meaningful
 *  characters left, caller treats "" as "not enough signal to dedup".
 *  Conservative on purpose: a generic "Bhandara" or "श्री राम" name
 *  shouldn't match every other generic poster in the queue. */
/**
 * Normalise a bhandara name down to its DISTINCTIVE component, the
 * part that's unique to a specific event, after stripping out the
 * boilerplate "Bada Mangal Bhandara" framing every poster has.
 *
 * Returns "" when the name has no distinctive component (i.e. the
 * entire name was just generic Bada Mangal framing). Callers MUST
 * treat empty as "do not dedup against this", comparing two empty
 * strings would false-match every generic-named row.
 *
 * Why this matters (real production bug, 2026-05-25):
 *   The original normaliser only stripped the trailing "Bhandara"
 *   suffix. A pamphlet titled "Bada Mangal Bhandara" reduced to
 *   "bada mangal" (11 chars, passed the >= 3 length gate). Then the
 *   dedup substring-match `normName.includes(candNorm)` was true for
 *   ANY pamphlet whose name happened to start with "Bada Mangal …".
 *   Result: distinct bhandaras (Brajesh's Para event + Amit Kapoor's
 *   Chowk event, both saved by humans as plain "Bada Mangal Bhandara"
 *   in the admin form) acted as honeypots that ate every forwarded
 *   pamphlet via false dedup. The bot looked busy in the audit log
 *   (DUPLICATE_CONTENT rows) but no new rows ever landed.
 *
 * Distinctive-name extraction: strip BOTH the boilerplate framing AND
 * the "Bhandara" suffix. What's left is the specific identifier.
 *   "Bada Mangal Bhandara"                  → "" (no dedup possible)
 *   "Bada Mangal Prasad Distribution Program" → "prasad distribution program"
 *   "Jetking Lucknow Bada Mangal Bhandara"  → "jetking lucknow"
 *   "Vishal Bhandara Invitation"            → "" (no dedup possible)
 *   "Bada Mangal Vishal Bhandara"           → "" (no dedup possible)
 *   "Vishal Bhandara, Hotel ANR"           → "hotel anr"
 *   "हम और आप वाला बड़ा मंगल भंडारा"        → "हम और आप वाला"
 *
 * 2026-05-26 expansion: added "vishal/विशाल" (means "grand", just an
 * adjective) and "invitation/आमंत्रण" (just the document type) to the
 * strip list after a real production false-dedup. Two distinct
 * pamphlets, a Hanumangarhi (Vinay Khand) event and a Shri Ram Tower
 * (Hazratganj) event, were both saved as "Vishal Bhandara …". The
 * old normaliser reduced them to "vishal hotel anr" vs "vishal" and
 * the fuzzy substring match (`candNorm.includes(normName)`) merged
 * them. Stripping "vishal" pushes the distinctive component to the
 * actual venue/organiser tokens, where it belongs.
 */
function normaliseBhandaraName(s: string | null | undefined): string {
  if (!s) return "";
  let cleaned = s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^(shri|sri|श्री|जय)\s+/i, "")
    // Strip "Bhandara" (Latin), word-boundary anchored.
    .replace(/\b(bhandara|bhandare|bhandaara)\b/gi, "")
    // Strip "भंडारा" (Devanagari), NO \b anchor. JS \b only fires at
    // the boundary between [A-Za-z0-9_] and non-word; Devanagari is
    // already a non-word char by that definition, so \b…भंडारा…\b
    // never matched. Surrounding-whitespace dance below + the final
    // whitespace collapse handle the in-line case cleanly. Match all
    // common spellings (नुक्ता variant included).
    .replace(/(भंडारा|भंडारे|भण्डारा|भण्डारे)/g, " ")
    // Strip the "Bada Mangal"/"बड़ा मंगल" framing from any position.
    .replace(/\b(bada|bade|badaa|bara|barre)\s+(mangal|mangle|mangaL)\b/gi, "")
    .replace(/(बड़ा|बड़े|बडा|बडे|बारा|बारे)\s*(मंगल|मंगले|मंगलवार)/g, "")
    // Strip generic devotional/scale adjectives that pamphlets stamp
    // on every event, "Vishal" ("grand"), "Bhavya" ("majestic"),
    // "Maha" ("great"), plus the document-type word "Invitation /
    // आमंत्रण". None of these distinguish one event from another.
    .replace(/\b(vishal|bhavya|maha|mahaan|grand)\b/gi, "")
    .replace(/(विशाल|भव्य|महा|महान)/g, " ")
    .replace(/\b(invitation|aamantran|aamantra|nimantran)\b/gi, "")
    .replace(/(आमंत्रण|आमन्त्रण|निमंत्रण|निमन्त्रण)/g, " ")
    // Strip ordinal prefixes that vary per event ("Fourth", "8th",
    // "चतुर्थ"), they're not stable across re-forwards.
    .replace(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth)\b/gi, "")
    .replace(/\b\d+(st|nd|rd|th)?\b/g, "")
    .replace(/(प्रथम|द्वितीय|तृतीय|चतुर्थ|पंचम|षष्ठ|सप्तम|अष्टम)/g, " ")
    // Strip stray punctuation left behind by the substitutions above
    // (em-dashes, hyphens, slashes, "|"). Without this, "Vishal
    // Bhandara, Hotel ANR" reduces to ", hotel anr" and the leading
    // em-dash defeats substring equality with another "hotel anr"
    // row. Keep alphanumerics + Devanagari + whitespace; drop the rest.
    .replace(/[, –\-/|,.;:()[\]{}"'`~!@#$%^&*+=<>?]/g, " ")
    // Collapse the resulting whitespace.
    .replace(/\s+/g, " ")
    .trim();
  // 3-char minimum filters out leftover junk like a stray punctuation
  // mark or single-word common framing ("का", "एवं").
  return cleaned.length >= 3 ? cleaned : "";
}

type IngestBody = {
  /** "bhandara" for an invite poster, "spot" for a live photo, or
   *  "auto" to let us classify the image via Gemini and route. The bot
   *  defaults to "auto" so users can forward anything into the group. */
  kind?: "bhandara" | "spot" | "auto";
  /** Base64-encoded image bytes (no data: prefix). */
  photoBase64?: string;
  /** Display name of the WhatsApp sender (for the admin's eyes). */
  senderName?: string;
  /** WhatsApp group / channel display name (e.g. "Jai Sri Ram"). The
   *  bot agent reads this from `chat.name` on each forwarded message
   *  and ships it through so the admin can slice the BotIngestionLog
   *  by source channel ("what came in from group X today?") and the
   *  [bot:…] provenance tag on the canonical row carries it as well.
   *  Optional, old bot daemon builds that don't send it still work. */
  groupName?: string;
  /** WhatsApp message id, used by the agent for "you already
   *  ingested this" dedupe. We persist it inside the description tag. */
  msgId?: string;
  /** Original mime type ("image/jpeg" | "image/png" | "image/webp"). */
  mime?: string;
  /** Optional WhatsApp imageMessage.caption, the text the sender
   *  typed alongside the photo. When present, the spot path uses it
   *  verbatim as the public caption (Gemini's extract is ignored so
   *  the chat panel reflects the sender's own words instead of a
   *  generic vision summary). */
  caption?: string;
};

function jsonError(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

export async function POST(req: NextRequest) {
  // ── 1. Auth ─────────────────────────────────────────────────────
  const expected = process.env.BOT_INGEST_SECRET;
  if (!expected) {
    return jsonError(500, "ingest_disabled", {
      detail:
        "BOT_INGEST_SECRET is not configured on the server. Add it in Netlify env and redeploy.",
    });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return jsonError(403, "forbidden");
  }

  // ── 2. Parse body ───────────────────────────────────────────────
  let body: IngestBody;
  try {
    body = (await req.json()) as IngestBody;
  } catch {
    return jsonError(400, "invalid_json");
  }
  if (!body.photoBase64) {
    return jsonError(400, "missing_photo");
  }
  // Resolve `kind`. Default flow from the bot is `kind: "auto"`, which
  // asks us to classify the image via Gemini and route. We can't run
  // classification yet (the image bytes are still raw + un-validated
  // here), we resolve it further down once we have a normalised WebP
  // in hand. Explicit "bhandara" / "spot" still works (e.g. for the
  // smoke-test curl invocations and the legacy ingester build).
  const requestedKind: "bhandara" | "spot" | "auto" =
    body.kind === "bhandara" || body.kind === "spot" ? body.kind : "auto";
  const senderName = (body.senderName ?? "").slice(0, 80) || "WhatsApp sender";
  // Capture the WhatsApp group / channel name when the bot agent
  // sends one. Trim to 80 chars to match senderName so the
  // BotIngestionLog row stays compact + indexable. Null if the bot
  // didn't send one (old build / personal-chat forward / etc.), the
  // ingest pipeline still works either way.
  const groupName = ((body.groupName ?? "").trim().slice(0, 80)) || null;
  const msgId = (body.msgId ?? "").slice(0, 120);
  const declaredMime = body.mime ?? "image/jpeg";
  const sourceMime: "image/jpeg" | "image/png" | "image/webp" =
    declaredMime === "image/png"
      ? "image/png"
      : declaredMime === "image/webp"
        ? "image/webp"
        : "image/jpeg";

  // Decode + sanity-cap. WhatsApp images can land oversized when
  // forwarded with original quality; we'll resize sharp-side anyway.
  let inputBuffer: Buffer;
  try {
    inputBuffer = Buffer.from(body.photoBase64, "base64");
  } catch {
    return jsonError(400, "bad_base64");
  }
  if (inputBuffer.length === 0) return jsonError(400, "empty_photo");
  if (inputBuffer.length > MAX_IMAGE_BYTES) {
    return jsonError(413, "photo_too_large", { detail: `Max ${MAX_IMAGE_BYTES} bytes` });
  }

  // ── 3. Normalise → WebP, 1600px long edge, q=80 ────────────────
  let webp: Buffer;
  try {
    webp = await sharp(inputBuffer, { failOn: "error" })
      .rotate() // honour EXIF orientation, then drop EXIF
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toBuffer();
  } catch (err) {
    console.error("[bot/ingest] sharp normalise failed", err);
    return jsonError(422, "image_unreadable");
  }

  // ── 4. Classify (if "auto") + Image-hash dedup check ──────────
  // We compute the WebP base64 once and reuse for both classification
  // (when needed) and extraction below. Classifying after the WebP
  // round-trip means the model is looking at the same bytes we'll
  // later extract from, slightly more accurate than classifying the
  // raw upload and then re-encoding.
  const base64Webp = webp.toString("base64");

  // Trusted-channel allowlist (added 2026-05-26 mid-Tuesday-1): some
  // WhatsApp groups are operator-curated forwarding channels rather
  // than open community chats. The operator drops images into them
  // *because* they're already-vetted bhandara content. Gemini's
  // off-topic classifier sometimes false-rejects real bhandara
  // photos as "other", newspaper-style framing, low light, weird
  // crops, etc. For these channels we skip classification entirely
  // and treat every image as a spot, since the operator's curation
  // upstream is the real filter.
  //
  // Group-name prefix match (case-insensitive) so the operator can
  // add new sibling channels, "BM Ingest 3", "BM Curated", etc.
  //, without a code change. The bot agent's chat.name field is
  // what we match against.
  const TRUSTED_CHANNEL_PREFIXES = ["BM Ingest", "BM Curated"];
  const isTrustedChannel =
    !!groupName &&
    TRUSTED_CHANNEL_PREFIXES.some((p) =>
      groupName.toLowerCase().startsWith(p.toLowerCase()),
    );

  let classified: "bhandara" | "spot" | "other";
  try {
    if (requestedKind !== "auto") {
      classified = requestedKind;
    } else if (isTrustedChannel) {
      // Trusted channels (BM Ingest / BM Curated) are pre-vetted by the
      // operator, so we never DROP their images as "other" (Gemini
      // occasionally false-rejects real bhandara content as off-topic).
      // But we DO still run the classifier so an invite POSTER routes to
      // a bhandara LISTING (auto-published since 2026-05-26) and a live
      // PHOTO routes to a spot. The old code hard-coded "spot", which
      // mis-filed every forwarded pamphlet as a live sighting (the
      // "spot would sit PENDING" worry is stale, bot bhandaras now
      // auto-publish). On a classify failure (e.g. Gemini quota 429) or
      // an "other" verdict, fall back to "spot", the auto-publishing
      // catch-all, so trusted content is never lost.
      try {
        const trustedClass = await classifyImage(base64Webp, "image/webp");
        classified = trustedClass === "bhandara" ? "bhandara" : "spot";
      } catch (trustedErr) {
        console.warn(
          "[bot/ingest] trusted-channel classify failed, defaulting to spot:",
          trustedErr instanceof Error ? trustedErr.message : trustedErr,
        );
        classified = "spot";
      }
    } else {
      classified = await classifyImage(base64Webp, "image/webp");
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[bot/ingest] gemini classify failed", detail);
    await logIngestion({
      outcome: "FAILED_CLASSIFY",
      senderName,
      groupName,
      msgId,
      reason: detail.slice(0, 400),
    });
    return jsonError(502, "classify_failed", { detail });
  }

  // Off-topic guard: when Gemini decided the image isn't actually a
  // bhandara poster OR a venue snapshot (newspaper clipping, recipe
  // graphic, political poster, generic religious wallpaper, advert
  // forwarded into the group, etc), DO NOT create a Bhandara or Spot
  // row. The bot still gets a 200 + a "kind: ignored" hint so its
  // notifier can log the rejection without an admin chase. The
  // uploaded WebP is discarded, we don't even upload to R2.
  if (classified === "other") {
    await logIngestion({
      outcome: "IGNORED_NON_BHANDARA",
      senderName,
      groupName,
      msgId,
      reason:
        "Gemini classified the image as off-topic (news clipping / recipe / generic poster / etc).",
    });
    return NextResponse.json({
      ok: true,
      kind: "ignored",
      reason: "non_bhandara_image",
      message:
        "Gemini classified the image as off-topic (news clipping / recipe / generic poster / etc). No Bhandara or Spot row created.",
      // Fresh review URL so a future bot.mjs daemon build can drop
      // the legacy "/admin?type=whatsapp" hardcode and pick this up
      // from the response. The current bot's WhatsApp auto-reply
      // hardcodes the legacy URL; until bot.mjs ships an update,
      // the middleware redirect in src/middleware.ts converts that
      // legacy URL to /admin/bot-log on click.
      reviewUrl: `${SITE_URL}/admin/bot-log?outcome=IGNORED_NON_BHANDARA`,
    });
  }
  const kind: "bhandara" | "spot" = classified;

  // SHA-256 of the normalised WebP bytes. We embed the first 12 chars
  // into the provenance tag so a second forward of the EXACT same
  // image (cross-posted between groups, which happens constantly with
  // bhandara posters) can be detected via a substring search. 12 chars
  // = 48 bits of collision space, comfortably more than the volume
  // of unique posters we'll ever see in a single season.
  const imageHash = createHash("sha256").update(webp).digest("hex").slice(0, 12);

  // Dedup check: bail early if any existing row (bhandara OR spot)
  // already carries this image hash in its description / caption tag.
  // We return 200 + `kind: "duplicate"` so the ingester logs cleanly
  // and the BM Ingest 2 notifier can show "already ingested" instead
  // of a fresh review link, admins shouldn't have to triage the same
  // poster N times when it cascades through 14 WhatsApp groups.
  const hashMarker = `hash:${imageHash}`;
  const [dupBhandara, dupSpot] = await Promise.all([
    prisma.bhandara.findFirst({
      where: { description: { contains: hashMarker } },
      select: { id: true, slug: true },
    }),
    prisma.spot.findFirst({
      where: { caption: { contains: hashMarker } },
      select: { id: true },
    }),
  ]);
  if (dupBhandara || dupSpot) {
    await logIngestion({
      outcome: "DUPLICATE_HASH",
      senderName,
      groupName,
      msgId,
      imageHash,
      resultRowId: dupBhandara?.id ?? dupSpot?.id ?? null,
      resultRowKind: dupBhandara ? "bhandara" : "spot",
      reason: "Byte-identical re-forward, matched on hash marker.",
    });
    return NextResponse.json({
      ok: true,
      kind: "duplicate",
      duplicateOf: dupBhandara?.id ?? dupSpot?.id,
      // Updated 2026-05-25: was the pre-redesign /admin?type=whatsapp
      // legacy URL which now just lands on the admin login (the new
      // /admin route is the AdminLoginForm). Bot reply messages were
      // posting these stale links into the WhatsApp ingest group, so
      // tapping "review" from a bhandara forward dead-ended on the
      // login page. New URL goes straight to the row's edit screen
      // under the redesigned admin shell (/admin/edit/<id> or
      // /admin/edit-spot/<id>). When the admin isn't already signed
      // in, the page-level `requireAdmin()` gate redirects to /admin
      // and they re-enter from there, same as before.
      reviewUrl: dupBhandara
        ? `${SITE_URL}/admin/edit/${dupBhandara.id}`
        : dupSpot
          ? `${SITE_URL}/admin/edit-spot/${dupSpot.id}`
          : `${SITE_URL}/admin/bhandaras?source=bot&status=PENDING`,
      message:
        "This exact image was already ingested. No new row created.",
    });
  }

  const filename = `bot-${kind}-${randomUUID()}.webp`;
  let photoUrl: string | null = null;

  // R2-first (matches /api/uploads) so bot-ingested photos land on
  // cdn.badamangal.com, identical to public /spot uploads. Returns
  // null when R2 envs aren't configured; the Supabase fall-through
  // below keeps an emergency path open.
  try {
    photoUrl = await uploadToR2({
      filename,
      buffer: webp,
      contentType: "image/webp",
    });
  } catch (err) {
    console.error("[bot/ingest] R2 upload failed, will try Supabase", err);
  }

  if (!photoUrl) {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      await logIngestion({
        outcome: "FAILED_UPLOAD",
        senderName,
        groupName,
        msgId,
        imageHash,
        reason: "No storage configured (R2 and Supabase both missing).",
      });
      return jsonError(500, "storage_unavailable", {
        detail:
          "Neither R2 (R2_*) nor Supabase (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) is configured on the server.",
      });
    }
    const upload = await supabase.storage.from(PHOTO_BUCKET).upload(
      filename,
      webp,
      {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      },
    );
    if (upload.error) {
      console.error(
        "[bot/ingest] supabase fallback upload failed",
        upload.error,
      );
      await logIngestion({
        outcome: "FAILED_UPLOAD",
        senderName,
        groupName,
        msgId,
        imageHash,
        reason: `R2 + Supabase both failed: ${upload.error.message ?? ""}`.slice(0, 400),
      });
      return jsonError(500, "storage_upload_failed");
    }
    photoUrl = supabase.storage
      .from(PHOTO_BUCKET)
      .getPublicUrl(filename).data.publicUrl;
  }

  // ── 5. Run Gemini extraction (same path as /api/admin/scan) ────
  // Provenance tag embedded into description / caption.
  //
  // Field order matters: the admin's parseBotTag regex
  // (/admin?type=whatsapp) expects `· <timestamp>` directly after
  // `msg:…`, so any new fields (hash, geocode note) MUST come AFTER
  // the timestamp. Otherwise the regex stops matching and the bot
  // moderation view loses its sender/group display.
  //
  // `hash:<12-char>` powers the cross-group dedup search above,
  // 48 bits of collision space, more than enough for a season's
  // worth of unique posters. The whole [bot:…] block is stripped
  // from every public surface by stripBotProvenance (lib/sanitize).
  const timestamp = `${new Date().toISOString().slice(0, 19)}Z`;
  // Embed groupName into the provenance tag (when present) so the
  // admin can see "this came from Jai Sri Ram channel" right on the
  // queue row without opening the bot-log. Slicing to 40 chars keeps
  // the tag from blowing past the row title's display width.
  const groupFragment = groupName ? ` · in:${groupName.slice(0, 40)}` : "";
  const tag = `[bot:whatsapp · from:${senderName}${groupFragment}${msgId ? ` · msg:${msgId.slice(0, 24)}` : ""} · ${timestamp} · ${hashMarker}]`;

  if (kind === "bhandara") {
    let extracted: ExtractedBhandara;
    try {
      extracted = await extractBhandaraFromImage(base64Webp, "image/webp");
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error("[bot/ingest] gemini bhandara extract failed", detail);

      // EXTRACT-FAILURE FALLBACK (added 2026-05-25 ahead of the
      // season's first Bada Mangal Tuesday).
      //
      // When Gemini Vision is slow / overloaded, the structured
      // extract throws and previously we just 502'd back to the bot,
      // losing the photo. On a high-traffic Tuesday that's the worst
      // possible outcome, pamphlets vanish off the map.
      //
      // Instead, save a PENDING Bhandara with just the photo + the
      // bot provenance tag. The classify call already returned
      // "bhandara" (we know it's a pamphlet, just couldn't parse
      // the fields). The operator sees these in /admin/bhandaras?
      // status=PENDING with a distinctive "(needs review)" name and
      // fills in details by opening the photo. Better than nothing.
      //
      // Byte-hash dedup ran earlier in the route, so re-forwards of
      // the SAME image bytes won't create N pending duplicates.
      // Cross-group re-forwards (different bytes) can still create
      // duplicates, the operator merges in admin if needed.
      let fallbackId: string | null = null;
      try {
        const pendingSlug = await ensureUniqueSlug(`pending-${Date.now().toString(36)}`);
        const fallbackName = `(needs review${groupName ? ` · ${groupName.slice(0, 30)}` : ""})`;
        const fallbackRow = await prisma.bhandara.create({
          data: {
            name: fallbackName,
            nameHi: fallbackName,
            slug: pendingSlug,
            status: "PENDING",
            isVerified: false,
            area: "Lucknow",
            address: "",
            addressHi: "",
            lat: 0,
            lng: 0,
            timeStart: "12:00",
            timeEnd: "",
            tuesdayDates: "[]",
            menu: "[]",
            menuHi: "[]",
            organizerName: senderName ?? "Unknown",
            organizerPhone: "",
            photoUrl,
            description: `${tag}\n[bot:extract-failed · ${detail.slice(0, 200)}]`,
          },
          select: { id: true },
        });
        fallbackId = fallbackRow.id;
      } catch (fallbackErr) {
        console.error(
          "[bot/ingest] extract-failure fallback insert failed",
          fallbackErr,
        );
      }

      await logIngestion({
        outcome: "FAILED_EXTRACT",
        senderName,
        groupName,
        msgId,
        imageHash,
        resultRowId: fallbackId,
        resultRowKind: fallbackId ? "bhandara" : null,
        reason: `Gemini bhandara extract: ${detail.slice(0, 300)}${fallbackId ? ` · saved PENDING ${fallbackId}` : " · NO FALLBACK"}`,
      });

      // Tell the bot "we handled it" so it doesn't retry / surface a
      // failure message back to the WhatsApp group. The audit row +
      // PENDING bhandara are the operator's signal that this image
      // needs hand-classification.
      return NextResponse.json({
        ok: true,
        kind: "bhandara",
        status: "pending_needs_review",
        bhandaraId: fallbackId,
        photoUrl,
        warning: "Gemini extract failed; row saved as PENDING for manual review.",
      });
    }

    // ── Content-based dedup ────────────────────────────────────────
    // The byte-hash dedup above catches re-forwards of the EXACT same
    // bytes. WhatsApp re-encodes images between groups (slight EXIF /
    // compression variance), so the same poster forwarded to 3 groups
    // ends up with 3 different hashes, and previously created 3
    // separate PENDING rows that the operator had to triage.
    //
    // After Gemini extraction we have the structured signal we need:
    // the bhandara name + the dates printed on the poster. Same name
    // (normalised) + same first date = same event, regardless of how
    // many times the image was forwarded.
    //
    // Conservative guard: only dedup when the normalised name has ≥3
    // meaningful characters AND a first date is present, so a generic
    // "Bhandara" or dateless poster doesn't false-match every other
    // generic forward in the queue.
    const normName = normaliseBhandaraName(extracted.name);
    const firstDate = extracted.dateIsoList?.[0];
    if (normName && firstDate) {
      const candidates = await prisma.bhandara.findMany({
        where: {
          tuesdayDates: { contains: firstDate },
          status: { in: ["PENDING", "APPROVED"] },
        },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
        },
      });
      const contentDup = candidates.find((c) => {
        const candNorm = normaliseBhandaraName(c.name);
        if (!candNorm) return false;
        // Fuzzy match: exact OR one contains the other (handles
        // "World Iron Champ Gym" vs "World Iron Champ Gym Bhandara"
        // both surviving normalisation).
        return (
          candNorm === normName ||
          candNorm.includes(normName) ||
          normName.includes(candNorm)
        );
      });
      if (contentDup) {
        // Append a re-forward audit line to the canonical row's
        // description so the operator can see WHICH groups + senders
        // surfaced this same event. The [bot:reforward…] tag is
        // stripped from public surfaces by stripBotProvenance.
        const forwardTag = `[bot:reforward · from:${senderName}${groupFragment}${msgId ? ` · msg:${msgId.slice(0, 24)}` : ""} · ${timestamp} · hash:${imageHash}]`;
        try {
          await prisma.bhandara.update({
            where: { id: contentDup.id },
            data: {
              description: `${contentDup.description ?? ""}\n${forwardTag}`,
            },
          });
        } catch (err) {
          console.warn("[bot/ingest] reforward tag append failed", err);
        }
        // Evict the freshly-uploaded WebP, we're not using it. Best
        // effort; R2 cleanup failure isn't fatal.
        if (photoUrl) {
          await deleteFromR2(photoUrl).catch((err) =>
            console.warn("[bot/ingest] R2 evict (content-dup) failed", err),
          );
        }
        await logIngestion({
          outcome: "DUPLICATE_CONTENT",
          senderName,
          groupName,
          msgId,
          imageHash,
          resultRowId: contentDup.id,
          resultRowKind: "bhandara",
          extractedName: extracted.name ?? null,
          reason: `Same normalised name ("${normName}") + first date (${firstDate}) as ${contentDup.id}.`,
        });
        return NextResponse.json({
          ok: true,
          kind: "duplicate",
          duplicateOf: contentDup.id,
          // See note at the earlier dup-hash reviewUrl: bot's
          // "Already ingested (cross-group)" reply messages used to
          // post legacy /admin?type=whatsapp#<id> URLs which dead-end
          // on the new login page. Point at the canonical row's edit
          // screen directly.
          reviewUrl: `${SITE_URL}/admin/edit/${contentDup.id}`,
          message:
            "Content-dedup: same bhandara (name + first date) was already ingested. Re-forward note appended to the canonical row.",
        });
      }
    }

    // Build a Bhandara row. Fields we can't infer get sane defaults the
    // admin will fix in /admin. status=PENDING so the row never appears
    // on the public map until an admin picks it up, even if the
    // Bhandara enum-default elsewhere is APPROVED, the explicit PENDING
    // here wins.
    const baseSlug = extracted.name
      ? slugify(extracted.name)
      : `bot-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 6)}`;
    const slug = await ensureUniqueSlug(baseSlug);

    // Vision schema now returns ALL Tuesdays the banner lists (real
    // posters print every date of the 8-Tuesday Jyeshtha season,
    // and the prior schema's single `dateIso` field tanked
    // extraction whenever Gemini surfaced more than one). Empty
    // array is fine, the admin fills in dates manually in the
    // edit form if Gemini couldn't read them off the banner.
    const tuesdayDates = extracted.dateIsoList;

    // Forward-geocode with a FALLBACK CHAIN, not just the address.
    // The candidate list (address → organizer → organizer+area →
    // landmark → venue) + the geocodeLucknow call are now both in
    // `@/lib/geocodeFallback` so the edit page can re-run the same
    // chain when an old row still sits at 0,0. Keeping the two
    // call-sites on one helper means future tweaks (new candidates,
    // changed strip rules) ship to both at once.
    //
    // If every candidate misses, fall back to Lucknow centre (NOT
    // 0,0) and stamp a `geocode:fallback-center` note so the admin
    // sees it needs a manual pin.
    const hit = await resolveBhandaraCoords({
      address: extracted.address,
      area: extracted.area,
      landmark: extracted.landmark,
      organizerName: extracted.organizerName,
      name: extracted.name,
    });
    const hasAnyCandidateSignal = Boolean(
      (extracted.address && extracted.address.length >= 5) ||
        (extracted.organizerName && extracted.organizerName.length >= 3) ||
        (extracted.landmark && extracted.landmark.length >= 3) ||
        (extracted.name && extracted.name.length >= 3),
    );
    let lat: number;
    let lng: number;
    let geocodeNote: string;
    if (hit) {
      lat = hit.lat;
      lng = hit.lng;
      geocodeNote = `geocode:${hit.source}/${hit.candidateTag}`;
    } else {
      // Hazratganj-ish, matches LKO_CENTER in lib/geocodeServer.ts.
      lat = 26.8467;
      lng = 80.9462;
      geocodeNote = hasAnyCandidateSignal
        ? "geocode:fallback-center/miss"
        : "geocode:fallback-center/no-signal";
    }

    // Tag carries the geocode outcome too, admin can spot whether a
    // row was auto-located vs. left blank without opening the edit
    // page. Stripped from public surfaces by stripBotProvenance.
    // `auto-publish` flag added 2026-05-26, see the APPROVED status
    // note below. Lets the operator filter
    // /admin/bhandaras?q=auto-publish to triage all rows the bot
    // shipped to the public listing without manual review.
    const taggedDescription = `${tag.slice(0, -1)} · ${geocodeNote} · auto-publish]`;
    const description = [extracted.description, taggedDescription]
      .filter(Boolean)
      .join("\n\n");
    const descriptionHi = extracted.descriptionHi || null;

    // Name fallback chain, pamphlets that pass the classifier but
    // don't have a recognisable host name on them used to land as
    // the generic "Bhandara from WhatsApp" placeholder. That string
    // reads as "we have no idea who runs this" to a public visitor.
    // "Samast Sevagan" ("all the volunteer servants" in Sanskrit
    // /Hindi) is a real, dignified collective attribution used by
    // many bhandaras anyway, keeps the public card readable when
    // we lack a specific host. The Hindi variant uses the same
    // phrase in Devanagari so the locale-correct surface still has
    // a proper name. Operators can rename via /admin/edit/<id> when
    // they identify the real host.
    const fallbackName = "Samast Sevagan";
    const fallbackNameHi = "समस्त सेवकगण";

    // Pamphlet/poster path. classifyImage returned "bhandara" so we
    // create the listing row. Status APPROVED (auto-publish, since
    // 2026-05-26) so the bhandara appears on the public map + cards
    // within seconds of the WhatsApp forward landing in the group.
    //
    // Trade-off: a small fraction of false-positives (off-topic
    // images Gemini misclassified, scammer pamphlets) will be live
    // briefly before an operator catches + REJECTs them. We accept
    // that cost because the alternative, every pamphlet sitting in
    // a PENDING queue overnight, meant the bot looked broken to
    // organisers ("I forwarded it, where is my bhandara?"). The
    // [bot:…] provenance tag + the `auto-publish` flag in
    // description make these rows trivial to find + reject in bulk
    // from /admin/bhandaras.
    //
    // Extract-failure rows (the catch branch above) stay PENDING
    // because there's no extracted signal to publish. The chat panel
    // + map deliberately do NOT surface a companion Spot here: a
    // pamphlet is an announcement, not a live sighting.
    const nowIso = new Date();
    const row = await prisma.bhandara.create({
      data: {
        slug,
        name: extracted.name || fallbackName,
        nameHi: extracted.nameHi || fallbackNameHi,
        description,
        descriptionHi,
        area: extracted.area ?? "",
        address: extracted.address || "Address pending admin review",
        addressHi: extracted.addressHi || null,
        landmark: extracted.landmark || null,
        lat,
        lng,
        tuesdayDates: JSON.stringify(tuesdayDates),
        timeStart: extracted.timeStart ?? "11:00",
        timeEnd: extracted.timeEnd ?? "",
        menu: JSON.stringify(extracted.menu ?? []),
        menuHi: JSON.stringify(menuHiFor(extracted.menu ?? [])),
        // organizerName is taken ONLY from the banner. We deliberately
        // do NOT fall back to the WhatsApp sender's pushName, the
        // person forwarding the invite is rarely the organiser, and
        // pre-filling their name made admins have to delete it before
        // every publish. Leave blank if the model couldn't read a host
        // name; the admin will fill it from the photo during review.
        organizerName: extracted.organizerName || "",
        // organizerPhone: skip (empty string) when Gemini couldn't
        // read a number off the banner. We deliberately do NOT use a
        // placeholder like "9999999999" because the public detail
        // page surfaces a tap-to-call CTA when this field is set
        // a fake number routes donors into a wrong call. The detail
        // page already gracefully hides the CTA on empty, so empty
        // is the safe + correct fallback.
        organizerPhone: extracted.organizerPhone || "",
        photoUrl,
        status: "APPROVED",
        approvedAt: nowIso,
      },
    });

    // Race-condition mop-up. The byte-hash dedup query above and the
    // content-dedup query both window on a read-then-insert pattern.
    // When the same pamphlet is forwarded into two WhatsApp groups
    // within seconds, both ingest requests pass through the dedup
    // gates before either has committed, and both insert. Result:
    // duplicate rows that read out identically on the public list
    // (one card per date in tuesdayDates, twice over).
    //
    // The defense: AFTER our own create commits, re-query for any
    // other row with the same image hash. If found, the older row
    // wins (it would have been the canonical match if our query had
    // seen it). We delete OUR row + tag the winner with a
    // race-deduped audit line so the operator can trace what
    // happened. This is the runtime complement to
    // `scripts/merge-bot-hash-dupes.mjs`, which mops up historical
    // dupes; this code prevents new ones.
    if (imageHash) {
      try {
        const collisions = await prisma.bhandara.findMany({
          where: {
            description: { contains: `hash:${imageHash}` },
            id: { not: row.id },
            status: { in: ["PENDING", "APPROVED"] },
          },
          select: { id: true, slug: true, description: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        });
        const olderCollision = collisions.find(
          (c) => c.createdAt < row.createdAt,
        );
        if (olderCollision) {
          // We lost the race. Append a race-deduped audit tag to the
          // winner so the operator can see this happened, then delete
          // our row + evict our uploaded photo.
          const raceTag = `[bot:race-deduped · loser:${row.id} · from:${senderName}${groupFragment} · hash:${imageHash}]`;
          await prisma.bhandara
            .update({
              where: { id: olderCollision.id },
              data: {
                description: `${olderCollision.description ?? ""}\n${raceTag}`,
              },
            })
            .catch((err) =>
              console.warn(
                "[bot/ingest] race-dedup winner tag-update failed",
                err,
              ),
            );
          await prisma.bhandara
            .delete({ where: { id: row.id } })
            .catch((err) =>
              console.warn("[bot/ingest] race-dedup loser delete failed", err),
            );
          if (photoUrl) {
            await deleteFromR2(photoUrl).catch((err) =>
              console.warn(
                "[bot/ingest] R2 evict (race-dedup) failed",
                err,
              ),
            );
          }
          await logIngestion({
            outcome: "DUPLICATE_CONTENT",
            senderName,
            groupName,
            msgId,
            imageHash,
            resultRowId: olderCollision.id,
            resultRowKind: "bhandara",
            extractedName: extracted.name ?? null,
            reason: `Race-condition dup of ${olderCollision.id} (${olderCollision.slug}). Loser ${row.id} deleted.`,
          });
          return NextResponse.json({
            ok: true,
            kind: "bhandara",
            duplicate: true,
            id: olderCollision.id,
            slug: olderCollision.slug,
            reviewUrl: `${SITE_URL}/admin/edit/${olderCollision.id}`,
          });
        }
      } catch (err) {
        // Non-fatal: if the collision check fails we still return the
        // created row. Worst case we leak a duplicate (caught by the
        // merge script on a periodic run).
        console.warn("[bot/ingest] race-dedup post-check failed", err);
      }
    }

    await logIngestion({
      outcome: "SUCCESS_BHANDARA",
      senderName,
      groupName,
      msgId,
      imageHash,
      resultRowId: row.id,
      resultRowKind: "bhandara",
      extractedName: extracted.name ?? null,
      reason: `Created PENDING bhandara · slug=${row.slug}`,
    });
    return NextResponse.json({
      ok: true,
      kind: "bhandara",
      id: row.id,
      slug: row.slug,
      // Same legacy → new admin path swap as the dup branches above.
      // /admin#<id> would have land-paged on the login screen with the
      // hash dropped on redirect; /admin/edit/<id> opens straight on
      // the row's review form.
      reviewUrl: `${SITE_URL}/admin/edit/${row.id}`,
    });
  }

  // kind === "spot" , live photo (food / crowd / tents).
  // Per the routing spec (pamphlets go to admin, live photos go
  // straight to the chat panel + map), spot images auto-publish.
  // Caption uses the WhatsApp sender's words verbatim when they
  // typed one; Gemini's extracted summary is only the fallback so
  // we never paste a vision model's interpretation into the public
  // caption when the human author already gave us text.
  let extracted: ExtractedSpot;
  try {
    extracted = await extractSpotFromImage(base64Webp, "image/webp");
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[bot/ingest] gemini spot extract failed", detail);

    // EXTRACT-FAILURE FALLBACK for live spot photos (added 2026-05-25).
    // Same posture as the bhandara branch above: when Gemini extract
    // throws (timeout / overload), still land the photo as an
    // APPROVED Spot with the sender's caption (if any) and the bot
    // provenance tag. Spots are time-boxed (8h TTL) and tolerate
    // missing extract data, area/address are nice-to-have, not
    // required for the live chat panel to render. Losing the photo
    // outright is the worse outcome.
    const senderCaptionFallback = (body.caption ?? "").trim().slice(0, 400);
    const captionFallback = [senderCaptionFallback, tag].filter(Boolean).join("\n\n");
    const expiresAtFallback = new Date(Date.now() + SPOT_TTL_HOURS * 60 * 60 * 1000);
    let fallbackSpotId: string | null = null;
    try {
      const fallbackSpot = await prisma.spot.create({
        data: {
          lat: 0,
          lng: 0,
          area: null,
          address: null,
          photoUrl,
          caption: captionFallback,
          language: "mixed",
          reporterName: senderName,
          reporterPhoneHash: null,
          status: "APPROVED",
          expiresAt: expiresAtFallback,
          ipHash: "bot:whatsapp",
          userAgent: "openclaw/ingest-spot · extract-fallback",
          extraPhotoUrls: "[]",
        },
        select: { id: true },
      });
      fallbackSpotId = fallbackSpot.id;
    } catch (fallbackErr) {
      console.error(
        "[bot/ingest] spot extract-failure fallback insert failed",
        fallbackErr,
      );
    }

    await logIngestion({
      outcome: "FAILED_EXTRACT",
      senderName,
      groupName,
      msgId,
      imageHash,
      resultRowId: fallbackSpotId,
      resultRowKind: fallbackSpotId ? "spot" : null,
      reason: `Gemini spot extract: ${detail.slice(0, 300)}${fallbackSpotId ? ` · saved fallback spot ${fallbackSpotId}` : " · NO FALLBACK"}`,
    });

    return NextResponse.json({
      ok: true,
      kind: "spot",
      status: "approved_with_minimal_data",
      spotId: fallbackSpotId,
      photoUrl,
      warning: "Gemini extract failed; spot saved with sender caption only.",
    });
  }

  // Caption priority:
  //   1. body.caption , WhatsApp imageMessage.caption (sender's words)
  //   2. extracted.caption, Gemini's vision summary (fallback only)
  //   3. neither      , empty
  // The provenance tag is appended last; stripBotProvenance hides it
  // on every public surface.
  const senderCaption = (body.caption ?? "").trim().slice(0, 400);
  const captionBody = senderCaption || extracted.caption || "";
  const caption = [captionBody, tag].filter(Boolean).join("\n\n");
  const expiresAt = new Date(Date.now() + SPOT_TTL_HOURS * 60 * 60 * 1000);

  // ── Multi-image burst grouping (BIDIRECTIONAL) ─────────────────
  // Two complementary patterns this block solves:
  //
  // (A) Multi-image album: WhatsApp delivers a 4-photo album as 4
  //     separate messages on the wire. Without grouping we'd land 4
  //     duplicate Spot rows for the same bhandara.
  //
  // (B) Location-first → photo-after: the WA sender drops a location
  //     pin BEFORE forwarding the photos. /api/bot/message already
  //     creates a photo-less Spot for that pin. Then the photo
  //     arrives here. Without this block we'd create a SEPARATE
  //     photo Spot, leaving the operator with the same row twice
  //     (one with coords + no photo, one with photo + no coords).
  //     Real production complaint Tuesday-1: operator had to
  //     manually merge every such pair.
  //
  // Resolution: look for ANY recent same-sender Spot from either
  // ingest path (bot:whatsapp image OR bot:whatsapp:text location
  // share). If found, fold this image into it. If the existing row
  // has no photoUrl yet (case B), this image becomes its primary
  // photo + coords/area are kept from the location share. If the
  // existing row already has a photo (case A), this image becomes
  // an extra in the carousel.
  //
  // 5-minute window is short enough to skip unrelated photos later
  // in the day, long enough to absorb the typical 5-10 s WA album
  // delivery + the 30-60 s gap between a location share and the
  // follow-up photo. Match is exact on senderName.
  //
  // False-positive recovery: bulkMergeSpotsAction on /admin/spots
  // handles the inverse (separate rows the bot didn't auto-pair).
  const GROUP_WINDOW_MS = 5 * 60 * 1000;
  const recentSameSender = senderName
    ? await prisma.spot.findFirst({
        where: {
          reporterName: senderName,
          // Match BOTH ipHashes, the image ingest path
          // ("bot:whatsapp") and the location-share-as-Spot path
          // from /api/bot/message ("bot:whatsapp:text"). Without
          // the OR, a location-first → photo-after sequence
          // creates two rows that the operator has to merge by
          // hand.
          ipHash: { in: ["bot:whatsapp", "bot:whatsapp:text"] },
          status: "APPROVED",
          createdAt: { gte: new Date(Date.now() - GROUP_WINDOW_MS) },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          photoUrl: true,
          extraPhotoUrls: true,
        },
      })
    : null;

  if (recentSameSender && photoUrl) {
    let extras: string[] = [];
    try {
      const arr = JSON.parse(recentSameSender.extraPhotoUrls || "[]") as unknown;
      if (Array.isArray(arr)) {
        extras = arr.filter(
          (u): u is string => typeof u === "string" && u.length > 0,
        );
      }
    } catch {
      /* malformed JSON, treat as no extras */
    }
    // Skip if this image is already in the carousel (defensive, the
    // image-hash dedup earlier in this route should already prevent
    // exact re-forwards, but a parallel race could slip past).
    const alreadyPresent =
      photoUrl === recentSameSender.photoUrl || extras.includes(photoUrl);
    if (!alreadyPresent) {
      // Branch based on whether the existing row already has a
      // primary photo or not:
      //
      //   • Has photoUrl (case A, multi-image album):
      //     append THIS image to extras. Carousel grows.
      //
      //   • No photoUrl (case B, location-first row from
      //     /api/bot/message): set THIS image as the primary
      //     photoUrl. The row now has both coords (from the
      //     earlier location share) and a photo. One clean Spot
      //     instead of two fragments the operator had to merge.
      const existingHasPhoto = !!recentSameSender.photoUrl;
      const updateData: {
        photoUrl?: string;
        extraPhotoUrls: string;
        expiresAt: Date;
        // Caption swap is intentional only when the existing row's
        // caption is the auto-generated "Shared a location near …"
        // placeholder from /api/bot/message. We want the photo's
        // caption (Gemini extract / sender's WA caption) to take
        // over once a real image lands. Operator-edited captions
        // are preserved because they wouldn't match the synthetic
        // template.
        caption?: string;
      } = {
        // Roll the TTL forward so the whole burst expires together
        //, otherwise photo 1 expires 8h after it landed but the
        // freshly-folded photo 4 should still be live, leaving a
        // half-stale carousel.
        expiresAt,
        extraPhotoUrls: existingHasPhoto
          ? JSON.stringify(extras.concat(photoUrl).slice(0, 5))
          : JSON.stringify(extras.slice(0, 5)),
      };
      if (!existingHasPhoto) {
        updateData.photoUrl = photoUrl;
        // Swap the synthetic "Shared a location near X" caption for
        // the real photo caption. The original location row's
        // bot:whatsapp-text provenance tag stays intact below it.
        updateData.caption = caption;
      }
      await prisma.spot.update({
        where: { id: recentSameSender.id },
        data: updateData,
      });
      await logIngestion({
        outcome: "SUCCESS_SPOT",
        senderName,
        groupName,
        msgId,
        imageHash,
        resultRowId: recentSameSender.id,
        resultRowKind: "spot",
        reason: existingHasPhoto
          ? `Grouped into existing Spot ${recentSameSender.id} from same sender within ${GROUP_WINDOW_MS / 1000}s window (multi-image burst).`
          : `Folded photo into location-first Spot ${recentSameSender.id} from same sender within ${GROUP_WINDOW_MS / 1000}s window (photo arrived after the location pin).`,
      });
      return NextResponse.json({
        ok: true,
        kind: "spot",
        id: recentSameSender.id,
        grouped: true,
        reviewUrl: `${SITE_URL}/admin/edit-spot/${recentSameSender.id}`,
      });
    }
    // If alreadyPresent, fall through and let the normal create path
    // run, but the image-hash dedup earlier should have caught it.
  }

  // Forward-geocode from the sender's words when the photo carried no
  // GPS (WhatsApp strips EXIF). The caption is frequently the ONLY
  // location given ("Ice cream bhandara / Ram Ram bank chauraha /
  // Aliganj"), so we mine it too, but only when it actually names a
  // place (SPOT_LOC_HINT) to avoid geocoding a generic "people
  // enjoying prasad" line to a random Lucknow point. Misses keep the
  // row at 0,0 (the /api/mentions/feed map filter hides those), exactly
  // as before. Wrapped so a geocode hiccup never blocks the ingest.
  let spotLat = 0;
  let spotLng = 0;
  try {
    const captionForGeo = (captionBody || "").replace(/\s+/g, " ").trim();
    const SPOT_LOC_HINT =
      /(chauraha|chauk|chowk|tiraha|mandir|temple|road|marg|nagar|ganj|puram|colony|vihar|bagh|crossing|bazaar|market|khand|cinema|hospital|college|school|stadium|park|gate|pul|stand|adda|morh|circle|square|chowraha|aliganj|indira|gomti|hazratganj|chinhat|aminabad|alambagh|rajajipuram|mahanagar|ashiyana|ashiana|kapoorthala|polytechnic)/i;
    const geoCandidates = [
      extracted.address?.trim() || null,
      captionForGeo && SPOT_LOC_HINT.test(captionForGeo)
        ? `${captionForGeo}, Lucknow`
        : null,
      extracted.area ? `${extracted.area}, Lucknow` : null,
    ].filter((q): q is string => !!q && q.length > 1);
    for (const q of geoCandidates) {
      const hit = await geocodeLucknow(q);
      if (hit) {
        spotLat = hit.lat;
        spotLng = hit.lng;
        break;
      }
    }
  } catch (geoErr) {
    console.error("[bot/ingest] spot geocode failed (non-fatal)", geoErr);
  }

  const spot = await prisma.spot.create({
    data: {
      lat: spotLat,
      lng: spotLng,
      area: extracted.area ?? null,
      address: extracted.address || null,
      photoUrl,
      caption,
      language: extracted.language || "mixed",
      reporterName: senderName,
      reporterPhoneHash: null,
      // Auto-publish live photos. Trade-off: a wrong image could
      // surface on the map for up to SPOT_TTL_HOURS (8h) before an
      // admin REJECTs it, but the alternative (PENDING gate) defeated
      // the "live feed" experience entirely, every chat-panel
      // arrival had to wait on manual moderation. lat/lng default to
      // 0,0 because WhatsApp strips EXIF GPS; the map filter at
      // /api/mentions/feed excludes 0,0 spots so the bare-image spot
      // appears in the chat panel but NOT as a wrong pin on the
      // heatmap until an admin sets coords via /admin/edit-spot.
      status: "APPROVED",
      expiresAt,
      ipHash: "bot:whatsapp",
      userAgent: "openclaw/ingest-bhandara",
    },
  });

  await logIngestion({
    outcome: "SUCCESS_SPOT",
    senderName,
    groupName,
    msgId,
    imageHash,
    resultRowId: spot.id,
    resultRowKind: "spot",
    reason: senderCaption
      ? `Spot created with sender caption (${senderCaption.length} chars).`
      : `Spot created with Gemini-extracted caption.`,
  });
  return NextResponse.json({
    ok: true,
    kind: "spot",
    id: spot.id,
    /** True when the spot caption came from the WhatsApp sender's
     *  imageMessage.caption (vs. Gemini's vision extract). The bot
     *  uses this to skip the parallel POST to /api/bot/message
     *  the caption is already on the public Spot row, no need to
     *  also create a duplicate text mention. */
    captionUsedInSpot: senderCaption.length > 0,
    // Spot opens straight on its edit page under the new admin shell.
    // Old `/admin#spot:<id>` hash was a pre-redesign hash-anchor on the
    // monolithic admin home; it no longer resolves anywhere useful.
    reviewUrl: `${SITE_URL}/admin/edit-spot/${spot.id}`,
  });
}
