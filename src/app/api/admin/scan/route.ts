/**
 * Admin-only image scan endpoint. Walks the upload through three steps:
 *
 *   1. Normalize: sharp resize to ≤ 2000 px + WebP @ q=85. We need
 *      a larger long-edge than the public uploads route (1600) because
 *      Claude needs to read fine Devanagari address text on a banner.
 *   2. Persist: drop the WebP into Supabase Storage (or /public/uploads
 *      in dev) and remember its public URL, this is the photo that
 *      will sit on the published bhandara/spot card.
 *   3. Extract: send the SAME image bytes (still as the resized WebP)
 *      to Gemini vision via `src/lib/vision.ts`, then geocode the
 *      address it returned so the admin can review with the pin
 *      already positioned.
 *
 * The endpoint never writes to the DB, that's the publish step. It
 * just hands the admin a payload to review and edit in the form.
 *
 * Two kinds:
 *   ?kind=bhandara → returns ExtractedBhandara + geocoded pin
 *   ?kind=spot     → returns ExtractedSpot + geocoded pin
 *
 * Auth: admin cookie (same gate as /admin page actions).
 */
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  extractBhandaraFromImage,
  extractSpotFromImage,
  type ExtractedBhandara,
  type ExtractedSpot,
} from "@/lib/vision";
import { geocodeLucknow, type ServerGeocodeHit } from "@/lib/geocodeServer";
import { getSupabaseAdmin, PHOTO_BUCKET } from "@/lib/supabase";
import { uploadToR2 } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Claude vision can take 6–15s on a complex banner; bump the function
// timeout above the default. Netlify caps at 26s, leaving us headroom.
export const maxDuration = 25;

const COOKIE = "admin";
const MAX_INPUT_BYTES = 8 * 1024 * 1024; // 8 MB before sharp re-encode
const MAX_DIMENSION = 2000;
const WEBP_QUALITY = 85;

async function isAdmin(): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const c = await cookies();
  return c.get(COOKIE)?.value === expected;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  if (kind !== "bhandara" && kind !== "spot") {
    return NextResponse.json(
      { error: "kind must be 'bhandara' or 'spot'" },
      { status: 400 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form payload" }, { status: 400 });
  }
  const value = form.get("file");
  if (!(value instanceof File) || value.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (value.size > MAX_INPUT_BYTES) {
    return NextResponse.json(
      { error: "Image too large. Max 8 MB." },
      { status: 413 },
    );
  }
  if (!/^image\/(jpe?g|png|webp)$/i.test(value.type)) {
    return NextResponse.json(
      { error: "Use a JPG, PNG, or WebP image." },
      { status: 415 },
    );
  }

  // ── 1. Resize + re-encode to WebP ──────────────────────────────────
  const inputBuffer = Buffer.from(await value.arrayBuffer());
  let webp: Buffer;
  try {
    webp = await sharp(inputBuffer, { failOn: "error" })
      .rotate()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer();
  } catch (err) {
    console.error("scan sharp failed", err);
    return NextResponse.json(
      { error: "Couldn't process that image." },
      { status: 422 },
    );
  }

  // ── 2. Persist ──────────────────────────────────────────────────────
  // Storage chain: R2 first (Phase 2+ primary), Supabase fallback,
  // local fs in dev. Mirrors the pattern in api/uploads/route.ts.
  const filename = `${randomUUID()}.webp`;
  let photoUrl: string | null = null;
  try {
    const r2Url = await uploadToR2({
      filename,
      buffer: webp,
      contentType: "image/webp",
    });
    if (r2Url) photoUrl = r2Url;
  } catch (err) {
    console.error("R2 upload failed (admin scan), falling back to Supabase", err);
  }

  const supabase = !photoUrl ? getSupabaseAdmin() : null;
  if (!photoUrl && supabase) {
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(filename, webp, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
    if (error) {
      console.error("supabase upload failed (admin scan)", error);
      return NextResponse.json(
        { error: "Could not save image. Try again." },
        { status: 500 },
      );
    }
    photoUrl = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(filename)
      .data.publicUrl;
  } else if (!photoUrl) {
    const dir = path.join(process.cwd(), "public", "uploads");
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, filename), webp);
    } catch (err) {
      console.error("admin scan write failed", err);
      return NextResponse.json(
        { error: "Could not save image. Try again." },
        { status: 500 },
      );
    }
    photoUrl = `/uploads/${filename}`;
  }
  // photoUrl is guaranteed string by this point: every branch above
  // sets it or returns 500. This guard is unreachable but keeps the
  // type checker happy and prevents a silent null in the DB if
  // control flow ever changes.
  if (!photoUrl) {
    return NextResponse.json({ error: "Storage chain failed." }, { status: 500 });
  }

  // ── 3. Vision extract + geocode ─────────────────────────────────────
  const base64 = webp.toString("base64");
  try {
    if (kind === "bhandara") {
      let extracted: ExtractedBhandara;
      try {
        extracted = await extractBhandaraFromImage(base64, "image/webp");
      } catch (err) {
        console.error("Gemini bhandara extract failed", err);
        const detail = err instanceof Error ? err.message : String(err);
        // Surface the specific config issue when the key is missing,
        // since "Gemini couldn't read it" is misleading there, the
        // API call never even left the server.
        const friendly = /GEMINI_API_KEY is not set/i.test(detail)
          ? "Vision is disabled: GEMINI_API_KEY is not configured on the server. Add it in Netlify → Site settings → Environment variables and redeploy."
          : "Image saved, but Gemini couldn't read it.";
        return NextResponse.json(
          { error: friendly, detail, photoUrl },
          { status: 502 },
        );
      }

      // Build a geocode query out of whatever the model gave us. We bias
      // toward the most-specific signal: full address > landmark+area > area.
      const queries: string[] = [];
      if (extracted.address) queries.push(extracted.address);
      if (extracted.landmark && extracted.area)
        queries.push(`${extracted.landmark}, ${extracted.area}, Lucknow`);
      if (extracted.area) queries.push(`${extracted.area}, Lucknow`);

      let geocode: ServerGeocodeHit | null = null;
      for (const q of queries) {
        geocode = await geocodeLucknow(q);
        if (geocode) break;
      }

      return NextResponse.json({
        kind: "bhandara",
        photoUrl,
        extracted,
        geocode, // may be null, admin can drop a pin manually
      });
    }

    // ── kind === "spot" ───────────────────────────────────────────────
    let extracted: ExtractedSpot;
    try {
      extracted = await extractSpotFromImage(base64, "image/webp");
    } catch (err) {
      console.error("Gemini spot extract failed", err);
      const detail = err instanceof Error ? err.message : String(err);
      const friendly = /GEMINI_API_KEY is not set/i.test(detail)
        ? "Vision is disabled: GEMINI_API_KEY is not configured on the server. Add it in Netlify → Site settings → Environment variables and redeploy."
        : "Image saved, but Gemini couldn't read it.";
      return NextResponse.json(
        { error: friendly, detail, photoUrl },
        { status: 502 },
      );
    }

    const queries: string[] = [];
    if (extracted.address) queries.push(extracted.address);
    if (extracted.area) queries.push(`${extracted.area}, Lucknow`);
    let geocode: ServerGeocodeHit | null = null;
    for (const q of queries) {
      geocode = await geocodeLucknow(q);
      if (geocode) break;
    }

    return NextResponse.json({ kind: "spot", photoUrl, extracted, geocode });
  } catch (err) {
    console.error("admin scan unexpected error", err);
    return NextResponse.json(
      { error: "Unexpected error during scan." },
      { status: 500 },
    );
  }
}
