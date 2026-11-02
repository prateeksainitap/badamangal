"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import PhotoPicker from "@/components/PhotoPicker";
import { trackEvent } from "@/lib/ga";
import { playJaiShreeRam } from "@/lib/playJaiShreeRam";
import { haversineKm } from "@/lib/geo";
import type { Locale } from "@/content/strings";
import { strings } from "@/content/strings";
import { olaAutocomplete, olaReverseGeocode } from "@/lib/geocode";
import { useLocaleFromContext } from "@/lib/locale-context";
import { isInAnyCity } from "@/lib/cities";
import { FormPanel, FormSkin, Field, Heading, Icon } from "@/components/v2";

// Leaflet pin-drop map is client-only; lazy-load so it never ships in
// the SSR bundle and only loads when the user opens the Edit panel.
const PinDropMap = dynamic(() => import("@/components/PinDropMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[260px] w-full rounded-[20px] bg-[#f5efe3] motion-safe:animate-pulse" />
  ),
});

type ListedBhandara = {
  id: string;
  slug: string;
  name: string;
  nameHi: string | null;
  area: string;
  lat: number;
  lng: number;
};

type Props = {
  /** Optional override; component reads the real locale from the
   *  LocaleProvider context so it can update after the user toggles
   *  language without a hard reload. */
  locale?: Locale;
  bhandaras: ListedBhandara[];
};

type Stage = "compose" | "submitting" | "done" | "error";
type LocStatus =
  | "idle"
  | "asking"
  | "ok"
  | "denied"
  | "outOfBounds"
  | "unsupported";

const DRAFT_KEY = "bm:spot:draft:v2";

// Lucknow bounding box (same one /api/spots validates against).
/**
 * MULTI-CITY (2026-07): was the Lucknow box inlined here. A citizen at
 * a Kanpur bhandara had their pin silently treated as out-of-area.
 * Now any served city counts.
 */
const inServedCity = (lat: number, lng: number) => isInAnyCity(lat, lng);

/**
 * Spot form, designed for "1 minute, every age group".
 *
 * Stripped to the dominant case: someone walking past a bhandara,
 * holding a phone. Auto-requests location on mount, photo opens the
 * rear camera, every other field is optional, and the page is one
 * continuous flow with no numbered "Step" cards.
 *
 * Form data is intentionally NOT persisted across visits, every load
 * of /spot starts fresh. (See cleanup effect below.)
 */
export default function SpotQuickForm({
  locale: _localeProp,
  bhandaras,
}: Props) {
  const locale = useLocaleFromContext();
  const router = useRouter();
  const t = strings[locale];
  const isHi = locale === "hi";

  const [photoUrl, setPhotoUrl] = useState("");
  // Extra photos beyond the primary. Up to 5 (the API caps at 5 too).
  // Uploaded via a multi-file input below the primary PhotoPicker ,
  // see the ExtraPhotosUploader sub-component below.
  const [extraPhotoUrls, setExtraPhotoUrls] = useState<string[]>([]);
  const [reporterName, setReporterName] = useState("");
  const [caption, setCaption] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [areaLabel, setAreaLabel] = useState<string | null>(null);
  const [areaKey, setAreaKey] = useState<string | null>(null); // raw area enum
  /** Full formatted address from Ola reverse-geocode, shown under the
   *  "near X" line so the user can verify the exact street the pin is on. */
  const [formattedAddress, setFormattedAddress] = useState<string | null>(null);
  const [locStatus, setLocStatus] = useState<LocStatus>("idle");
  const [locError, setLocError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("compose");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const successRef = useRef<HTMLDivElement | null>(null);
  const askedOnce = useRef(false);

  // Manual edit mode, opened by the "Edit" button on the location chip.
  // Shows an address search (Nominatim) + a tap-to-drop Leaflet map so
  // the user can correct the auto-detected location.
  const [editingLocation, setEditingLocation] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{
      id: string;
      label: string;
      secondary?: string;
      lat: number;
      lng: number;
    }>
  >([]);
  const [searching, setSearching] = useState(false);
  /** Mirror of PinDropStep's skip flag, see comment there. Set to true
   *  by the suggestion-pick handler so the next searchQuery change
   *  doesn't reopen the dropdown after a selection. */
  const skipNextSearchFetch = useRef(false);

  /* ── Manual address search (only runs while editing) ─────────────────── */
  // Backed by the shared Ola Maps Autocomplete helper, caches identical
  // queries, debounces network calls, and degrades to `[]` on quota /
  // network errors so the panel stays usable.
  useEffect(() => {
    if (skipNextSearchFetch.current) {
      skipNextSearchFetch.current = false;
      return;
    }
    const q = searchQuery.trim();
    if (!editingLocation || q.length < 2) {
      setSearchResults([]);
      return;
    }
    const controller = new AbortController();
    const id = window.setTimeout(async () => {
      setSearching(true);
      try {
        const hits = await olaAutocomplete(q, { signal: controller.signal });
        setSearchResults(
          hits.map((h) => ({
            id: h.id,
            label: h.label,
            secondary: h.secondary,
            lat: h.lat,
            lng: h.lng,
          })),
        );
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(id);
    };
  }, [searchQuery, editingLocation]);

  // Update area label whenever coords change. Two sources, in order of
  // preference:
  //   1. Closest listed bhandara within 4 km, gives us the curated area
  //      key (used both for the friendly label AND for the spot's `area`
  //      field on submit).
  //   2. Ola reverse-geocode, fills the chip with a real-world locality
  //      (suburb / neighbourhood / city) so the user always sees a
  //      recognisable name, not just "Got your location".
  const inferArea = (lat: number, lng: number) => {
    let listedHit = false;
    if (bhandaras.length > 0) {
      let closest: { area: string; km: number } | null = null;
      for (const b of bhandaras) {
        const km = haversineKm({ lat, lng }, { lat: b.lat, lng: b.lng });
        if (!closest || km < closest.km) closest = { area: b.area, km };
      }
      if (closest && closest.km <= 4) {
        setAreaKey(closest.area);
        setAreaLabel(t.areas[closest.area] ?? closest.area);
        listedHit = true;
      } else {
        setAreaKey(null);
        // Clear any stale label from a previous pin so we don't show
        // "near Aliganj" while the new reverse-geocode is in flight.
        setAreaLabel(null);
      }
    }
    // Clear stale formatted address as well; the new reverse-geocode
    // below will refill it (or leave it null if the API errors).
    setFormattedAddress(null);

    // Reverse-geocode in the background. We want BOTH:
    //   - `area` for the "near X" line
    //   - the full formatted address for the verification line below
    // Curated bhandara area names still win for the `near X` chip
    // (listedHit gate), but the formatted address is always taken from
    // Ola so the user sees the actual street.
    void olaReverseGeocode(lat, lng).then((r) => {
      if (!r) return;
      if (r.formatted) setFormattedAddress(r.formatted);
      if (listedHit) return; // curated area name wins for the "near X" chip
      const area =
        r.area ?? r.geoNeighborhood ?? r.geoDistrict ?? null;
      if (area) setAreaLabel(area);
    });
  };

  const setManualCoords = (lat: number, lng: number) => {
    const inBounds =
      inServedCity(lat, lng);
    if (!inBounds) {
      setLocStatus("outOfBounds");
      setCoords({ lat, lng });
      return;
    }
    setCoords({ lat, lng });
    setLocStatus("ok");
    setLocError(null);
    inferArea(lat, lng);
  };

  /* ── Cleanup any stale draft on mount ─────────────────────────────────
   * Earlier versions of this form persisted in-progress data to
   * localStorage so a phone-screen-off mid-flow could resume. That
   * surprised users who navigated away and came back to find old data
   * still there, the form should always feel fresh on a new visit.
   *
   * We:
   *   1. Wipe any draft from the previous session on mount.
   *   2. Wipe again on unmount (covers client-side navigation away).
   *   3. Wipe on `beforeunload` (covers tab close / hard navigation).
   * The DRAFT_KEY is preserved as a constant so older drafts written by
   * past versions of the form get cleaned up too. */
  useEffect(() => {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    const wipe = () => {
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("beforeunload", wipe);
    return () => {
      window.removeEventListener("beforeunload", wipe);
      wipe();
    };
  }, []);

  /* ── Auto-request geolocation on mount ───────────────────────────────── */
  const askLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocStatus("unsupported");
      return;
    }
    setLocStatus("asking");
    setLocError(null);
    trackEvent("spot_locate_request");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        const inBounds =
          inServedCity(lat, lng);
        if (!inBounds) {
          setLocStatus("outOfBounds");
          setCoords({ lat, lng });
          trackEvent("spot_locate_out_of_bounds");
          return;
        }

        setCoords({ lat, lng });
        setLocStatus("ok");
        trackEvent("spot_locate_success");
        // inferArea handles both the curated-area lookup and the
        // Nominatim fallback so the chip always carries a name.
        inferArea(lat, lng);
      },
      (err) => {
        setLocStatus("denied");
        setLocError(err.message);
        trackEvent("spot_locate_error", { code: err.code });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60_000 },
    );
  };

  useEffect(() => {
    if (askedOnce.current) return;
    askedOnce.current = true;
    askLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Submit ──────────────────────────────────────────────────────────── */
  // Photo OR caption is required (not caption alone) so non-typing users
  // can post a spot with just a photo.
  const hasPhoto = photoUrl.length > 0;
  const hasCaption = caption.trim().length >= 3;
  const locReady = locStatus === "ok" && coords !== null;
  const canSubmit = locReady && (hasPhoto || hasCaption) && stage !== "submitting";

  const submit = async () => {
    if (!canSubmit || !coords) return;
    setStage("submitting");
    setSubmitError(null);
    trackEvent("spot_submit_attempt", {
      has_photo: hasPhoto ? 1 : 0,
      has_caption: hasCaption ? 1 : 0,
    });
    try {
      const res = await fetch("/api/spots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lat: coords.lat,
          lng: coords.lng,
          photoUrl,
          extraPhotoUrls: extraPhotoUrls.length > 0 ? extraPhotoUrls : undefined,
          caption: caption.trim() || undefined,
          area: areaKey ?? undefined,
          reporterName: reporterName.trim() || undefined,
          language: isHi ? "hi" : "en",
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setStage("error");
        setSubmitError(
          data?.error ??
            (isHi
              ? "रिपोर्ट नहीं हो पाई, फिर कोशिश करें।"
              : "Couldn't post. Please try again."),
        );
        trackEvent("spot_submit_error", { status: res.status });
        return;
      }
      trackEvent("spot_submit_success");
      playJaiShreeRam();
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      setStage("done");
      setTimeout(() => router.push(`/live${isHi ? "" : "?lang=en"}`), 1300);
    } catch {
      setStage("error");
      setSubmitError(
        isHi ? "नेटवर्क समस्या, फिर कोशिश करें।" : "Network problem. Try again.",
      );
      trackEvent("spot_submit_error", { status: 0 });
    }
  };

  // Scroll success card into view on mount.
  useEffect(() => {
    if (stage !== "done") return;
    const node = successRef.current;
    if (!node) return;
    const id = window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [stage]);

  /* ── Success state ───────────────────────────────────────────────────── */
  if (stage === "done") {
    return (
      <FormPanel>
        <div ref={successRef} className="bmi-done" aria-live="polite">
          <div className="bmi-done-tick" aria-hidden>
            <Icon name="check" />
          </div>
          <p className="bmi-kick" style={{ justifyContent: "center" }} lang={isHi ? "hi" : "en"}>
            {isHi ? "जय हनुमान" : "Jai Hanuman"}
          </p>
          <Heading
            as="h2"
            en="Thank you, your spot is live!"
            hi="धन्यवाद! भंडारा रिपोर्ट हो गया।"
          />
          <p className="bmi-lede">
            {isHi ? "लाइव फ़ीड पर ले जा रहे हैं…" : "Taking you to the live feed…"}
          </p>
        </div>
      </FormPanel>
    );
  }

  /* ── Compose state ───────────────────────────────────────────────────── */
  return (
    <>
      {/* The whole form is one panel, read as one continuous task. */}
      <FormPanel className="mb-28 sm:mb-0">
        <FormSkin>
        {/* PHOTO, primary delight, big tap target */}
        <section className="bmi-fsec">
          <h2 className="bmi-fh" lang={isHi ? "hi" : "en"}>
            <span className="ic" aria-hidden><IconCamera /></span>
            {isHi ? "एक फ़ोटो जोड़ें" : "Add a photo"}
          </h2>
          <p className="bmi-field-hint">
            {isHi
              ? "बैनर, पंडाल, या थाली। बिना फ़ोटो के भी आगे बढ़ सकते हैं।"
              : "The pandal, the kadhai, the line. You can still post without one."}
          </p>
          <PhotoPicker
            value={photoUrl}
            onChange={setPhotoUrl}
            locale={locale}
            layout="stacked"
          />
          {/* Extra photos, only once the first is set. */}
          {photoUrl ? (
            <ExtraPhotosUploader
              urls={extraPhotoUrls}
              onChange={setExtraPhotoUrls}
              isHi={isHi}
              max={5}
            />
          ) : null}
        </section>

        {/* LOCATION, auto-fetched */}
        <section className="bmi-fsec">
          <h2 className="bmi-fh" lang={isHi ? "hi" : "en"}>
            <span className="ic" aria-hidden><IconPin /></span>
            {isHi ? "आप कहाँ हैं?" : "Where are you right now?"}
          </h2>

          <LocationStatus
            status={locStatus}
            areaLabel={areaLabel}
            formattedAddress={formattedAddress}
            errorMessage={locError}
            isHi={isHi}
            onRetry={askLocation}
            onEdit={() => {
              setEditingLocation(true);
              trackEvent("spot_locate_edit_open");
            }}
          />

          {/* Manual edit: address search + tap-to-drop map. */}
          {editingLocation ? (
            <div className="grid gap-4" style={{ marginTop: 6 }}>
              <div className="flex items-center justify-between gap-2">
                <p className="bmi-ilabel">
                  {isHi ? "लोकेशन सही करें" : "Correct your location"}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingLocation(false);
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  className="bmi-tl"
                >
                  {isHi ? "हो गया" : "Done"}
                </button>
              </div>

              {/* Address search */}
              <div className="relative">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label={isHi ? "पता या निशानी खोजें" : "Search address or landmark"}
                  placeholder={
                    isHi
                      ? "पता या निशानी खोजें"
                      : "Search address or landmark"
                  }
                  className="w-full"
                  autoComplete="off"
                />
                {searching ? (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-ink-600">
                    …
                  </span>
                ) : null}
                {searchResults.length > 0 ? (
                  <ul
                    role="listbox"
                    className="absolute z-[1100] mt-2 w-full max-h-60 overflow-auto rounded-2xl bg-white"
                    style={{ boxShadow: "inset 0 0 0 1px rgba(201,162,74,0.45), 0 18px 36px -18px rgba(60,40,10,0.45)" }}
                  >
                    {searchResults.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => {
                            // Suppress the search effect's next run so
                            // the dropdown doesn't reopen after pick.
                            skipNextSearchFetch.current = true;
                            setManualCoords(r.lat, r.lng);
                            setSearchQuery(r.label);
                            setSearchResults([]);
                            trackEvent("spot_address_pick");
                          }}
                          className="block w-full text-left px-4 py-3 hover:bg-[#f5eac9]/60"
                        >
                          <span className="block text-[15px] text-ink-900 line-clamp-1">
                            {r.label}
                          </span>
                          {r.secondary ? (
                            <span className="block text-[13px] text-ink-600 mt-0.5 line-clamp-1">
                              {r.secondary}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    askLocation();
                    trackEvent("spot_locate_use_current");
                  }}
                  disabled={locStatus === "asking"}
                  className="bmi-b bmi-b-s sm"
                >
                  <IconCrosshair
                    className={
                      locStatus === "asking" ? "motion-safe:animate-spin" : ""
                    }
                  />
                  <span>
                    {locStatus === "asking"
                      ? isHi
                        ? "लोकेट कर रहे हैं…"
                        : "Locating…"
                      : isHi
                        ? "मेरी मौजूदा लोकेशन"
                        : "Use current location"}
                  </span>
                </button>
                <p className="bmi-field-hint">
                  {isHi
                    ? "या नक़्शे पर सही जगह टैप करें।"
                    : "Or tap the map below to drop the pin."}
                </p>
              </div>

              <PinDropMap
                lat={coords?.lat ?? null}
                lng={coords?.lng ?? null}
                onChange={({ lat, lng }) => {
                  setManualCoords(lat, lng);
                  trackEvent("spot_pin_drop");
                }}
                className="h-[260px] w-full rounded-[20px] overflow-hidden bg-[#f5efe3]"
              />
            </div>
          ) : null}
        </section>

        {/* OPTIONAL: one-line caption */}
        <Field
          label={isHi ? "भंडारे के बारे में लिखें" : "Write about the bhandara"}
          htmlFor="spot-v2-caption"
          optional={isHi ? "वैकल्पिक" : "optional"}
          lang={isHi ? "hi" : "en"}
        >
          <input
            id="spot-v2-caption"
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 200))}
            placeholder={
              isHi ? "जैसे: पूड़ी सब्ज़ी, बहुत भीड़ है" : "e.g. Puri sabzi, big crowd"
            }
            maxLength={200}
          />
        </Field>

        {/* OPTIONAL: name */}
        <Field
          label={isHi ? "आपका नाम" : "Your name"}
          htmlFor="spot-v2-name"
          optional={isHi ? "वैकल्पिक" : "optional"}
          lang={isHi ? "hi" : "en"}
        >
          <input
            id="spot-v2-name"
            type="text"
            value={reporterName}
            onChange={(e) => setReporterName(e.target.value)}
            placeholder={isHi ? "जैसे: प्रिया" : "e.g. Priya"}
            maxLength={60}
          />
        </Field>

        {/* In-page error banner */}
        {submitError ? (
          <div className="bmi-alert" role="alert">
            {submitError}
          </div>
        ) : null}

        {/* Inline submit (tablet and desktop; phones use the bar) */}
        <div className="hidden sm:flex pt-1.5">
          <SubmitButton
            isHi={isHi}
            stage={stage}
            disabled={!canSubmit}
            onClick={submit}
          />
        </div>
        </FormSkin>
      </FormPanel>

      {/* STICKY MOBILE BAR, keeps the primary action always reachable */}
      <div className="bmi-sbar sm:hidden">
        <SubmitButton
          isHi={isHi}
          stage={stage}
          disabled={!canSubmit}
          onClick={submit}
          fullWidth
        />
      </div>
    </>
  );
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */

function SubmitButton({
  isHi,
  stage,
  disabled,
  onClick,
  fullWidth,
}: {
  isHi: boolean;
  stage: Stage;
  disabled: boolean;
  onClick: () => void;
  fullWidth?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`bmi-b bmi-b-p ${fullWidth ? "block" : ""}`}
    >
      <IconBroadcast />
      <span>
        {stage === "submitting"
          ? isHi
            ? "भेजा जा रहा है…"
            : "Submitting…"
          : isHi
            ? "सबमिट करें"
            : "Submit"}
      </span>
    </button>
  );
}

function LocationStatus({
  status,
  areaLabel,
  formattedAddress,
  errorMessage,
  isHi,
  onRetry,
  onEdit,
}: {
  status: LocStatus;
  areaLabel: string | null;
  /** Full street address from reverse-geocode, shown under the
   *  "near X" line so the user can verify the exact spot. */
  formattedAddress: string | null;
  errorMessage: string | null;
  isHi: boolean;
  onRetry: () => void;
  /** Opens the manual edit panel (address search + map). */
  onEdit: () => void;
}) {
  if (status === "asking") {
    return (
      <p className="bmi-fnote" aria-live="polite">
        <span className="ic" aria-hidden>
          <IconCrosshair className="motion-safe:animate-spin" />
        </span>
        <span>
          {isHi
            ? "लोकेशन का अनुमति माँग रहे हैं…"
            : "Asking your phone for location…"}
        </span>
      </p>
    );
  }
  if (status === "ok") {
    // Icon, text stack and the Edit button share one optical midline.
    return (
      <div className="bmi-fnote" style={{ alignItems: "center" }}>
        <span className="ic" aria-hidden style={{ background: "var(--leaf)", color: "#fff", marginTop: 0 }}>
          <IconCheck />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block">
            {isHi ? "लोकेशन मिल गई" : "Got your location"}
            {areaLabel ? (isHi ? `, ${areaLabel} के पास` : `, near ${areaLabel}`) : ""}
          </b>
          {formattedAddress ? (
            <span className="block text-[13.5px] leading-snug line-clamp-2" title={formattedAddress}>
              {formattedAddress}
            </span>
          ) : !areaLabel ? (
            <span className="block text-[13.5px]">
              {isHi ? "नक़्शे पर पिन सही जगह दिख रहा है।" : "Pin is set on the map."}
            </span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={onEdit}
          aria-label={isHi ? "लोकेशन बदलें" : "Edit location"}
          className="bmi-tl shrink-0"
        >
          <IconPencil />
          <span>{isHi ? "बदलें" : "Edit"}</span>
        </button>
      </div>
    );
  }
  if (status === "outOfBounds") {
    return (
      <div className="bmi-alert" role="alert">
        <span className="flex-1">
          {isHi
            ? "हम अभी सिर्फ़ लखनऊ में स्पॉट लेते हैं। लखनऊ शहर के अंदर से रिपोर्ट करें।"
            : "We only cover Lucknow right now. Please post your spot from inside the city."}
          <button type="button" onClick={onRetry} className="bmi-tl" style={{ display: "flex" }}>
            <IconCrosshair /> <span>{isHi ? "फिर से लें" : "Retry"}</span>
          </button>
        </span>
      </div>
    );
  }
  if (status === "denied" || status === "unsupported") {
    return (
      <div className="grid gap-3">
        <p className="bmi-fnote warn">
          <span>
            <b className="block">
              {isHi ? "लोकेशन की अनुमति नहीं मिली।" : "Location permission was blocked."}
            </b>
            {isHi
              ? "ब्राउज़र की सेटिंग्स में लोकेशन ऑन करें, फिर नीचे का बटन दबाएँ।"
              : "Turn on location in your browser settings, then tap below."}
          </span>
        </p>
        <div>
          <button type="button" onClick={onRetry} className="bmi-b bmi-b-s sm">
            <IconCrosshair /> <span>{isHi ? "फिर से कोशिश करें" : "Try again"}</span>
          </button>
          {errorMessage ? <span className="bmi-sr">{errorMessage}</span> : null}
        </div>
      </div>
    );
  }
  // "idle", shouldn't show in practice since we auto-ask on mount
  return (
    <button type="button" onClick={onRetry} className="bmi-b bmi-b-s sm">
      <IconCrosshair /> <span>{isHi ? "मेरी लोकेशन इस्तेमाल करें" : "Use my current location"}</span>
    </button>
  );
}

/* ── Icons ──────────────────────────────────────────────────────────────── */

function IconCamera({ className = "" }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M3 7h3l2-2h8l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
function IconPin({ className = "" }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M12 21s-7-7-7-12a7 7 0 1 1 14 0c0 5-7 12-7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}
function IconPencil({ className = "" }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M3 21l3.5-1 11-11-2.5-2.5-11 11L3 21z" />
      <path d="M14.5 6.5l3 3" />
    </svg>
  );
}
function IconCrosshair({ className = "" }: { className?: string }) {
  return (
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
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
/**
 * Best-effort reverse geocode → returns the most "neighbourhood-y"
 * label Nominatim hands back (suburb / neighbourhood / city_district /
 * locality / town). Never throws, returns null on any failure so the
 * caller can fall back gracefully.
 */
// The previous local `reverseGeocode` helper was removed, every caller
// now uses `olaReverseGeocode` directly so we get the full
// ReverseGeocodeResult (area + formatted + geo* fields) in one shot.

function IconBroadcast() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12a7 7 0 0 1 14 0" />
      <path d="M3 12a9 9 0 0 1 18 0" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

/**
 * Multi-file uploader for extra spot photos.
 *
 * Stays deliberately small (~50 lines) and reuses the same
 * /api/uploads endpoint PhotoPicker hits, so the 5 MB cap, the
 * WebP re-encoding, and the upload-success GA event apply uniformly
 * regardless of which path the user uploaded through.
 *
 * Design notes:
 *   • Renders only when the primary photoUrl is set (parent handles
 *     this), keeps the form linear: pick one, then offer more.
 *   • Caps at `max` (defaults to 5). When the cap is hit, the input
 *     disables itself and the hint copy updates to "max reached".
 *   • Parallel upload (Promise.all) so adding 4 photos is one
 *     network round-trip of latency, not four.
 *   • Each uploaded photo gets a remove button (×) so a fat-finger
 *     pick is easy to undo without re-uploading the lot.
 */
function ExtraPhotosUploader({
  urls,
  onChange,
  isHi,
  max,
}: {
  urls: string[];
  onChange: (next: string[]) => void;
  isHi: boolean;
  max: number;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = Math.max(0, max - urls.length);
  const atCap = remaining === 0;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, remaining);
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    // Promise.allSettled (NOT .all) so a single failed upload doesn't
    // throw away every other successful upload's URL. Previously the
    // entire batch was abandoned on the first failure, even if 3 of
    // 4 photos had landed fine. Now successful uploads stick; only
    // the failed ones are reported.
    const results = await Promise.allSettled(
      files.map(async (f) => {
        const fd = new FormData();
        fd.append("file", f);
        const res = await fetch("/api/uploads", { method: "POST", body: fd });
        if (!res.ok) throw new Error("upload_failed");
        const data = (await res.json()) as { url?: string };
        if (!data.url) throw new Error("upload_failed");
        return data.url;
      }),
    );
    const uploaded = results
      .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
      .map((r) => r.value);
    const failedCount = results.length - uploaded.length;
    if (uploaded.length > 0) {
      onChange([...urls, ...uploaded]);
    }
    if (failedCount > 0) {
      setError(
        isHi
          ? `${failedCount} फ़ोटो अपलोड नहीं हुई${failedCount > 1 ? "ं" : ""}। बाकी ${uploaded.length} सुरक्षित।`
          : `${failedCount} photo${failedCount > 1 ? "s" : ""} failed to upload. ${uploaded.length} saved.`,
      );
    }
    setUploading(false);
    // reset input so picking the same file again re-fires onChange
    e.target.value = "";
  }

  return (
    <div className="grid gap-3" style={{ marginTop: 16 }}>
      <p className="bmi-field-hint">
        <b className="text-ink-900">{isHi ? "और फ़ोटो जोड़ें" : "Add more photos"}</b>{" "}
        {atCap
          ? isHi
            ? `(अधिकतम ${max} फ़ोटो, बस इतनी।)`
            : `(max ${max}, you're at the cap.)`
          : isHi
            ? `(${remaining} और जोड़ सकते हैं।)`
            : `(you can add ${remaining} more.)`}
      </p>
      {urls.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {urls.map((u, i) => (
            <li key={u + i} className="relative w-[72px] h-[72px] rounded-xl overflow-hidden bg-[#f5efe3]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="w-full h-full object-cover" loading="lazy" />
              <button
                type="button"
                onClick={() => onChange(urls.filter((_, j) => j !== i))}
                aria-label={isHi ? "हटाएँ" : "Remove"}
                className="absolute top-1 right-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#1a1410]/70 text-white"
              >
                <Icon name="plus" className="rotate-45" size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <label
        className={`bmi-b bmi-b-s sm ${atCap || uploading ? "opacity-50 cursor-not-allowed" : ""}`}
        style={{ justifySelf: "start" }}
      >
        <Icon name="plus" />
        <span>
          {uploading
            ? isHi
              ? "अपलोड हो रहा है…"
              : "Uploading…"
            : isHi
              ? "फ़ोटो चुनें"
              : "Pick photos"}
        </span>
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={atCap || uploading}
          onChange={onPick}
          className="sr-only"
        />
      </label>
      {error ? <p className="bmi-field-err" role="alert">{error}</p> : null}
    </div>
  );
}
