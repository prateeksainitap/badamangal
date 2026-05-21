/**
 * Admin-only "replace photo" upload endpoint.
 *
 * Sister to /api/admin/scan but with NO Gemini extraction and NO
 * geocoding, just takes an image, resizes via sharp, drops it in
 * Supabase Storage (or /public/uploads in dev), and returns the
 * public URL. The admin edit forms (/admin/edit/[id],
 * /admin/edit-spot/[id]) use this to let admins replace a bhandara
 * or spot's photoUrl in-place without leaving the form.
 *
 * Why a separate endpoint vs reusing /api/admin/scan:
 *   The scan endpoint runs Gemini + Ola Maps on EVERY upload, which
 *   is wasted work + cost when the admin is just swapping a photo on
 *   an already-extracted row. This endpoint skips that path entirely
 *  , ~50ms vs ~6-15s, and zero Gemini quota burn.
 *
 * Auth: same admin cookie gate as the rest of /admin.
 */
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { getSupabaseAdmin, PHOTO_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Pure resize + upload, should never need more than a few seconds.
// Keep a generous timeout just in case of large source files + slow
// Supabase round-trips on cold pool.
export const maxDuration = 15;

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

  // sharp resize + WebP re-encode. Identical recipe to the public
  // /api/public/scan-bhandara and admin /api/admin/scan endpoints so
  // photos across all upload paths render at consistent quality + size.
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
    console.error("admin upload-image sharp failed", err);
    return NextResponse.json(
      { error: "Couldn't process that image." },
      { status: 422 },
    );
  }

  const filename = `${randomUUID()}.webp`;
  let photoUrl: string;
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(filename, webp, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
    if (error) {
      console.error("supabase upload failed (admin upload-image)", error);
      return NextResponse.json(
        { error: "Could not save image. Try again." },
        { status: 500 },
      );
    }
    photoUrl = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(filename)
      .data.publicUrl;
  } else {
    const dir = path.join(process.cwd(), "public", "uploads");
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, filename), webp);
    } catch (err) {
      console.error("admin upload-image write failed", err);
      return NextResponse.json(
        { error: "Could not save image. Try again." },
        { status: 500 },
      );
    }
    photoUrl = `/uploads/${filename}`;
  }

  return NextResponse.json({
    ok: true,
    photoUrl,
    filename,
    sizeBytes: webp.length,
  });
}
