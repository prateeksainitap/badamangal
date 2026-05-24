"use client";

/**
 * Admin testing tool: upload one or more WhatsApp chat screenshots and
 * feed every extracted bubble into the BhandaraMention pipeline.
 *
 * Sits at the top of /admin/mentions as a collapsible panel. After
 * picking files the admin sees a per-file queue with thumbnails + size
 * (before/after compression). "Ingest now" walks the queue
 * sequentially, posting each file to /api/admin/ingest-screenshot and
 * surfacing the per-message result list inline. After every file
 * completes, the moderation queue below auto-refreshes
 * (router.refresh()) and the homepage's LiveChatterBoard picks up the
 * new APPROVED rows on its next 30s poll.
 *
 * ## Why client-side compression
 *
 * WhatsApp screenshots from iOS/Android are routinely 4-8 MB PNGs.
 * Server-side sharp re-encodes them to ~500 KB WebP anyway, so
 * compressing in the browser first:
 *   • cuts upload bandwidth by 8-15× (huge win for the admin on a
 *     mobile / hotel-wifi connection),
 *   • keeps the JSON payload well under Next.js's default 4.5 MB body
 *     limit even on multi-file runs,
 *   • lets us batch N files without ballooning client memory (each
 *     compressed blob is <1 MB before base64 encoding).
 *
 * ## Why sequential, not parallel processing
 *
 * Each ingest is heavy server-side: Gemini Vision + per-message
 * Gemini classifier + per-message geocode. Firing 10 in parallel
 * would trip the per-second Gemini quota and (in the bot path) the
 * /api/admin/ingest-screenshot rate limit. Sequential keeps each file
 * within its own request budget and gives the admin clean per-file
 * progress feedback.
 */
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { IconX } from "@/components/admin/AdminIcons";

/** Server-side response shape (per file). Mirrors the route handler's
 *  return; kept in sync by convention. */
type ProcessedMessage = {
  sender: string;
  text: string;
  status:
    | "created"
    | "skipped_unrelated"
    | "skipped_low_confidence"
    | "skipped_empty"
    | "error";
  intent?: string;
  confidence?: number;
  locationSource?: string;
  mentionId?: string;
  errorDetail?: string;
};
type IngestResp = {
  ok?: boolean;
  groupName?: string | null;
  runId?: string;
  summary?: string;
  processed?: ProcessedMessage[];
  homepageUrl?: string;
  adminQueueUrl?: string;
  error?: string;
  detail?: string;
};

/** Per-file state machine. The queue moves files through these states
 *  one at a time; the UI renders a status pill keyed off `status`. */
type FileItem = {
  id: string; // stable id for React keys (file objects don't have one)
  file: File;
  preview: string; // object URL for the thumbnail
  status:
    | "queued"
    | "compressing"
    | "uploading"
    | "done"
    | "error"
    | "skipped";
  originalBytes: number;
  compressedBytes?: number;
  response?: IngestResp;
  error?: string;
};

/** 8 MB pre-compression source limit — anything bigger gets rejected at
 *  selection. The server's MAX_IMAGE_BYTES is also 8 MB but it sees the
 *  COMPRESSED payload, so this client-side cap is on the raw file. */
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
/** Compression target. Long edge cap matches src/app/api/admin/ingest-screenshot/route.ts's
 *  sharp resize (2000px). Quality 0.82 / WebP gives ~5-8× shrinkage on
 *  typical PNG chat screenshots with no visible OCR degradation. */
const COMPRESS_MAX_DIM = 2000;
const COMPRESS_QUALITY = 0.82;
const COMPRESS_MIME = "image/webp";

export default function ScreenshotIngestPanel() {
  const [expanded, setExpanded] = useState<boolean>(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [groupOverride, setGroupOverride] = useState<string>("");
  const [running, setRunning] = useState<boolean>(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  // Release preview object URLs on unmount so we don't leak memory
  // across long sessions where the admin batches many uploads.
  useEffect(() => {
    return () => {
      files.forEach((f) => {
        try {
          URL.revokeObjectURL(f.preview);
        } catch {
          /* noop */
        }
      });
    };
    // We DELIBERATELY don't re-revoke on every state update; the
    // cleanup runs on unmount. Per-file revocation happens explicitly
    // when an item is removed from the queue (removeFile below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    setGlobalError(null);
    const picked = e.target.files ? Array.from(e.target.files) : [];
    if (picked.length === 0) return;

    const additions: FileItem[] = [];
    const oversize: string[] = [];
    for (const f of picked) {
      if (f.size > MAX_SOURCE_BYTES) {
        oversize.push(`${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)`);
        continue;
      }
      additions.push({
        id: `${f.name}-${f.size}-${f.lastModified}-${crypto.randomUUID().slice(0, 6)}`,
        file: f,
        preview: URL.createObjectURL(f),
        status: "queued",
        originalBytes: f.size,
      });
    }
    if (oversize.length > 0) {
      setGlobalError(
        `Skipped (over 8 MB): ${oversize.join(", ")}. Crop or downscale before retrying.`,
      );
    }
    setFiles((prev) => [...prev, ...additions]);
    // Reset the input so re-picking the SAME file re-fires onChange.
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(id: string) {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target) {
        try {
          URL.revokeObjectURL(target.preview);
        } catch {
          /* noop */
        }
      }
      return prev.filter((f) => f.id !== id);
    });
  }

  function clearAll() {
    files.forEach((f) => {
      try {
        URL.revokeObjectURL(f.preview);
      } catch {
        /* noop */
      }
    });
    setFiles([]);
    setGlobalError(null);
  }

  /** Per-file in-place state update. `setFiles` with a functional
   *  updater so concurrent updates from the same processing tick don't
   *  clobber each other (in practice we only update one at a time, but
   *  the pattern stays correct under React 18 strict-mode double-renders). */
  function updateFile(id: string, patch: Partial<FileItem>) {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (running) return;
    const queue = files.filter((f) => f.status === "queued" || f.status === "error");
    if (queue.length === 0) return;
    setRunning(true);
    setGlobalError(null);

    // Sequential processing (see panel doc: avoids Gemini quota /
    // rate-limit fan-out). Each iteration: compress → POST → mark done.
    for (const item of queue) {
      setActiveId(item.id);
      // Compress in the browser to a small WebP blob. Catches canvas /
      // image decode failures (corrupt files, unsupported formats) and
      // marks the file errored without aborting the whole queue.
      updateFile(item.id, { status: "compressing" });
      let compressed: { base64: string; mime: string; bytes: number };
      try {
        compressed = await compressImage(item.file, {
          maxDim: COMPRESS_MAX_DIM,
          quality: COMPRESS_QUALITY,
          mime: COMPRESS_MIME,
        });
      } catch (err) {
        updateFile(item.id, {
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
      updateFile(item.id, {
        status: "uploading",
        compressedBytes: compressed.bytes,
      });

      try {
        const res = await fetch("/api/admin/ingest-screenshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photoBase64: compressed.base64,
            mime: compressed.mime,
            groupNameOverride: groupOverride.trim() || undefined,
          }),
        });
        const data = (await res.json()) as IngestResp;
        if (!res.ok || !data.ok) {
          updateFile(item.id, {
            status: "error",
            error: data.detail ?? data.error ?? `HTTP ${res.status}`,
          });
          continue;
        }
        updateFile(item.id, { status: "done", response: data });
      } catch (err) {
        updateFile(item.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Network error",
        });
      }
    }

    setActiveId(null);
    setRunning(false);
    // Refresh the SSR-rendered moderation queue underneath. The
    // homepage's LiveChatterBoard polls on its own (30s), no kick
    // needed.
    router.refresh();
  }

  const totalQueued = files.filter((f) => f.status === "queued").length;
  const totalDone = files.filter((f) => f.status === "done").length;
  const totalErrored = files.filter((f) => f.status === "error").length;
  const totalCreated = files
    .flatMap((f) => f.response?.processed ?? [])
    .filter((p) => p.status === "created").length;

  return (
    <section className="mt-6 rounded-2xl border border-saffron-500/30 bg-saffron-500/[0.06]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left"
        aria-expanded={expanded}
      >
        <span className="font-medium text-cream-50 text-sm">
          🧪 Test by screenshots — extract mentions from WhatsApp chat
          images (batch upload supported)
        </span>
        <span className="text-xs text-cream-50/65">
          {expanded ? "Hide" : "Expand"}
        </span>
      </button>
      {expanded ? (
        <div className="px-4 pb-4 grid gap-4 border-t border-saffron-600/20 pt-4">
          <p className="text-xs text-cream-50/65">
            Useful for validating the WhatsApp ingest pipeline without
            waiting for the OpenClaw agent. Pick one or more chat
            screenshots — they&apos;ll be auto-compressed in your
            browser (WebP, max 2000px long edge), then processed{" "}
            <strong>one at a time</strong> so the per-file Gemini
            extract + classifier round-trip stays inside its rate
            limit. Every extracted bubble is classified and inserted
            as an <strong>APPROVED</strong> BhandaraMention so the
            homepage heatmap updates immediately. Reject individual
            rows below if needed.
          </p>

          <form onSubmit={onSubmit} className="grid gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="grid gap-1.5 flex-shrink-0">
                <span className="text-sm text-cream-50/65">
                  Add screenshots (PNG / JPG / WebP, max 8 MB each)
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  onChange={onFileChange}
                  disabled={running}
                  className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-cyan-500 file:text-cream-50 file:px-3 file:py-1.5 file:cursor-pointer disabled:opacity-50"
                />
              </label>
              {files.length > 0 ? (
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={running}
                  className="text-xs rounded-full px-3 py-1 border border-cyan-400/25 text-cream-50 hover:bg-cyan-400/[0.08] disabled:opacity-50"
                >
                  Clear all
                </button>
              ) : null}
              <span className="text-xs text-cream-50/65">
                {files.length === 0
                  ? "No files selected"
                  : `${files.length} file${files.length === 1 ? "" : "s"} · ${totalQueued} queued · ${totalDone} done · ${totalErrored} errored`}
              </span>
            </div>

            {/* Per-file queue. Renders thumbnails + status pills +
                per-file size + (after run) result summary. Each file
                also has a remove (✕) button when the queue isn't
                actively running. */}
            {files.length > 0 ? (
              <ul className="grid gap-2 max-h-[28rem] overflow-y-auto pr-1">
                {files.map((f) => (
                  <FileRow
                    key={f.id}
                    item={f}
                    active={activeId === f.id}
                    canRemove={!running}
                    onRemove={() => removeFile(f.id)}
                  />
                ))}
              </ul>
            ) : null}

            <label className="grid gap-1.5">
              <span className="text-sm text-cream-50/65">
                Group name override{" "}
                <span className="text-cream-50/50">
                  (optional — applies to every file in this batch)
                </span>
              </span>
              <input
                type="text"
                value={groupOverride}
                onChange={(e) => setGroupOverride(e.target.value)}
                placeholder="Leave blank to let Gemini read it from each screenshot's header"
                maxLength={80}
                disabled={running}
                className="rounded-xl border border-cyan-400/20 bg-[#080A10]/70 backdrop-blur-sm px-3 py-2 text-sm text-cream-50 placeholder:text-cream-50/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/45 focus:border-cyan-400/55 transition-colors text-sm disabled:opacity-50"
              />
            </label>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="submit"
                disabled={
                  running ||
                  files.filter(
                    (f) => f.status === "queued" || f.status === "error",
                  ).length === 0
                }
                className="rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 border border-cyan-300/40 shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)] text-cream-50 font-medium px-5 py-2 text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {running ? (
                  <>
                    <Spinner />
                    Processing batch…
                  </>
                ) : (
                  `Ingest ${files.filter((f) => f.status === "queued" || f.status === "error").length || ""} now`
                )}
              </button>
              <span className="text-xs text-cream-50/65">
                Gemini Vision + classifier × N bubbles, per file. About
                5-15s per screenshot.
              </span>
              {totalDone > 0 ? (
                <span className="text-xs text-leaf-700 ml-auto">
                  Batch summary: <strong>{totalCreated}</strong> mention
                  {totalCreated === 1 ? "" : "s"} created across{" "}
                  <strong>{totalDone}</strong> file
                  {totalDone === 1 ? "" : "s"}.{" "}
                  <a
                    href="/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-dotted underline-offset-4 text-saffron-600"
                  >
                    Open homepage ↗
                  </a>
                </span>
              ) : null}
            </div>
          </form>

          {globalError ? (
            <div className="rounded-xl border border-alert-500/40 bg-alert-50 p-3 text-sm text-alert-700">
              {globalError}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function FileRow({
  item,
  active,
  canRemove,
  onRemove,
}: {
  item: FileItem;
  active: boolean;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const ratio =
    item.compressedBytes && item.originalBytes
      ? item.originalBytes / item.compressedBytes
      : null;
  return (
    <li
      className={`rounded-xl border bg-[#0B0E16]/70 backdrop-blur-sm grid gap-2 p-2 ${
        active
          ? "border-saffron-600 shadow-sm"
          : item.status === "error"
            ? "border-alert-500/40"
            : "border-cyan-400/15"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.preview}
          alt=""
          className="w-14 h-14 object-cover rounded border border-cyan-400/15 flex-shrink-0"
        />
        <div className="grid gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={item.status} />
            <span className="text-xs text-cream-50 truncate font-mono">
              {item.file.name}
            </span>
          </div>
          <div className="text-xs text-cream-50/65 flex gap-3 flex-wrap">
            <span>{formatBytes(item.originalBytes)} original</span>
            {typeof item.compressedBytes === "number" ? (
              <span>
                → {formatBytes(item.compressedBytes)} compressed
                {ratio ? ` (${ratio.toFixed(1)}× smaller)` : ""}
              </span>
            ) : null}
          </div>
          {item.error ? (
            <p className="text-xs text-alert-700">{item.error}</p>
          ) : null}
          {item.response ? <FileResultSummary resp={item.response} /> : null}
        </div>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${item.file.name}`}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-cream-50/65 hover:text-alert-500 hover:bg-alert-500/[0.10] leading-none flex-shrink-0 transition-colors"
            title="Remove from queue"
          >
            <IconX size={14} />
          </button>
        ) : null}
      </div>
    </li>
  );
}

function FileResultSummary({ resp }: { resp: IngestResp }) {
  const processed = resp.processed ?? [];
  const counts = processed.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});
  const [expanded, setExpanded] = useState<boolean>(false);
  return (
    <div className="grid gap-1.5 mt-1">
      <div className="text-xs text-cream-50 flex flex-wrap items-center gap-2">
        <strong className="text-cream-50">{resp.summary}</strong>
        {resp.groupName ? (
          <span className="px-1.5 py-0.5 rounded-full bg-cyan-400/[0.08] text-cyan-200 border border-cyan-400/20 text-[10px]">
            {resp.groupName}
          </span>
        ) : null}
        {resp.runId ? (
          <span className="px-1.5 py-0.5 rounded-full bg-cyan-400/[0.08] text-cyan-200 border border-cyan-400/20 text-[10px] font-mono">
            {resp.runId}
          </span>
        ) : null}
        {Object.entries(counts).map(([k, v]) => (
          <span key={k} className="text-cream-50/65">
            <strong className="text-cream-50">{v}</strong>{" "}
            {k.replace(/_/g, " ")}
          </span>
        ))}
        {processed.length > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-saffron-600 hover:text-saffron-700 underline decoration-dotted underline-offset-4 text-xs ml-auto"
          >
            {expanded ? "hide details" : "show details"}
          </button>
        ) : null}
      </div>
      {expanded ? (
        <ul className="grid gap-1.5 max-h-[20rem] overflow-y-auto rounded-lg border border-cyan-400/10 bg-[#080A10]/50 p-2">
          {processed.map((p, i) => (
            <li key={i} className="text-[11px] grid gap-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <MsgStatusBadge status={p.status} />
                {p.intent ? (
                  <span className="text-cream-50/65">
                    {p.intent}
                    {typeof p.confidence === "number"
                      ? ` (${p.confidence.toFixed(2)})`
                      : ""}
                  </span>
                ) : null}
                {p.locationSource && p.locationSource !== "none" ? (
                  <span className="text-leaf-700">
                    📍 {p.locationSource.replace(/_/g, " ")}
                  </span>
                ) : null}
                {p.sender ? (
                  <span className="text-cream-50/65">— {p.sender}</span>
                ) : null}
              </div>
              <p className="text-cream-50 whitespace-pre-wrap break-words">
                {p.text || <em className="text-cream-50/65">(empty)</em>}
              </p>
              {p.errorDetail ? (
                <p className="text-alert-700">{p.errorDetail}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: FileItem["status"] }) {
  const meta = ((): { label: string; cls: string } => {
    switch (status) {
      case "queued":
        return {
          label: "queued",
          cls: "bg-ink-100 text-cream-50/75 border-ink-300",
        };
      case "compressing":
        return {
          label: "compressing",
          cls: "bg-saffron-500/[0.14] text-saffron-300 border-saffron-500/35",
        };
      case "uploading":
        return {
          label: "uploading",
          cls: "bg-saffron-500/[0.14] text-saffron-300 border-saffron-500/35",
        };
      case "done":
        return {
          label: "done",
          cls: "bg-leaf-400/[0.14] text-leaf-300 border-leaf-400/35",
        };
      case "error":
        return {
          label: "error",
          cls: "bg-alert-100 text-alert-700 border-alert-300",
        };
      case "skipped":
        return {
          label: "skipped",
          cls: "bg-ink-100 text-cream-50/75 border-ink-300",
        };
    }
  })();
  return (
    <span
      className={`px-2 py-0.5 rounded-full border ${meta.cls} text-[10px] font-medium`}
    >
      {meta.label}
    </span>
  );
}

function MsgStatusBadge({ status }: { status: ProcessedMessage["status"] }) {
  const meta = ((): { label: string; cls: string } => {
    switch (status) {
      case "created":
        return {
          label: "created",
          cls: "bg-leaf-400/[0.14] text-leaf-300 border-leaf-400/35",
        };
      case "skipped_unrelated":
        return {
          label: "unrelated",
          cls: "bg-ink-100 text-cream-50/75 border-ink-300",
        };
      case "skipped_low_confidence":
        return {
          label: "low conf",
          cls: "bg-saffron-500/[0.14] text-saffron-300 border-saffron-500/35",
        };
      case "skipped_empty":
        return {
          label: "empty",
          cls: "bg-ink-100 text-cream-50/75 border-ink-300",
        };
      case "error":
        return {
          label: "error",
          cls: "bg-alert-100 text-alert-700 border-alert-300",
        };
    }
  })();
  return (
    <span
      className={`px-1.5 py-0.5 rounded-full border ${meta.cls} text-[10px] font-medium`}
    >
      {meta.label}
    </span>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 motion-safe:animate-spin rounded-full border-2 border-cream-50/40 border-t-cream-50"
    />
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

// ────────────────────────────────────────────────────────────────────
// Compression helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Compress a File to a smaller image blob in the browser. Resizes so
 * the long edge fits within `maxDim`, re-encodes as `mime` with the
 * given quality, and returns the base64-encoded body + final size.
 *
 * Uses createImageBitmap when available (faster than the HTMLImageElement
 * fallback, doesn't keep the bitmap in DOM memory) and falls back to
 * Image() for older Safari.
 *
 * Throws on corrupt files, unsupported formats, or canvas toBlob
 * failures — the caller marks the file `error` and moves on without
 * killing the whole queue.
 */
async function compressImage(
  file: File,
  opts: { maxDim: number; quality: number; mime: string },
): Promise<{ base64: string; mime: string; bytes: number }> {
  const bitmap = await loadBitmap(file);
  const longEdge = Math.max(bitmap.width, bitmap.height);
  const scale = longEdge > opts.maxDim ? opts.maxDim / longEdge : 1;
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  // ImageBitmap has a `.close()` method to free its GPU-side resources
  // immediately; HTMLImageElement doesn't (the browser GCs it
  // naturally). The narrow + manual check below releases the bitmap
  // ASAP on the createImageBitmap path without breaking the fallback.
  const isBitmap = typeof ImageBitmap !== "undefined" && bitmap instanceof ImageBitmap;
  if (!ctx) {
    if (isBitmap) (bitmap as ImageBitmap).close();
    throw new Error("canvas 2D context unavailable");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  if (isBitmap) (bitmap as ImageBitmap).close();

  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, opts.mime, opts.quality),
  );
  if (!blob) {
    // toBlob can return null for very large canvases / OOM. Surface
    // clearly so the admin knows to crop or downscale first.
    throw new Error(
      "Browser couldn't encode the compressed image (file may be too large to process client-side).",
    );
  }

  const base64 = await blobToBase64(blob);
  return { base64, mime: blob.type || opts.mime, bytes: blob.size };
}

/** Decode a File into a drawable bitmap. Prefers createImageBitmap
 *  (handles EXIF orientation automatically since recent browsers,
 *  faster on large PNGs) and falls back to HTMLImageElement otherwise. */
async function loadBitmap(
  file: File,
): Promise<HTMLImageElement | ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
    } catch {
      // Some Safari builds don't honour imageOrientation; fall through
      // to the HTMLImageElement path which honours EXIF natively.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new Error("Browser couldn't decode this image"));
      img.src = url;
    });
  } finally {
    // Best-effort revoke; the image keeps its decoded bitmap in memory
    // independently of the URL once onload fires.
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* noop */
    }
  }
}

/** Read a Blob as base64 (no data: prefix). Uses FileReader so we
 *  don't have to manually concatenate a 4 MB Uint8Array on the main
 *  thread for every file. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result;
      if (typeof url !== "string") {
        reject(new Error("FileReader returned non-string"));
        return;
      }
      const commaIdx = url.indexOf(",");
      if (commaIdx < 0) {
        reject(new Error("Malformed data URL"));
        return;
      }
      resolve(url.slice(commaIdx + 1));
    };
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}
