"use client";

import { useRef, useState } from "react";
import BhandaraForm from "@/components/BhandaraForm";
import { FormPanel, Button } from "@/components/v2";
import { trackEvent } from "@/lib/ga";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * "I have a pamphlet, scan it" entry point on /list-bhandara.
 *
 * Phases:
 *   1. idle      , file picker (camera or library)
 *   2. scanning  , POST the chosen file to /api/public/scan-bhandara,
 *                  show a calm spinner while Gemini chews on it (5-12s
 *                  typical)
 *   3. form      , drop the extracted fields into <BhandaraForm /> as
 *                  initialValues, the form's existing 6-step flow
 *                  carries the rest. From the user's perspective they
 *                  arrive on step 1 with EVERY field they didn't have
 *                  to type already filled.
 *
 * On scan error we fall back to phase=form with NO initialValues, so
 * the user still gets to fill the form by hand without bouncing back
 * to the chooser; the uploaded photo (when we saved it before Gemini
 * failed) is passed through too so step 6 isn't a re-upload.
 */
type Phase = "idle" | "scanning" | "form" | "error";

// Shape returned by /api/public/scan-bhandara. Mirrors ExtractedBhandara
// from src/lib/vision.ts plus photoUrl + geocode. Inline-typed here so
// this component doesn't have to import from the server module.
type ScanResponse = {
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
  };
  geocode: { lat: number; lng: number; matched: string; source: string } | null;
};

// Same FormState shape BhandaraForm exposes via its initialValues prop.
// Inline-typed here (vs imported) because BhandaraForm doesn't export
// FormState and we don't want to break encapsulation just for this
// one consumer; Partial<> keeps us safe against future field additions.
type BhandaraFormSeed = Partial<{
  pin: {
    lat: number;
    lng: number;
    address: string;
    geoNeighborhood?: string;
    geoDistrict?: string;
    geoState?: string;
  } | null;
  name: string;
  area: string;
  description: string;
  addressOverride: string;
  landmark: string;
  tuesdayDates: string[];
  timeStart: string;
  timeEnd: string;
  menu: string[];
  menuOther: string[];
  menuOtherDraft: string;
  organizerName: string;
  organizerPhone: string;
  photoUrl: string;
}>;

/**
 * Map the server's scan response into the shape BhandaraForm wants.
 * Empty fields collapse to undefined so they fall through to INITIAL
 * inside the form instead of overwriting INITIAL's sensible defaults
 * (e.g. timeStart="11:00", menu=["puri","sabzi"]) with empty strings.
 */
function buildSeed(resp: ScanResponse): BhandaraFormSeed {
  const e = resp.extracted;
  const seed: BhandaraFormSeed = {
    photoUrl: resp.photoUrl,
  };
  if (e.name) seed.name = e.name;
  if (e.area) seed.area = e.area;
  if (e.description) seed.description = e.description;
  if (e.address) seed.addressOverride = e.address;
  if (e.landmark) seed.landmark = e.landmark;
  if (e.dateIsoList && e.dateIsoList.length > 0) {
    seed.tuesdayDates = e.dateIsoList;
  }
  if (e.timeStart) seed.timeStart = e.timeStart;
  if (e.timeEnd) seed.timeEnd = e.timeEnd;
  if (e.menu && e.menu.length > 0) seed.menu = e.menu;
  if (e.menuOther && e.menuOther.length > 0) seed.menuOther = e.menuOther;
  if (e.organizerName) seed.organizerName = e.organizerName;
  if (e.organizerPhone) seed.organizerPhone = e.organizerPhone;
  // Geocoded pin → BhandaraForm step 1's PinValue. Only seed when the
  // geocode succeeded; a null geocode just leaves the pin empty and
  // the user drops it on the map themselves (which step 1 already
  // supports as the default flow).
  if (resp.geocode) {
    seed.pin = {
      lat: resp.geocode.lat,
      lng: resp.geocode.lng,
      address: e.address ?? resp.geocode.matched,
    };
  }
  return seed;
}

export default function BhandaraScanner() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";

  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [seed, setSeed] = useState<BhandaraFormSeed | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function pickFile(f: File | null) {
    if (!f) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    setFile(f);
    // Local object URL so the user gets immediate visual confirmation
    // they picked the right file before committing 5-12s of scan
    // latency. Revoke the previous URL to avoid leaking blobs.
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
    trackEvent("scan_file_pick", { size_kb: Math.round(f.size / 1024) });
  }

  async function startScan() {
    if (!file) return;
    setPhase("scanning");
    setErrorMessage(null);
    trackEvent("scan_start", { size_kb: Math.round(file.size / 1024) });

    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/public/scan-bhandara", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as
        | ScanResponse
        | { error?: string; message?: string; photoUrl?: string };
      if (!res.ok || !("extracted" in json)) {
        const msg =
          ("message" in json && json.message) ||
          ("error" in json && json.error) ||
          "Scan failed. Please try again or fill the form by hand.";
        trackEvent("scan_error", { status: res.status, msg: msg.slice(0, 80) });
        // Soft fallback: if the server saved the photo but Gemini choked
        // (502 with photoUrl in payload), still seed the form with just
        // the photoUrl so the user doesn't have to re-upload it.
        if ("photoUrl" in json && typeof json.photoUrl === "string") {
          setSeed({ photoUrl: json.photoUrl });
          setErrorMessage(msg);
          setPhase("form");
          return;
        }
        setErrorMessage(msg);
        setPhase("error");
        return;
      }
      const built = buildSeed(json);
      trackEvent("scan_success", {
        had_geocode: json.geocode ? 1 : 0,
        date_count: json.extracted.dateIsoList?.length ?? 0,
        menu_count: json.extracted.menu?.length ?? 0,
      });
      setSeed(built);
      setPhase("form");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      trackEvent("scan_error", { status: 0, msg: msg.slice(0, 80) });
      setErrorMessage(msg);
      setPhase("error");
    }
  }

  function reset() {
    // Tag resets fired from the post-scan banner separately from
    // resets fired from the idle-state "Remove" link (the latter
    // never reaches this function, pickFile(null) handles it
    // without a phase transition). `from_phase` lets GA distinguish
    // "scanned but didn't like the extraction" from quieter resets.
    trackEvent("scan_reset", { from_phase: phase });
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setSeed(null);
    setErrorMessage(null);
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  // ── Phase: form ────────────────────────────────────────────────────
  // Once we have a seed (or the soft-fallback photoUrl), render the
  // existing 6-step form pre-filled. A slim banner up top tells the
  // user what just happened so they know to verify the fields.
  if (phase === "form") {
    return (
      <div className="grid gap-6">
        <div className={errorMessage ? "bmi-alert" : "bmi-fnote"} style={{ alignItems: "center" }}>
          {errorMessage ? null : (
            <span className="ic" aria-hidden>
              <IconSparkle />
            </span>
          )}
          <span className="flex-1">
            <b>
              {errorMessage
                ? isHi
                  ? "AI से पढ़ा नहीं जा सका, फॉर्म स्वयं भरें।"
                  : "AI couldn't read this pamphlet, please fill the form by hand."
                : isHi
                  ? "AI ने जो पढ़ा वह नीचे भर दिया है।"
                  : "We've pre-filled what we could read."}
            </b>{" "}
            {isHi
              ? "हर फ़ील्ड एक बार ज़रूर देख लें।"
              : "Please review each step and fix anything it missed."}
          </span>
          <button type="button" onClick={reset} className="bmi-tl shrink-0">
            {isHi ? "अलग पैम्फलेट" : "Different pamphlet"}
          </button>
        </div>
        {/* entryMethod="scan" lets BhandaraForm tag its submit-related
            GA events so we can split conversion: scan-pre-filled
            submissions vs typed-from-scratch. Same FormState shape,
            same /api/bhandaras endpoint, same admin moderation gate. */}
        <BhandaraForm
          initialValues={seed ?? undefined}
          entryMethod="scan"
        />
      </div>
    );
  }

  // ── Phase: scanning ────────────────────────────────────────────────
  if (phase === "scanning") {
    return (
      <FormPanel>
        <div className="bmi-done" aria-live="polite">
          <div className="bmi-drop-ic" style={{ margin: "0 auto 16px" }} aria-hidden>
            <SpinnerLarge />
          </div>
          <h2 className={`bmi-h3 ${isHi ? "" : "lat"}`}>
            {isHi ? "पैम्फलेट पढ़ा जा रहा है…" : "Reading your pamphlet…"}
          </h2>
          <p className="bmi-lede" style={{ marginTop: 8 }}>
            {isHi
              ? "इसमें 5 से 12 सेकंड लगते हैं। कृपया प्रतीक्षा करें।"
              : "Takes about 5 to 12 seconds. Hang tight."}
          </p>
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              className="bmi-drop-img mt-6 mx-auto max-h-64 object-contain"
            />
          ) : null}
        </div>
      </FormPanel>
    );
  }

  // ── Phase: idle / error ────────────────────────────────────────────
  // Two visual states share this branch:
  //   • no file yet → dotted drop-zone with both pick buttons inside,
  //     "Scan with AI" CTA is HIDDEN (showing it greyed-out before
  //     the user picks anything reads as a broken/disabled CTA)
  //   • file picked → preview block replaces the drop-zone; "Scan
  //     with AI" appears below as the obvious next action, sized +
  //     styled to match the chooser-page CTAs via btn btn-gold
  return (
    <FormPanel>
      {/* The single native file input is referenced by both pick
          buttons; toggling the `capture` attr decides whether the
          OS opens the camera (Take photo) or the file library
          (Choose file). */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        className="sr-only"
        aria-label={isHi ? "पैम्फलेट चुनें" : "Pick a pamphlet image"}
      />

      <div className="grid gap-5">
        {!file ? (
          <div className="bmi-drop">
            <span className="bmi-drop-ic" aria-hidden>
              <IconUpload />
            </span>
            <p className="bmi-drop-t" lang={isHi ? "hi" : "en"}>
              {isHi
                ? "पैम्फलेट की फ़ोटो चुनें या खींचें"
                : "Choose a pamphlet image or take a photo"}
            </p>
            <div className="bmi-drop-acts">
              <button
                type="button"
                onClick={() => {
                  if (inputRef.current) {
                    inputRef.current.removeAttribute("capture");
                    inputRef.current.click();
                  }
                }}
                className="bmi-b bmi-b-s sm"
              >
                <IconUpload />
                <span>{isHi ? "फ़ाइल चुनें" : "Choose file"}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (inputRef.current) {
                    inputRef.current.setAttribute("capture", "environment");
                    inputRef.current.click();
                  }
                }}
                className="bmi-b bmi-b-s sm"
              >
                <IconCamera />
                <span>{isHi ? "फ़ोटो खींचें" : "Take photo"}</span>
              </button>
            </div>
          </div>
        ) : (
          // File picked: preview replaces the drop zone so the user
          // sees what they're about to scan.
          <div className="flex items-center gap-4">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt=""
                className="bmi-drop-img w-24 h-24 object-cover"
              />
            ) : null}
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-semibold text-ink-900 truncate">
                {file.name}
              </p>
              <p className="bmi-field-hint">
                {(file.size / 1024).toFixed(0)} KB
              </p>
              <button
                type="button"
                onClick={() => pickFile(null)}
                className="bmi-tl"
              >
                {isHi ? "हटाएँ" : "Remove"}
              </button>
            </div>
          </div>
        )}

        {errorMessage ? (
          <div className="bmi-alert" role="alert">
            {errorMessage}
          </div>
        ) : null}

        {file ? (
          // The one saffron action, only once a file is picked (a
          // greyed out button before that reads as broken).
          <Button onClick={() => void startScan()} block iconEnd="chevron">
            {isHi ? "AI से स्कैन करें" : "Scan with AI"}
          </Button>
        ) : null}

        <p className="bmi-field-hint text-center">
          {isHi
            ? "JPG, PNG या WebP, अधिकतम 5 MB। पते से GPS पिन भी अपने आप लग जाता है।"
            : "JPG, PNG or WebP, max 5 MB. We auto-place the GPS pin from the address."}
        </p>
      </div>
    </FormPanel>
  );
}

/* ── Icons ──────────────────────────────────────────────────────────── */

function IconUpload() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
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
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8h3l1.6-2h8.8L18 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.5" r="3.6" />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2 L13.5 8.5 L20 10 L13.5 11.5 L12 18 L10.5 11.5 L4 10 L10.5 8.5 Z" />
    </svg>
  );
}

function SpinnerLarge() {
  return (
    <svg
      className="motion-safe:animate-spin"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
