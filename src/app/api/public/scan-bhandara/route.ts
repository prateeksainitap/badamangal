/**
 * Public bhandara-poster scan endpoint.
 *
 * Mirrors /api/admin/scan but for unauthenticated organisers using the
 * "I have a pamphlet, scan it" flow on /list-bhandara. Same Sharp
 * resize → Supabase upload → Gemini extract → Ola geocode pipeline;
 * the differences are:
 *   • no admin cookie check (anyone can call it)
 *   • IP rate limit (5 scans / IP / hour) so abuse can't burn the
 *     Gemini quota
 *   • slightly stricter input cap (5 MB vs admin's 8 MB) because the
 *     public form trims to 1600 px client-side before upload, the
 *     full 8 MB headroom is only useful for admin batch ingest from
 *     desktop scans
 *
 * The endpoint never writes a Bhandara row, it returns the extracted
 * fields + the persisted photo URL + a geocoded pin, and the client
 * hands those to BhandaraForm as `initialValues`. The user reviews +
 * edits, then submits through the normal /api/bhandaras pipeline
 * (which writes PENDING and goes through admin moderation).
 */
import { NextResponse, type NextRequest } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  extractBhandaraFromImage,
  type ExtractedBhandara,
} from "@/lib/vision";
import { geocodeLucknow, type ServerGeocodeHit } from "@/lib/geocodeServer";
import { getSupabaseAdmin, PHOTO_BUCKET } from "@/lib/supabase";
import { ipHash, readClientIp } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Gemini vision can take 6–15s on a complex banner. Same headroom
// budget as the admin endpoint.
export const maxDuration = 25;

const MAX_INPUT_BYTES = 5 * 1024 * 1024; // 5 MB (vs admin's 8)
const MAX_DIMENSION = 2000;
const WEBP_QUALITY = 85;

// Per-IP rate limit. In-memory because Netlify Functions are stateless
// across cold starts, the limiter resets every regen which means worst-
// case an attacker gets RATE_LIMIT_MAX scans per cold start (still
// bounded). DB-backed rate-limit is the next step if abuse appears in
// practice; for the soft-launch this caps quota burn cheaply.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const rateBuckets = new Map<string, number[]>();

function checkRateLimit(hash: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  // Pull this IP's bucket, drop entries outside the window, then
  // count + (maybe) append the new attempt.
  const bucket = (rateBuckets.get(hash) ?? []).filter((t) => t > cutoff);
  if (bucket.length >= RATE_LIMIT_MAX) {
    const oldest = bucket[0]!;
    const retryAfterSec = Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000);
    rateBuckets.set(hash, bucket);
    return { ok: false, retryAfterSec: Math.max(retryAfterSec, 1) };
  }
  bucket.push(now);
  rateBuckets.set(hash, bucket);
  // Opportunistic cleanup so the Map doesn't grow unbounded under a
  // long-lived warm function: drop any IP whose newest attempt is
  // older than the window.
  if (rateBuckets.size > 500) {
    for (const [k, v] of rateBuckets.entries()) {
      if (!v.length || v[v.length - 1]! <= cutoff) rateBuckets.delete(k);
    }
  }
  return { ok: true };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Rate limit by IP (hashed) ──────────────────────────────────────
  const ip = ipHash(readClientIp(req.headers));
  const limit = checkRateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: `Too many scans. Try again in ${Math.ceil(limit.retryAfterSec / 60)} min.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSec) },
      },
    );
  }

  // ── Validate request body ──────────────────────────────────────────
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
      { error: "Image too large. Max 5 MB." },
      { status: 413 },
    );
  }
  if (!/^image\/(jpe?g|png|webp)$/i.test(value.type)) {
    return NextResponse.json(
      { error: "Use a JPG, PNG, or WebP image." },
      { status: 415 },
    );
  }

  // ── 1. Sharp resize + re-encode to WebP ────────────────────────────
  // `failOn: "error"` makes Sharp reject truncated / fake-MIME inputs
  // outright instead of silently producing garbage. The .rotate() call
  // honours EXIF orientation so phone-camera shots don't end up
  // sideways. WebP @ q85 keeps banner text legible for Gemini while
  // collapsing 5 MB phone JPEGs to ~200–400 KB on the wire.
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
    console.error("public scan sharp failed", err);
    return NextResponse.json(
      { error: "Couldn't process that image." },
      { status: 422 },
    );
  }

  // ── 2. Persist to Supabase (or /public/uploads in dev) ─────────────
  // Same storage convention as the admin scan + the public upload
  // endpoints so we have one bucket of bhandara photos to manage,
  // not three. The /public/uploads dev fallback only fires when
  // Supabase env vars are absent (local without .env or PR previews).
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
      console.error("supabase upload failed (public scan)", error);
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
      console.error("public scan write failed", err);
      return NextResponse.json(
        { error: "Could not save image. Try again." },
        { status: 500 },
      );
    }
    photoUrl = `/uploads/${filename}`;
  }

  // ── 3. Gemini vision extract ───────────────────────────────────────
  // Same schema as the admin path (extractedBhandaraSchema) so the
  // client can reuse the same field-mapping helper for both surfaces.
  const base64 = webp.toString("base64");
  let extracted: ExtractedBhandara;
  try {
    extracted = await extractBhandaraFromImage(base64, "image/webp");
  } catch (err) {
    console.error("public Gemini extract failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    const friendly = /GEMINI_API_KEY is not set/i.test(detail)
      ? "Pamphlet scan is temporarily unavailable. Please fill the form by hand."
      : "We saved your pamphlet but couldn't read it. Please fill the form by hand, your photo will be used.";
    return NextResponse.json(
      { error: friendly, detail, photoUrl },
      { status: 502 },
    );
  }

  // ── 4. Geocode the address Gemini returned ─────────────────────────
  // Bias toward the most-specific signal: full address > landmark+area
  // > area. First successful hit wins; if all fail we return geocode
  // null and the form's pin step asks the user to drop a pin manually.
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
    photoUrl,
    extracted,
    geocode,
  });
}
