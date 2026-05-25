"use client";

/**
 * Admin "scan & review" widget. Three states:
 *
 *   1. idle     , user picks a kind (bhandara / spot) and a file
 *   2. scanning , POST /api/admin/scan, await Gemini + Ola response
 *   3. review   , render an editable form pre-filled with what we got
 *                  back; Publish hits /api/admin/publish?kind=…
 *
 * The form intentionally trusts the admin to fix anything the model
 * got wrong, phone, time, area, coords. That review-and-edit gate is
 * the safety net for the two failure modes we've already seen:
 *   - geocoder picking a different venue with the same name
 *     (e.g. LU New Campus vs Main Campus)
 *   - vision model fumbling organizer phone when the banner has
 *     several printed numbers
 */
import { useMemo, useRef, useState } from "react";
import SeasonDatePicker from "@/components/SeasonDatePicker";
import MapPasteResolver from "@/components/admin/MapPasteResolver";
import PhoneInput from "@/components/PhoneInput";
import UpiQrUpload from "@/components/UpiQrUpload";
import AdminListbox from "@/components/admin/AdminListbox";
import { trackEvent } from "@/lib/ga";
import { IconCheck } from "@/components/admin/AdminIcons";

// ── Client-side image compression ────────────────────────────────────
//
// Why pre-compress on the client?
//   1. Phone photos straight out of the camera are 4-12 MB. Sending all
//      that over a flaky 4G uplink at a bhandara is painful, even with
//      Netlify's 6 MB body cap we'd reject the upload mid-flight.
//   2. The server already re-encodes via sharp, but doing it twice
//      doesn't hurt and saves an upload round-trip. The server pass
//      stays as the trust boundary (EXIF strip, magic-byte check).
//
// 1600 px / JPEG q=0.85 is the sweet spot, Claude can still read
// Devanagari banner text crisply, and the file lands ~150-400 KB.
const MAX_LONG_EDGE = 1600;
const JPEG_QUALITY = 0.85;
// Below this, skip the canvas round-trip, the file is already small.
const SKIP_COMPRESSION_BELOW = 600 * 1024;

async function compressToJpeg(file: File): Promise<File> {
  if (file.size <= SKIP_COMPRESSION_BELOW) return file;

  // Load into a bitmap. createImageBitmap honours EXIF orientation in
  // modern browsers (Chrome/Safari/Firefox all OK from ~2020), so we
  // don't end up with a sideways photo when re-encoding.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const ratio = Math.min(
    1,
    MAX_LONG_EDGE / Math.max(bitmap.width, bitmap.height),
  );
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return file; // graceful fallback, server-side sharp pass still runs
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) return file;

  // Rename so the server's content-type sniff stays accurate.
  const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

type MenuItem = { en: string; hi: string };

type Props = {
  areas: string[];
  menuItems: MenuItem[];
  tuesdays: string[];
  saturdays: string[];
  /** When set, the component skips the upload/scan UI and opens the
   *  review form pre-populated with empty fields for the given kind.
   *  Used by /admin/new where the operator types details from scratch
   *  (organizer phoned in, news article spotted, seed data, etc.) —
   *  same publish endpoint, no Gemini in the loop. The kind toggle
   *  at the top still lets them flip between bhandara/spot inside
   *  the form. */
  initialBlank?: Kind;
};

type Kind = "bhandara" | "spot";

type ScanResponse =
  | {
      kind: "bhandara";
      photoUrl: string;
      extracted: {
        name?: string;
        nameHi?: string;
        description?: string;
        descriptionHi?: string;
        area?: string;
        address?: string;
        addressHi?: string;
        landmark?: string;
        dateIsoList?: string[];
        timeStart?: string;
        timeEnd?: string;
        menu?: string[];
        menuOther?: string[];
        organizerName?: string;
        organizerPhone?: string;
        notes?: string;
      };
      geocode: { lat: number; lng: number; matched: string; source: string } | null;
    }
  | {
      kind: "spot";
      photoUrl: string;
      extracted: {
        caption?: string;
        captionHi?: string;
        area?: string;
        address?: string;
        language?: "hi" | "en" | "mixed";
        notes?: string;
      };
      geocode: { lat: number; lng: number; matched: string; source: string } | null;
    };

/** Build an empty ScanResponse so the review form can render with
 *  blank values when the admin chose "Add manually" instead of
 *  uploading a poster. Same shape Gemini would return after a scan,
 *  just with nothing filled in. */
function emptyScan(kind: Kind): ScanResponse {
  return kind === "bhandara"
    ? {
        kind: "bhandara",
        photoUrl: "",
        extracted: {},
        geocode: null,
      }
    : {
        kind: "spot",
        photoUrl: "",
        extracted: {},
        geocode: null,
      };
}

export default function ScanReview({
  areas,
  menuItems,
  tuesdays,
  saturdays,
  initialBlank,
}: Props) {
  const [kind, setKind] = useState<Kind>(initialBlank ?? "bhandara");
  const [file, setFile] = useState<File | null>(null);
  /** Captured before client-side compression so we can show the savings. */
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [compressing, setCompressing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  // When `initialBlank` is set, jump straight to the review form with
  // an empty payload. Otherwise we start in idle (upload/scan flow).
  const [phase, setPhase] = useState<"idle" | "scanning" | "review" | "publishing" | "done">(
    initialBlank ? "review" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  // Raw server-side detail (e.g. "GEMINI_API_KEY is not set", a
  // model error, or a network message). Hidden behind a small "show
  // detail" toggle so the friendly message stays primary but the
  // admin can dig in when something looks weird.
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [scan, setScan] = useState<ScanResponse | null>(
    initialBlank ? emptyScan(initialBlank) : null,
  );
  const [publishResult, setPublishResult] = useState<{
    slug?: string;
    id?: string;
  } | null>(null);

  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  function reset() {
    setFile(null);
    setOriginalSize(null);
    setScan(null);
    setError(null);
    setPublishResult(null);
    setPhase("idle");
    if (fileInput.current) fileInput.current.value = "";
    if (cameraInput.current) cameraInput.current.value = "";
  }

  /** Single ingress for both file-picker and camera. Compresses
   *  client-side so the admin never uploads a 10 MB phone photo. */
  async function handleIncomingFile(f: File | null) {
    if (!f) return;
    setError(null);
    if (!/^image\/(jpe?g|png|webp)$/i.test(f.type)) {
      setError("Use a JPG, PNG, or WebP image.");
      return;
    }
    setCompressing(true);
    setOriginalSize(f.size);
    try {
      const compressed = await compressToJpeg(f);
      setFile(compressed);
    } catch (err) {
      console.warn("client-side compression failed", err);
      // Soft-fail: send the raw file and let the server sharp pass
      // handle re-encoding. Better UX than blocking the upload.
      setFile(f);
    } finally {
      setCompressing(false);
    }
  }

  async function handleScan() {
    if (!file) return;
    setPhase("scanning");
    setError(null);
    setErrorDetail(null);
    setShowDetail(false);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/admin/scan?kind=${kind}`, {
        method: "POST",
        body: form,
      });

      // Defensive parse. When the upstream Gemini call exceeds the
      // function's maxDuration, Vercel returns a 504 with an HTML
      // error page ("An error occurred with your deployment"). We
      // used to call `res.json()` directly here, which threw
      // SyntaxError("Unexpected token 'A', \"An error o\"... is not
      // valid JSON") and surfaced that cryptic message to the
      // operator. Now we read the response body once as text, try to
      // JSON-parse it (so the success path stays unchanged), and
      // fall through to a status-aware human message if parsing
      // fails or the response body isn't JSON.
      const raw = await res.text();
      let parsed: unknown = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        /* non-JSON body (Vercel HTML error page, network proxy, etc.) */
      }
      const errBody =
        parsed && typeof parsed === "object"
          ? (parsed as { error?: unknown; detail?: unknown })
          : null;

      if (!res.ok) {
        const friendly =
          res.status === 504
            ? "Scan timed out. Gemini took longer than 60 seconds — usually a busy moment on Google's side. Click 'Scan with Gemini' again; the upload is already saved."
            : res.status === 502
              ? "Gemini failed to read this image. Try a sharper or higher-resolution upload, or scan again — the upload is already saved."
              : res.status === 429
                ? "Too many scans in a short window. Wait a minute and try again."
                : res.status === 401
                  ? "Session expired. Refresh the page and log in again."
                  : `Scan failed (HTTP ${res.status}). Try again — the upload is already saved.`;
        const errMsg =
          errBody && typeof errBody.error === "string"
            ? errBody.error
            : friendly;
        setError(errMsg);
        if (
          errBody &&
          typeof errBody.detail === "string" &&
          errBody.detail.length > 0
        ) {
          setErrorDetail(errBody.detail);
        }
        setPhase("idle");
        return;
      }

      // Happy path: we expect a JSON ScanResponse. If parse failed
      // on a 200 (shouldn't happen but defensive), treat it as an
      // unknown error rather than crashing the component.
      if (!parsed) {
        setError("Got an empty response from the scan endpoint. Try again.");
        setPhase("idle");
        return;
      }
      setScan(parsed as ScanResponse);
      setPhase("review");
    } catch (err) {
      // Network-level failure (offline, DNS, CORS). Distinct from
      // an HTTP-error response; surface that distinction so the
      // operator knows whether to retry or check connectivity.
      const networkMsg =
        err instanceof Error
          ? err.message.toLowerCase().includes("fetch")
            ? "Network error. Check your connection and try again."
            : err.message
          : "Unknown scan error.";
      setError(networkMsg);
      setPhase("idle");
    }
  }

  return (
    <div className="mt-6">
      {/* ── Kind toggle ───────────────────────────────────────── */}
      <div className="inline-flex rounded-full bg-[#0B0E16]/85 border border-cyan-400/20 p-1 font-mono">
        {(["bhandara", "spot"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k);
              // In manual-create mode, "reset" means "blank form of
              // the newly-chosen kind", not "back to upload". In
              // scan mode it's the normal reset to idle.
              if (initialBlank) {
                setFile(null);
                setOriginalSize(null);
                setError(null);
                setPublishResult(null);
                setScan(emptyScan(k));
                setPhase("review");
              } else {
                reset();
              }
            }}
            className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
              kind === k
                ? "bg-gradient-to-r from-cyan-500 to-violet-500 text-cream-50 shadow-[0_4px_14px_-4px_rgba(34,211,238,0.5)]"
                : "text-cream-50/65 hover:text-cream-50 hover:bg-cyan-400/[0.06]"
            }`}
          >
            {k === "bhandara" ? "Listed bhandara" : "Live spot"}
          </button>
        ))}
      </div>

      {/* ── Upload card ───────────────────────────────────────── */}
      {/* In manual-create mode the upload UI is suppressed entirely —
          the form below opens with empty fields and the operator
          types everything. */}
      {!initialBlank && (phase === "idle" || phase === "scanning") ? (
        <div className="mt-4 rounded-2xl border border-dashed border-cyan-400/35 bg-cyan-400/[0.02] p-6 sm:p-8">
          <p className="text-sm text-cream-50/65 font-mono">
            {kind === "bhandara"
              ? "Upload a WhatsApp invite, or snap one with the camera."
              : "Snap a photo of the live bhandara, or upload one from the gallery."}
          </p>

          {/* Hidden inputs, the visible buttons trigger them. We keep
              them separate so the camera one carries the `capture` hint,
              which on mobile pops the rear camera straight away instead
              of the gallery. Desktop browsers ignore `capture` and fall
              through to a normal file picker, which is fine. */}
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => handleIncomingFile(e.target.files?.[0] ?? null)}
          />
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => handleIncomingFile(e.target.files?.[0] ?? null)}
          />

          {/* CTA hierarchy:
              • Before a file is picked: Choose file is the cyan→violet
                primary; Take photo is the muted secondary.
              • Once a file is picked: both upload buttons demote to
                outline-secondary (so they don't compete with the real
                primary action), and Scan with Gemini takes over as the
                cyan→violet primary. Single primary at every step. */}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={compressing || phase === "scanning"}
              className={
                file
                  ? "inline-flex items-center gap-2 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 disabled:opacity-60 font-mono font-semibold px-4 py-2 text-sm transition-colors"
                  : "inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 disabled:opacity-60 text-cream-50 font-mono font-semibold border border-cyan-300/40 px-4 py-2 text-sm shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)] transition-colors"
              }
            >
              <IconUpload />
              {file ? "Replace file" : "Choose file"}
            </button>
            <button
              type="button"
              onClick={() => cameraInput.current?.click()}
              disabled={compressing || phase === "scanning"}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 disabled:opacity-60 font-mono font-semibold px-4 py-2 text-sm transition-colors"
            >
              <IconCamera />
              Take photo
            </button>
            {compressing ? (
              <span className="inline-flex items-center gap-2 text-sm text-cream-50/65 font-mono">
                <Spinner dark />
                Compressing image…
              </span>
            ) : null}
          </div>

          {previewUrl && file ? (
            <div className="mt-5 flex items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="preview"
                className="h-32 w-32 object-cover rounded-xl border border-cyan-400/25"
              />
              <div className="flex-1 text-sm text-cream-50/80">
                <p className="font-medium text-cream-50 break-all">{file.name}</p>
                <p className="text-xs text-cream-50/55 mt-0.5 font-numerals tabular-nums">
                  {/* Show "5.4 MB → 380 KB · 93% smaller" so the admin
                      sees the bandwidth win that compression bought. */}
                  {originalSize && originalSize !== file.size ? (
                    <>
                      <span className="line-through opacity-60">
                        {formatBytes(originalSize)}
                      </span>
                      {" → "}
                      <span className="font-semibold text-leaf-300">
                        {formatBytes(file.size)}
                      </span>
                      <span className="ml-1 text-leaf-300/80">
                        ({Math.round(
                          ((originalSize - file.size) / originalSize) * 100,
                        )}
                        % smaller)
                      </span>
                    </>
                  ) : (
                    formatBytes(file.size)
                  )}
                </p>
                <button
                  type="button"
                  disabled={phase === "scanning" || compressing}
                  onClick={handleScan}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 disabled:opacity-60 text-cream-50 font-semibold border border-cyan-300/40 px-5 py-2 text-sm shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)] transition-colors"
                >
                  {phase === "scanning" ? (
                    <>
                      <Spinner />
                      Reading the invite…
                    </>
                  ) : (
                    <>
                      <span aria-hidden>✨</span>
                      <span>Scan with Gemini</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mt-4">
              <p className="text-sm text-alert-500">{error}</p>
              {errorDetail ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowDetail((v) => !v)}
                    className="mt-1 text-[11px] uppercase tracking-[0.18em] text-cream-50/65 hover:text-cyan-200"
                  >
                    {showDetail ? "hide detail" : "show detail"}
                  </button>
                  {showDetail ? (
                    <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-cyan-400/15 bg-[#080A10]/70 p-2 text-[11px] leading-snug text-cream-50/75 whitespace-pre-wrap break-words">
                      {errorDetail}
                    </pre>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── Review form ───────────────────────────────────────── */}
      {/* Keep the form mounted during "publishing" too so the in-flight
          spinner has somewhere to render, narrowing the guard to
          "review" only would unmount before the response lands. */}
      {(phase === "review" || phase === "publishing") && scan ? (
        scan.kind === "bhandara" ? (
          <BhandaraReviewForm
            scan={scan}
            areas={areas}
            menuItems={menuItems}
            tuesdays={tuesdays}
            saturdays={saturdays}
            onPublish={async (payload) => {
              setPhase("publishing");
              setError(null);
              try {
                const res = await fetch("/api/admin/publish?kind=bhandara", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify(payload),
                });
                const data = await res.json();
                if (!res.ok) {
                  setError(
                    data?.error
                      ? `${data.error}${
                          data?.issues
                            ? ` · ${JSON.stringify(data.issues.fieldErrors)}`
                            : ""
                        }`
                      : "Publish failed.",
                  );
                  setPhase("review");
                  return;
                }
                setPublishResult(data);
                setPhase("done");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Publish failed.");
                setPhase("review");
              }
            }}
            onCancel={reset}
            publishing={phase === "publishing"}
            publishError={error}
            blank={Boolean(initialBlank)}
          />
        ) : (
          <SpotReviewForm
            scan={scan}
            areas={areas}
            onPublish={async (payload) => {
              setPhase("publishing");
              setError(null);
              try {
                const res = await fetch("/api/admin/publish?kind=spot", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify(payload),
                });
                const data = await res.json();
                if (!res.ok) {
                  setError(
                    data?.error
                      ? `${data.error}${
                          data?.issues
                            ? ` · ${JSON.stringify(data.issues.fieldErrors)}`
                            : ""
                        }`
                      : "Publish failed.",
                  );
                  setPhase("review");
                  return;
                }
                setPublishResult(data);
                setPhase("done");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Publish failed.");
                setPhase("review");
              }
            }}
            onCancel={reset}
            publishing={phase === "publishing"}
            publishError={error}
            blank={Boolean(initialBlank)}
          />
        )
      ) : null}

      {/* ── Done ──────────────────────────────────────────────── */}
      {phase === "done" && publishResult ? (
        <div className="mt-4 rounded-2xl border border-leaf-400/35 bg-leaf-400/[0.08] p-6">
          <p className="font-fraunces text-xl text-leaf-300 inline-flex items-center gap-2">
            <IconCheck size={20} />
            <span>Published. It&apos;s live on the homepage now.</span>
          </p>
          <p className="mt-1 text-sm text-cream-50/65">
            {publishResult.slug
              ? `/bhandara/${publishResult.slug}`
              : `Spot id: ${publishResult.id}`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {publishResult.slug ? (
              <a
                href={`/bhandara/${publishResult.slug}`}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 font-medium px-4 py-2 text-sm transition-colors"
              >
                View public page ↗
              </a>
            ) : null}
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-cream-50 font-medium border border-cyan-300/40 px-4 py-2 text-sm shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)] transition-colors"
            >
              Scan another
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Bhandara review form
// ────────────────────────────────────────────────────────────────────

function BhandaraReviewForm({
  scan,
  areas,
  menuItems,
  tuesdays,
  saturdays,
  onPublish,
  onCancel,
  publishing,
  publishError,
  blank,
}: {
  scan: Extract<ScanResponse, { kind: "bhandara" }>;
  areas: string[];
  menuItems: MenuItem[];
  tuesdays: string[];
  saturdays: string[];
  onPublish: (payload: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  publishing: boolean;
  publishError: string | null;
  /** True when the page reached this form via /admin/new (manual
   *  create). Suppresses scan-flow chrome that doesn't apply: the
   *  empty cream photo slot, the "No geocode hit" alert, the
   *  "Edit anything Gemini misread" subhead, and the "Discard &
   *  scan another" link. */
  blank?: boolean;
}) {
  const e = scan.extracted;
  const [name, setName] = useState(e.name ?? "");
  const [nameHi, setNameHi] = useState(e.nameHi ?? "");
  const [description, setDescription] = useState(e.description ?? "");
  const [descriptionHi, setDescriptionHi] = useState(e.descriptionHi ?? "");
  const [area, setArea] = useState(e.area ?? "");
  const [address, setAddress] = useState(e.address ?? "");
  const [addressHi, setAddressHi] = useState(e.addressHi ?? "");
  const [landmark, setLandmark] = useState(e.landmark ?? "");
  const [lat, setLat] = useState(scan.geocode?.lat?.toFixed(6) ?? "");
  const [lng, setLng] = useState(scan.geocode?.lng?.toFixed(6) ?? "");
  // Vision schema now extracts all serving Tuesdays the banner lists
  // (was single `dateIso`, which failed validation on the common
  // multi-Tuesday Lucknow posters). Empty array → admin types dates
  // in below.
  const [dates, setDates] = useState<string[]>(e.dateIsoList ?? []);
  const [timeStart, setTimeStart] = useState(e.timeStart ?? "");
  const [timeEnd, setTimeEnd] = useState(e.timeEnd ?? "");
  const [menu, setMenu] = useState<string[]>(e.menu ?? []);
  const [menuOther, setMenuOther] = useState((e.menuOther ?? []).join(", "));
  const [organizerName, setOrganizerName] = useState(e.organizerName ?? "");
  const [organizerPhone, setOrganizerPhone] = useState(e.organizerPhone ?? "");
  const [organizerWhatsapp, setOrganizerWhatsapp] = useState("");
  const [upiId, setUpiId] = useState("");
  const [upiQrUrl, setUpiQrUrl] = useState("");
  // The "verified" decision is now driven by which Publish button the
  // admin clicks (Publish vs. Called & confirmed, publish), mirroring
  // the row-level button cluster on /admin. We no longer carry an
  // isVerified state since it'd be redundant: the click site already
  // knows which intent it represents and passes that to onPublish.

  // "Custom area" mode: when the extracted area isn't in the curated
  // AREAS list (or admin wants to type something not on the list), we
  // swap the dropdown for a free-text input. Detect on mount so an
  // out-of-list area Gemini extracted opens in custom mode right away.
  const initialCustomArea =
    (e.area ?? "").length > 0 && !areas.includes(e.area ?? "");
  const [customAreaMode, setCustomAreaMode] = useState<boolean>(initialCustomArea);

  function toggleDate(d: string) {
    setDates((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  }

  function addCustomDate(iso: string) {
    setDates((cur) => (cur.includes(iso) ? cur : [...cur, iso].sort()));
  }
  function removeDate(iso: string) {
    setDates((cur) => cur.filter((x) => x !== iso));
  }

  // Custom dates the admin has added that aren't in the preset
  // Tuesday/Saturday chip set, shown as removable chips above the
  // SeasonDatePicker so the admin can see exactly what's selected.
  const presetSet = useMemo(
    () => new Set([...tuesdays, ...saturdays]),
    [tuesdays, saturdays],
  );
  const customDates = useMemo(
    () => dates.filter((d) => !presetSet.has(d)),
    [dates, presetSet],
  );
  function toggleMenu(k: string) {
    setMenu((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  }

  const canPublish =
    name.length >= 2 &&
    nameHi.length >= 1 &&
    area.length > 0 &&
    address.length >= 5 &&
    /^\d{2}:\d{2}$/.test(timeStart) &&
    dates.length > 0 &&
    organizerName.length >= 1 &&
    organizerPhone.length >= 1 &&
    Number.isFinite(parseFloat(lat)) &&
    Number.isFinite(parseFloat(lng));

  return (
    // In blank (manual-create) mode we drop the photo column and let
    // the form span the full width. In scan mode we keep the two-col
    // layout so the poster sits beside the editable fields.
    <div
      className={
        blank
          ? "mt-4"
          : "mt-4 grid gap-6 lg:grid-cols-[260px_1fr]"
      }
    >
      {/* Photo + extras column — scan flow only. The slot is meaningless
          in manual-create mode (no upload, no Gemini geocode), so we
          omit it entirely instead of leaving an empty cream rectangle.
          Sticky on lg+ so the poster + geocode notice stay in view
          while the operator scrolls the form. Same `top-20 self-start`
          combo as /admin/edit + /admin/edit-spot. */}
      {!blank ? (
        <div className="lg:sticky lg:top-20 lg:self-start">
          {/* Wrapped in an <a target="_blank"> so the operator can pop
              the full-resolution invite open in a new tab when the
              thumbnail is too small to read a phone number or a
              hand-written venue line. Same affordance AdminPhotoField
              + /admin/edit-spot already provide; ScanReview was the
              one review surface that still rendered a static <img>.
              cursor-zoom-in gives the visual cue that the image
              expands; focus-visible ring keeps keyboard nav obvious. */}
          <a
            href={scan.photoUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open full image in a new tab"
            className="group block rounded-2xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/55"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={scan.photoUrl}
              alt="uploaded invite"
              className="w-full aspect-[3/4] object-contain bg-[#080A10]/70 rounded-2xl border border-cyan-400/25 cursor-zoom-in transition-colors group-hover:border-cyan-400/55"
            />
          </a>
          <p className="mt-2 text-[10px] text-cream-50/45 font-mono break-all">
            {scan.photoUrl}
          </p>
          {scan.geocode ? (
            <div className="mt-3 rounded-xl border border-leaf-400/35 bg-leaf-400/[0.08] p-3 text-xs">
              <p className="font-semibold text-leaf-300 inline-flex items-center gap-1.5">
                <span aria-hidden>📍</span>
                Geocoded ({scan.geocode.source})
              </p>
              <p className="mt-1 text-cream-50/70 break-words">
                {scan.geocode.matched}
              </p>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-alert-500/40 bg-alert-500/[0.10] p-3 text-xs">
              <p className="font-semibold text-alert-300">No geocode hit</p>
              <p className="mt-1 text-cream-50/70">
                Fill the lat/lng manually before publishing.
              </p>
            </div>
          )}
          {e.notes ? (
            <p className="mt-3 text-xs text-cream-50/60 italic">📝 {e.notes}</p>
          ) : null}
        </div>
      ) : null}

      {/* Form column — dark admin surface */}
      <div className="rounded-2xl border border-cyan-400/20 bg-[#0B0E16]/70 backdrop-blur-sm p-5 sm:p-6">
        <h2 className="font-fraunces text-xl text-cream-50">
          {blank ? "New bhandara" : "Review & publish"}
        </h2>
        <p className="text-xs text-cream-50/55 mt-1 font-mono">
          {blank
            ? "Type the details an organizer gave you. Lat/lng can come from a Maps link below, or paste a Plus Code (“VXR6+QP Lucknow”) and click Resolve."
            : "Edit anything Gemini misread, especially organizer phone, exact venue, and the area pin."}
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Name (English)" value={name} onChange={setName} required />
          <Field label="Name (Hindi)" value={nameHi} onChange={setNameHi} required />
          <Field
            label="Description (English)"
            value={description}
            onChange={setDescription}
            multiline
            wide
          />
          <Field
            label="Description (Hindi)"
            value={descriptionHi}
            onChange={setDescriptionHi}
            multiline
            wide
          />
          {/* Area picker, supports curated list + free-text "Other".
              Same pattern as the public BhandaraForm so admin and
              organiser have one mental model.
              Replaced the native <select> (system font + OS menu
              chrome that broke out of the admin AI theme) with the
              shared AdminListbox — same dark cyan trigger + popover
              every other admin select uses. The custom-area free-text
              mode keeps its own eyebrow + escape-hatch button so
              admins who picked "Other" by accident can revert. */}
          <div>
            {customAreaMode ? (
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/70 font-mono">
                  Area *
                </span>
                <input
                  value={area}
                  onChange={(ev) => setArea(ev.target.value)}
                  placeholder="Type the area name"
                  maxLength={50}
                  className="w-full rounded-xl border border-cyan-400/20 bg-[#080A10]/70 backdrop-blur-sm px-3 py-2 text-sm text-cream-50 placeholder:text-cream-50/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/45 focus:border-cyan-400/55 transition-colors"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setArea("");
                    setCustomAreaMode(false);
                  }}
                  className="text-[11px] uppercase tracking-[0.18em] text-cream-50/65 hover:text-cyan-200"
                >
                  ← Pick from the list
                </button>
              </div>
            ) : (
              <AdminListbox
                name=""
                label="Area *"
                value={area}
                onChange={(v) => {
                  if (v === "__custom__") {
                    setArea("");
                    setCustomAreaMode(true);
                    return;
                  }
                  setArea(v);
                }}
                className="w-full block"
                options={[
                  { value: "", label: "Select…" },
                  ...areas.map((o) => ({ value: o, label: o })),
                  { value: "__custom__", label: "Other, type your own…" },
                ]}
              />
            )}
          </div>
          <Field label="Landmark" value={landmark} onChange={setLandmark} />
          <Field
            label="Address (English)"
            value={address}
            onChange={setAddress}
            multiline
            wide
            required
          />
          <Field
            label="Address (Hindi)"
            value={addressHi}
            onChange={setAddressHi}
            multiline
            wide
          />
          {/* Paste-anything Maps URL → coords helper, mirrors the
              same affordance on /admin/edit/[id] (where it lives
              inside MapLocationInput). Resolving fills both lat
              and lng below in one click, so the admin doesn't
              have to fish them out of a Maps share-link manually. */}
          <div className="sm:col-span-2">
            <MapPasteResolver
              onResolved={(la, ln) => {
                setLat(la);
                setLng(ln);
              }}
            />
          </div>
          <Field
            label="Latitude"
            value={lat}
            onChange={setLat}
            required
            mono
          />
          <Field
            label="Longitude"
            value={lng}
            onChange={setLng}
            required
            mono
          />
          <MapPreviewLink lat={lat} lng={lng} />
          <Field
            label="Time start (HH:MM 24h)"
            value={timeStart}
            onChange={setTimeStart}
            required
            mono
          />
          <Field
            label="Time end (optional)"
            value={timeEnd}
            onChange={setTimeEnd}
            mono
          />
          <Field
            label="Organizer name"
            value={organizerName}
            onChange={setOrganizerName}
            required
          />
          {/* Shared PhoneInput, locked +91 prefix + 10-digit cap.
              Same control used on public + admin/edit forms so admins
              and organisers share one mental model. */}
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/70 font-mono">
              Organizer phone *
            </span>
            <div className="mt-1">
              <PhoneInput
                value={organizerPhone}
                onChange={setOrganizerPhone}
                required
              />
            </div>
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/70 font-mono">
              Organizer WhatsApp (optional)
            </span>
            <div className="mt-1">
              <PhoneInput
                value={organizerWhatsapp}
                onChange={setOrganizerWhatsapp}
              />
            </div>
          </label>
        </div>

        {/* ── Donations (optional) ─────────────────────────────
            Bumped from a single inline "UPI ID for sponsorship"
            row in the organiser-info grid up to its own section
            header so operators reviewing a bhandara can SEE this
            slot exists (the old layout buried it on row 3 and the
            organiser interview rarely surfaced it). When the
            field is populated, the public bhandara detail page
            renders a 'Sponsor this bhandara' UPI deep-link. */}
        <fieldset className="mt-5 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.03] p-3">
          <legend className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/85 font-mono px-1">
            Enable donations (optional)
          </legend>
          <p className="text-xs text-cream-50/65 mt-1 leading-relaxed">
            Drop the organiser&apos;s UPI ID here so the public bhandara
            page surfaces a &quot;Sponsor this bhandara&quot; button. Leave
            blank to keep donations off for this listing.
          </p>
          <div className="mt-2.5 space-y-3">
            <Field
              label="UPI ID"
              value={upiId}
              onChange={setUpiId}
              mono
            />
            {/* Companion QR upload — covers the case where the
                organiser has a printed UPI QR but doesn't know the
                handle text underneath. Either field works on its
                own; both is fine. SponsorBhandara on the public
                page prefers upiQrUrl when present, falls back to
                a client-generated QR from upiId otherwise. */}
            <UpiQrUpload
              value={upiQrUrl}
              onChange={setUpiQrUrl}
              theme="admin"
            />
          </div>
        </fieldset>

        {/* Dates, preset Bada Mangal Tuesdays + Bada Shanivar
            Saturdays as quick-pick chips. Below them, a custom-date
            picker (any 2026 date) for off-season events or one-off
            community dinners the calendar doesn't preset. */}
        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/70 font-mono">
            Dates *
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...tuesdays, ...saturdays]
              .sort()
              .map((d) => {
                const active = dates.includes(d);
                const isSat = saturdays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDate(d)}
                    className={`text-xs rounded-full px-2.5 py-1 border ${
                      active
                        ? "bg-gradient-to-r from-cyan-500 to-violet-500 border-cyan-300/40 text-cream-50 shadow-[0_4px_14px_-4px_rgba(34,211,238,0.5)]"
                        : "bg-cyan-400/[0.06] border-cyan-400/20 text-cream-50/70 hover:border-cyan-400/50 hover:text-cream-50"
                    }`}
                  >
                    {d.slice(8)}
                    {"/"}
                    {d.slice(5, 7)}
                    {isSat ? " · Sat" : ""}
                  </button>
                );
              })}
          </div>

          {/* Custom-date chips (anything the admin added that isn't in
              the preset Tuesday/Saturday set). Each gets an inline
              × so admin can remove without re-opening the picker. */}
          {customDates.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {customDates.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1.5 rounded-full bg-leaf-400/85 border border-leaf-400/55 text-ink-900 font-medium px-2.5 py-1 text-xs"
                >
                  {d.slice(8)}/{d.slice(5, 7)}/{d.slice(2, 4)}
                  <button
                    type="button"
                    onClick={() => removeDate(d)}
                    aria-label={`Remove ${d}`}
                    className="text-cream-50/85 hover:text-cream-50"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-2">
            <SeasonDatePicker
              // Allow any 2026 date for admin overrides. Public form
              // sticks to the season window; admin gets full freedom.
              minIso="2026-01-01"
              maxIso="2026-12-31"
              selectedIsos={dates}
              onPick={addCustomDate}
              locale="en"
            />
          </div>
        </div>

        {/* Menu */}
        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/70 font-mono">
            Menu
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {menuItems.map((m) => {
              const active = menu.includes(m.en);
              return (
                <button
                  key={m.en}
                  type="button"
                  onClick={() => toggleMenu(m.en)}
                  className={`text-xs rounded-full px-2.5 py-1 border ${
                    active
                      ? "bg-leaf-400/85 border-leaf-400/55 text-ink-900 font-medium"
                      : "bg-cyan-400/[0.06] border-cyan-400/20 text-cream-50/70 hover:border-leaf-400/55 hover:text-cream-50"
                  }`}
                >
                  {m.en} · {m.hi}
                </button>
              );
            })}
          </div>
          <Field
            label="Other items (comma-separated)"
            value={menuOther}
            onChange={setMenuOther}
            wide
          />
        </div>

        {publishError ? (
          <p className="mt-3 text-sm text-alert-500">{publishError}</p>
        ) : null}

        {/* Two publish CTAs mirror the row-level cluster on /admin:
              • "Publish bhandara", ship what we have, no badge claim.
                The right default for scans where the admin hasn't
                actually spoken to the organiser yet, the listing
                still goes live, just without the green check.
              • "Called & confirmed, publish", same publish action +
                the ✓ Verified badge stamps in the same write. Mirrors
                publishVerifiedAction's role in the row-level pattern.
            Both buttons share the same big payload, built once via
            buildPayload(verified) so the only thing that changes
            between the two click handlers is the isVerified flag. */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {(() => {
            const buildPayload = (verified: boolean) => ({
              name,
              nameHi,
              description,
              descriptionHi,
              area,
              address,
              addressHi,
              landmark,
              lat: parseFloat(lat),
              lng: parseFloat(lng),
              tuesdayDates: dates,
              timeStart,
              timeEnd: timeEnd || undefined,
              menu,
              menuOther: menuOther
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              organizerName,
              organizerPhone,
              organizerWhatsapp: organizerWhatsapp || undefined,
              upiId: upiId || undefined,
              upiQrUrl: upiQrUrl || undefined,
              photoUrl: scan.photoUrl,
              isVerified: verified,
            });
            // Imperative trackEvent (vs data-ga) because we need the
            // `verified` boolean as a param keyed off WHICH button
            // was clicked, and GAClickDelegate's attribute scan
            // can't differentiate between two buttons that share the
            // same event name from a class attribute. Same `bm_`
            // prefix gets applied by ga.ts's normaliseEventName.
            const fire = (verified: boolean): void => {
              trackEvent("admin_scan_publish", {
                verified,
                area: area || "(blank)",
              });
            };
            return (
              <>
                <button
                  type="button"
                  disabled={!canPublish || publishing}
                  onClick={() => {
                    fire(false);
                    onPublish(buildPayload(false));
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-leaf-600 hover:bg-leaf-500 disabled:opacity-60 text-cream-50 font-medium border border-leaf-400/40 px-4 py-2 text-sm shadow-[0_4px_14px_-4px_rgba(93,174,93,0.55)] transition-colors"
                >
                  {publishing ? (
                    <>
                      <Spinner />
                      Publishing…
                    </>
                  ) : (
                    <>
                      <IconCheck size={14} />
                      <span>Publish bhandara</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={!canPublish || publishing}
                  onClick={() => {
                    fire(true);
                    onPublish(buildPayload(true));
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-leaf-500/[0.08] border border-leaf-400/30 text-leaf-300 hover:bg-leaf-500/[0.16] hover:border-leaf-400/55 hover:text-leaf-200 disabled:opacity-60 font-medium px-4 py-2 text-sm transition-colors"
                  title="Stamps the green Verified badge on the listing in the same write."
                >
                  <IconCheck size={14} />
                  <span>Called &amp; confirmed, publish</span>
                </button>
              </>
            );
          })()}
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-cream-50/65 hover:text-cyan-200 underline decoration-dotted underline-offset-4"
          >
            {blank ? "Discard" : "Discard & scan another"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Spot review form
// ────────────────────────────────────────────────────────────────────

function SpotReviewForm({
  scan,
  areas,
  onPublish,
  onCancel,
  publishing,
  publishError,
  blank,
}: {
  scan: Extract<ScanResponse, { kind: "spot" }>;
  areas: string[];
  onPublish: (payload: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  publishing: boolean;
  publishError: string | null;
  /** Same flag as BhandaraReviewForm — see there for details. */
  blank?: boolean;
}) {
  const e = scan.extracted;
  const [caption, setCaption] = useState(e.caption ?? "");
  const [area, setArea] = useState(e.area ?? "");
  const [address, setAddress] = useState(e.address ?? "");
  const [language, setLanguage] = useState<"hi" | "en" | "mixed">(
    e.language ?? "en",
  );
  const [lat, setLat] = useState(scan.geocode?.lat?.toFixed(6) ?? "");
  const [lng, setLng] = useState(scan.geocode?.lng?.toFixed(6) ?? "");
  const [reporterName, setReporterName] = useState("");

  const canPublish =
    Number.isFinite(parseFloat(lat)) && Number.isFinite(parseFloat(lng));

  return (
    // Blank mode drops the photo-+-geocode column entirely; scan mode
    // keeps the two-column layout for the poster + extracted data.
    <div
      className={
        blank
          ? "mt-4"
          : "mt-4 grid gap-6 lg:grid-cols-[260px_1fr]"
      }
    >
      {!blank ? (
        // Sticky on lg+ — same rationale as BhandaraReviewForm above.
        <div className="lg:sticky lg:top-20 lg:self-start">
          {/* Click the preview to open full-resolution in a new tab.
              Live-spot photos are often phone-camera shots of a busy
              prasad line; the operator needs to zoom in to read the
              venue board or the queue size. */}
          <a
            href={scan.photoUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open full image in a new tab"
            className="group block rounded-2xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/55"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={scan.photoUrl}
              alt="uploaded spot"
              className="w-full aspect-square object-cover bg-[#080A10]/70 rounded-2xl border border-cyan-400/25 cursor-zoom-in transition-colors group-hover:border-cyan-400/55"
            />
          </a>
          <p className="mt-2 text-[11px] text-cream-50/65 break-all">{scan.photoUrl}</p>
          {scan.geocode ? (
            <div className="mt-3 rounded-xl border border-leaf-400/35 bg-leaf-400/[0.08] p-3 text-xs">
              <p className="font-semibold text-leaf-300">
                📍 Geocoded ({scan.geocode.source})
              </p>
              <p className="mt-1 text-cream-50/65 break-words">{scan.geocode.matched}</p>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-alert-500/40 bg-alert-500/[0.10] p-3 text-xs">
              <p className="font-semibold text-alert-300">No geocode hit</p>
              <p className="mt-1 text-cream-50/65">
                Drop a pin manually, type lat/lng below.
              </p>
            </div>
          )}
          {e.notes ? (
            <p className="mt-3 text-xs text-cream-50/65 italic">📝 {e.notes}</p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-cyan-400/20 bg-[#0B0E16]/70 backdrop-blur-sm p-5 sm:p-6">
        <h2 className="font-fraunces text-xl text-cream-50">
          {blank ? "New spot" : "Review & publish spot"}
        </h2>
        <p className="text-xs text-cream-50/65 mt-1">
          {blank
            ? "Type the details of a live spot you saw on the field. Lat/lng is required; everything else is optional. Spot auto-expires 8 hours after the time you publish."
            : "Live spots auto-expire after 8 hours. Photo + lat/lng required."}
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field
            label="Caption"
            value={caption}
            onChange={setCaption}
            multiline
            wide
          />
          <SelectField
            label="Area"
            value={area}
            onChange={setArea}
            options={areas}
          />
          <Field
            label="Address (optional)"
            value={address}
            onChange={setAddress}
            wide
          />
          <SelectField
            label="Language"
            value={language}
            onChange={(v) => setLanguage(v as "hi" | "en" | "mixed")}
            options={["en", "hi", "mixed"]}
          />
          <Field label="Latitude" value={lat} onChange={setLat} required mono />
          <Field label="Longitude" value={lng} onChange={setLng} required mono />
          <MapPreviewLink lat={lat} lng={lng} />
          <Field
            label="Reporter name (optional)"
            value={reporterName}
            onChange={setReporterName}
          />
        </div>

        {publishError ? (
          <p className="mt-3 text-sm text-alert-500">{publishError}</p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!canPublish || publishing}
            onClick={() =>
              onPublish({
                lat: parseFloat(lat),
                lng: parseFloat(lng),
                area: area || undefined,
                address: address || undefined,
                caption: caption || undefined,
                language,
                photoUrl: scan.photoUrl,
                reporterName: reporterName || undefined,
              })
            }
            className="inline-flex items-center gap-2 rounded-lg bg-leaf-600 hover:bg-leaf-500 disabled:opacity-60 text-cream-50 font-medium border border-leaf-400/40 px-4 py-2 text-sm shadow-[0_4px_14px_-4px_rgba(93,174,93,0.55)] transition-colors"
          >
            {publishing ? (
              <>
                <Spinner />
                Publishing…
              </>
            ) : (
              <>
                <IconCheck size={14} />
                <span>Publish spot</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-cream-50/65 hover:text-cyan-200 underline decoration-dotted underline-offset-4"
          >
            {blank ? "Discard" : "Discard & scan another"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Small primitives
// ────────────────────────────────────────────────────────────────────

// Field + SelectField match the AI/ops palette used by /admin/edit
// (MapLocationInput, etc.) — cyan-tinted dark inputs, cyan-300/70
// uppercase mono labels. Re-skinned in one place; every form that
// uses these picks up the dark theme automatically.
function Field({
  label,
  value,
  onChange,
  required,
  multiline,
  wide,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  multiline?: boolean;
  wide?: boolean;
  mono?: boolean;
}) {
  const cls = `mt-1.5 w-full rounded-xl border border-cyan-400/20 bg-[#080A10]/70 backdrop-blur-sm px-3 py-2 text-sm text-cream-50 placeholder:text-cream-50/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/45 focus:border-cyan-400/55 transition-colors ${
    mono ? "font-mono tabular-nums" : ""
  }`;
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/70 font-mono">
        {label}
        {required ? " *" : ""}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className={cls}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      )}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  required?: boolean;
}) {
  // Was a native <select> (broke out of the admin AI theme — OS menu
  // chrome, system font, no keyboard niceties). Swapped to AdminListbox
  // so this helper matches the rest of the admin form. The external
  // <label> + eyebrow are dropped because AdminListbox now owns its
  // own inset label inside the trigger pill, which is how every other
  // admin Listbox renders.
  return (
    <AdminListbox
      name=""
      label={`${label}${required ? " *" : ""}`}
      value={value}
      onChange={onChange}
      className="w-full block"
      options={[
        { value: "", label: "Select…" },
        ...options.map((o) => ({ value: o, label: o })),
      ]}
    />
  );
}

/** Renders a "Preview on Google Maps ↗" link below the lat/lng pair
 *  whenever both parse to valid finite numbers (and aren't the 0,0
 *  null-island placeholder). Doubles as a sanity-check for Lucknow:
 *  when the coords sit outside the bbox we colour the row sindoor to
 *  flag the operator before publish. Spans the full row inside the
 *  parent 2-col grid via sm:col-span-2 so it sits cleanly under the
 *  inputs without re-flowing them. */
function MapPreviewLink({ lat, lng }: { lat: string; lng: string }) {
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  const hasCoords =
    Number.isFinite(latNum) &&
    Number.isFinite(lngNum) &&
    (latNum !== 0 || lngNum !== 0);
  if (!hasCoords) return null;
  const inLucknow =
    latNum >= 26.6 && latNum <= 27.0 && lngNum >= 80.7 && lngNum <= 81.2;
  return (
    <p
      className={[
        "sm:col-span-2 -mt-2 text-xs font-mono",
        inLucknow ? "text-leaf-300" : "text-sindoor-300",
      ].join(" ")}
    >
      {inLucknow ? "✓ Coords look correct for Lucknow." : "⚠ Coords sit outside the Lucknow bbox."}{" "}
      <a
        href={`https://www.google.com/maps?q=${latNum},${lngNum}&z=18`}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-dotted underline-offset-4 hover:text-cream-50"
      >
        Preview on Google Maps ↗
      </a>
    </p>
  );
}

function Spinner({ dark }: { dark?: boolean } = {}) {
  return (
    <span
      className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 ${
        dark
          ? "border-saffron-600/30 border-t-saffron-600"
          : "border-cream-50/40 border-t-cream-50"
      }`}
    />
  );
}

function IconUpload() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
