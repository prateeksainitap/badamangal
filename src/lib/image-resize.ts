/**
 * Client-side image resize before upload.
 *
 * Why this exists:
 *   A typical Indian-phone photo is 5-12 MB at the sensor's native
 *   resolution (often 4032×3024 or larger). Server-side sharp on
 *   /api/volunteer/upload-media resizes everything to 2000px WebP @
 *   quality 85 before storing, but only AFTER receiving the full
 *   raw upload. On 4G in Lucknow that's ~30-60 seconds per photo
 *   before sharp even sees the bytes. 10 photos = a 5-minute
 *   upload spinner, plenty of time for the volunteer to give up.
 *
 *   Running the same resize on the browser BEFORE upload drops the
 *   wire bytes to ~500-800 KB per photo. Server sharp still runs as
 *   a safety net (and standardises the WebP output for the CDN),
 *   but the 5-10x bandwidth saving + skipping the per-file
 *   serialise-into-RAM step makes the whole submission feel
 *   instant.
 *
 * Failure modes (all fail-open, return the original file):
 *   • Non-image file types (videos, PDFs, etc.) → server handles
 *   • HEIC / HEIF (iPhone default) → Chrome can't decode via
 *     <img>; Safari can. Conservative: skip and let the server's
 *     sharp (which has libheif) do the work.
 *   • Image is already smaller than maxDim on both axes → no
 *     point resizing it bigger
 *   • Canvas / toBlob errors (rare; out-of-memory on very low-end
 *     phones with huge images) → fall back to raw upload
 */

const DEFAULT_MAX_DIMENSION = 2000;
const DEFAULT_JPEG_QUALITY = 0.85;

export async function resizeImageForUpload(
  file: File,
  maxDim: number = DEFAULT_MAX_DIMENSION,
  quality: number = DEFAULT_JPEG_QUALITY,
): Promise<File> {
  // Type gates, only re-encode actual web-decodable images.
  if (!file.type.startsWith("image/")) return file;
  if (/heic|heif/i.test(file.type)) return file;

  try {
    const img = await loadImage(file);
    const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
    // Already within bounds: ship as-is (saves a re-encode cost).
    if (scale === 1) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // Higher-quality bilinear downscale. Default is "low" on some
    // browsers which produces noticeably crunchier output at large
    // scale ratios.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });
    if (!blob) return file;

    // We re-encoded to JPEG; rename the file accordingly so the
    // server's content-type detection and the .ext-on-Supabase
    // path both reflect reality. Strip the original extension and
    // append .jpg.
    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    // Any failure, return original. Server-side sharp will still
    // do the heavy lifting; we just lose the bandwidth win.
    return file;
  }
}

/** Load a File into an HTMLImageElement via a one-shot object URL. */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
