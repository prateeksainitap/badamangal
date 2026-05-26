"use client";

import { useRef, useState } from "react";

/**
 * Controlled UPI-QR image uploader.
 *
 * Shared by every "Enable donations" surface, public BhandaraForm,
 * /admin/scan ScanReview, /admin/edit/[id], /admin/new, so the QR
 * affordance reads the same regardless of which flow the operator
 * came in through. Holds NO state of its own besides "is the
 * upload in flight"; parent owns the URL value and persists it
 * however that surface persists data (formData hidden input,
 * fetch payload, server action).
 *
 * Upload pipeline:
 *   POST FormData{file} → /api/uploads (already handles JPEG/PNG/WebP,
 *   sharp-normalises to WebP, ships to R2 / Supabase / local-dev).
 *   Endpoint returns { url } which we hand back via onChange.
 *
 * Why not a separate "QR" endpoint:
 *   /api/uploads already strips EXIF, normalises codec, caps
 *   dimensions, and supports the same auth-free public path the
 *   bhandara photo upload uses. A QR is just another small image;
 *   reusing the existing pipeline keeps storage + CDN paths
 *   uniform and avoids a second image-validation surface.
 *
 * Theme prop:
 *   • "admin"  → dark cyan-accented chrome (ScanReview / edit pages)
 *   • "public" → cream saffron-accented chrome (BhandaraForm)
 *   Picked at the call site so this component doesn't have to know
 *   which surface it's mounted on; styling stays consistent with
 *   the surrounding form.
 */

type Theme = "admin" | "public";

type Props = {
  /** Current QR image URL (or empty string for "no QR uploaded"). */
  value: string;
  /** Called with the new URL after a successful upload, or "" after
   *  the user removes the uploaded QR. */
  onChange: (next: string) => void;
  theme?: Theme;
  /** Optional id for the hidden name input the surrounding form may
   *  read on submit. When provided, a `<input type="hidden" name=...>`
   *  is rendered so plain HTML form submissions pick up the value
   *  without the parent needing extra wiring. */
  name?: string;
};

export default function UpiQrUpload({
  value,
  onChange,
  theme = "admin",
  name,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = theme === "admin";

  // Theme tokens. Two surfaces, identical structure, different
  // hues. The default is admin because that's where this lives most.
  const tokens = isAdmin
    ? {
        wrap: "rounded-xl border border-cyan-400/20 bg-[#080A10]/40 p-3",
        label: "text-[10px] uppercase tracking-[0.18em] text-cyan-300/70 font-mono",
        button:
          "inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-3 py-1.5 text-[12px] font-mono font-medium transition-colors disabled:opacity-50 disabled:cursor-wait",
        remove:
          "inline-flex items-center gap-1.5 rounded-lg bg-sindoor-700/15 border border-sindoor-700/40 text-sindoor-300 hover:bg-sindoor-700/25 hover:border-sindoor-700/60 hover:text-sindoor-200 px-3 py-1.5 text-[12px] font-mono font-medium transition-colors",
        helper: "text-[11px] text-cream-50/55 mt-1.5",
        errorText: "text-[11px] text-alert-300 mt-1.5",
        preview:
          "rounded-lg border border-cyan-400/25 bg-[#080A10]/60 p-1",
      }
    : {
        wrap: "rounded-xl border border-gold-500/40 bg-cream-50 p-3",
        label: "text-[11px] uppercase tracking-[0.16em] text-sindoor-700 font-semibold",
        button:
          "inline-flex items-center gap-1.5 rounded-full bg-saffron-50 border border-saffron-500/60 text-sindoor-700 hover:bg-saffron-100 px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-wait",
        remove:
          "inline-flex items-center gap-1.5 rounded-full bg-sindoor-50 border border-sindoor-300 text-sindoor-700 hover:bg-sindoor-100 px-4 py-2 text-sm font-medium transition-colors",
        helper: "text-xs text-ink-700/65 mt-1.5",
        errorText: "text-xs text-alert-500 mt-1.5",
        preview:
          "rounded-lg border border-gold-500/40 bg-cream-50 p-1",
      };

  async function handleFile(file: File): Promise<void> {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/uploads", {
        method: "POST",
        body: form,
      });
      // /api/uploads can return JSON or a plain error message; same
      // defensive pattern we use in ScanReview's Gemini scan path:
      // read as text, try JSON.parse, fall through to a human
      // message instead of crashing on a non-JSON proxy response.
      const raw = await res.text();
      let parsed: unknown = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        /* non-JSON response body */
      }
      if (!res.ok) {
        const errBody =
          parsed && typeof parsed === "object"
            ? (parsed as { error?: unknown })
            : null;
        setError(
          errBody && typeof errBody.error === "string"
            ? errBody.error
            : `Upload failed (HTTP ${res.status}). Try a smaller image.`,
        );
        return;
      }
      const url =
        parsed && typeof parsed === "object"
          ? (parsed as { url?: unknown }).url
          : undefined;
      if (typeof url !== "string" || url.length === 0) {
        setError("Upload returned no URL. Try again.");
        return;
      }
      onChange(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Network error during upload.",
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={tokens.wrap}>
      <div className={tokens.label}>UPI QR code (optional)</div>

      {value ? (
        // Uploaded: small preview + remove button.
        <div className="mt-2 flex items-start gap-3">
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className={`${tokens.preview} inline-block focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-600`}
            title="Open full QR image in a new tab"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="UPI QR code"
              className="h-20 w-20 object-contain rounded"
            />
          </a>
          <div className="flex-1 min-w-0 space-y-2">
            <p className={tokens.helper}>
              QR uploaded. Donors will see this on the bhandara&apos;s
              public page when they tap &quot;Sponsor this bhandara&quot;.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className={tokens.button}
              >
                {uploading ? "Uploading…" : "Replace QR"}
              </button>
              <button
                type="button"
                onClick={() => onChange("")}
                className={tokens.remove}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        // No QR yet: single upload button + helper copy.
        <div className="mt-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={tokens.button}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 14h7v7" />
              <path d="M14 17.5h3.5" />
            </svg>
            {uploading ? "Uploading…" : "Upload QR image"}
          </button>
          <p className={tokens.helper}>
            JPG / PNG / WebP, up to 5 MB. Useful if the organiser has a
            printed QR but doesn&apos;t know the UPI ID text. Either
            field works; both is fine too.
          </p>
        </div>
      )}

      {error ? <p className={tokens.errorText}>{error}</p> : null}

      {/* Hidden form-submission carrier, set only when the parent
          wants this component to participate in a plain HTML form
          submit (e.g. the /admin/edit/[id] server-action form). */}
      {name ? <input type="hidden" name={name} value={value} /> : null}

      {/* The actual file picker, kept hidden, triggered by the
          buttons above. accept narrows the system file picker to
          image types so the user can't accidentally pick a PDF. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
