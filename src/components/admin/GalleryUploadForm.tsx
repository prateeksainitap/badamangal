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
  /** Server action — typed loosely because Next's typing for
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

  return (
    <section className="mt-6 rounded-3xl border border-saffron-500/40 bg-cream-50 p-5 sm:p-6">
      <h2 className="font-fraunces text-xl text-sindoor-700">
        Add a photo to the gallery
      </h2>
      <p className="mt-1 text-sm text-ink-600">
        Pick an image, add an optional caption + credit, hit save.
        It'll appear in the homepage gallery within a few minutes
        (ISR revalidate window).
      </p>

      {/* Step 1: file upload */}
      <div className="mt-4">
        <label className="grid gap-1.5 text-sm">
          <span className="text-ink-600">Image file</span>
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="block w-full text-sm file:rounded-full file:border-0 file:bg-saffron-600 file:text-cream-50 file:px-4 file:py-2 file:font-semibold file:cursor-pointer hover:file:bg-saffron-500"
          />
        </label>
        {uploading ? (
          <p className="mt-2 text-xs text-ink-600 italic">Uploading…</p>
        ) : null}
        {error ? (
          <p className="mt-2 text-xs text-alert-500">Upload failed: {error}</p>
        ) : null}
        {uploadedUrl ? (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-leaf-600/40 bg-leaf-600/5 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={uploadedUrl}
              alt="uploaded preview"
              className="w-16 h-16 rounded-lg object-cover border border-gold-500/40"
            />
            <p className="text-xs text-leaf-600 font-medium">
              Uploaded! Fill in the details below and hit save.
            </p>
          </div>
        ) : null}
      </div>

      {/* Step 2: metadata + save (only enabled after upload) */}
      <form action={action} className="mt-4 grid gap-3">
        <input type="hidden" name="imageUrl" value={uploadedUrl ?? ""} />

        <label className="grid gap-1.5 text-sm">
          <span className="text-ink-600">Caption (optional)</span>
          <input
            name="caption"
            type="text"
            maxLength={140}
            placeholder="e.g. Hanuman Setu mandir, dawn ke time"
            className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600"
          />
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="text-ink-600">Caption in Hindi (optional)</span>
          <input
            name="captionHi"
            type="text"
            maxLength={140}
            placeholder="उदा. हनुमान सेतु मंदिर, सुबह की झलक"
            className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600"
          />
        </label>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="grid gap-1.5 text-sm">
            <span className="text-ink-600">Uploaded by (optional)</span>
            <input
              name="uploadedBy"
              type="text"
              maxLength={60}
              placeholder="Prateek"
              className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-ink-600">
              Display order (lower = surfaces earlier)
            </span>
            <input
              name="displayOrder"
              type="number"
              defaultValue="100"
              min="0"
              max="9999"
              className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={!uploadedUrl}
          className={`mt-2 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
            uploadedUrl
              ? "bg-saffron-600 text-cream-50 hover:bg-saffron-500 shadow-warm"
              : "bg-cream-50 text-ink-600 border border-gold-500/40 cursor-not-allowed opacity-60"
          }`}
        >
          {uploadedUrl ? "Save to gallery" : "Upload an image first"}
        </button>
      </form>
    </section>
  );
}
