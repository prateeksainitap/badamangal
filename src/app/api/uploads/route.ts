import { NextResponse, type NextRequest } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { getSupabaseAdmin, PHOTO_BUCKET } from "@/lib/supabase";
import { uploadToR2 } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Upload endpoint for organizer photos, spot pictures, and contact-form
// attachments.
//
// Images (JPG, PNG, WebP) are re-encoded server-side as WebP @ q=80,
// capped at 1600 px on the long edge, EXIF stripped. Two big wins:
//   • storage cost drops 60–85% vs. the original phone-camera JPG
//   • a hostile upload (oversized PNG, weird codec, EXIF tracker) is
//     normalized away before it lands in Supabase.
//
// PDFs are accepted up to a strict 5 MB cap and stored as-is. PDFs are
// already deflate-compressed internally by every modern PDF writer; a
// meaningful re-pass would need a heavy library (pdf-lib ≈ 1.5 MB) for
// modest savings, not worth it for the contact-form's expected volume.
//
// Storage chain (first match wins, see end of handler):
//   1. Cloudflare R2 if R2_* env vars are set (Phase 2 onwards;
//      photos served from cdn.badamangal.com).
//   2. Supabase Storage `bhandara-photos` bucket → public URL
//      (legacy primary, now fallback; kept so the route still works
//      on any environment that doesn't have R2 creds yet).
//   3. Local dev (no Supabase env either): writes to `/public/uploads/`.
// Both caps held at 5 MB, Vercel + Netlify Functions reject request
// bodies larger than ~6 MB at the platform level, so 8 MB+ images
// would fail with a generic 413 before reaching this handler.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 1600;              // px on the long edge after resize
const WEBP_QUALITY = 80;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const PDF_TYPE = "application/pdf";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form payload" }, { status: 400 });
  }

  const value = form.get("file");
  if (!(value instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  const file = value;

  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }

  const isPdf = file.type === PDF_TYPE;
  const isImage = ALLOWED_IMAGE_TYPES.has(file.type);

  if (!isPdf && !isImage) {
    return NextResponse.json(
      { error: "Use a JPG, PNG, WebP image or a PDF." },
      { status: 415 },
    );
  }

  if (isImage && file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "Image too large. Max 5 MB." },
      { status: 413 },
    );
  }
  if (isPdf && file.size > MAX_PDF_BYTES) {
    return NextResponse.json(
      { error: "PDF too large. Max 5 MB." },
      { status: 413 },
    );
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  let outputBuffer: Buffer;
  let filename: string;
  let contentType: string;
  let kind: "image" | "pdf";

  if (isPdf) {
    // Magic-byte check: a real PDF starts with `%PDF-` (0x25 0x50 0x44
    // 0x46 0x2D). The browser-set Content-Type can be spoofed, so
    // verify the actual file header before trusting it. Sharp does the
    // equivalent for images by failing on malformed input.
    const head = inputBuffer.subarray(0, 5).toString("ascii");
    if (head !== "%PDF-") {
      return NextResponse.json(
        { error: "That doesn't look like a real PDF." },
        { status: 415 },
      );
    }
    outputBuffer = inputBuffer;
    filename = `${randomUUID()}.pdf`;
    contentType = PDF_TYPE;
    kind = "pdf";
  } else {
    // ── Convert to WebP ────────────────────────────────────────────────
    try {
      outputBuffer = await sharp(inputBuffer, { failOn: "error" })
        .rotate() // honour EXIF orientation, then drop EXIF
        .resize({
          width: MAX_DIMENSION,
          height: MAX_DIMENSION,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY, effort: 4 })
        .toBuffer();
    } catch (err) {
      console.error("sharp webp conversion failed", err);
      return NextResponse.json(
        { error: "Couldn't process that image. Try another." },
        { status: 422 },
      );
    }
    filename = `${randomUUID()}.webp`;
    contentType = "image/webp";
    kind = "image";
  }

  // ── 1. Cloudflare R2 (Phase 2+ primary path) ───────────────────────
  // uploadToR2 returns null if R2_* env vars aren't set, so the
  // fall-through to Supabase below keeps working on any environment
  // that hasn't been wired up to R2 yet.
  try {
    const r2Url = await uploadToR2({
      filename,
      buffer: outputBuffer,
      contentType,
    });
    if (r2Url) {
      return NextResponse.json(
        { url: r2Url, bytes: outputBuffer.length, kind },
        { status: 201 },
      );
    }
  } catch (err) {
    console.error("R2 upload failed, falling back to Supabase", err);
    // Don't return: fall through to Supabase as a safety net so a
    // transient R2 issue doesn't drop the user's upload.
  }

  // ── 2. Supabase Storage path (legacy primary, now fallback) ────────
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
      console.error("supabase upload failed", error);
      return NextResponse.json(
        { error: "Could not save file. Please try again." },
        { status: 500 },
      );
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(filename);
    return NextResponse.json(
      { url: publicUrl, bytes: outputBuffer.length, kind },
      { status: 201 },
    );
  }

  // ── 3. Local-dev fallback: write to /public/uploads ────────────────
  const dir = path.join(process.cwd(), "public", "uploads");
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), outputBuffer);
  } catch (err) {
    console.error("upload write failed", err);
    return NextResponse.json(
      { error: "Could not save file. Please try again." },
      { status: 500 },
    );
  }
  return NextResponse.json(
    { url: `/uploads/${filename}`, bytes: outputBuffer.length, kind },
    { status: 201 },
  );
}
