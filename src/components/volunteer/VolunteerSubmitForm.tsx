"use client";

/**
 * Volunteer bhandara submission form, the "fill it on your phone
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
 *      All inline in the same form, no multi-step wizard in Tier A.
 *   4. Media uploads: three buckets (10 photos / 2 videos / 1 spot
 *      photo). Each file uploads independently via fetch to
 *      /api/volunteer/upload-media; we track per-file state so the
 *      UI shows a tick when done.
 *   5. Submit: posts URL list to /api/volunteer/submit. Shows the
 *      success screen with "submit another" + "back to BadaMangal".
 *
 * Validation philosophy: minimal client-side gates beyond required
 * fields. The server is the source of truth, we let the user
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
  VOLUNTEER_VIDEO_DRIVE_URL,
  isValidVolunteerCodeShape,
  normaliseVolunteerCode,
} from "@/lib/volunteer";
import { resizeImageForUpload } from "@/lib/image-resize";
import { olaReverseGeocode } from "@/lib/geocode";

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
  // Videos are not uploaded through this form anymore, they go to
  // the shared Google Drive folder (see VOLUNTEER_VIDEO_DRIVE_URL).
  // The bundle check uses a self-attested checkbox; admin verifies
  // the Drive folder during moderation.
  const [videosUploadedToDrive, setVideosUploadedToDrive] = useState<boolean>(false);
  const [spotPhoto, setSpotPhoto] = useState<UploadedMedia | null>(null);
  // Area + address are controlled inputs so the reverse-geocoder
  // can pre-fill them from the captured GPS coords. We track
  // user-touched flags via refs (not state, flag flips never need
  // to trigger a re-render) so the auto-fill effect knows to skip
  // any field the volunteer has already typed in.
  const [areaValue, setAreaValue] = useState<string>("");
  const [addressValue, setAddressValue] = useState<string>("");
  const [autoFilled, setAutoFilled] = useState<{ area: boolean; address: boolean }>({
    area: false,
    address: false,
  });
  const userTouchedRef = useRef<{ area: boolean; address: boolean }>({
    area: false,
    address: false,
  });
  const [photoUploading, setPhotoUploading] = useState<number>(0);
  const [spotUploading, setSpotUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<SubmitPhase>({ kind: "form" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const photoInputRef = useRef<HTMLInputElement | null>(null);
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
        /* private browsing / storage disabled, fine */
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

  // ─── Auto-fill area + address from GPS via Ola reverse-geocode
  //
  // Fires whenever GPS state flips to "captured". Background fetch
  // → fills `areaValue` and `addressValue` ONLY if the volunteer
  // hasn't manually edited those fields yet (tracked via the
  // userTouchedRef so a re-capture doesn't clobber typed text).
  // Fail-open: any API error / null result just leaves the fields
  // empty and the volunteer fills them by hand. The cleanup flag
  // protects against a stale request landing after recapture.
  useEffect(() => {
    if (gps.kind !== "captured") return;
    let cancelled = false;
    void olaReverseGeocode(gps.lat, gps.lng).then((r) => {
      if (cancelled || !r) return;
      const nextArea = r.area ?? r.geoNeighborhood ?? r.geoDistrict ?? null;
      const filled = { area: false, address: false };
      if (nextArea && !userTouchedRef.current.area) {
        setAreaValue(nextArea);
        filled.area = true;
      }
      if (r.formatted && !userTouchedRef.current.address) {
        setAddressValue(r.formatted);
        filled.address = true;
      }
      if (filled.area || filled.address) {
        setAutoFilled(filled);
        trackEvent("volunteer_address_autofilled", {
          area: filled.area ? 1 : 0,
          address: filled.address ? 1 : 0,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [gps]);

  // ─── Upload helpers ──────────────────────────────────────────
  async function uploadOne(file: File): Promise<UploadedMedia> {
    // Client-side resize for images BEFORE the network hop. Drops
    // a 5-12 MB phone photo to ~500 KB → 5-10x faster upload on 4G.
    // Non-images and HEIC files pass through unchanged (server's
    // sharp handles them). Fully fail-open: any error returns the
    // original file.
    const fileToUpload = await resizeImageForUpload(file);
    const fd = new FormData();
    fd.append("file", fileToUpload);
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

  // handleVideoPick was removed when videos moved to Google Drive
  // (Section 3 of the form now shows a Drive folder link + a
  // confirmation checkbox instead of an in-app file picker). The
  // server upload endpoint still accepts video MIME types, kept
  // as a safety net + for the parked paid-version flow.

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
    const userNotes = String(fd.get("volunteerNotes") ?? "").trim();
    // Auto-prepend a Drive marker to volunteerNotes so the admin
    // moderation queue surfaces "this volunteer says they uploaded
    // videos to Drive, go check folder X" at a glance. Volunteer's
    // own note text follows after a blank line.
    const drivePrefix = videosUploadedToDrive
      ? "[Videos in Drive folder, prefixed with volunteer code]\n\n"
      : "[Videos NOT marked as uploaded to Drive]\n\n";
    const composedNotes = `${drivePrefix}${userNotes}`.trim();

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
      volunteerNotes: composedNotes,
      photoUrls: photos.map((p) => p.url),
      // videoUrls stays in the payload shape (server expects the
      // key) but is always empty now, videos live in Google Drive.
      videoUrls: [] as string[],
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
        videos_in_drive: videosUploadedToDrive ? 1 : 0,
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
  // Videos go to Google Drive now (see VOLUNTEER_VIDEO_DRIVE_URL) ,
  // the bundle check is a self-attested checkbox the volunteer
  // ticks after uploading there. We can't programmatically verify
  // the Drive upload happened, but the admin reviews the folder
  // when moderating the submission.
  const videoBundleOk = videosUploadedToDrive;
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

      {/* GPS banner, silently captures on mount. Shows status + re-capture. */}
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
          {/* Area + address are controlled so the reverse-geocoder
              (effect on gps state above) can pre-fill them from the
              captured GPS coords. Volunteer can edit anything that
              landed; once they touch a field, userTouchedRef flips
              and a later GPS re-capture won't overwrite their
              changes. */}
          <label className="grid gap-1.5">
            <span className="text-sm text-ink-600">
              Area / mohalla
              <span className="ml-1 text-ink-600">· क्षेत्र / मोहल्ला</span>
              <span className="text-sindoor-700"> *</span>
            </span>
            <input
              name="area"
              type="text"
              required
              value={areaValue}
              onChange={(e) => {
                userTouchedRef.current.area = true;
                setAutoFilled((p) => ({ ...p, area: false }));
                setAreaValue(e.target.value);
              }}
              placeholder="e.g. Hazratganj, Aliganj"
              list="vol-area-suggestions"
              className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
            />
            {autoFilled.area ? (
              <span className="text-xs text-leaf-600">
                📍 Auto-filled from GPS. Edit if needed.
              </span>
            ) : null}
            {fieldErrors.area ? (
              <span className="text-xs text-alert-500">{fieldErrors.area}</span>
            ) : null}
          </label>
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

        <label className="grid gap-1.5">
          <span className="text-sm text-ink-600">
            Full address
            <span className="ml-1 text-ink-600">· पूरा पता</span>
            <span className="text-sindoor-700"> *</span>
          </span>
          <textarea
            name="address"
            rows={3}
            required
            value={addressValue}
            onChange={(e) => {
              userTouchedRef.current.address = true;
              setAutoFilled((p) => ({ ...p, address: false }));
              setAddressValue(e.target.value);
            }}
            placeholder="Street + landmark + area, e.g. Swati-Krutika Apartment Gate, CG City, Ansal API"
            className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
          />
          {autoFilled.address ? (
            <span className="text-xs text-leaf-600">
              📍 Auto-filled from GPS. Edit / add landmark if it helps devotees find the spot.
            </span>
          ) : null}
          {fieldErrors.address ? (
            <span className="text-xs text-alert-500">{fieldErrors.address}</span>
          ) : null}
        </label>

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

      {/* ─── Section 3: Videos via Google Drive ───────────────────
          Phone videos are 30-120 MB each and in-app upload over 4G
          is slow and failure-prone, with no server-side ffmpeg to
          transcode. Videos route through a shared Google Drive
          folder instead. Volunteer prefixes their code on each
          filename so admin can match Drive uploads to submissions
          during moderation. */}
      <fieldset className="grid gap-3">
        <legend className="font-fraunces text-lg text-sindoor-700">
          3. 2 videos {videoBundleOk ? "✅" : "(via Google Drive)"}
        </legend>
        <p className="text-xs text-ink-600">
          10-30 sec each. One pandal pan, one prasad-serving moment.
          Upload them to our shared Google Drive folder (phone
          videos are too large to upload here directly).
        </p>

        <div className="mt-1 rounded-2xl border border-gold-500/45 bg-cream-50 p-4 space-y-3">
          {/* Step A: open the Drive folder in a new tab */}
          <div>
            <p className="text-sm font-medium text-ink-900">
              1. Drive folder खोलिए · Open the Drive folder
            </p>
            <a
              href={VOLUNTEER_VIDEO_DRIVE_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-ga="volunteer_open_drive_folder"
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-4 py-2 text-sm shadow-sm transition-colors"
            >
              📂 Open Google Drive folder ↗
            </a>
          </div>

          {/* Step B: naming convention with the volunteer's code */}
          <div>
            <p className="text-sm font-medium text-ink-900">
              2. File का नाम इस तरह रखें · Name your files like
            </p>
            <p className="mt-1.5 text-sm font-mono text-sindoor-700 bg-saffron-50 inline-block px-2.5 py-1 rounded border border-saffron-600/35">
              {code || "BM-LKO-XXXXXX"}_bhandara-name.mp4
            </p>
            <p className="mt-1.5 text-xs text-ink-600">
              आपका volunteer code <strong>{code || ","}</strong> file
              के नाम के शुरू में लगाएं ताकि हम आपकी video पहचान सकें।
            </p>
            <p className="text-xs text-ink-600">
              Prefix every video file with your code so we can match
              your Drive uploads to this submission.
            </p>
          </div>

          {/* Step C: confirmation checkbox, gates the bundle */}
          <label className="flex items-start gap-2.5 mt-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={videosUploadedToDrive}
              onChange={(e) => {
                setVideosUploadedToDrive(e.target.checked);
                if (e.target.checked) {
                  trackEvent("volunteer_videos_drive_confirmed", {});
                }
              }}
              className="mt-1 h-4 w-4 accent-saffron-600 shrink-0"
            />
            <span className="text-sm text-ink-900">
              <strong>
                ✅ मैंने अपनी videos Drive folder में upload कर दी हैं
              </strong>
              <br />
              <span className="text-xs text-ink-600">
                I've uploaded my 2 videos to the Google Drive folder,
                with my volunteer code as the filename prefix.
              </span>
            </span>
          </label>
        </div>
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
