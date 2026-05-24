"use client";

import { useState } from "react";

/**
 * Two-step upload form for /admin/gallery.
 *
 * Step 1 (client-side): file goes to /api/uploads (same endpoint the
 * spot flow + bhandara edit form use, so the 5 MB cap + WebP
 * re-encoding apply uniformly). Returns the resulting URL.
 *
 * Step 2 (server action): URL + optional caption / credit / display
 * order get POSTed to addGalleryPhotoAction (defined in
 * src/app/admin/actions.ts) which writes the GalleryPhoto row + flips
 * status to VISIBLE.
 *
 * Two-step instead of one because /api/uploads needs a multipart
 * FormData (the file blob), while the server action wants a clean
 * JSON-ish FormData (the URL + metadata). Keeping them separate
 * avoids the brittleness of trying to thread file bytes through a
 * Next server action.
 */
type Props = {
  /** Server action, typed loosely because Next's typing for
   *  bound server actions is awkward to express. */
  action: (formData: FormData) => Promise<void>;
};

export default function GalleryUploadForm({ action }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`upload_failed_${res.status}`);
      const data = (await res.json()) as { url?: string };
      if (!data.url) throw new Error("upload_no_url");
      setUploadedUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  // Shared field className — cyan-bordered dark inputs, mono text,
  // cyan focus ring. Drops in for every <input> in the form.
  const FIELD =
    "rounded-xl border border-cyan-400/20 bg-[#080A10]/70 backdrop-blur-sm px-3 py-2 text-cream-50 font-mono placeholder:text-cream-50/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/45 focus:border-cyan-400/55 transition-colors";
  const LABEL =
    "text-[10px] uppercase tracking-[0.18em] text-cyan-300/70 font-mono";

  return (
    <section className="mt-6 rounded-2xl border border-cyan-400/20 bg-[#0B0E16]/85 backdrop-blur-sm p-5 sm:p-6">
      <h2 className="font-fraunces text-xl text-cream-50">
        Add a photo to the{" "}
        <span className="bg-gradient-to-r from-cyan-300 to-violet-300 bg-clip-text text-transparent">
          gallery
        </span>
      </h2>
      <p className="mt-1 text-sm text-cream-50/55 font-mono">
        Pick an image, add an optional caption + credit, hit save. It'll
        appear in the homepage gallery within a few minutes (ISR
        revalidate window).
      </p>

      {/* Step 1: file upload */}
      <div className="mt-4">
        <label className="grid gap-1.5 text-sm">
          <span className={LABEL}>Image file</span>
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="block w-full text-sm text-cream-50/80 font-mono file:rounded-lg file:border file:border-cyan-300/40 file:bg-gradient-to-r file:from-cyan-500 file:to-violet-500 file:text-cream-50 file:px-4 file:py-2 file:font-semibold file:cursor-pointer hover:file:from-cyan-400 hover:file:to-violet-400 file:shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)]"
          />
        </label>
        {uploading ? (
          <p className="mt-2 text-xs text-cyan-300/85 font-mono">Uploading…</p>
        ) : null}
        {error ? (
          <p className="mt-2 text-xs text-sindoor-700 font-mono">
            Upload failed: {error}
          </p>
        ) : null}
        {uploadedUrl ? (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-leaf-400/40 bg-leaf-400/[0.08] p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={uploadedUrl}
              alt="uploaded preview"
              className="w-16 h-16 rounded-lg object-cover border border-cyan-400/30"
            />
            <p className="text-xs text-leaf-400 font-medium font-mono">
              Uploaded! Fill in the details below and hit save.
            </p>
          </div>
        ) : null}
      </div>

      {/* Step 2: metadata + save (only enabled after upload) */}
      <form action={action} className="mt-4 grid gap-3">
        <input type="hidden" name="imageUrl" value={uploadedUrl ?? ""} />

        <label className="grid gap-1.5 text-sm">
          <span className={LABEL}>Caption (optional)</span>
          <input
            name="caption"
            type="text"
            maxLength={140}
            placeholder="e.g. Hanuman Setu mandir, dawn ke time"
            className={FIELD}
          />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className={LABEL}>Caption in Hindi (optional)</span>
          <input
            name="captionHi"
            type="text"
            maxLength={140}
            placeholder="उदा. हनुमान सेतु मंदिर, सुबह की झलक"
            className={FIELD}
          />
        </label>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="grid gap-1.5 text-sm">
            <span className={LABEL}>Uploaded by (optional)</span>
            <input
              name="uploadedBy"
              type="text"
              maxLength={60}
              placeholder="Prateek"
              className={FIELD}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className={LABEL}>
              Display order (lower = surfaces earlier)
            </span>
            <input
              name="displayOrder"
              type="number"
              defaultValue="100"
              min="0"
              max="9999"
              className={FIELD}
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={!uploadedUrl}
          className={`mt-2 inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-mono font-semibold transition-all ${
            uploadedUrl
              ? "bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-cream-50 border border-cyan-300/40 shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)]"
              : "bg-[#0B0E16]/60 text-cream-50/35 border border-cyan-400/15 cursor-not-allowed"
          }`}
        >
          {uploadedUrl ? "Save to gallery →" : "Upload an image first"}
        </button>
      </form>
    </section>
  );
}
