"use client";

/**
 * Admin-only "swap the photo on this row" widget.
 *
 * Used on:
 *   • /admin/edit/[id]       (bhandara edit & publish)
 *   • /admin/edit-spot/[id]  (spot edit & approve)
 *
 * Both edit pages are plain server-rendered <form action={...}> with no
 * client state of their own — the inputs are read straight off
 * FormData in the server action. To keep that shape, this component
 * exposes a hidden <input name={...}> whose value is updated in React
 * state. So when the admin submits, the form action reads the latest
 * photoUrl (either the original DB value, or the newly-uploaded one)
 * with zero extra wiring.
 *
 * Workflow:
 *   1. Render the current photo (if any) as a preview.
 *   2. Admin clicks "Replace photo" or "Take photo" → file picker opens.
 *   3. We POST the picked file to /api/admin/upload-image.
 *   4. On success: swap the preview to the new URL, update the hidden
 *      input. The form's other fields stay untouched.
 *   5. On error: show an inline message, leave the existing photoUrl
 *      intact (admin can retry or just keep the old photo).
 *
 * Why a separate endpoint vs reusing /api/admin/scan: scan runs Gemini
 * + Ola Maps on every upload, which is wasted work + cost when the
 * admin is just swapping a photo on an already-extracted row.
 * /api/admin/upload-image skips that path entirely.
 */

import { useRef, useState } from "react";
import { trackEvent } from "@/lib/ga";

type UploadResponse = {
  ok?: boolean;
  photoUrl?: string;
  filename?: string;
  sizeBytes?: number;
  error?: string;
};

type Props = {
  /** Form field name — read by the server action via FormData. */
  name: string;
  /** Existing photo URL from the DB row (empty string if none). */
  defaultValue?: string;
  /** Optional label shown above the preview. Defaults to "Photo". */
  label?: string;
  /**
   * Optional hint shown beneath the preview. Use to call out anything
   * row-specific (eg. "Bot-ingested rows often need a sharper crop").
   */
  hint?: string;
};

type Status =
  | { kind: "idle" }
  | { kind: "uploading"; sizeKb: number }
  | { kind: "ok"; sizeKb: number }
  | { kind: "err"; message: string };

const MAX_INPUT_BYTES = 8 * 1024 * 1024; // mirrors the server cap

export default function AdminPhotoField({
  name,
  defaultValue = "",
  label = "Photo",
  hint,
}: Props) {
  const [photoUrl, setPhotoUrl] = useState<string>(defaultValue);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  async function uploadFile(file: File | null) {
    if (!file) return;
    // Client-side guard so the admin gets instant feedback on
    // oversize files instead of waiting for the round-trip + 413.
    if (file.size > MAX_INPUT_BYTES) {
      setStatus({
        kind: "err",
        message: `That image is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Max 8 MB. Try a smaller crop.`,
      });
      return;
    }
    if (!/^image\/(jpe?g|png|webp)$/i.test(file.type)) {
      setStatus({
        kind: "err",
        message: "Use a JPG, PNG, or WebP image.",
      });
      return;
    }

    const sizeKb = Math.round(file.size / 1024);
    setStatus({ kind: "uploading", sizeKb });
    trackEvent("admin_photo_upload_start", { size_kb: sizeKb });

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload-image", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as UploadResponse;
      if (!res.ok || !json.ok || !json.photoUrl) {
        const msg =
          json.error ??
          (res.status === 401
            ? "Session expired. Refresh the page and try again."
            : "Couldn't save that image. Try again.");
        setStatus({ kind: "err", message: msg });
        trackEvent("admin_photo_upload_error", {
          status: res.status,
          msg: msg.slice(0, 80),
        });
        return;
      }
      setPhotoUrl(json.photoUrl);
      setStatus({
        kind: "ok",
        sizeKb: json.sizeBytes ? Math.round(json.sizeBytes / 1024) : sizeKb,
      });
      trackEvent("admin_photo_upload_success", {
        size_kb_out: json.sizeBytes ? Math.round(json.sizeBytes / 1024) : 0,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setStatus({ kind: "err", message: msg });
      trackEvent("admin_photo_upload_error", { msg: msg.slice(0, 80) });
    }
  }

  const hasPhoto = photoUrl.trim().length > 0;
  const uploading = status.kind === "uploading";

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink-600">{label}</span>
        {status.kind === "ok" ? (
          <span className="text-xs text-leaf-600">
            ✓ New photo saved ({status.sizeKb} KB)
          </span>
        ) : null}
      </div>

      {/* Hidden field — this is what the server action reads. We keep
          it as a real <input name={name}> rather than building the
          FormData by hand so the page stays no-JS-friendly: if the
          admin never touches the photo, the original defaultValue
          flows through unchanged. */}
      <input type="hidden" name={name} value={photoUrl} readOnly />

      {/* Preview band. Same look as the standalone preview that lives
          above the form on /admin/edit/[id], so the visual hierarchy
          stays consistent: photo on top, fields below. Mirrors the
          existing "click image → open full size" affordance via a
          wrapping anchor. */}
      {hasPhoto ? (
        <a
          href={photoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-2xl border border-gold-500/40 overflow-hidden bg-cream-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-600"
          title="Open full image in a new tab"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt=""
            className="max-h-[360px] w-full object-contain"
          />
        </a>
      ) : (
        <div className="rounded-2xl border border-dashed border-gold-500/40 bg-cream-50 px-4 py-10 text-center text-sm text-ink-600">
          No photo yet. Use the buttons below to add one.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-4 py-2 text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <Spinner />
              Uploading…
            </>
          ) : hasPhoto ? (
            "Replace photo"
          ) : (
            "Upload photo"
          )}
        </button>
        {/* Camera-capture button is a second native input with
            capture="environment" so mobile admins can shoot straight
            from the phone without leaving the form. Desktop browsers
            just open the file picker, which is fine. */}
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/50 bg-white hover:bg-cream-50 text-ink-900 font-medium px-4 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Take photo
        </button>
        {hasPhoto && !uploading ? (
          <span className="text-xs text-ink-600 break-all">
            {shortenUrl(photoUrl)}
          </span>
        ) : null}
      </div>

      {hint ? <span className="text-xs text-ink-600">{hint}</span> : null}

      {status.kind === "err" ? (
        <p className="text-xs text-alert-500">{status.message}</p>
      ) : null}

      {/* The two hidden file inputs. Kept off-screen rather than
          display:none so iOS Safari reliably forwards the camera
          intent. Reset value="" via the onChange-then-clear pattern
          would normally go here, but we don't need it — re-picking
          the same filename still fires onChange because we never
          assign back to the input. */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          void uploadFile(f);
          // Reset so picking the same file twice re-triggers onChange.
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          void uploadFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/**
 * Trim a long Supabase URL down to "…/{filename}" so the field doesn't
 * blow out the layout on small screens. The full URL is still
 * available via the hidden input + the preview anchor's href.
 */
function shortenUrl(url: string): string {
  const slash = url.lastIndexOf("/");
  if (slash < 0 || slash === url.length - 1) return url;
  return `…/${url.slice(slash + 1)}`;
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 motion-safe:animate-spin rounded-full border-2 border-cream-50/40 border-t-cream-50"
    />
  );
}
