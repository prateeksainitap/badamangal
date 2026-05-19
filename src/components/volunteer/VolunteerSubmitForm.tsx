"use client";

/**
 * Volunteer bhandara submission form — the "fill it on your phone
 * at the bhandara" experience.
 *
 * Flow:
 *   1. Resolve volunteer code: URL ?code= → localStorage → empty
 *      (force the volunteer to paste it). Cache to localStorage on
 *      first valid use so subsequent submissions skip the prompt.
 *   2. On mount: capture GPS via navigator.geolocation (silent, fires
 *      one-shot). Volunteer can see captured coords + a re-capture
 *      button below the location field.
 *   3. Bhandara fields: name, area, address, organizer, time, menu.
 *      All inline in the same form — no multi-step wizard in Tier A.
 *   4. Media uploads: three buckets (10 photos / 2 videos / 1 spot
 *      photo). Each file uploads independently via fetch to
 *      /api/volunteer/upload-media; we track per-file state so the
 *      UI shows a tick when done.
 *   5. Submit: posts URL list to /api/volunteer/submit. Shows the
 *      success screen with "submit another" + "back to BadaMangal".
 *
 * Validation philosophy: minimal client-side gates beyond required
 * fields. The server is the source of truth — we let the user
 * submit even if photos < 10 (their choice + admin discretion on
 * what counts as a complete bundle) but we surface a yellow
 * warning so they know what's coming.
 */

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import PhoneInput from "@/components/PhoneInput";
import { AREAS } from "@/lib/lucknow";
import { trackEvent } from "@/lib/ga";
import {
  isValidVolunteerCodeShape,
  normaliseVolunteerCode,
} from "@/lib/volunteer";

type UploadedMedia = {
  url: string;
  filename: string;
  sizeBytes: number;
};

type GpsState =
  | { kind: "pending" }
  | { kind: "denied" }
  | { kind: "captured"; lat: number; lng: number; accuracy: number }
  | { kind: "error"; message: string };

type SubmitPhase =
  | { kind: "form" }
  | { kind: "submitting" }
  | { kind: "success"; id: string }
  | { kind: "error"; message: string };

const STORAGE_KEY = "bm.volunteer.code";

export default function VolunteerSubmitForm({
  initialCode,
}: {
  initialCode: string;
}) {
  // ─── State ────────────────────────────────────────────────────
  const [code, setCode] = useState<string>(initialCode);
  const [codeLocked, setCodeLocked] = useState<boolean>(false);
  const [gps, setGps] = useState<GpsState>({ kind: "pending" });
  const [photos, setPhotos] = useState<UploadedMedia[]>([]);
  const [videos, setVideos] = useState<UploadedMedia[]>([]);
  const [spotPhoto, setSpotPhoto] = useState<UploadedMedia | null>(null);
  const [photoUploading, setPhotoUploading] = useState<number>(0);
  const [videoUploading, setVideoUploading] = useState<number>(0);
  const [spotUploading, setSpotUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<SubmitPhase>({ kind: "form" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const spotInputRef = useRef<HTMLInputElement | null>(null);

  // ─── On mount: resolve code + capture GPS ────────────────────
  useEffect(() => {
    // Code resolution: URL → localStorage → empty
    if (!code) {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY) ?? "";
        if (isValidVolunteerCodeShape(stored)) {
          setCode(normaliseVolunteerCode(stored));
          setCodeLocked(true);
        }
      } catch {
        /* private browsing / storage disabled — fine */
      }
    } else if (isValidVolunteerCodeShape(code)) {
      // URL-provided code: cache to localStorage for next time
      try {
        window.localStorage.setItem(STORAGE_KEY, normaliseVolunteerCode(code));
      } catch {
        /* noop */
      }
      setCodeLocked(true);
    }

    // GPS capture: one-shot, silently fails to "denied" or "error"
    if (!("geolocation" in navigator)) {
      setGps({ kind: "error", message: "Your browser doesn't support GPS." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          kind: "captured",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        trackEvent("volunteer_gps_captured", {
          accuracy_m: Math.round(pos.coords.accuracy),
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGps({ kind: "denied" });
        } else {
          setGps({ kind: "error", message: err.message });
        }
        trackEvent("volunteer_gps_failed", { code: err.code });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function recaptureGps() {
    setGps({ kind: "pending" });
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setGps({
          kind: "captured",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) =>
        err.code === err.PERMISSION_DENIED
          ? setGps({ kind: "denied" })
          : setGps({ kind: "error", message: err.message }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  // ─── Upload helpers ──────────────────────────────────────────
  async function uploadOne(file: File): Promise<UploadedMedia> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/volunteer/upload-media", {
      method: "POST",
      headers: { "x-volunteer-code": code },
      body: fd,
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      const e = (json && json.error) || `HTTP ${res.status}`;
      throw new Error(humanizeUploadError(e));
    }
    return { url: json.url, filename: json.filename, sizeBytes: json.sizeBytes };
  }

  async function handlePhotoPick(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadError(null);
    const slots = Math.max(0, 10 - photos.length);
    const toUpload = Array.from(files).slice(0, slots);
    setPhotoUploading(toUpload.length);
    let added = 0;
    for (const file of toUpload) {
      try {
        const uploaded = await uploadOne(file);
        setPhotos((prev) => [...prev, uploaded]);
        added++;
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
        break;
      } finally {
        setPhotoUploading((n) => Math.max(0, n - 1));
      }
    }
    trackEvent("volunteer_photos_uploaded", { added, total: photos.length + added });
  }

  async function handleVideoPick(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadError(null);
    const slots = Math.max(0, 2 - videos.length);
    const toUpload = Array.from(files).slice(0, slots);
    setVideoUploading(toUpload.length);
    let added = 0;
    for (const file of toUpload) {
      try {
        const uploaded = await uploadOne(file);
        setVideos((prev) => [...prev, uploaded]);
        added++;
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
        break;
      } finally {
        setVideoUploading((n) => Math.max(0, n - 1));
      }
    }
    trackEvent("volunteer_videos_uploaded", { added });
  }

  async function handleSpotPick(file: File | null) {
    if (!file) return;
    setUploadError(null);
    setSpotUploading(true);
    try {
      const uploaded = await uploadOne(file);
      setSpotPhoto(uploaded);
      trackEvent("volunteer_spot_uploaded", {});
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSpotUploading(false);
    }
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  }
  function removeVideo(idx: number) {
    setVideos((prev) => prev.filter((_, i) => i !== idx));
  }

  // ─── Submit ──────────────────────────────────────────────────
  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (phase.kind === "submitting") return;
    if (!isValidVolunteerCodeShape(code)) {
      setPhase({ kind: "error", message: "Please paste a valid volunteer code." });
      return;
    }
    setFieldErrors({});
    setPhase({ kind: "submitting" });

    const fd = new FormData(ev.currentTarget);
    const payload = {
      code: normaliseVolunteerCode(code),
      bhandaraName: String(fd.get("bhandaraName") ?? "").trim(),
      area: String(fd.get("area") ?? "").trim(),
      address: String(fd.get("address") ?? "").trim(),
      organizerName: String(fd.get("organizerName") ?? "").trim(),
      organizerPhone: String(fd.get("organizerPhone") ?? "").trim(),
      startTime: String(fd.get("startTime") ?? "").trim(),
      menu: String(fd.get("menu") ?? "").trim(),
      mapsUrl: String(fd.get("mapsUrl") ?? "").trim(),
      volunteerNotes: String(fd.get("volunteerNotes") ?? "").trim(),
      photoUrls: photos.map((p) => p.url),
      videoUrls: videos.map((v) => v.url),
      spotPhotoUrl: spotPhoto?.url ?? "",
      gpsLat: gps.kind === "captured" ? gps.lat : null,
      gpsLng: gps.kind === "captured" ? gps.lng : null,
    };

    try {
      const res = await fetch("/api/volunteer/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        if (json && json.fields) setFieldErrors(json.fields);
        const msg =
          (json && json.fields && json.fields._form) ||
          humanizeSubmitError(json && json.error);
        trackEvent("volunteer_submit_error", { err: (json && json.error) || res.status });
        setPhase({ kind: "error", message: msg });
        return;
      }
      trackEvent("volunteer_submit_success", {
        photo_count: photos.length,
        video_count: videos.length,
        has_spot: spotPhoto ? 1 : 0,
        has_gps: gps.kind === "captured" ? 1 : 0,
      });
      setPhase({ kind: "success", id: json.id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setPhase({ kind: "error", message: msg });
    }
  }

  // ─── SUCCESS STATE ────────────────────────────────────────────
  if (phase.kind === "success") {
    return <SuccessCard submissionId={phase.id} code={code} />;
  }

  // ─── FORM STATE ───────────────────────────────────────────────
  const submitting = phase.kind === "submitting";
  const photoBundleOk = photos.length >= 10;
  const videoBundleOk = videos.length >= 2;
  const spotOk = spotPhoto !== null;
  const fullBundle = photoBundleOk && videoBundleOk && spotOk;

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      {/* Code lock-in. Shows a paste field only if we don't have one. */}
      <CodeBanner
        code={code}
        locked={codeLocked}
        onChange={(v) => setCode(v)}
        onLock={() => {
          if (isValidVolunteerCodeShape(code)) {
            try {
              window.localStorage.setItem(
                STORAGE_KEY,
                normaliseVolunteerCode(code),
              );
            } catch {
              /* noop */
            }
            setCodeLocked(true);
          }
        }}
      />

      {/* GPS banner — silently captures on mount. Shows status + re-capture. */}
      <GpsBanner gps={gps} onRecapture={recaptureGps} />

      {/* Errors */}
      {phase.kind === "error" ? (
        <div className="rounded-xl border border-alert-500/40 bg-alert-500/10 px-3 py-2 text-sm text-alert-500">
          {phase.message}
        </div>
      ) : null}
      {uploadError ? (
        <div className="rounded-xl border border-alert-500/40 bg-alert-500/10 px-3 py-2 text-sm text-alert-500">
          Upload error: {uploadError}
        </div>
      ) : null}

      {/* ─── Section 1: Bhandara details ─── */}
      <fieldset className="grid gap-4">
        <legend className="font-fraunces text-lg text-sindoor-700">
          1. भण्डारे की जानकारी · Bhandara details
        </legend>

        <Field
          label="Bhandara name"
          labelHi="भण्डारे का नाम"
          name="bhandaraName"
          required
          placeholder="e.g. Dwitiya Vishal Bhandara"
          error={fieldErrors.bhandaraName}
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            label="Area / mohalla"
            labelHi="क्षेत्र / मोहल्ला"
            name="area"
            required
            placeholder="e.g. Hazratganj, Aliganj"
            error={fieldErrors.area}
            list="vol-area-suggestions"
          />
          <datalist id="vol-area-suggestions">
            {AREAS.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
          <Field
            label="Start time"
            labelHi="समय"
            name="startTime"
            placeholder="e.g. 9:00 AM"
            error={fieldErrors.startTime}
          />
        </div>

        <FieldArea
          label="Full address"
          labelHi="पूरा पता"
          name="address"
          required
          placeholder="Street + landmark + area, e.g. Swati-Krutika Apartment Gate, CG City, Ansal API"
          error={fieldErrors.address}
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            label="Organizer name"
            labelHi="आयोजक का नाम"
            name="organizerName"
            placeholder="As written on banner"
            error={fieldErrors.organizerName}
          />
          <label className="grid gap-1.5">
            <span className="text-sm text-ink-600">
              Organizer phone <span className="text-xs">(optional)</span>
            </span>
            <PhoneInput name="organizerPhone" />
            {fieldErrors.organizerPhone ? (
              <span className="text-xs text-alert-500">{fieldErrors.organizerPhone}</span>
            ) : null}
          </label>
        </div>

        <Field
          label="Menu"
          labelHi="मेन्यू"
          name="menu"
          placeholder="Comma-separated, e.g. puri, sabzi, halwa, prasad"
        />

        <Field
          label="Google Maps link (optional)"
          labelHi="Google Maps लिंक"
          name="mapsUrl"
          placeholder="Paste Maps link of your exact location"
          hint="Open Maps → tap blue dot → Share → Copy link"
        />
      </fieldset>

      {/* ─── Section 2: Photos ─── */}
      <fieldset className="grid gap-3">
        <legend className="font-fraunces text-lg text-sindoor-700">
          2. 10 photos {photoBundleOk ? "✅" : `(${photos.length}/10)`}
        </legend>
        <p className="text-xs text-ink-600">
          2-3 each: <strong>VENUE</strong> (pandal, decoration) ·{" "}
          <strong>PEOPLE</strong> (devotees, organizers, queue) ·{" "}
          <strong>FOOD</strong> (puri, sabzi, prasad, serving) ·{" "}
          <strong>BANNER</strong> (the invite poster)
        </p>

        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            void handlePhotoPick(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          id="vol-photo-camera"
          onChange={(e) => {
            void handlePhotoPick(e.target.files);
            e.target.value = "";
          }}
        />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={photos.length >= 10 || photoUploading > 0}
            className="inline-flex items-center gap-1.5 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-4 py-2 text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {photoUploading > 0 ? (
              <>
                <Spinner /> Uploading…
              </>
            ) : (
              <>📸 Add photos ({10 - photos.length} more)</>
            )}
          </button>
          <label
            htmlFor="vol-photo-camera"
            className={`inline-flex items-center gap-1.5 rounded-full border border-gold-500/50 bg-white hover:bg-saffron-50 text-ink-900 font-medium px-4 py-2 text-sm transition-colors cursor-pointer ${photos.length >= 10 || photoUploading > 0 ? "opacity-50 pointer-events-none" : ""}`}
          >
            📷 Open camera
          </label>
        </div>

        {photos.length > 0 ? (
          <ul className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2">
            {photos.map((p, i) => (
              <li
                key={p.url}
                className="relative aspect-square rounded-lg border border-gold-500/40 overflow-hidden bg-cream-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-ink-900/70 text-cream-50 text-xs flex items-center justify-center hover:bg-alert-500"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </fieldset>

      {/* ─── Section 3: Videos ─── */}
      <fieldset className="grid gap-3">
        <legend className="font-fraunces text-lg text-sindoor-700">
          3. 2 videos {videoBundleOk ? "✅" : `(${videos.length}/2)`}
        </legend>
        <p className="text-xs text-ink-600">
          10-30 sec each. One pandal pan, one prasad-serving moment.
        </p>

        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            void handleVideoPick(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          type="file"
          accept="video/*"
          capture="environment"
          className="sr-only"
          id="vol-video-camera"
          onChange={(e) => {
            void handleVideoPick(e.target.files);
            e.target.value = "";
          }}
        />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            disabled={videos.length >= 2 || videoUploading > 0}
            className="inline-flex items-center gap-1.5 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-4 py-2 text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {videoUploading > 0 ? (
              <>
                <Spinner /> Uploading…
              </>
            ) : (
              <>🎥 Add videos ({2 - videos.length} more)</>
            )}
          </button>
          <label
            htmlFor="vol-video-camera"
            className={`inline-flex items-center gap-1.5 rounded-full border border-gold-500/50 bg-white hover:bg-saffron-50 text-ink-900 font-medium px-4 py-2 text-sm transition-colors cursor-pointer ${videos.length >= 2 || videoUploading > 0 ? "opacity-50 pointer-events-none" : ""}`}
          >
            📹 Record
          </label>
        </div>

        {videos.length > 0 ? (
          <ul className="grid grid-cols-2 gap-2 mt-2">
            {videos.map((v, i) => (
              <li
                key={v.url}
                className="relative rounded-lg border border-gold-500/40 overflow-hidden bg-cream-50 p-2"
              >
                <video
                  src={v.url}
                  controls
                  preload="metadata"
                  className="w-full h-32 object-contain bg-ink-900/5 rounded"
                />
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-xs text-ink-600 truncate">
                    {(v.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                  </span>
                  <button
                    type="button"
                    onClick={() => removeVideo(i)}
                    className="text-xs text-alert-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </fieldset>

      {/* ─── Section 4: Live spot photo ─── */}
      <fieldset className="grid gap-3">
        <legend className="font-fraunces text-lg text-sindoor-700">
          4. Live spot photo {spotOk ? "✅" : "(0/1)"}
        </legend>
        <p className="text-xs text-ink-600">
          ONE photo taken right now where you're standing. Goes on the live city map for 8 hours.
        </p>

        <input
          ref={spotInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            void handleSpotPick(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />

        <button
          type="button"
          onClick={() => spotInputRef.current?.click()}
          disabled={spotUploading}
          className="inline-flex items-center gap-1.5 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-4 py-2 text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-start"
        >
          {spotUploading ? (
            <>
              <Spinner /> Uploading…
            </>
          ) : spotOk ? (
            <>📸 Replace spot photo</>
          ) : (
            <>📸 Take spot photo</>
          )}
        </button>

        {spotPhoto ? (
          <div className="rounded-lg border border-gold-500/40 overflow-hidden bg-cream-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={spotPhoto.url}
              alt="Live spot"
              className="w-full max-h-64 object-contain"
            />
          </div>
        ) : null}
      </fieldset>

      {/* ─── Section 5: Notes (optional) ─── */}
      <fieldset className="grid gap-3">
        <legend className="font-fraunces text-lg text-sindoor-700">
          5. Anything else? (optional)
        </legend>
        <FieldArea
          label="Notes for the BadaMangal team"
          labelHi="नोट्स"
          name="volunteerNotes"
          placeholder="Anything we should know? Bhandara closed early? Banner damaged? Duplicate listing?"
        />
      </fieldset>

      {/* ─── Submit ─── */}
      <div className="mt-2 grid gap-3">
        {!fullBundle ? (
          <div className="rounded-xl border border-saffron-600/40 bg-saffron-50 px-3 py-2 text-sm text-ink-900">
            ⚠️ <strong>Bundle incomplete.</strong> Full bundle is 10 photos + 2 videos + 1 spot photo. Partial submissions may or may not be accepted at admin's discretion.
          </div>
        ) : (
          <div className="rounded-xl border border-leaf-600/40 bg-leaf-600/5 px-3 py-2 text-sm text-ink-900">
            ✅ Full bundle ready to submit. 🙏
          </div>
        )}
        <button
          type="submit"
          disabled={
            submitting ||
            photoUploading > 0 ||
            videoUploading > 0 ||
            spotUploading
          }
          className="inline-flex items-center justify-center gap-2 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-6 py-3 text-base shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Spinner /> Submitting...
            </>
          ) : (
            <>🙏 Submit bhandara</>
          )}
        </button>
        <p className="text-center text-xs text-ink-600">
          By submitting you confirm all photos + videos were taken at this bhandara today.
        </p>
      </div>
    </form>
  );
}

/* ─── Helper sub-components ────────────────────────────────── */

function CodeBanner({
  code,
  locked,
  onChange,
  onLock,
}: {
  code: string;
  locked: boolean;
  onChange: (v: string) => void;
  onLock: () => void;
}) {
  if (locked && isValidVolunteerCodeShape(code)) {
    return (
      <div className="rounded-xl border border-leaf-600/40 bg-leaf-600/5 px-3 py-2 flex items-center justify-between gap-2">
        <span className="text-sm text-ink-900">
          ✓ Submitting as <strong className="font-fraunces">{code}</strong>
        </span>
        <Link
          href="/volunteer/signup"
          className="text-xs text-ink-600 underline hover:text-saffron-600"
        >
          Not you?
        </Link>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-saffron-600/40 bg-saffron-50/60 p-3">
      <label className="grid gap-1.5">
        <span className="text-sm text-ink-900">
          Paste your volunteer code (e.g. BM-LKO-X7K2M9)
        </span>
        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            placeholder="BM-LKO-XXXXXX"
            autoCapitalize="characters"
            spellCheck={false}
            className="flex-1 rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 font-fraunces tracking-wider focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
          />
          <button
            type="button"
            onClick={onLock}
            disabled={!isValidVolunteerCodeShape(code)}
            className="shrink-0 inline-flex items-center justify-center rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-4 py-2 text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Use code
          </button>
        </div>
        <span className="text-xs text-ink-600">
          Don't have one?{" "}
          <Link href="/volunteer/signup" className="underline hover:text-saffron-600">
            Sign up here →
          </Link>
        </span>
      </label>
    </div>
  );
}

function GpsBanner({
  gps,
  onRecapture,
}: {
  gps: GpsState;
  onRecapture: () => void;
}) {
  if (gps.kind === "pending") {
    return (
      <div className="rounded-xl border border-gold-500/40 bg-cream-50 px-3 py-2 text-sm text-ink-600 flex items-center gap-2">
        <Spinner /> Getting your location…
      </div>
    );
  }
  if (gps.kind === "captured") {
    return (
      <div className="rounded-xl border border-leaf-600/40 bg-leaf-600/5 px-3 py-2 flex items-center justify-between gap-2">
        <span className="text-sm text-ink-900">
          📍 Location captured · accuracy {Math.round(gps.accuracy)}m
        </span>
        <button
          type="button"
          onClick={onRecapture}
          className="text-xs text-ink-600 underline hover:text-saffron-600"
        >
          Re-capture
        </button>
      </div>
    );
  }
  if (gps.kind === "denied") {
    return (
      <div className="rounded-xl border border-alert-500/40 bg-alert-500/10 px-3 py-2 text-sm text-alert-500">
        ⚠️ Location permission denied. Please enable location in your browser settings + reload. Submissions without GPS may be rejected.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-alert-500/40 bg-alert-500/10 px-3 py-2 flex items-center justify-between gap-2">
      <span className="text-sm text-alert-500">⚠️ GPS error: {gps.message}</span>
      <button
        type="button"
        onClick={onRecapture}
        className="text-xs text-alert-500 underline hover:text-alert-500/80"
      >
        Retry
      </button>
    </div>
  );
}

function Field({
  label,
  labelHi,
  name,
  required,
  placeholder,
  hint,
  error,
  list,
}: {
  label: string;
  labelHi?: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  error?: string;
  list?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm text-ink-600">
        {label}
        {labelHi ? <span className="ml-1 text-ink-600">· {labelHi}</span> : null}
        {required ? <span className="text-sindoor-700"> *</span> : null}
      </span>
      <input
        name={name}
        type="text"
        required={required}
        placeholder={placeholder}
        list={list}
        className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
      />
      {hint ? <span className="text-xs text-ink-600">{hint}</span> : null}
      {error ? <span className="text-xs text-alert-500">{error}</span> : null}
    </label>
  );
}

function FieldArea({
  label,
  labelHi,
  name,
  required,
  placeholder,
  error,
}: {
  label: string;
  labelHi?: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm text-ink-600">
        {label}
        {labelHi ? <span className="ml-1 text-ink-600">· {labelHi}</span> : null}
        {required ? <span className="text-sindoor-700"> *</span> : null}
      </span>
      <textarea
        name={name}
        rows={3}
        required={required}
        placeholder={placeholder}
        className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
      />
      {error ? <span className="text-xs text-alert-500">{error}</span> : null}
    </label>
  );
}

function SuccessCard({
  submissionId,
  code,
}: {
  submissionId: string;
  code: string;
}) {
  return (
    <div className="grid gap-5 text-center">
      <p className="text-4xl">✅</p>
      <div>
        <h2 className="font-fraunces text-2xl sm:text-3xl text-sindoor-700">
          Submitted! 🙏
        </h2>
        <p className="mt-2 text-sm text-ink-600">
          We'll review within 24 hours. Once approved, your bhandara
          goes live on the public directory + city map. Thank you
          for your seva 🙏
        </p>
        <p className="mt-1 text-xs text-ink-600 font-mono">
          ID: {submissionId.slice(0, 12)}…
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href={`/volunteer/submit?code=${code}`}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-6 py-3 text-base shadow-sm transition-colors"
        >
          📸 Submit another bhandara
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-gold-500/60 bg-white hover:bg-cream-50 text-ink-900 font-medium px-6 py-3 text-base transition-colors"
        >
          🏠 Back to BadaMangal
        </Link>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-cream-50/40 border-t-cream-50"
    />
  );
}

/* ─── Error humanizers ─────────────────────────────────────── */

function humanizeUploadError(err: string): string {
  switch (err) {
    case "invalid_code":
    case "unknown_code":
      return "Your volunteer code wasn't recognised. Re-check it on the form above.";
    case "suspended":
      return "Your account has been suspended. Contact the team.";
    case "no_file":
      return "No file selected.";
    case "unsupported_type":
      return "Use a JPG, PNG, WebP image, or a common video format.";
    case "photo_too_large":
      return "Photo is too large (max 12 MB). Try compressing it first.";
    case "video_too_large":
      return "Video is too large (max 60 MB). Try recording a shorter clip.";
    case "image_processing_failed":
      return "Couldn't process that image. Try a different one.";
    case "storage_failed":
      return "Couldn't save the file. Please retry.";
    default:
      return err.replace(/_/g, " ");
  }
}

function humanizeSubmitError(err: string | undefined): string {
  switch (err) {
    case "invalid_code":
    case "unknown_code":
      return "Your volunteer code wasn't recognised.";
    case "suspended":
      return "Your account has been suspended. Contact the team.";
    case "validation":
      return "Please fix the highlighted fields.";
    case "rate_limited":
      return "You've hit the daily submission cap. Resume tomorrow.";
    default:
      return "Something went wrong. Please try again.";
  }
}
