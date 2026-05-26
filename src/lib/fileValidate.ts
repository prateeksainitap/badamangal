/**
 * Shared client-side file-validation helpers used by PhotoPicker and
 * ContactForm. Every check here mirrors the server-side guard in
 * /api/uploads/route.ts so the user is told "this file won't work" the
 * instant they pick it from the file browser, not after they've filled
 * in the whole form and clicked Submit.
 *
 * Keep these limits in sync with the server route. The server is still
 * the source of truth (a malicious client can bypass any of this), but
 * 99 % of real users see only the client-side message.
 */

// Lowered from 8 MB → 5 MB. Netlify Functions reject any request body
// larger than 6 MB at the platform level (the request never reaches our
// handler), so an 8 MB image would fail with a generic 413 in prod.
// 5 MB leaves headroom for multipart-form-data overhead and matches the
// PDF cap, so users see a single consistent number.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_BYTES = 5 * 1024 * 1024;

// IMPORTANT: This list MUST stay aligned with the server allowlist in
// src/app/api/uploads/route.ts. The aspirational HEIC/HEIF entries
// here previously let iPhone "Most Efficient" uploads pass client
// validation, then 415 at the API with a generic error, the user
// never saw the helpful "switch to Most Compatible" nudge below.
// Removed so the unsupported-type branch fires and surfaces the HEIC-
// specific guidance. When the server actually ships a working
// sharp+libheif pipeline, re-add them here in the same commit that
// flips the server allowlist.
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
const PDF_TYPE = "application/pdf";

/** Comma-separated MIME list for the `accept` attribute of an image-only input. */
export const IMAGE_ACCEPT = ALLOWED_IMAGE_TYPES.join(",");
/** Comma-separated MIME list for the `accept` attribute of an image-or-PDF input. */
export const IMAGE_OR_PDF_ACCEPT = `${PDF_TYPE},${ALLOWED_IMAGE_TYPES.join(",")}`;

export type ValidationResult = { ok: true } | { ok: false; message: string };

type Locale = "hi" | "en";

function bilingual(locale: Locale, hi: string, en: string): string {
  return locale === "hi" ? hi : en;
}

/**
 * Validate an image-only upload (PhotoPicker on /list-bhandara, /spot, etc.).
 * Rejects:
 *   - Anything that isn't JPG / PNG / WebP (HEIC, AVIF-without-fallback,
 *     GIF, BMP, SVG, etc., the server can't process them safely).
 *   - Empty files.
 *   - Files over 5 MB.
 */
export function validateImage(file: File, locale: Locale): ValidationResult {
  if (file.size === 0) {
    return {
      ok: false,
      message: bilingual(
        locale,
        "फ़ाइल खाली है।",
        "That file is empty.",
      ),
    };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    // iPhones often hand over HEIC by default, call that out by name so
    // the user knows what's wrong, instead of a generic "type mismatch".
    const heicHint =
      file.name.toLowerCase().endsWith(".heic") ||
      file.name.toLowerCase().endsWith(".heif") ||
      file.type === "image/heic" ||
      file.type === "image/heif";
    if (heicHint) {
      return {
        ok: false,
        message: bilingual(
          locale,
          "iPhone की HEIC तस्वीर अभी सपोर्ट नहीं है। iPhone Settings → Camera → Formats → Most Compatible चुनकर फिर से लें, या स्क्रीनशॉट डालें।",
          "iPhone HEIC photos aren't supported yet. Open Settings → Camera → Formats → Most Compatible and retake, or upload a screenshot of the photo.",
        ),
      };
    }
    return {
      ok: false,
      message: bilingual(
        locale,
        "केवल JPG, PNG या WebP तस्वीर चलेगी।",
        "Only JPG, PNG, or WebP images are allowed.",
      ),
    };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      message: bilingual(
        locale,
        "तस्वीर बहुत बड़ी है (अधिकतम 5 MB)।",
        "Image is too large (max 5 MB).",
      ),
    };
  }
  return { ok: true };
}

/**
 * Validate an image-or-PDF attachment (ContactForm). Same rules as
 * `validateImage`, plus PDF up to 5 MB.
 */
export function validateAttachment(file: File, locale: Locale): ValidationResult {
  if (file.size === 0) {
    return {
      ok: false,
      message: bilingual(locale, "फ़ाइल खाली है।", "That file is empty."),
    };
  }
  const isPdf = file.type === PDF_TYPE;
  if (isPdf) {
    if (file.size > MAX_PDF_BYTES) {
      return {
        ok: false,
        message: bilingual(
          locale,
          "PDF बहुत बड़ी है (अधिकतम 5 MB)।",
          "PDF is too large (max 5 MB).",
        ),
      };
    }
    return { ok: true };
  }
  // Defer to the image validator for everything else, it carries the
  // HEIC-specific hint that PhotoPicker users care about.
  return validateImage(file, locale);
}
