"use client";

import { useRef, useState } from "react";
import { trackEvent } from "@/lib/ga";
import { IMAGE_ACCEPT, validateImage } from "@/lib/fileValidate";
import { compressImageForUpload } from "@/lib/imageCompress";

/**
 * Format a long upload URL as `host/…/last20.ext` so it fits in one line
 * without breaking the layout. Full URL still available via the `title`
 * tooltip for anyone who needs to copy it.
 */
function shortUrl(url: string): string {
  if (!url) return "";
  if (url.length <= 56) return url;
  try {
    const u = new URL(url);
    const file = u.pathname.split("/").filter(Boolean).pop() ?? "";
    const tail = file.length > 18 ? `…${file.slice(-15)}` : file;
    return `${u.host}/…/${tail}`;
  } catch {
    return `${url.slice(0, 24)}…${url.slice(-12)}`;
  }
}

type Props = {
  /** Current photo URL (empty when not set). */
  value: string;
  onChange: (url: string) => void;
  locale: "hi" | "en";
  /**
   * Preview composition once a photo is uploaded:
   *   - "inline" (default): photo on the left, info + CTAs on the right.
   *     Used by the original /list-bhandara and /spot forms where the
   *     photo is one of several stacked fields and screen real estate
   *     for it should be modest.
   *   - "stacked": photo spans full width on top, info + CTAs sit below.
   *     Used by the V2 spot form where the photo is the hero of the card.
   */
  layout?: "inline" | "stacked";
};

const LABELS = {
  hi: {
    pick: "फ़ोटो खींचें या चुनें",
    picking: "अपलोड हो रहा है…",
    change: "बदलें",
    remove: "हटाएँ",
    chooseSource: "कैमरा खोलें / गैलरी से चुनें",
    helper: "अधिकतम 5 MB · JPG, PNG या WebP",
  },
  en: {
    pick: "Take a photo or choose from gallery",
    picking: "Uploading…",
    change: "Change",
    remove: "Remove",
    chooseSource: "Camera or gallery",
    helper: "Max 5 MB · JPG, PNG or WebP",
  },
} as const;

export default function PhotoPicker({
  value,
  onChange,
  locale,
  layout = "inline",
}: Props) {
  const t = LABELS[locale];
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    trackEvent("photo_upload_start", {
      size_kb: Math.round(file.size / 1024),
      type: file.type,
    });
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        trackEvent("photo_upload_error", { status: res.status });
        setError(data?.error ?? "Upload failed. Please try again.");
        return;
      }
      const data = (await res.json()) as { url: string };
      trackEvent("photo_upload_success");
      onChange(data.url);
    } catch {
      trackEvent("photo_upload_error", { status: 0 });
      setError("Network error. Check your connection and retry.");
    } finally {
      setUploading(false);
    }
  };

  // Compress before validating. iPhone cameras shoot 4-12 MB JPEGs that
  // would trip the 5 MB upload cap (and Netlify's 6 MB platform cap)
  // before the spotter ever sees a result. Downscaling to 1920px on
  // the long edge + JPEG q=0.85 brings even 48 MP shots down to
  // ~250-500 KB, so the upload almost always succeeds. Original is
  // returned untouched on any decoder failure (HEIC outside Safari,
  // corrupt input, etc.) and the existing server validation still
  // catches anything we shouldn't accept.
  const handlePicked = async (rawFile: File) => {
    setError(null);
    setUploading(true);
    let file = rawFile;
    try {
      const before = rawFile.size;
      file = await compressImageForUpload(rawFile);
      const after = file.size;
      if (after !== before) {
        trackEvent("photo_compress", {
          before_kb: Math.round(before / 1024),
          after_kb: Math.round(after / 1024),
          ratio: Math.round((after / before) * 100) / 100,
        });
      }
    } catch {
      // Compressor itself shouldn't throw (it returns the original on
      // failure) but belt + suspenders, fall through with raw file.
    }

    const check = validateImage(file, locale);
    if (!check.ok) {
      trackEvent("photo_upload_rejected_client", {
        type: file.type || "unknown",
        size_kb: Math.round(file.size / 1024),
      });
      setError(check.message);
      setUploading(false);
      return;
    }
    await upload(file);
  };

  const onCameraChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) await handlePicked(f);
    if (cameraRef.current) cameraRef.current.value = "";
  };
  const onGalleryChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) await handlePicked(f);
    if (galleryRef.current) galleryRef.current.value = "";
  };

  return (
    <div className="grid gap-3">
      {/* Hidden inputs, one preferring the camera, one preferring gallery */}
      <input
        ref={cameraRef}
        type="file"
        accept={IMAGE_ACCEPT}
        capture="environment"
        onChange={onCameraChange}
        className="sr-only"
        aria-hidden
        tabIndex={-1}
      />
      <input
        ref={galleryRef}
        type="file"
        accept={IMAGE_ACCEPT}
        onChange={onGalleryChange}
        className="sr-only"
        aria-hidden
        tabIndex={-1}
      />

      {value ? (
        layout === "stacked" ? (
          <div className="space-y-3">
            {/* Full-width hero preview */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Bhandara photo preview"
              className="w-full max-h-80 rounded-2xl object-contain border border-gold-500/50 shadow-warm bg-cream-50"
            />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 justify-between">
              <p className="text-sm text-ink-900 font-medium inline-flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-leaf-600 text-cream-50">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                {locale === "hi" ? "फ़ोटो जोड़ी गई" : "Photo added"}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    trackEvent("photo_picker_choose", { source: "change" });
                    galleryRef.current?.click();
                  }}
                  disabled={uploading}
                  className="btn btn-ghost btn-sm"
                >
                  {uploading ? t.picking : t.change}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    trackEvent("photo_picker_remove");
                    onChange("");
                  }}
                  disabled={uploading}
                  className="btn btn-soft btn-sm"
                >
                  ✕ {t.remove}
                </button>
              </div>
            </div>
            {error ? (
              <p className="text-xs text-alert-500">{error}</p>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[160px_1fr] items-start">
            {/* Preview */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Bhandara photo preview"
              // `object-contain` shows the full pamphlet/banner without
              // cropping; max-h keeps very tall posters from blowing out
              // the form.
              className="w-full sm:w-40 max-h-64 sm:max-h-48 rounded-2xl object-contain border border-gold-500/50 shadow-warm bg-cream-50"
            />
            <div className="flex flex-col gap-2">
              <p className="text-sm text-ink-900 font-medium">
                {locale === "hi" ? "फ़ोटो जोड़ी गई ✓" : "Photo added ✓"}
              </p>
              <p
                className="text-xs text-ink-600 font-mono"
                title={value}
              >
                {shortUrl(value)}
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    trackEvent("photo_picker_choose", { source: "change" });
                    galleryRef.current?.click();
                  }}
                  disabled={uploading}
                  className="btn btn-ghost btn-sm"
                >
                  {uploading ? t.picking : t.change}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    trackEvent("photo_picker_remove");
                    onChange("");
                  }}
                  disabled={uploading}
                  className="btn btn-soft btn-sm"
                >
                  ✕ {t.remove}
                </button>
              </div>
              {error ? (
                <p className="text-xs text-alert-500">{error}</p>
              ) : null}
            </div>
          </div>
        )
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-gold-500/50 bg-saffron-50/50 px-5 py-7 text-center">
          <p className="font-mukta uppercase tracking-[0.28em] text-gold-500 text-[0.65rem]">
            {t.chooseSource}
          </p>
          <p className="mt-2 text-sm text-ink-900 font-medium">{t.pick}</p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                trackEvent("photo_picker_choose", { source: "camera" });
                cameraRef.current?.click();
              }}
              disabled={uploading}
              className="btn btn-primary btn-sm"
              aria-label={
                locale === "hi" ? "कैमरे से फ़ोटो लें" : "Take a photo with camera"
              }
            >
              <IconCamera />
              {locale === "hi" ? "कैमरा" : "Camera"}
            </button>
            <button
              type="button"
              onClick={() => {
                trackEvent("photo_picker_choose", { source: "gallery" });
                galleryRef.current?.click();
              }}
              disabled={uploading}
              className="btn btn-ghost btn-sm"
              aria-label={
                locale === "hi"
                  ? "गैलरी से फ़ोटो चुनें"
                  : "Choose photo from gallery"
              }
            >
              <IconImage />
              {locale === "hi" ? "गैलरी" : "Gallery"}
            </button>
          </div>

          <p className="mt-3 text-xs text-ink-600">
            {uploading ? t.picking : t.helper}
          </p>
          {error ? (
            <p className="mt-2 text-xs text-alert-500">{error}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function IconCamera() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7h3l2-2h8l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
function IconImage() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="m3 18 5-5 4 4 3-3 6 6" />
    </svg>
  );
}
