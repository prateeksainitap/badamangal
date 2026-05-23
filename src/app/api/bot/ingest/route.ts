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
import { revalidatePath } from "next/cache";
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
import { slugify, ensureUniqueSlug } from "@/lib/slugify";
import { menuHiFor } from "@/lib/menu";
import { geocodeLucknow } from "@/lib/geocodeServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB before normalisation
const SPOT_TTL_HOURS = 8;

type IngestBody = {
  /** "bhandara" for an invite poster, "spot" for a live photo, or
   *  "auto" to let us classify the image via Gemini and route. The bot
   *  defaults to "auto" so users can forward anything into the group. */
  kind?: "bhandara" | "spot" | "auto";
  /** Base64-encoded image bytes (no data: prefix). */
  photoBase64?: string;
  /** Display name of the WhatsApp sender (for the admin's eyes). */
  senderName?: string;
  /** WhatsApp message id, used by the agent for "you already
   *  ingested this" dedupe. We persist it inside the description tag. */
  msgId?: string;
  /** Original mime type ("image/jpeg" | "image/png" | "image/webp"). */
  mime?: string;
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
  const kind: "bhandara" | "spot" =
    requestedKind === "auto"
      ? await classifyImage(base64Webp, "image/webp")
      : requestedKind;

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

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return jsonError(500, "storage_unavailable", {
      detail: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set on the server.",
    });
  }
  const filename = `bot-${kind}-${randomUUID()}.webp`;
  const upload = await supabase.storage.from(PHOTO_BUCKET).upload(filename, webp, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (upload.error) {
    console.error("[bot/ingest] supabase upload failed", upload.error);
    return jsonError(500, "storage_upload_failed");
  }
  const photoUrl = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(filename).data.publicUrl;

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
  const tag = `[bot:whatsapp · from:${senderName}${msgId ? ` · msg:${msgId.slice(0, 24)}` : ""} · ${timestamp} · ${hashMarker}]`;

  if (kind === "bhandara") {
    let extracted: ExtractedBhandara;
    try {
      extracted = await extractBhandaraFromImage(base64Webp, "image/webp");
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error("[bot/ingest] gemini bhandara extract failed", detail);
      return jsonError(502, "extract_failed", { detail, photoUrl });
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

    // Forward-geocode the extracted address via Ola Maps so the row
    // lands with real lat/lng (matched against Lucknow's bounding box)
    // instead of 0,0. The admin can still edit, but most rows now go
    // live without manual coord-pasting, which was the #1 reason
    // /admin/edit/[id] existed for bot rows in the first place.
    // Returns null on network failure, missing key, or zero results
    // in the Lucknow bbox; in that case we keep 0,0 + the admin fills
    // it in the edit form as before. `geocodeNote` records what
    // happened so the admin can see at a glance whether to trust
    // the coords or correct them.
    let lat = 0;
    let lng = 0;
    let geocodeNote = "geocode:skipped";
    if (extracted.address && extracted.address.length >= 5) {
      try {
        const hit = await geocodeLucknow(extracted.address);
        if (hit) {
          lat = hit.lat;
          lng = hit.lng;
          geocodeNote = `geocode:${hit.source}`;
        } else {
          geocodeNote = "geocode:miss";
        }
      } catch (err) {
        console.error("[bot/ingest] geocode error:", err);
        geocodeNote = "geocode:error";
      }
    }

    // Tag carries the geocode outcome too, admin can spot whether a
    // row was auto-located vs. left blank without opening the edit
    // page. Stripped from public surfaces by stripBotProvenance.
    const taggedDescription = `${tag.slice(0, -1)} · ${geocodeNote}]`;
    const description = [extracted.description, taggedDescription]
      .filter(Boolean)
      .join("\n\n");
    const descriptionHi = extracted.descriptionHi || null;

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

    // Spot promotion — mirror the pamphlet into the live chat + map
    // surfaces via an APPROVED Spot so the photo is visible on the
    // homepage immediately, while the Bhandara row above still waits
    // on admin review before joining the listings grid. Trade-off:
    // a stale or wrong-day poster could surface for up to 8h before
    // the admin rejects the source row; the standard SPOT_TTL_HOURS
    // backstop limits the blast radius and the bhandaraId link lets
    // the admin clean both rows in one click.
    //
    // Strict gate, same logic the message-path uses: require a real
    // Lucknow lat/lng (geocoding succeeded), refuse the 0,0 fallback.
    // No pin is better than a wrong pin.
    let spotId: string | null = null;
    if (lat !== 0 && lng !== 0 && Number.isFinite(lat) && Number.isFinite(lng)) {
      // Caption strips the [bot:…] provenance off the public surface
      // but keeps it embedded — stripBotProvenance grabs the prefix
      // from any chatter-board / map render-site automatically.
      const spotCaption = [extracted.name || "Bhandara", tag]
        .filter(Boolean)
        .join("\n\n");
      const spotExpiresAt = new Date(
        Date.now() + SPOT_TTL_HOURS * 60 * 60 * 1000,
      );
      try {
        const spot = await prisma.spot.create({
          data: {
            lat,
            lng,
            area: extracted.area ?? null,
            address: extracted.address || null,
            photoUrl,
            caption: spotCaption,
            language: "mixed",
            reporterName: senderName,
            reporterPhoneHash: null,
            status: "APPROVED",
            expiresAt: spotExpiresAt,
            ipHash: "bot:whatsapp:bhandara-poster",
            bhandaraId: row.id,
          },
          select: { id: true },
        });
        spotId = spot.id;
        // Refresh the SSR caches so the homepage's HappeningNow + map
        // pick up the new Spot on the next render instead of waiting
        // on the 60s revalidate window. Best-effort — never fatal.
        try {
          revalidatePath("/");
          revalidatePath("/live");
        } catch {
          /* noop */
        }
      } catch (err) {
        console.warn(
          "[bot/ingest] bhandara-companion spot create failed:",
          err,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      kind: "bhandara",
      id: row.id,
      slug: row.slug,
      spotId,
      reviewUrl: `${SITE_URL}/admin#${row.id}`,
    });
  }

  // kind === "spot"
  let extracted: ExtractedSpot;
  try {
    extracted = await extractSpotFromImage(base64Webp, "image/webp");
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[bot/ingest] gemini spot extract failed", detail);
    return jsonError(502, "extract_failed", { detail, photoUrl });
  }

  const caption = [extracted.caption, tag].filter(Boolean).join("\n\n");
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
      // Hold for admin review, forwarded photos shouldn't auto-publish
      // even with the 8-hour TTL backstop. Less surprise on the map.
      status: "PENDING",
      expiresAt,
      ipHash: "bot:whatsapp",
      userAgent: "openclaw/ingest-bhandara",
    },
  });

  return NextResponse.json({
    ok: true,
    kind: "spot",
    id: spot.id,
    reviewUrl: `${SITE_URL}/admin#spot:${spot.id}`,
  });
}
