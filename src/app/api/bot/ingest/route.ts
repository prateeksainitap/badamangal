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
 *      stays silent in the WhatsApp group — no replies, no DMs.
 *      The admin queue is the notification surface.
 *
 * The endpoint is Bearer-token gated by BOT_INGEST_SECRET. Treat that
 * secret like a password: anyone with it can create unlimited PENDING
 * rows. They can't publish (only the admin password can flip
 * APPROVED), so the blast radius of a leak is bounded — an attacker
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
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import {
  extractBhandaraFromImage,
  extractSpotFromImage,
  type ExtractedBhandara,
  type ExtractedSpot,
} from "@/lib/vision";
import { getSupabaseAdmin, PHOTO_BUCKET } from "@/lib/supabase";
import { slugify, ensureUniqueSlug } from "@/lib/slugify";
import { menuHiFor } from "@/lib/menu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB before normalisation
const SPOT_TTL_HOURS = 8;

type IngestBody = {
  /** "bhandara" for an invite poster, "spot" for a live photo. */
  kind?: "bhandara" | "spot";
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
  const kind: "bhandara" | "spot" = body.kind === "spot" ? "spot" : "bhandara";
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

  // ── 4. Upload to Supabase Storage ───────────────────────────────
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
  const base64Webp = webp.toString("base64");
  const tag = `[bot:whatsapp · from:${senderName}${msgId ? ` · msg:${msgId.slice(0, 24)}` : ""} · ${new Date().toISOString().slice(0, 19)}Z]`;

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
    // admin will fix in /admin. We deliberately set status=PENDING and
    // lat/lng=0 so the row never appears on the public map until an
    // admin picks it up — even if the Bhandara enum-default elsewhere
    // is APPROVED, the explicit PENDING here wins.
    const baseSlug = extracted.name
      ? slugify(extracted.name)
      : `bot-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 6)}`;
    const slug = await ensureUniqueSlug(baseSlug);

    const tuesdayDates = extracted.dateIso ? [extracted.dateIso] : [];
    const description = [extracted.description, tag].filter(Boolean).join("\n\n");
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
        lat: 0,
        lng: 0,
        tuesdayDates: JSON.stringify(tuesdayDates),
        timeStart: extracted.timeStart ?? "11:00",
        timeEnd: extracted.timeEnd ?? "",
        menu: JSON.stringify(extracted.menu ?? []),
        menuHi: JSON.stringify(menuHiFor(extracted.menu ?? [])),
        organizerName: extracted.organizerName || senderName,
        organizerPhone: extracted.organizerPhone || "unknown",
        photoUrl,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      ok: true,
      kind: "bhandara",
      id: row.id,
      slug: row.slug,
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
      // Hold for admin review — forwarded photos shouldn't auto-publish
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
