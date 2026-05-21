/**
 * Public AI-fill endpoint for the pamphlet builder.
 *
 * Lets visitors on /pamphlet describe their bhandara in one line OR
 * upload an existing pamphlet/poster image; Gemini returns structured
 * fields the form can pre-populate. Same `ExtractedBhandara` shape
 * the admin /api/admin/scan returns, just exposed publicly with
 * lighter input size limits and per-IP throttling.
 *
 * Why public (no admin gate):
 *   The whole point of the pamphlet generator is to be friction-free
 *   for organisers who land here from WhatsApp shares. Forcing OTP
 *   first kills the conversion. We accept the small Gemini cost per
 *   parse (~₹0.05) in exchange for the conversion lift.
 *
 * Inputs (two variants, mutually exclusive):
 *   • multipart/form-data with `file` field → image extraction
 *   • application/json with `{ text: "..." }` → text extraction
 *
 * Output (always):
 *   { ok: true, data: ExtractedBhandara }       // 200
 *   { ok: false, error: "<friendly message>" }  // 400/429/500
 *
 * Throttling: 8 parses per IP per 10 minutes, in-memory. The cap is
 * intentionally generous, most users will parse once and tweak, but
 * stops accidental loops + casual abuse without needing redis.
 */
import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import {
  extractBhandaraFromImage,
  extractBhandaraFromText,
} from "@/lib/vision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Gemini can take 4-10s on a complex banner. Stay under Netlify's 26s
// Function timeout with comfortable headroom for the sharp resize.
export const maxDuration = 25;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB before sharp re-encode
const MAX_DIMENSION = 1800; // smaller than admin/scan, body text is the only goal
const WEBP_QUALITY = 82;
const MAX_TEXT_LEN = 2000;
const RATE_LIMIT = 8; // calls per window
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// In-memory rate-limit map. Per-IP timestamp buffer. Persists for the
// lifetime of the Function instance (Netlify reuses warm Functions
// across many requests, so this is effective enough without needing
// redis). Cold-start visitors get a fresh window, acceptable.
const ipHits = new Map<string, number[]>();

function clientIp(req: NextRequest): string {
  // Netlify, Cloudflare, and Vercel all set `x-forwarded-for` with the
  // real client IP first and any proxy chain after. Pick the first
  // token; default to "anon" if the header isn't set (local dev).
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "anon";
  const xri = req.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return "anon";
}

function checkRate(ip: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  const hits = (ipHits.get(ip) ?? []).filter((t) => t > cutoff);
  if (hits.length >= RATE_LIMIT) {
    const retryAfter = Math.ceil((hits[0]! + RATE_WINDOW_MS - now) / 1000);
    ipHits.set(ip, hits);
    return { ok: false, retryAfter };
  }
  hits.push(now);
  ipHits.set(ip, hits);
  return { ok: true };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = clientIp(req);
  const rate = checkRate(ip);
  if (!rate.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `Too many AI requests. Try again in ${rate.retryAfter}s.`,
      },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  const contentType = req.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      // ── IMAGE VARIANT ───────────────────────────────────────────
      const form = await req.formData();
      const value = form.get("file");
      if (!(value instanceof File) || value.size === 0) {
        return NextResponse.json(
          { ok: false, error: "No image uploaded." },
          { status: 400 },
        );
      }
      if (value.size > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { ok: false, error: "Image is too large (max 8 MB)." },
          { status: 400 },
        );
      }

      // Normalize: resize + WebP encode so Gemini sees a clean,
      // small-ish input. Heavy pamphlet posters are often 6-10 MB
      // JPEGs straight from a phone; the resize alone usually
      // 8-15× the file size down.
      const original = Buffer.from(await value.arrayBuffer());
      // `failOn: "error"` matches the other Sharp pipelines in this
      // codebase (admin/scan, public/scan-bhandara, volunteer/
      // upload-media, /api/uploads). Without it Sharp tolerates
      // partial decoding, opening the door to crafted malformed
      // images that blow up RAM on the Vercel function (1 GB cap).
      // limitInputPixels caps a decompression-bomb attempt before
      // libvips even allocates the pixel buffer.
      const webp = await sharp(original, {
        failOn: "error",
        limitInputPixels: 50_000_000,
      })
        .rotate() // honour EXIF orientation
        .resize({
          width: MAX_DIMENSION,
          height: MAX_DIMENSION,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();

      const data = await extractBhandaraFromImage(
        webp.toString("base64"),
        "image/webp",
      );
      return NextResponse.json({ ok: true, data });
    }

    // ── TEXT VARIANT ─────────────────────────────────────────────
    const body = (await req.json().catch(() => ({}))) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json(
        { ok: false, error: "Type a one-line description of your bhandara." },
        { status: 400 },
      );
    }
    if (text.length > MAX_TEXT_LEN) {
      return NextResponse.json(
        { ok: false, error: `Description too long (max ${MAX_TEXT_LEN} characters).` },
        { status: 400 },
      );
    }

    const data = await extractBhandaraFromText(text);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    // PUBLIC endpoint: never echo SDK internals (model IDs, internal
    // request IDs, sometimes upstream URLs) to the visitor. The two
    // generic strings below are all the form UI ever sees. Operator
    // detail goes to the server log only (L1 fix).
    const friendly = /GEMINI_API_KEY/i.test(msg)
      ? "AI is temporarily unavailable. Please type the details below manually."
      : "Couldn't read the pamphlet automatically. Please type the details below.";
    console.error("[pamphlet/ai-fill] failed:", msg);
    return NextResponse.json({ ok: false, error: friendly }, { status: 500 });
  }
}
