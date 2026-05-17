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
import { trackEvent } from "@/lib/ga";

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

export default function ScanReview({
  areas,
  menuItems,
  tuesdays,
  saturdays,
}: Props) {
  const [kind, setKind] = useState<Kind>("bhandara");
  const [file, setFile] = useState<File | null>(null);
  /** Captured before client-side compression so we can show the savings. */
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [compressing, setCompressing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<"idle" | "scanning" | "review" | "publishing" | "done">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  // Raw server-side detail (e.g. "GEMINI_API_KEY is not set", a
  // model error, or a network message). Hidden behind a small "show
  // detail" toggle so the friendly message stays primary but the
  // admin can dig in when something looks weird.
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [scan, setScan] = useState<ScanResponse | null>(null);
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
      const data = await res.json();
      if (!res.ok) {
        // 502 path keeps the saved photoUrl so we don't waste the upload.
        setError(
          data?.error ??
            "Scan failed. Check the server logs for the Gemini error.",
        );
        if (typeof data?.detail === "string" && data.detail.length > 0) {
          setErrorDetail(data.detail);
        }
        setPhase("idle");
        return;
      }
      setScan(data as ScanResponse);
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown scan error.");
      setPhase("idle");
    }
  }

  return (
    <div className="mt-6">
      {/* ── Kind toggle ───────────────────────────────────────── */}
      <div className="inline-flex rounded-full bg-cream-50 border border-gold-500/40 p-1">
        {(["bhandara", "spot"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k);
              reset();
            }}
            className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
              kind === k
                ? "bg-saffron-600 text-cream-50"
                : "text-ink-600 hover:text-sindoor-700"
            }`}
          >
            {k === "bhandara" ? "Listed bhandara" : "Live spot"}
          </button>
        ))}
      </div>

      {/* ── Upload card ───────────────────────────────────────── */}
      {phase === "idle" || phase === "scanning" ? (
        <div className="mt-4 rounded-2xl border border-dashed border-gold-500/50 bg-cream-50/60 p-6 sm:p-8">
          <p className="text-sm text-ink-600">
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

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={compressing || phase === "scanning"}
              className="inline-flex items-center gap-2 rounded-full bg-saffron-600 hover:bg-saffron-500 disabled:opacity-60 text-cream-50 font-medium px-4 py-2 text-sm shadow-warm"
            >
              <IconUpload />
              Choose file
            </button>
            <button
              type="button"
              onClick={() => cameraInput.current?.click()}
              disabled={compressing || phase === "scanning"}
              className="inline-flex items-center gap-2 rounded-full border-2 border-saffron-600 text-saffron-600 hover:bg-saffron-600 hover:text-cream-50 disabled:opacity-60 font-medium px-4 py-2 text-sm"
            >
              <IconCamera />
              Take photo
            </button>
            {compressing ? (
              <span className="inline-flex items-center gap-2 text-sm text-ink-600">
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
                className="h-32 w-32 object-cover rounded-xl border border-gold-500/40"
              />
              <div className="flex-1 text-sm text-ink-600">
                <p className="font-medium text-ink-900 break-all">{file.name}</p>
                <p className="text-xs text-ink-600 mt-0.5 font-numerals tabular-nums">
                  {/* Show "5.4 MB → 380 KB · 93% smaller" so the admin
                      sees the bandwidth win that compression bought. */}
                  {originalSize && originalSize !== file.size ? (
                    <>
                      <span className="line-through opacity-60">
                        {formatBytes(originalSize)}
                      </span>
                      {" → "}
                      <span className="font-semibold text-leaf-600">
                        {formatBytes(file.size)}
                      </span>
                      <span className="ml-1 text-leaf-600/80">
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
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-saffron-600 hover:bg-saffron-500 disabled:opacity-60 text-cream-50 font-medium px-5 py-2 text-sm shadow-warm"
                >
                  {phase === "scanning" ? (
                    <>
                      <Spinner />
                      Reading the invite…
                    </>
                  ) : (
                    <>✨ Scan with Gemini</>
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
                    className="mt-1 text-[11px] uppercase tracking-[0.18em] text-ink-600 hover:text-sindoor-700"
                  >
                    {showDetail ? "hide detail" : "show detail"}
                  </button>
                  {showDetail ? (
                    <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-gold-500/30 bg-cream-50/70 p-2 text-[11px] leading-snug text-ink-700 whitespace-pre-wrap break-words">
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
          />
        )
      ) : null}

      {/* ── Done ──────────────────────────────────────────────── */}
      {phase === "done" && publishResult ? (
        <div className="mt-4 rounded-2xl border border-leaf-600/50 bg-leaf-600/8 p-6">
          <p className="font-fraunces text-xl text-leaf-600">
            ✓ Published. It's live on the homepage now.
          </p>
          <p className="mt-1 text-sm text-ink-600">
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
                className="inline-flex items-center rounded-full border-2 border-saffron-600 text-saffron-600 hover:bg-saffron-600 hover:text-cream-50 font-medium px-4 py-2 text-sm"
              >
                View public page ↗
              </a>
            ) : null}
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-4 py-2 text-sm"
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
    <div className="mt-4 grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* Photo + extras column */}
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={scan.photoUrl}
          alt="uploaded invite"
          className="w-full aspect-[3/4] object-contain bg-cream-50 rounded-2xl border border-gold-500/40"
        />
        <p className="mt-2 text-[11px] text-ink-600 break-all">{scan.photoUrl}</p>
        {scan.geocode ? (
          <div className="mt-3 rounded-xl border border-leaf-600/40 bg-leaf-600/8 p-3 text-xs">
            <p className="font-semibold text-leaf-600">
              📍 Geocoded ({scan.geocode.source})
            </p>
            <p className="mt-1 text-ink-600 break-words">{scan.geocode.matched}</p>
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-alert-500/40 bg-alert-500/8 p-3 text-xs">
            <p className="font-semibold text-alert-500">No geocode hit</p>
            <p className="mt-1 text-ink-600">
              Fill the lat/lng manually before publishing.
            </p>
          </div>
        )}
        {e.notes ? (
          <p className="mt-3 text-xs text-ink-600 italic">📝 {e.notes}</p>
        ) : null}
      </div>

      {/* Form column */}
      <div className="rounded-2xl border border-gold-500/40 bg-cream-50 p-5 sm:p-6">
        <h2 className="font-fraunces text-xl text-sindoor-700">Review &amp; publish</h2>
        <p className="text-xs text-ink-600 mt-1">
          Edit anything Gemini misread, especially organizer phone, exact
          venue, and the area pin.
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
              organiser have one mental model. */}
          <div>
            <span className="text-[11px] uppercase tracking-wider text-ink-600">
              Area *
            </span>
            {customAreaMode ? (
              <div className="mt-1 space-y-1.5">
                <input
                  value={area}
                  onChange={(ev) => setArea(ev.target.value)}
                  placeholder="Type the area name"
                  maxLength={50}
                  className="w-full rounded-lg border border-gold-500/50 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setArea("");
                    setCustomAreaMode(false);
                  }}
                  className="text-[11px] uppercase tracking-[0.18em] text-ink-600 hover:text-sindoor-700"
                >
                  ← Pick from the list
                </button>
              </div>
            ) : (
              <select
                value={area}
                onChange={(ev) => {
                  const v = ev.target.value;
                  if (v === "__custom__") {
                    setArea("");
                    setCustomAreaMode(true);
                    return;
                  }
                  setArea(v);
                }}
                className="mt-1 w-full rounded-lg border border-gold-500/50 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
              >
                <option value="">Select…</option>
                {areas.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
                <option value="__custom__">Other, type your own…</option>
              </select>
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
          {/* Shared PhoneInput — locked +91 prefix + 10-digit cap.
              Same control used on public + admin/edit forms so admins
              and organisers share one mental model. */}
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-ink-600">
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
            <span className="text-[11px] uppercase tracking-wider text-ink-600">
              Organizer WhatsApp (optional)
            </span>
            <div className="mt-1">
              <PhoneInput
                value={organizerWhatsapp}
                onChange={setOrganizerWhatsapp}
              />
            </div>
          </label>
          <Field
            label="UPI ID for sponsorship (optional)"
            value={upiId}
            onChange={setUpiId}
            mono
          />
        </div>

        {/* Dates, preset Bada Mangal Tuesdays + Bada Shanivar
            Saturdays as quick-pick chips. Below them, a custom-date
            picker (any 2026 date) for off-season events or one-off
            community dinners the calendar doesn't preset. */}
        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-wider text-ink-600">
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
                        ? "bg-saffron-600 border-saffron-600 text-cream-50"
                        : "bg-white border-gold-500/40 text-ink-600 hover:border-saffron-500"
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
                  className="inline-flex items-center gap-1.5 rounded-full bg-leaf-600 border border-leaf-600 text-cream-50 px-2.5 py-1 text-xs"
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
          <p className="text-[11px] uppercase tracking-wider text-ink-600">
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
                      ? "bg-leaf-600 border-leaf-600 text-cream-50"
                      : "bg-white border-gold-500/40 text-ink-600 hover:border-leaf-600"
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
              • "Publish bhandara" — ship what we have, no badge claim.
                The right default for scans where the admin hasn't
                actually spoken to the organiser yet, the listing
                still goes live, just without the green check.
              • "Called & confirmed, publish" — same publish action +
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
                  className="inline-flex items-center gap-2 rounded-full bg-leaf-600 hover:bg-leaf-600/90 disabled:opacity-60 text-cream-50 font-medium px-5 py-2 text-sm shadow-warm"
                >
                  {publishing ? (
                    <>
                      <Spinner />
                      Publishing…
                    </>
                  ) : (
                    <>✓ Publish bhandara</>
                  )}
                </button>
                <button
                  type="button"
                  disabled={!canPublish || publishing}
                  onClick={() => {
                    fire(true);
                    onPublish(buildPayload(true));
                  }}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-leaf-600 text-leaf-600 hover:bg-leaf-600 hover:text-cream-50 disabled:opacity-60 font-medium px-5 py-2 text-sm transition-colors"
                  title="Stamps the green Verified badge on the listing in the same write."
                >
                  ✓ Called &amp; confirmed, publish
                </button>
              </>
            );
          })()}
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-ink-600 hover:text-sindoor-700 underline decoration-dotted underline-offset-4"
          >
            Discard &amp; scan another
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
}: {
  scan: Extract<ScanResponse, { kind: "spot" }>;
  areas: string[];
  onPublish: (payload: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  publishing: boolean;
  publishError: string | null;
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
    <div className="mt-4 grid gap-6 lg:grid-cols-[260px_1fr]">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={scan.photoUrl}
          alt="uploaded spot"
          className="w-full aspect-square object-cover bg-cream-50 rounded-2xl border border-gold-500/40"
        />
        <p className="mt-2 text-[11px] text-ink-600 break-all">{scan.photoUrl}</p>
        {scan.geocode ? (
          <div className="mt-3 rounded-xl border border-leaf-600/40 bg-leaf-600/8 p-3 text-xs">
            <p className="font-semibold text-leaf-600">
              📍 Geocoded ({scan.geocode.source})
            </p>
            <p className="mt-1 text-ink-600 break-words">{scan.geocode.matched}</p>
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-alert-500/40 bg-alert-500/8 p-3 text-xs">
            <p className="font-semibold text-alert-500">No geocode hit</p>
            <p className="mt-1 text-ink-600">
              Drop a pin manually, type lat/lng below.
            </p>
          </div>
        )}
        {e.notes ? (
          <p className="mt-3 text-xs text-ink-600 italic">📝 {e.notes}</p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-gold-500/40 bg-cream-50 p-5 sm:p-6">
        <h2 className="font-fraunces text-xl text-sindoor-700">
          Review &amp; publish spot
        </h2>
        <p className="text-xs text-ink-600 mt-1">
          Live spots auto-expire after 8 hours. Photo + lat/lng required.
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
            className="inline-flex items-center gap-2 rounded-full bg-leaf-600 hover:bg-leaf-600/90 disabled:opacity-60 text-cream-50 font-medium px-5 py-2 text-sm shadow-warm"
          >
            {publishing ? (
              <>
                <Spinner />
                Publishing…
              </>
            ) : (
              <>✓ Publish spot</>
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-ink-600 hover:text-sindoor-700 underline decoration-dotted underline-offset-4"
          >
            Discard &amp; scan another
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Small primitives
// ────────────────────────────────────────────────────────────────────

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
  const cls = `mt-1 w-full rounded-lg border border-gold-500/50 bg-white px-3 py-2 text-sm ${
    mono ? "font-numerals tabular-nums" : ""
  } focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600`;
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-[11px] uppercase tracking-wider text-ink-600">
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
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-ink-600">
        {label}
        {required ? " *" : ""}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gold-500/50 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
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
