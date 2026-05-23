/**
 * Volunteer-only: upload a single photo or video to Supabase Storage.
 *
 * Used by /volunteer/submit during the 10-photos + 2-videos + 1-spot
 * upload step. Each file uploads independently so the UI can show
 * per-file progress and skip a failed one without re-uploading the
 * rest.
 *
 * Auth:
 *   Volunteer code in the `x-volunteer-code` header (or `?code=`
 *   query). We validate the code exists + is NOT SUSPENDED. No
 *   session / cookie, the code is the auth (Tier A trade-off).
 *
 * Differences vs /api/admin/upload-image:
 *   • Public-facing (no admin cookie required)
 *   • Accepts videos too (admin endpoint is photos-only)
 *   • Photos pass through sharp like the admin endpoint; videos are
 *     stored as-is (sharp can't process videos and we don't need
 *     transcoding for our use case)
 *   • Same Supabase bucket (PHOTO_BUCKET), admin can see both
 *     photo and video uploads alongside scan submissions
 */
import { NextResponse, type NextRequest } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { getSupabaseAdmin, PHOTO_BUCKET } from "@/lib/supabase";
import { uploadToR2 } from "@/lib/r2";
import {
  isValidVolunteerCodeShape,
  normaliseVolunteerCode,
} from "@/lib/volunteer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 60s matches the existing tier used by news/refresh + admin/page so
// this route folds into that function group instead of carving out
// its own 30s tier (Hobby's 12-function cap counts each unique
// maxDuration as a separate group). Generous headroom for 60 MB
// video uploads + sharp re-encode on slow networks.
export const maxDuration = 60;

const MAX_PHOTO_BYTES = 12 * 1024 * 1024;  // 12 MB before sharp re-encode
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;  // 60 MB before any processing
const MAX_DIMENSION = 2000;
const WEBP_QUALITY = 85;

function jsonError(status: number, error: string, detail?: string) {
  return NextResponse.json({ ok: false, error, detail }, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Validate volunteer code ───────────────────────────────
  const headerCode = req.headers.get("x-volunteer-code") ?? "";
  const queryCode = new URL(req.url).searchParams.get("code") ?? "";
  const rawCode = (headerCode || queryCode).trim();
  if (!isValidVolunteerCodeShape(rawCode)) {
    return jsonError(401, "invalid_code");
  }
  const code = normaliseVolunteerCode(rawCode);

  // Lookup volunteer, cheap (indexed unique) and we need to know
  // SUSPENDED status to gate uploads at the door rather than letting
  // a banned volunteer keep filling Supabase Storage.
  const volunteer = await prisma.volunteer.findUnique({
    where: { code },
    select: { id: true, status: true },
  });
  if (!volunteer) {
    return jsonError(401, "unknown_code");
  }
  if (volunteer.status === "SUSPENDED") {
    return jsonError(403, "suspended");
  }

  // ── 2. Parse the multipart form ──────────────────────────────
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, "invalid_form");
  }
  const value = form.get("file");
  if (!(value instanceof File) || value.size === 0) {
    return jsonError(400, "no_file");
  }

  const isImage = /^image\/(jpe?g|png|webp|heic|heif)$/i.test(value.type);
  const isVideo = /^video\//i.test(value.type);

  if (!isImage && !isVideo) {
    return jsonError(415, "unsupported_type", value.type);
  }

  if (isImage && value.size > MAX_PHOTO_BYTES) {
    return jsonError(413, "photo_too_large");
  }
  if (isVideo && value.size > MAX_VIDEO_BYTES) {
    return jsonError(413, "video_too_large");
  }

  // ── 3. Process + buffer ──────────────────────────────────────
  const inputBuffer = Buffer.from(await value.arrayBuffer());
  let outputBuffer: Buffer;
  let extension: string;
  let contentType: string;

  if (isImage) {
    // Same sharp recipe as /api/admin/upload-image so photos from
    // every source render at consistent quality + size.
    try {
      outputBuffer = await sharp(inputBuffer, { failOn: "error" })
        .rotate()
        .resize({
          width: MAX_DIMENSION,
          height: MAX_DIMENSION,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY, effort: 4 })
        .toBuffer();
      extension = "webp";
      contentType = "image/webp";
    } catch (err) {
      console.error("volunteer upload sharp failed", err);
      return jsonError(422, "image_processing_failed");
    }
  } else {
    // Videos: store as-is. No transcoding (would require ffmpeg
    // server-side, way out of scope for v1).
    //
    // Magic-byte check (H4): the MIME gate above is purely
    // browser-asserted Content-Type which a hostile uploader can
    // trivially spoof. Read the first 32 bytes and verify a
    // recognised video container signature (MP4/MOV ftyp box, WebM
    // EBML header). Without this, a volunteer code holder could
    // upload arbitrary binary as fake-mp4 and we'd serve it from
    // cdn.badamangal.com as video/mp4 with a 1-year cache. Direct
    // execution is impossible (R2 honours the declared
    // Content-Type), but having attacker-controlled binaries
    // hosted on our CDN is a phishing-link + brand-trust risk.
    if (!hasVideoMagicBytes(inputBuffer)) {
      return jsonError(
        415,
        "not_a_video",
        "File doesn't have a recognised video container header. Try a standard MP4 / MOV / WebM file.",
      );
    }
    outputBuffer = inputBuffer;
    extension = extractExt(value.name, value.type) ?? "mp4";
    contentType = value.type || "video/mp4";
  }

  // ── 4. Upload ────────────────────────────────────────────────
  const filename = `vol-${randomUUID()}.${extension}`;
  let publicUrl: string;

  // Cloudflare R2 first (Phase 2+ primary). Returns null when R2 env
  // vars are unset, falls through to Supabase below. See src/lib/r2.ts.
  try {
    const r2Url = await uploadToR2({
      filename,
      buffer: outputBuffer,
      contentType,
    });
    if (r2Url) {
      return NextResponse.json({
        ok: true,
        url: r2Url,
        filename,
        sizeBytes: outputBuffer.length,
        kind: isImage ? "image" : "video",
      });
    }
  } catch (err) {
    console.error("R2 upload failed (volunteer), falling back to Supabase", err);
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(filename, outputBuffer, {
        contentType,
        cacheControl: "31536000",
        upsert: false,
      });
    if (error) {
      console.error("supabase upload failed (volunteer)", error);
      return jsonError(500, "storage_failed");
    }
    publicUrl = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(filename).data
      .publicUrl;
  } else {
    // Dev fallback, same pattern as /api/admin/upload-image.
    const dir = path.join(process.cwd(), "public", "uploads");
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, filename), outputBuffer);
    } catch (err) {
      console.error("volunteer upload write failed", err);
      return jsonError(500, "storage_failed");
    }
    publicUrl = `/uploads/${filename}`;
  }

  return NextResponse.json({
    ok: true,
    url: publicUrl,
    filename,
    sizeBytes: outputBuffer.length,
    kind: isImage ? "image" : "video",
  });
}

/**
 * Magic-byte sniffer for video files. Returns true when the buffer
 * starts with a recognised video container signature:
 *   - MP4 / MOV: "ftyp" box at byte offset 4 (any brand)
 *   - WebM: EBML header bytes 1A 45 DF A3 at offset 0
 *   - 3GPP (mobile): also "ftyp" at offset 4
 * False for everything else (PE/ELF executables, ZIPs, PDFs, etc).
 *
 * Defensive: returns false on any read error rather than throwing,
 * so a too-short or pathological buffer just fails the gate.
 */
function hasVideoMagicBytes(buf: Buffer): boolean {
  try {
    if (buf.length < 12) return false;
    // ftyp at offset 4-7 covers MP4, MOV, M4V, 3GP, etc.
    if (buf.slice(4, 8).toString("ascii") === "ftyp") return true;
    // EBML header for WebM/Matroska: 1A 45 DF A3
    if (
      buf[0] === 0x1a &&
      buf[1] === 0x45 &&
      buf[2] === 0xdf &&
      buf[3] === 0xa3
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Best-effort extension extraction from filename or mime. */
function extractExt(name: string, mime: string): string | null {
  // Prefer the original filename's extension when available, preserves
  // user intent (e.g. .mov vs .mp4) for browsers that care.
  const fromName = /\.([a-z0-9]{2,5})$/i.exec(name);
  if (fromName) return fromName[1].toLowerCase();
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/quicktime") return "mov";
  if (mime === "video/webm") return "webm";
  return null;
}
