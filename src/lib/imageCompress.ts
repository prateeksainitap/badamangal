/**
 * Client-side image downscaler / recompressor.
 *
 * iPhone cameras shoot 12-48 MP JPEGs that land between 4 MB and 15 MB
 * straight off the sensor. Both the upload endpoint (5 MB cap) and the
 * Netlify Functions platform itself (6 MB hard request-body limit)
 * reject those, so a passer-by who tapped "Take a photo" on /spot would
 * watch their attempt fail with no recourse but to fish through the
 * gallery for a smaller shot.
 *
 * Compressing in the browser before upload sidesteps both caps. We:
 *   1. Decode the picked file as an ImageBitmap (this honours EXIF
 *      orientation on Safari/Chrome via `imageOrientation: "from-image"`,
 *      so portrait shots don't end up sideways).
 *   2. Draw onto a canvas resized so the long edge ≤ MAX_DIMENSION.
 *   3. Re-encode as JPEG at QUALITY.
 *   4. If anything in that pipeline throws (HEIC on a non-Safari browser,
 *      a weird codec, an empty bitmap), return the original file
 *      unchanged so the server still gets a chance to accept or reject.
 *
 * Output sizes in practice:
 *   iPhone 12 MP JPEG  (≈4 MB)  → 220-380 KB
 *   iPhone 48 MP JPEG  (≈12 MB) → 350-600 KB
 *   Android 50 MP JPEG (≈8 MB)  → 280-500 KB
 */

const MAX_DIMENSION = 1920; // px on the long edge — plenty for a feed photo
const QUALITY = 0.85;
const COMPRESSED_MIME = "image/jpeg";

/**
 * Returns a possibly-compressed File. The caller can pass the result
 * straight into a FormData / upload call; the server's existing image
 * pipeline (sharp → WebP) handles the second pass without issue.
 *
 * Already-small images (under SKIP_BYTES) and non-image inputs are
 * passed through untouched — there's no point spending main-thread
 * cycles on a 200 KB file that's already going to upload fine.
 */
export async function compressImageForUpload(
  input: File,
  opts: { skipUnderBytes?: number } = {},
): Promise<File> {
  const skipUnderBytes = opts.skipUnderBytes ?? 1_500_000; // 1.5 MB

  // Bail on anything that isn't a recognisable image — the upload
  // endpoint will reject (or accept) by content-type as it does today.
  if (!input.type.startsWith("image/")) return input;

  // Tiny images don't need a round-trip through canvas.
  if (input.size <= skipUnderBytes) return input;

  // No DOM (SSR safety): just return the original.
  if (typeof window === "undefined" || typeof document === "undefined") {
    return input;
  }

  try {
    // createImageBitmap is the cleanest way to decode + auto-orient.
    // Safari has supported the `imageOrientation` option since 17.4.
    const bitmap = await createImageBitmap(input, {
      imageOrientation: "from-image",
    });

    const longEdge = Math.max(bitmap.width, bitmap.height);
    const scale = longEdge > MAX_DIMENSION ? MAX_DIMENSION / longEdge : 1;
    const targetW = Math.round(bitmap.width * scale);
    const targetH = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return input;
    }
    // High-quality downscale (default smoothing is fine; explicitly
    // setting "high" makes some browsers pick a better resampler).
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, COMPRESSED_MIME, QUALITY),
    );
    if (!blob) return input;

    // If the compressed version is somehow larger than the original
    // (rare — happens for tiny artworks on lossy re-encode), keep the
    // original.
    if (blob.size >= input.size) return input;

    // Preserve a sensible filename + extension so the server-side log
    // and the storage bucket entry stay readable.
    const baseName = input.name.replace(/\.[^./\\]+$/, "") || "photo";
    return new File([blob], `${baseName}.jpg`, {
      type: COMPRESSED_MIME,
      lastModified: input.lastModified || Date.now(),
    });
  } catch {
    // Decoding failed (HEIC outside Safari, corrupt image, etc.) —
    // hand the original file back; server-side validation will produce
    // a meaningful error if the upload itself can't go through.
    return input;
  }
}
