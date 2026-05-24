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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 25s matches the existing tier used by admin/scan, pamphlet, and
// public/scan-bhandara so we don't spawn a new Vercel function group
// (Hobby caps total functions per deployment, and each unique
// maxDuration becomes a separate group). Realistic Gemini retry
// budget: 3 fast-503 attempts return in ~7s; only a Gemini outright
// hang on every attempt could exceed 25s, which is rare enough that
// a truncated retry chain is an acceptable trade for keeping the
// function count under the cap.
export const maxDuration = 25;

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
 *  write failure NEVER crashes the actual ingest — losing one audit
 *  row is acceptable; losing a real Bhandara/Spot create is not. */
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
  } catch (err) {
    // Don't let logging failures cascade. Log to stderr so a missing
    // table / schema drift is still visible to the operator via
    // server logs.
    console.warn("[bot/ingest] logIngestion failed", err);
  }
}

/** Normalise a bhandara name for content-dedup comparison. Lowercases,
 *  collapses whitespace, strips the common "Shri" / "Sri" prefix and
 *  the trailing "Bhandara" / "Bhandare" suffix that 95% of posters
 *  carry. Returns "" when the input has fewer than ~3 meaningful
 *  characters left — caller treats "" as "not enough signal to dedup".
 *  Conservative on purpose: a generic "Bhandara" or "श्री राम" name
 *  shouldn't match every other generic poster in the queue. */
function normaliseBhandaraName(s: string | null | undefined): string {
  if (!s) return "";
  const cleaned = s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^(shri|sri|श्री)\s+/i, "")
    .replace(/\s+(bhandara|bhandare|भंडारा|भंडारे)\s*$/i, "")
    .trim();
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
   *  Optional — old bot daemon builds that don't send it still work. */
  groupName?: string;
  /** WhatsApp message id, used by the agent for "you already
   *  ingested this" dedupe. We persist it inside the description tag. */
  msgId?: string;
  /** Original mime type ("image/jpeg" | "image/png" | "image/webp"). */
  mime?: string;
  /** Optional WhatsApp imageMessage.caption — the text the sender
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
  // didn't send one (old build / personal-chat forward / etc.) — the
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
  let classified: "bhandara" | "spot" | "other";
  try {
    classified =
      requestedKind === "auto"
        ? await classifyImage(base64Webp, "image/webp")
        : requestedKind;
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
  // uploaded WebP is discarded — we don't even upload to R2.
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
      reason: "Byte-identical re-forward — matched on hash marker.",
    });
    return NextResponse.json({
      ok: true,
      kind: "duplicate",
      duplicateOf: dupBhandara?.id ?? dupSpot?.id,
      reviewUrl: dupBhandara
        ? `${SITE_URL}/admin?type=whatsapp#${dupBhandara.id}`
        : `${SITE_URL}/admin?type=whatsapp&status=spot#${dupSpot?.id ?? ""}`,
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
      await logIngestion({
        outcome: "FAILED_EXTRACT",
        senderName,
        groupName,
        msgId,
        imageHash,
        reason: `Gemini bhandara extract: ${detail.slice(0, 380)}`,
      });
      return jsonError(502, "extract_failed", { detail, photoUrl });
    }

    // ── Content-based dedup ────────────────────────────────────────
    // The byte-hash dedup above catches re-forwards of the EXACT same
    // bytes. WhatsApp re-encodes images between groups (slight EXIF /
    // compression variance), so the same poster forwarded to 3 groups
    // ends up with 3 different hashes — and previously created 3
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
        // Evict the freshly-uploaded WebP — we're not using it. Best
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
          reviewUrl: `${SITE_URL}/admin?type=whatsapp#${contentDup.id}`,
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
      // Hazratganj-ish — matches LKO_CENTER in lib/geocodeServer.ts.
      lat = 26.8467;
      lng = 80.9462;
      geocodeNote = hasAnyCandidateSignal
        ? "geocode:fallback-center/miss"
        : "geocode:fallback-center/no-signal";
    }

    // Tag carries the geocode outcome too, admin can spot whether a
    // row was auto-located vs. left blank without opening the edit
    // page. Stripped from public surfaces by stripBotProvenance.
    const taggedDescription = `${tag.slice(0, -1)} · ${geocodeNote}]`;
    const description = [extracted.description, taggedDescription]
      .filter(Boolean)
      .join("\n\n");
    const descriptionHi = extracted.descriptionHi || null;

    // Pamphlet/poster path. classifyImage returned "bhandara" so we
    // create a PENDING listing row only — admin reviews + approves
    // before the listing shows up on the public cards / map. The
    // chat panel + map deliberately do NOT surface a companion Spot
    // here: a pamphlet is an announcement of an event, not a live
    // sighting. (Food/crowd/tent photos take the spot branch below
    // and bypass admin via an APPROVED Spot.)
    const row = await prisma.bhandara.create({
      data: {
        slug,
        name: extracted.name || "Bhandara from WhatsApp",
        nameHi: extracted.nameHi || null,
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
        organizerPhone: extracted.organizerPhone || "",
        photoUrl,
        status: "PENDING",
      },
    });

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
      reviewUrl: `${SITE_URL}/admin#${row.id}`,
    });
  }

  // kind === "spot"  — live photo (food / crowd / tents).
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
    await logIngestion({
      outcome: "FAILED_EXTRACT",
      senderName,
      groupName,
      msgId,
      imageHash,
      reason: `Gemini spot extract: ${detail.slice(0, 380)}`,
    });
    return jsonError(502, "extract_failed", { detail, photoUrl });
  }

  // Caption priority:
  //   1. body.caption  — WhatsApp imageMessage.caption (sender's words)
  //   2. extracted.caption — Gemini's vision summary (fallback only)
  //   3. neither       — empty
  // The provenance tag is appended last; stripBotProvenance hides it
  // on every public surface.
  const senderCaption = (body.caption ?? "").trim().slice(0, 400);
  const captionBody = senderCaption || extracted.caption || "";
  const caption = [captionBody, tag].filter(Boolean).join("\n\n");
  const expiresAt = new Date(Date.now() + SPOT_TTL_HOURS * 60 * 60 * 1000);

  const spot = await prisma.spot.create({
    data: {
      lat: 0,
      lng: 0,
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
      // the "live feed" experience entirely — every chat-panel
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
     *  uses this to skip the parallel POST to /api/bot/message —
     *  the caption is already on the public Spot row, no need to
     *  also create a duplicate text mention. */
    captionUsedInSpot: senderCaption.length > 0,
    reviewUrl: `${SITE_URL}/admin#spot:${spot.id}`,
  });
}
