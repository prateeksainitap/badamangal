"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import SeasonDatePicker from "@/components/SeasonDatePicker";
import { playJaiShreeRam } from "@/lib/playJaiShreeRam";
// Keep the PinValue type as a type-only import so the dynamic-loaded
// component below doesn't need to re-export it. Types are erased at
// compile time and add zero bytes to the bundle.
import type { PinValue } from "@/components/PinDropStep";
import { useT } from "@/lib/useT";
import FancySelect from "@/components/FancySelect";
import TimeField from "@/components/TimeField";
import PhoneInput from "@/components/PhoneInput";
import UpiQrUpload from "@/components/UpiQrUpload";
import { FormPanel, FormSkin, Stepper, Field as KitField, Heading, Button, Icon } from "@/components/v2";

// Donations are off for now (Founder, Nov 2026): the organiser UPI and
// QR fields stay in the code and the payload, hidden from the public.
const SHOW_DONATIONS = false;

// Dynamic-import the heavy sub-components so the form's first paint
// doesn't have to wait for them.
//
// Previously /list-bhandara took 3-4s to render because PinDropStep
// pulls in the Ola Maps GL library (~120 KB of JS) and PhotoPicker
// pulls in browser camera/file-handling code (~40 KB). Both were
// eagerly bundled and parsed even though PinDropStep is only on
// step 1 and PhotoPicker is only on step 6, and step 1's pin drop
// is now OPTIONAL (since we ship the wave-3 form-UX cut), so many
// organisers will skip step 1 entirely without ever needing the map.
//
// `ssr: false` is safe here because both components are interactive
// (camera, geolocation, map clicks) and don't render anything
// useful on the server. The placeholder keeps the layout stable
// while the chunk loads, usually under 200ms on warm cache.
const PhotoPicker = dynamic(() => import("@/components/PhotoPicker"), {
  ssr: false,
  loading: () => (
    <div className="h-48 rounded-2xl bg-[#f5efe3] flex items-center justify-center text-sm text-ink-600 motion-safe:animate-pulse">
      Loading photo upload…
    </div>
  ),
});

const PinDropStep = dynamic(() => import("@/components/PinDropStep"), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] rounded-2xl bg-[#f5efe3] flex items-center justify-center text-sm text-ink-600 motion-safe:animate-pulse">
      Loading map…
    </div>
  ),
});
import { formatHindiDate, formatEnglishDate } from "@/lib/dates";
import { isListableDate, listingSeason } from "@/lib/season";
import { AREAS } from "@/lib/lucknow";
import { MENU_ITEMS, MENU_KEYS } from "@/lib/menu";
import { isValidIndianMobile } from "@/lib/validation";
import { strings } from "@/content/strings";
import { trackEvent } from "@/lib/ga";

type FieldErrors = Record<string, string[] | undefined>;

type FormState = {
  // Step 1
  pin: PinValue | null;
  // Step 2, single fields, accepts either script
  name: string;
  area: string;
  description: string;
  addressOverride: string;
  landmark: string;
  // Step 3
  tuesdayDates: string[];
  timeStart: string;
  timeEnd: string;
  // Step 4
  menu: string[];
  menuOther: string[];
  menuOtherDraft: string;
  // Step 5
  organizerName: string;
  organizerPhone: string;
  /** Optional UPI ID the organiser wants surfaced as a "Sponsor this
   *  bhandara" deep-link on the public detail page. Plain text (e.g.
   *  "rajesh@oksbi" / "9876543210@upi"). Persisted to Bhandara.upiId,
   *  which already exists on the production schema, so no migration
   *  is needed to support this field.
   *  Empty string = donations disabled for this listing. */
  upiId: string;
  /** Optional uploaded UPI QR image URL, companion to upiId. Some
   *  organisers only know their UPI as a printed QR (no idea of the
   *  text handle underneath); uploading the QR here lets us surface
   *  their actual QR on the public page instead of a client-generated
   *  one from the text. Either field alone, or both, is fine. */
  upiQrUrl: string;
  // Step 6
  photoUrl: string;
};

const INITIAL: FormState = {
  pin: null,
  name: "",
  area: "",
  description: "",
  addressOverride: "",
  landmark: "",
  tuesdayDates: [],
  timeStart: "11:00",
  timeEnd: "",
  menu: ["puri", "sabzi"],
  menuOther: [],
  menuOtherDraft: "",
  organizerName: "",
  organizerPhone: "",
  upiId: "",
  upiQrUrl: "",
  photoUrl: "",
};

type ApiOk = { id: string; slug: string };
type ApiErr = {
  error: string;
  issues?: { fieldErrors: FieldErrors; formErrors: string[] };
};

// The kit's FormSkin styles every input inside the form (52px field,
// gold hairline, saffron focus ring), so inputs carry no look of their own.
const inputBase = "w-full";

const TOTAL_STEPS = 6;

// localStorage key for autosaving form progress. Bumped on schema
// changes so a stale saved blob never re-hydrates into the wrong
// shape and crashes the form.
const AUTOSAVE_KEY = "bm.bhandaraForm.v1";
// How long a saved draft is considered valid (7 days). Past this we
// drop it on next mount, the organiser probably moved on, and we
// don't want to silently re-populate a half-finished form from
// weeks ago when they revisit /list-bhandara.
const AUTOSAVE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type AutosaveBlob = {
  step: number;
  state: FormState;
  savedAt: number;
};

function readAutosave(): AutosaveBlob | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AutosaveBlob;
    if (
      typeof parsed?.step !== "number" ||
      typeof parsed?.state !== "object" ||
      typeof parsed?.savedAt !== "number"
    ) {
      return null;
    }
    if (Date.now() - parsed.savedAt > AUTOSAVE_TTL_MS) {
      // Stale draft, clean up.
      window.localStorage.removeItem(AUTOSAVE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Optional pre-fill seed for the form. Passed in by the pamphlet-scan
 * entry point (BhandaraScanner): after Gemini extracts what it can
 * read off the uploaded banner, those values come in here so the user
 * lands on a form that's already filled out and only needs to verify
 * + fix gaps, instead of typing every field from scratch.
 *
 * Partial because Gemini's extraction is best-effort, every field
 * defaults back to INITIAL when not provided.
 *
 * `entryMethod` flows into GA so we can compare conversion rates
 * between the two paths (typed vs scan-pre-filled). Default "type"
 * covers the existing /list-bhandara?role=organizer entry; the
 * scanner sets "scan" explicitly. Future variants ("deeplink",
 * "campaign") slot in here without touching the event schema.
 */
type EntryMethod = "type" | "scan";
type BhandaraFormProps = {
  initialValues?: Partial<FormState>;
  entryMethod?: EntryMethod;
};

export default function BhandaraForm({
  initialValues,
  entryMethod = "type",
}: BhandaraFormProps = {}) {
  const { locale } = useT();
  const [step, setStep] = useState<number>(1);
  // Seed the form state with INITIAL + any caller-provided overrides
  // (typically from a pamphlet scan). useState's initializer runs once
  // per mount, so the merge happens exactly when the form first
  // renders, never on re-renders.
  const [state, setState] = useState<FormState>(() => ({
    ...INITIAL,
    ...(initialValues ?? {}),
  }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<ApiOk | null>(null);

  // ── Autosave restore on mount ──────────────────────────────────────
  // GA4 showed 88% of users who STARTED the form abandoned before
  // submit. Some of those drop-offs are real (changed their mind);
  // a meaningful chunk are accidental (mobile browser closed,
  // network drop, tab swipe, "back" navigation). Without persistence
  // they'd lose every field they typed.
  //
  // We persist the entire form state + current step to localStorage
  // on every change, and on mount we check for a saved draft. If one
  // exists, we silently restore it, the user re-opens /list-bhandara
  // and continues where they left off, no "would you like to
  // restore?" dialog (that itself is friction).
  //
  // EXCEPTION: when the caller passed initialValues (the scan-pamphlet
  // flow), skip the autosave restore. The fresh scan is more
  // current + intentional than whatever might have been left behind
  // from a previous abandoned session, restoring would silently
  // overwrite the freshly-extracted Gemini values with stale text.
  useEffect(() => {
    if (initialValues) return;
    const blob = readAutosave();
    if (blob) {
      // Merge with INITIAL so drafts saved BEFORE a new optional field
      // (e.g. upiId added 2026-05-25) was introduced don't hydrate as
      // undefined, every field in FormState stays a defined value.
      // Stale drafts keep all the data the organiser already typed;
      // newly-added fields simply default to their INITIAL value.
      // Drop dates from a season that has since ended (a 2026 draft
      // opened in the 2027 season), the server would refuse them.
      const restored = { ...INITIAL, ...blob.state };
      setState({
        ...restored,
        tuesdayDates: (restored.tuesdayDates ?? []).filter((d) => isListableDate(d)),
      });
      setStep(blob.step);
    }
  }, [initialValues]);

  // ── Autosave on every state / step change ──────────────────────────
  // Debouncing isn't worth it here, the writes are tiny (~2KB JSON)
  // and synchronous in modern browsers. Persisting every keystroke
  // is the safer choice for a multi-step form on a flaky mobile.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (success) return; // don't save once already submitted
    try {
      const blob: AutosaveBlob = { step, state, savedAt: Date.now() };
      window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(blob));
    } catch {
      // Quota exceeded / private mode / blocked storage, fail silent.
    }
  }, [step, state, success]);

  // Clear the autosave once the submit succeeds. Otherwise re-visiting
  // /list-bhandara after a successful submission would re-populate
  // with the previously-submitted listing's data.
  useEffect(() => {
    if (success && typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(AUTOSAVE_KEY);
      } catch {
        /* noop */
      }
    }
  }, [success]);

  const setField = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) => {
    setState((s) => ({ ...s, [k]: v }));
  }, []);

  const toggleInArray = useCallback((field: "tuesdayDates" | "menu", value: string) => {
    setState((s) => {
      const cur = s[field];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      return { ...s, [field]: next };
    });
  }, []);

  // Compact Tuesday-chip data: short label (`25 May`) + year (`2027`) so
  // the chips stay small but still show every detail clearly.
  const HI_MONTHS = [
    "जन", "फ़र", "मार्च", "अप्रै", "मई", "जून",
    "जुल", "अग", "सित", "अक्टू", "नव", "दिस",
  ];
  const EN_MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const dateOptions = useMemo(() => {
    // Hide season dates that are already past (in IST). Form is forward-only,
    // there's no value in letting an organizer "list" a bhandara on a
    // date that's already happened.
    const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const todayIso = ist.toISOString().slice(0, 10);
    // Presets come from the season people list for now (lib/season.ts).
    const season = listingSeason();
    const tuesdays = season.tuesdays.map((iso) => ({ iso, weekday: "tue" as const }));
    const saturdays = season.saturdays.map((iso) => ({ iso, weekday: "sat" as const }));
    return [...tuesdays, ...saturdays]
      .filter((r) => r.iso >= todayIso)
      .sort((a, b) => a.iso.localeCompare(b.iso))
      .map(({ iso, weekday }) => {
        const d = new Date(`${iso}T04:30:00Z`);
        const day = d.getUTCDate();
        const month = d.getUTCMonth();
        const year = d.getUTCFullYear();
        return {
          iso,
          weekday,
          hiShort: `${day} ${HI_MONTHS[month]}`,
          enShort: `${day} ${EN_MONTHS[month]}`,
          year,
          hi: formatHindiDate(d),
          en: formatEnglishDate(d),
        };
      });
  }, [HI_MONTHS, EN_MONTHS]);

  const canAdvance = (s: number, st: FormState): boolean => {
    switch (s) {
      // Step 1 (pin) is now SKIPPABLE, organisers can advance
      // without dropping a pin if they've at least typed an address.
      // /api/bhandaras runs Ola Maps forward-geocoding on submit to
      // turn the address into lat/lng. If geocoding misses, the row
      // saves with lat=0 and an admin sets the pin via /admin/edit.
      // Per GA4 the pin drop was the single biggest abandonment
      // point in the form, making it optional is the largest
      // single conversion-rate lever available without redesigning
      // the form entirely.
      case 1:
        return st.pin !== null || st.addressOverride.trim().length >= 5;
      case 2: return st.name.trim().length >= 2 && st.area !== "";
      case 3: return st.tuesdayDates.length > 0 && /^\d{2}:\d{2}$/.test(st.timeStart) && (st.timeEnd === "" || /^\d{2}:\d{2}$/.test(st.timeEnd));
      // Step 4 (menu) is also skippable now. /api/bhandaras defaults
      // an empty menu to a single "prasad" entry server-side. Most
      // organisers stuck on this step were over-thinking it; the
      // default carries plenty of information for the public listing.
      case 4: return true;
      case 5:
        // Phone is optional. Only block advance if it's non-empty
        // AND invalid, empty stays valid so organisers without a
        // contact number (or who don't want to share one) can still
        // submit. Team will follow up via WhatsApp / email instead.
        return (
          st.organizerName.trim().length >= 2 &&
          (st.organizerPhone.trim() === "" ||
            isValidIndianMobile(st.organizerPhone))
        );
      case 6: return true;
      default: return false;
    }
  };

  const advance = () => {
    if (!canAdvance(step, state)) return;
    if (step < TOTAL_STEPS) {
      const next = step + 1;
      trackEvent("form_step_advance", { from: step, to: next });
      setStep(next);
    }
  };
  const back = () => {
    if (step > 1) {
      trackEvent("form_step_back", { from: step, to: step - 1 });
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    // entry_method tags every submit event with which entry path the
    // user came in through ("type" or "scan"), so GA reports can
    // split conversion: how many of each path get to the submit
    // attempt, how many succeed. Tuesday-count + has-photo were
    // already tracked here; entry_method joins them on the same
    // event so we don't need a side-channel.
    trackEvent("form_submit_attempt", {
      area: state.area,
      tuesday_count: state.tuesdayDates.length,
      has_photo: state.photoUrl ? 1 : 0,
      entry_method: entryMethod,
    });
    setSubmitting(true);
    setErrors({});
    setFormError(null);

    // pin is OPTIONAL by design, step 1 lets the organiser skip
    // pin-drop and just type an address; the server geocodes via
    // Ola Maps (see /api/bhandaras POST). Previously this guard
    // hard-failed any pin-less submission with an English-only
    // error message scrolled away from step 1, which contradicted
    // the entire 'pin optional' UX and silently killed real
    // organiser submissions.
    const pin = state.pin;
    const finalAddress =
      state.addressOverride.trim() ||
      pin?.address ||
      (pin ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : "");

    // Single name/description input → both columns get the same value, since
    // we don't ask for separate Hindi anymore. Server stores both so existing
    // display logic (locale-aware reads) keeps working.
    const nameValue = state.name.trim();
    const descriptionValue = state.description.trim();

    // Pull any draft text the user typed but didn't commit yet into menuOther.
    const otherFromDraft = state.menuOtherDraft
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const allOther = [...state.menuOther, ...otherFromDraft]
      .map((s) => s.trim())
      .filter((s, i, arr) => s && arr.indexOf(s) === i);

    const payload = {
      organizerName: state.organizerName,
      organizerPhone: state.organizerPhone,
      // Optional UPI ID + uploaded QR image for the "Sponsor this
      // bhandara" deep-link on the public detail page. Sent only when
      // non-empty; the server route (/api/bhandaras POST) maps them
      // to Bhandara.upiId / Bhandara.upiQrUrl.
      upiId: state.upiId.trim() || undefined,
      upiQrUrl: state.upiQrUrl.trim() || undefined,
      name: nameValue,
      nameHi: nameValue,
      description: descriptionValue || undefined,
      descriptionHi: descriptionValue || undefined,
      area: state.area,
      address: finalAddress,
      landmark: state.landmark || undefined,
      // lat/lng are OMITTED when pin is null. The server will
      // geocode the address via Ola Maps in /api/bhandaras POST
      // (and gate the row to status=PENDING if geocode fails, so
      // bad pins don't end up at lat=0/lng=0 on the public map).
      ...(pin
        ? {
            lat: pin.lat,
            lng: pin.lng,
            geoNeighborhood: pin.geoNeighborhood,
            geoDistrict: pin.geoDistrict,
            geoState: pin.geoState,
          }
        : {}),
      tuesdayDates: state.tuesdayDates,
      timeStart: state.timeStart,
      timeEnd: state.timeEnd || undefined,
      // Drop any stale menu keys that no longer exist in MENU_KEYS
      // (e.g. an old "sherbet" sitting in form state from before a key
      // rename) so the server's enum validation never trips on legacy data.
      menu: state.menu.filter((k) =>
        (MENU_KEYS as readonly string[]).includes(k),
      ),
      menuOther: allOther,
      photoUrl: state.photoUrl || undefined,
    };

    try {
      const res = await fetch("/api/bhandaras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const ok = (await res.json()) as ApiOk;
        trackEvent("form_submit_success", {
          slug: ok.slug,
          entry_method: entryMethod,
        });
        setSuccess(ok);
        return;
      }
      trackEvent("form_submit_error", {
        status: res.status,
        entry_method: entryMethod,
      });
      const err = (await res.json()) as ApiErr;
      if (err.issues?.fieldErrors) {
        setErrors(err.issues.fieldErrors);
        const firstBadStep = stepForFirstError(err.issues.fieldErrors);
        if (firstBadStep) setStep(firstBadStep);
      }
      setFormError(
        err.issues?.formErrors?.[0] ??
          err.error ??
          "Something went wrong. Please try again.",
      );
    } catch {
      setFormError("Network error. Please check your connection and retry.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) return <ThankYou slug={success.slug} />;

  const isHi = locale === "hi";
  const stepLabels = isHi ? STEP_TITLES_HI : STEP_TITLES_EN;

  return (
    <FormPanel>
      <div className="bmi-steps-compact">
        <Stepper
          steps={stepLabels}
          current={step - 1}
          label={isHi ? "फ़ॉर्म के चरण" : "Form steps"}
        />
      </div>

      {formError ? (
        <div className="bmi-alert" role="alert" style={{ marginBottom: 22 }}>
          {formError}
        </div>
      ) : null}

      {/* Step body */}
      <FormSkin>
        <fieldset className="bmi-fieldset">
          <legend className="bmi-sr">
            {isHi ? `चरण ${step}: ${stepLabels[step - 1]}` : `Step ${step}: ${stepLabels[step - 1]}`}
          </legend>

          {step === 1 ? (
            <Step1
              pin={state.pin}
              onChange={(v) => setField("pin", v)}
            />
          ) : null}
          {step === 2 ? (
            <Step2
              state={state}
              errors={errors}
              setField={setField}
            />
          ) : null}
          {step === 3 ? (
            <Step3
              state={state}
              errors={errors}
              setField={setField}
              toggle={toggleInArray}
              dates={dateOptions}
            />
          ) : null}
          {step === 4 ? (
            <Step4
              state={state}
              errors={errors}
              setField={setField}
              toggle={toggleInArray}
            />
          ) : null}
          {step === 5 ? (
            <Step5
              state={state}
              errors={errors}
              setField={setField}
            />
          ) : null}
          {step === 6 ? (
            <Step6
              state={state}
              errors={errors}
              setField={setField}
              locale={locale}
            />
          ) : null}
        </fieldset>
      </FormSkin>

      {/* Nav: one saffron action per step, Back as a quiet link. */}
      <div className="bmi-form-nav">
        <button
          type="button"
          onClick={back}
          disabled={step === 1 || submitting}
          className="bmi-tl"
        >
          <Icon name="back" />
          <span>{isHi ? "वापस" : "Back"}</span>
        </button>
        {step < TOTAL_STEPS ? (
          <Button
            onClick={advance}
            disabled={!canAdvance(step, state) || submitting}
            iconEnd="chevron"
          >
            {isHi ? "आगे बढ़ें" : "Continue"}
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting} icon="check">
            {submitting
              ? isHi
                ? "भेज रहे हैं…"
                : "Submitting…"
              : isHi
                ? "जमा करें"
                : "Submit"}
          </Button>
        )}
      </div>
    </FormPanel>
  );
}

const STEP_TITLES_EN = ["Where", "Bhandara", "When", "Thali", "Organiser", "Photo"];
const STEP_TITLES_HI = ["कहाँ", "भंडारा", "कब", "थाली", "व्यवस्थापक", "फ़ोटो"];

function stepForFirstError(fe: FieldErrors): number | null {
  // If validation rejected at the API after we thought we passed, jump to the
  // step that owns the first errored field.
  const map: Record<string, number> = {
    lat: 1, lng: 1,
    name: 2, nameHi: 2, area: 2, description: 2, descriptionHi: 2,
    address: 1, addressHi: 1, landmark: 2,
    tuesdayDates: 3, timeStart: 3, timeEnd: 3,
    menu: 4, menuOther: 4,
    organizerName: 5, organizerPhone: 5,
    photoUrl: 6,
  };
  for (const k of Object.keys(fe)) {
    if (fe[k] && fe[k]!.length > 0 && map[k]) return map[k];
  }
  return null;
}

// ── Steps ────────────────────────────────────────────────────────────────

function StepHeading({ hi, en }: { hi: string; en: string }) {
  // One language: the visitor's.
  return (
    <header className="bmi-step-h">
      <Heading as="h3" en={en} hi={hi} />
    </header>
  );
}

function Step1({
  pin,
  onChange,
}: {
  pin: PinValue | null;
  onChange: (v: PinValue) => void;
}) {
  return (
    <div>
      <StepHeading hi="आपका भंडारा कहाँ है?" en="Where is your bhandara?" />
      <PinDropStep value={pin} onChange={onChange} />
    </div>
  );
}

type StepProps = {
  state: FormState;
  errors: FieldErrors;
  setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
};

// Sentinel value for the "Other, type your own" entry in the area
// dropdown. Picking it doesn't write anything into state.area; it just
// flips the field into custom-text mode (see useState below).
const AREA_OTHER_SENTINEL = "__bm_area_other__";

function Step2({ state, errors, setField }: StepProps) {
  const { locale } = useT();
  const t = strings[locale];
  // Same canonical area list as the homepage filter, sorted by display label
  // in the user's current locale.
  const sortedAreas = [...AREAS].sort((a, b) =>
    (t.areas[a] ?? a).localeCompare(t.areas[b] ?? b),
  );

  // "Custom area" mode is on when the saved area isn't one of the
  // curated values (e.g. a previous draft typed "Khurram Nagar"), or
  // when the user explicitly picks "Other" from the dropdown. Lucknow
  // has more neighbourhoods than we can reasonably curate; the free
  // text fallback ensures no organiser is locked out because their
  // colony isn't on our short list.
  const isCuratedArea = state.area !== "" && (AREAS as readonly string[]).includes(state.area);
  const [customMode, setCustomMode] = useState<boolean>(
    state.area !== "" && !isCuratedArea,
  );

  return (
    <div>
      <StepHeading hi="भंडारा का परिचय" en="About the bhandara" />
      <div className="bmi-grid2">
        <Field
          hi="भंडारा का नाम"
          en="Bhandara Name"
          required
          error={errors.name?.[0] ?? errors.nameHi?.[0]}
        >
          <input
            required
            className={`${inputBase} font-mukta`}
            value={state.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder={locale === "hi" ? "बड़ा मंगल भंडारा" : "Bada Mangal Bhandara"}
          />
        </Field>
        <Field hi="क्षेत्र" en="Area" required error={errors.area?.[0]}>
          {customMode ? (
            <div className="space-y-2">
              <input
                className={`${inputBase} font-mukta`}
                value={state.area}
                onChange={(e) => setField("area", e.target.value)}
                placeholder={
                  locale === "hi"
                    ? "क्षेत्र का नाम लिखें"
                    : "Type your area name"
                }
                autoFocus
                maxLength={50}
              />
              <button
                type="button"
                onClick={() => {
                  setField("area", "");
                  setCustomMode(false);
                  trackEvent("bhandara_area_back_to_list");
                }}
                className="bmi-tl"
              >
                <Icon name="back" />
                <span>{locale === "hi" ? "सूची से चुनें" : "Pick from the list"}</span>
              </button>
            </div>
          ) : (
            <FancySelect
              ariaLabel={locale === "hi" ? "क्षेत्र" : "Area"}
              value={state.area}
              onChange={(v) => {
                if (v === AREA_OTHER_SENTINEL) {
                  setField("area", "");
                  setCustomMode(true);
                  trackEvent("bhandara_area_choose_other");
                  return;
                }
                setField("area", v);
              }}
              placeholder={locale === "hi" ? "क्षेत्र चुनें" : "Select an area"}
              size="md"
              variant="input"
              options={[
                ...sortedAreas.map((a) => ({
                  value: a,
                  label: t.areas[a] ?? a,
                })),
                {
                  value: AREA_OTHER_SENTINEL,
                  label:
                    locale === "hi"
                      ? "अन्य, अपना क्षेत्र लिखें"
                      : "Other, type your own",
                },
              ]}
            />
          )}
        </Field>
        <Field hi="स्थान चिह्न" en="Landmark (optional)" error={errors.landmark?.[0]}>
          <input
            className={inputBase}
            value={state.landmark}
            onChange={(e) => setField("landmark", e.target.value)}
            placeholder={locale === "hi" ? "अलीगंज पुलिस चौकी" : "Aliganj police chowki"}
          />
        </Field>
        <Field
          hi="विवरण"
          en="Description (optional)"
          error={errors.description?.[0] ?? errors.descriptionHi?.[0]}
        >
          <textarea
            rows={2}
            className={`${inputBase} font-mukta`}
            value={state.description}
            onChange={(e) => setField("description", e.target.value)}
            placeholder={locale === "hi" ? "हर मंगल को 12,000 थाली" : "12,000 plates every Tuesday"}
          />
        </Field>
      </div>
    </div>
  );
}

function Step3({
  state, errors, setField, toggle, dates,
}: StepProps & {
  toggle: (f: "tuesdayDates" | "menu", v: string) => void;
  dates: {
    iso: string;
    weekday: "tue" | "sat";
    hiShort: string;
    enShort: string;
    year: number;
    hi: string;
    en: string;
  }[];
}) {
  const { locale } = useT();
  // Split presets into Tuesdays + Saturdays so each group reads as its
  // own row of chips with a small kicker label.
  const tuesdays = dates.filter((d) => d.weekday === "tue");
  const saturdays = dates.filter((d) => d.weekday === "sat");

  // ISO of any picked date that isn't in our preset list, these are the
  // organizer's free calendar picks, surfaced as removable pills.
  const presetIsoSet = new Set(dates.map((d) => d.iso));
  const customDates = state.tuesdayDates.filter((iso) => !presetIsoSet.has(iso));

  // Today, in IST, as the lower bound of the calendar picker, same logic
  // we use to filter past chips out of the preset grid.
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const todayIso = ist.toISOString().slice(0, 10);
  const season = listingSeason();
  const SEASON_START_ISO = season.startISO;
  const SEASON_END_ISO = season.endISO;
  const minIso = todayIso > SEASON_START_ISO ? todayIso : SEASON_START_ISO;

  const onPickCustomDate = (v: string) => {
    if (!v) return;
    if (state.tuesdayDates.includes(v)) return;
    if (v < SEASON_START_ISO || v > SEASON_END_ISO) return;
    setField("tuesdayDates", [...state.tuesdayDates, v]);
  };

  const removeDate = (iso: string) => {
    setField(
      "tuesdayDates",
      state.tuesdayDates.filter((d) => d !== iso),
    );
  };

  const isHi = locale === "hi";
  const DateChip = ({ d }: { d: typeof dates[number] }) => {
    const checked = state.tuesdayDates.includes(d.iso);
    const weekdayHi = d.weekday === "tue" ? "मंगलवार" : "शनिवार";
    const weekdayEn = d.weekday === "tue" ? "Tuesday" : "Saturday";
    return (
      <label className="bmi-date" title={`${weekdayEn}, ${d.en}`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => toggle("tuesdayDates", d.iso)}
        />
        <span className="min-w-0">
          <span className="d" lang={isHi ? "hi" : "en"}>
            {isHi ? d.hiShort : d.enShort}
          </span>
          <span className="w">
            {isHi ? `${weekdayHi} ${d.year}` : `${weekdayEn} ${d.year}`}
          </span>
        </span>
        <span className="tick" aria-hidden>
          <Icon name="check" />
        </span>
      </label>
    );
  };

  const GroupLabel = ({ hi, en }: { hi: string; en: string }) => (
    <p className="bmi-ilabel" lang={isHi ? "hi" : "en"} style={{ marginBottom: 12 }}>
      {isHi ? hi : en}
    </p>
  );

  const fmtShort = (iso: string) => {
    const d = new Date(`${iso}T04:30:00Z`);
    return d.toLocaleDateString(isHi ? "hi-IN" : "en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  };

  return (
    <div>
      <StepHeading hi="किन-किन दिन को सेवा है?" en="Which days, and what time?" />

      {tuesdays.length > 0 ? (
        <>
          <GroupLabel hi="बड़े मंगल" en="Bada Mangal Tuesdays" />
          <div className="bmi-dates" role="group" aria-label="Tuesdays">
            {tuesdays.map((d) => <DateChip key={d.iso} d={d} />)}
          </div>
        </>
      ) : null}

      {saturdays.length > 0 ? (
        <div style={{ marginTop: 26 }}>
          <GroupLabel hi="बड़े शनिवार" en="Bada Shanivar Saturdays" />
          <div className="bmi-dates" role="group" aria-label="Saturdays">
            {saturdays.map((d) => <DateChip key={d.iso} d={d} />)}
          </div>
        </div>
      ) : null}

      {/* Free calendar pick, any day in the listing season's window. */}
      <div style={{ marginTop: 26 }}>
        <GroupLabel hi="कोई और दिन?" en="Pick any other date" />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <SeasonDatePicker
            minIso={minIso}
            maxIso={SEASON_END_ISO}
            selectedIsos={state.tuesdayDates}
            onPick={(iso) => onPickCustomDate(iso)}
            locale={locale}
          />
          <span className="bmi-field-hint">
            {isHi
              ? `${fmtShort(SEASON_START_ISO)} से ${fmtShort(SEASON_END_ISO)} तक`
              : `${fmtShort(SEASON_START_ISO)} to ${fmtShort(SEASON_END_ISO)}`}
          </span>
        </div>

        {customDates.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {customDates.map((iso) => {
              const d = new Date(`${iso}T04:30:00Z`);
              return (
                <li key={iso}>
                  <span className="bmi-tag" title={formatEnglishDate(d)}>
                    <span>{fmtShort(iso)}</span>
                    <button
                      type="button"
                      onClick={() => removeDate(iso)}
                      aria-label={`Remove ${iso}`}
                    >
                      <Icon name="plus" className="rotate-45" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      {errors.tuesdayDates ? (
        <p className="bmi-field-err" role="alert" style={{ marginTop: 10 }}>{errors.tuesdayDates[0]}</p>
      ) : null}

      {/* Timing row, a hairline then two time pickers. */}
      <div className="bmi-sub bmi-grid2">
        <Field hi="शुरू होने का समय" en="Start time" required error={errors.timeStart?.[0]}>
          <TimeField
            ariaLabel="Start time"
            value={state.timeStart}
            onChange={(v) => setField("timeStart", v)}
            placeholder={isHi ? "समय चुनें" : "Pick start time"}
          />
        </Field>
        <Field
          hi="समाप्ति का समय"
          en="End time (optional)"
          error={errors.timeEnd?.[0]}
          helper={
            state.timeEnd
              ? undefined
              : isHi
                ? "ख़ाली छोड़ें तो प्रभु इच्छा तक"
                : "Leave empty for prabhu iccha tak, open ended"
          }
        >
          <TimeField
            ariaLabel="End time"
            value={state.timeEnd}
            onChange={(v) => setField("timeEnd", v)}
            placeholder="प्रभु इच्छा तक"
          />
          {/* When an end time is set, one tap clears it back to
              "prabhu iccha tak" (open ended). */}
          {state.timeEnd ? (
            <button
              type="button"
              onClick={() => setField("timeEnd", "")}
              className="bmi-tl"
              style={{ justifySelf: "start" }}
            >
              {isHi ? "समाप्ति समय हटाएँ" : "Clear end time"}
            </button>
          ) : null}
        </Field>
      </div>
    </div>
  );
}

function Step4({
  state, errors, setField, toggle,
}: StepProps & { toggle: (f: "tuesdayDates" | "menu", v: string) => void }) {
  return (
    <div>
      <StepHeading hi="थाली में क्या है?" en="What's served?" />
      <StepMenu state={state} errors={errors} setField={setField} toggle={toggle} />
    </div>
  );
}

function StepMenu({
  state, errors, setField, toggle,
}: StepProps & { toggle: (f: "tuesdayDates" | "menu", v: string) => void }) {
  const { locale } = useT();
  const isHi = locale === "hi";
  return (
    <>
      <div className="bmi-choices" role="group" aria-label={isHi ? "थाली" : "Menu"}>
        {MENU_ITEMS.map((m) => {
          const checked = state.menu.includes(m.en);
          return (
            <label key={m.en} className="bmi-choice" lang={isHi ? "hi" : "en"}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle("menu", m.en)}
              />
              {checked ? <Icon name="check" /> : null}
              <span>{isHi ? m.hi : m.en.charAt(0).toUpperCase() + m.en.slice(1)}</span>
            </label>
          );
        })}
      </div>
      {errors.menu ? <p className="bmi-field-err" role="alert" style={{ marginTop: 10 }}>{errors.menu[0]}</p> : null}

      {/* Free-form items the organizer types in */}
      <div className="bmi-field" style={{ marginTop: 28 }}>
        <span className="bmi-field-label" lang={isHi ? "hi" : "en"}>
          {isHi ? "और कुछ?" : "Anything else?"}
        </span>
        <div className="bmi-tagbox">
          {state.menuOther.map((item, i) => (
            <span key={`${item}-${i}`} className="bmi-tag">
              <span>{item}</span>
              <button
                type="button"
                onClick={() =>
                  setField(
                    "menuOther",
                    state.menuOther.filter((_, idx) => idx !== i),
                  )
                }
                aria-label={`Remove ${item}`}
              >
                <Icon name="plus" className="rotate-45" />
              </button>
            </span>
          ))}
          <input
            type="text"
            aria-label={isHi ? "और कुछ?" : "Anything else?"}
            value={state.menuOtherDraft}
            onChange={(e) => setField("menuOtherDraft", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                const v = state.menuOtherDraft.trim();
                if (!v) return;
                if (state.menuOther.includes(v)) {
                  setField("menuOtherDraft", "");
                  return;
                }
                if (state.menuOther.length >= 20) return;
                setField("menuOther", [...state.menuOther, v]);
                setField("menuOtherDraft", "");
              } else if (
                e.key === "Backspace" &&
                state.menuOtherDraft === "" &&
                state.menuOther.length > 0
              ) {
                setField("menuOther", state.menuOther.slice(0, -1));
              }
            }}
            onBlur={() => {
              const v = state.menuOtherDraft.trim();
              if (!v) return;
              if (state.menuOther.includes(v)) {
                setField("menuOtherDraft", "");
                return;
              }
              if (state.menuOther.length >= 20) return;
              setField("menuOther", [...state.menuOther, v]);
              setField("menuOtherDraft", "");
            }}
            placeholder={
              state.menuOther.length === 0
                ? isHi
                  ? "इमरती, चना, लस्सी"
                  : "Imarti, chana, lassi"
                : ""
            }
            className="font-mukta"
          />
        </div>
        <span className="bmi-field-hint">
          {isHi
            ? "हर चीज़ लिखकर Enter दबाएँ (या कॉमा लगाएँ)। हिंदी या अंग्रेज़ी, दोनों चलेंगे।"
            : "Type each item and press Enter (or use commas). Hindi or English both work."}
        </span>
        {errors.menuOther ? (
          <span className="bmi-field-err" role="alert">{errors.menuOther[0]}</span>
        ) : null}
      </div>
    </>
  );
}

/**
 * Step 5, organizer contact details.
 *
 * Option-4 launch model: no OTP at all. The bhandara team calls the
 * submitted number to confirm details before flipping the listing live.
 * Step 5 therefore collects just Name + Mobile, with a saffron banner that
 * sets the expectation up-front. The form's submit gate only checks for a
 * structurally-valid Indian mobile, there's no separate "verified" state
 * to track or persist.
 */
function Step5({ state, errors, setField }: StepProps) {
  const { locale } = useT();
  const phone = state.organizerPhone.trim();
  const phoneValid = isValidIndianMobile(phone);

  return (
    <div>
      <StepHeading hi="व्यवस्थापक की जानकारी" en="Your contact details" />

      {/* Honest expectation-setter, we WILL call this number. Keeping
          the language explicit avoids surprise + builds trust. */}
      <p className="bmi-fnote" style={{ marginBottom: 24 }}>
        <span className="ic" aria-hidden>
          <Icon name="phone" />
        </span>
        <span>
          {locale === "hi"
            ? "अगर आप नंबर देंगे तो हम उस पर कॉल करके जानकारी सत्यापित करेंगे, फिर भंडारा लाइव होगा। नंबर कहीं सार्वजनिक नहीं होगा।"
            : "If you share a number, our team will call to confirm the details and your bhandara goes live right after. Your number is never shown publicly."}
        </span>
      </p>

      <div className="bmi-grid2">
        <Field hi="नाम" en="Full name" required error={errors.organizerName?.[0]}>
          <input
            required
            className={inputBase}
            value={state.organizerName}
            onChange={(e) => setField("organizerName", e.target.value)}
            placeholder={locale === "hi" ? "रमेश तिवारी" : "Ramesh Tiwari"}
          />
        </Field>
        <Field
          hi="मोबाइल"
          en="Mobile (optional)"
          error={
            errors.organizerPhone?.[0] ??
            (state.organizerPhone.length > 0 && !phoneValid
              ? locale === "hi"
                ? "10 अंकों का सही मोबाइल नंबर डालें"
                : "Enter a valid 10-digit Indian mobile number"
              : undefined)
          }
        >
          {/* Shared PhoneInput, same +91 chip + 10-digit cap that the
              admin / contact / organise forms now use. State still
              stores the canonical 10-digit form, downstream
              isValidIndianMobile() check is unchanged.
              Phone is OPTIONAL, left without `required` so visitors
              can submit without giving a number. */}
          <PhoneInput
            value={state.organizerPhone}
            onChange={(digits) => setField("organizerPhone", digits)}
          />
        </Field>

      </div>

      {/* ── Donations (optional) ───────────────────────────────────
          Surfaces on the public bhandara page as a "Sponsor this
          bhandara" CTA that opens the donor's UPI app directly. Empty
          = donations disabled for this listing; the platform-level
          donate flow stays available regardless. Kept inside the
          existing fieldset on a thin top-border so it reads as a
          peer to "contact info", not a separate noisy section. */}
      {SHOW_DONATIONS ? (
      <div className="bmi-sub">
        <p className="bmi-ilabel">
          {locale === "hi"
            ? "दान सक्षम करें (वैकल्पिक)"
            : "Enable donations (optional)"}
        </p>
        <p className="mt-1 text-sm text-ink-700/85 leading-relaxed">
          {locale === "hi"
            ? "अपनी UPI ID डालें ताकि लोग सीधे आपके बैंक खाते में सेवा-दान भेज सकें। आपके भंडारा पेज पर 'सहयोग करें' बटन दिखेगा। खाली छोड़ें तो दान बंद रहेगा।"
            : "Add your UPI ID so people can send a seva contribution directly to your bank account. A 'Sponsor this bhandara' button will appear on your listing page. Leave blank to keep donations off."}
        </p>
        <div className="mt-3 space-y-3">
          <Field hi="UPI ID" en="UPI ID">
            <input
              type="text"
              autoComplete="off"
              inputMode="email"
              className={inputBase}
              value={state.upiId}
              onChange={(e) => setField("upiId", e.target.value)}
              placeholder="rajesh@oksbi  ·  9876543210@upi"
              maxLength={64}
            />
          </Field>
          <p className="text-xs text-ink-700/65">
            {locale === "hi"
              ? "टिप: अपनी UPI app में 'मेरी UPI ID' देखें, Google Pay / PhonePe / Paytm, और वहीं से कॉपी करके पेस्ट करें।"
              : "Tip: open your UPI app (GPay / PhonePe / Paytm), tap your profile, copy the ID shown there, and paste it here."}
          </p>
          {/* Either the typed UPI ID above OR an uploaded QR image is
              sufficient. Both is fine too. Public bhandara page prefers
              the uploaded QR (if present) over a client-generated one
              from the text. */}
          <UpiQrUpload
            value={state.upiQrUrl}
            onChange={(next) => setField("upiQrUrl", next)}
            theme="public"
          />
        </div>
      </div>
      ) : null}
    </div>
  );
}

function Step6({ state, setField, locale }: StepProps & { locale: "hi" | "en" }) {
  const isHi = locale === "hi";
  return (
    <div>
      <StepHeading hi="फ़ोटो (वैकल्पिक)" en="Add a photo (optional)" />

      {/* INLINE PAMPHLET GENERATOR is hidden during the soft-launch
          phase. The /pamphlet route still works for direct URL
          access; we just don't surface this CTA inside the listing
          form. Restore by uncommenting the JSX below:
          <InlinePamphletGenerator
            state={state}
            setField={setField}
            locale={locale}
          />
      */}


      {/* Surface the pamphlet/banner use-case up-front so organisers
          know they can upload printed invites, not just food photos. */}
      <p className="bmi-fnote" style={{ marginBottom: 20 }}>
        <span className="ic" aria-hidden>
          <Icon name="camera" />
        </span>
        <span>
          {isHi
            ? "आप यहाँ अपना भंडारा का पर्चा (पैम्फ़्लेट), बैनर या निमंत्रण की तस्वीर भी अपलोड कर सकते हैं।"
            : "You can also upload your pamphlet, banner, or invite-card photo here."}
        </span>
      </p>

      <PhotoPicker
        value={state.photoUrl}
        onChange={(url) => setField("photoUrl", url)}
        locale={locale}
      />
      <p className="bmi-field-hint" style={{ marginTop: 14 }}>
        {isHi
          ? "एक अच्छी तस्वीर भंडारा को 3X ज़्यादा क्लिक मिलवाती है।"
          : "A clear photo gets 3X the engagement."}
      </p>
    </div>
  );
}

function Field({
  hi,
  en,
  required: _required,
  helper,
  error,
  children,
}: {
  hi: string;
  en: string;
  required?: boolean;
  helper?: string;
  error?: string;
  children: React.ReactNode;
}) {
  // One language per label (the visitor's). Optional fields say so
  // quietly; required ones carry no star.
  const { locale } = useT();
  const isHi = locale === "hi";
  const optional = /\(optional\)/i.test(en);
  const label = isHi ? hi : en.replace(/\s*\(optional\)/i, "");
  return (
    <KitField
      asLabel
      label={label}
      lang={isHi ? "hi" : "en"}
      optional={optional ? (isHi ? "वैकल्पिक" : "optional") : undefined}
      hint={helper}
      error={error}
    >
      {children}
    </KitField>
  );
}

// ── Thank-you ────────────────────────────────────────────────────────────

function ThankYou(_props: { slug: string }) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { locale } = useT();
  const isHi = locale === "hi";

  // Play the Jai Shree Ram blessing once when the success card mounts,
  // and scroll it into view so the tick + chant land in the user's eyeline
  // even if they were deep in the form when they hit submit.
  useEffect(() => {
    playJaiShreeRam();
    const node = cardRef.current;
    if (!node) return;
    const id = window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  return (
    <FormPanel>
      <div ref={cardRef} className="bmi-done">
        <div className="bmi-done-tick" aria-hidden>
          <Icon name="check" />
        </div>
        <p className="bmi-kick" style={{ justifyContent: "center" }} lang={isHi ? "hi" : "en"}>
          {isHi ? "जय हनुमान" : "Jai Hanuman"}
        </p>
        <Heading
          as="h2"
          en="Your bhandara is now live on the city map."
          hi="भंडारा लाइव हो गया!"
        />
        <p className="bmi-lede">
          {isHi
            ? "हमारी टीम 24 घंटे में कॉल करके जानकारी पक्की करेगी और सत्यापित बैज जोड़ेगी।"
            : "Our team will call you within 24 hours to confirm the details and add a Verified badge."}
        </p>

        {/* What happens next. The listing is live the moment this
            shows, so the first two are ticked; the call remains. */}
        <ol className="bmi-next">
          <li className="done">{isHi ? "आपका भंडारा मिल गया" : "Submission received"}</li>
          <li className="done">{isHi ? "शहर के नक़्शे पर लाइव" : "Live on the city map"}</li>
          <li>{isHi ? "सत्यापन कॉल (24 घंटे में)" : "Our team calls to verify (within 24h)"}</li>
        </ol>

        <div className="bmi-actions">
          <Button href={isHi ? "/" : "/?lang=en"} data-ga="thankyou_home" icon="back" iconEnd={null}>
            {isHi ? "होम" : "Home"}
          </Button>
        </div>
      </div>
    </FormPanel>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * InlinePamphletGenerator
 * ────────────────────────────────────────────────────────────────
 * Generates the A4 printable pamphlet directly from the form's
 * current state. Sits at the top of step 6 (photo upload) because
 * by step 6 the organiser has typed all the fields the pamphlet
 * needs (name, date, time, place, organiser, optional menu) and
 * is about to leave the form to find a photo anyway.
 *
 * Two outputs:
 *   1. Downloaded PNG, the print-ready pamphlet they'll WhatsApp
 *      to the local press shop.
 *   2. Auto-populated photoUrl (via Supabase upload) so the same
 *      pamphlet image becomes the bhandara's listing photo on
 *      BadaMangal.com. Eliminates "I don't have a good photo of
 *      the venue yet" as a reason to skip the photo upload.
 *
 * Same `/api/pamphlet` endpoint the /pamphlet page uses, single
 * source of truth for the design + render pipeline.
 * ────────────────────────────────────────────────────────────── */

function InlinePamphletGenerator({
  state,
  setField,
  locale,
}: {
  state: FormState;
  setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  locale: "hi" | "en";
}) {
  const isHi = locale === "hi";
  const [generating, setGenerating] = useState(false);
  const [doneUrl, setDoneUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usingForPhoto, setUsingForPhoto] = useState(false);

  // The pamphlet needs a human-readable date. The form holds an
  // ISO array of Tuesdays; pick the first upcoming one and format
  // it for the pamphlet body. We don't surface this in the form
  // UI, it's a derived value the pamphlet endpoint expects.
  const firstDate = useMemo(() => {
    const dates = state.tuesdayDates.slice().sort();
    const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const upcoming = dates.filter((d) => d >= today);
    const pick = upcoming[0] ?? dates[0];
    if (!pick || !/^\d{4}-\d{2}-\d{2}$/.test(pick)) return "";
    const [y, m, d] = pick.split("-").map(Number);
    if (!y || !m || !d) return "";
    const hiMonths = [
      "जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून",
      "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर",
    ];
    const enMonths = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const date = new Date(`${pick}T00:00:00`);
    const dow = date.getDay();
    const hiDow = ["रविवार", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"];
    const enDow = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return isHi
      ? `${hiDow[dow]}, ${d} ${hiMonths[m - 1]} ${y}`
      : `${enDow[dow]}, ${d} ${enMonths[m - 1]} ${y}`;
  }, [state.tuesdayDates, isHi]);

  const menuStr = useMemo(() => {
    const all = [...state.menu, ...state.menuOther];
    return all.join(", ");
  }, [state.menu, state.menuOther]);

  const address = state.pin?.address || state.addressOverride;

  const canGenerate =
    state.name.trim().length >= 2 && firstDate && (state.timeStart || "");

  const generate = async (alsoUseAsPhoto: boolean) => {
    if (!canGenerate || generating) return;
    setGenerating(true);
    setError(null);
    setDoneUrl(null);
    setUsingForPhoto(alsoUseAsPhoto);
    trackEvent("form_pamphlet_generate", { use_as_photo: alsoUseAsPhoto ? 1 : 0 });
    try {
      const res = await fetch("/api/pamphlet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.name.trim() || undefined,
          nameHi: state.name.trim() || undefined, // no separate Hindi field in form
          organizerName: state.organizerName.trim() || undefined,
          area: state.area || undefined,
          address: address || undefined,
          date: firstDate || undefined,
          timeStart: state.timeStart || undefined,
          timeEnd: state.timeEnd || undefined,
          menu: menuStr || undefined,
          organizerPhone: state.organizerPhone.trim() || undefined,
          qrUrl:
            typeof window !== "undefined"
              ? `${window.location.origin}/?q=${encodeURIComponent(state.name.trim())}`
              : undefined,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setDoneUrl(url);

      // Always auto-download, that's the primary deliverable.
      const a = document.createElement("a");
      a.href = url;
      a.download = `bada-mangal-pamphlet-${slugify(state.name)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Optionally upload the generated PNG to Supabase via the
      // existing /api/uploads endpoint so it becomes the
      // bhandara's listing photo on BadaMangal.com.
      if (alsoUseAsPhoto) {
        const file = new File([blob], `pamphlet-${slugify(state.name)}.png`, {
          type: "image/png",
        });
        const fd = new FormData();
        fd.append("file", file);
        const up = await fetch("/api/uploads", { method: "POST", body: fd });
        if (up.ok) {
          const upJson = (await up.json()) as { url?: string };
          if (upJson.url) {
            setField("photoUrl", upJson.url);
            trackEvent("form_pamphlet_set_as_photo", {});
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      trackEvent("form_pamphlet_error", { msg });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mb-5 rounded-2xl border-2 border-sindoor-700/30 bg-gradient-to-br from-saffron-50 via-cream-50 to-saffron-50 p-5 sm:p-6 shadow-warm">
      <div className="flex items-start gap-4 flex-wrap">
        {/* Mini pamphlet icon */}
        <div
          aria-hidden
          className="shrink-0 inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sindoor-700 text-cream-50 shadow-warm relative"
        >
          <span className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-saffron-500" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-saffron-500" />
          <span className="text-2xl">🪔</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mukta uppercase tracking-[0.22em] text-saffron-600 text-[0.65rem] font-semibold">
            {isHi ? "एक क्लिक में" : "One Click"}
          </p>
          <h3
            className={`mt-1 ${
              isHi
                ? "font-tiro text-sindoor-700"
                : "font-fraunces font-bold text-sindoor-700"
            } text-lg sm:text-xl leading-snug`}
          >
            {isHi
              ? "अपने भंडारे का पैम्फलेट यहीं बनाएँ, मुफ़्त"
              : "Generate your bhandara pamphlet, free"}
          </h3>
          <p className="mt-1.5 text-xs sm:text-sm text-ink-600 leading-relaxed">
            {isHi
              ? "इस फ़ॉर्म की जानकारी से A4 पारंपरिक पैम्फलेट बनाइए। पास के प्रेस शॉप से छपवाएँ, या इसी को भंडारे की फ़ोटो भी बनाइए।"
              : "Uses the details you've already typed to make an A4 traditional pamphlet. Print at any local press shop, or use it as the listing photo below."}
          </p>
          {!canGenerate ? (
            <p className="mt-2 text-xs text-saffron-700">
              {isHi
                ? "नाम, दिनांक और समय भरने के बाद उपलब्ध होगा।"
                : "Available once name, date, and time are filled."}
            </p>
          ) : null}
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex flex-wrap gap-2.5">
        <button
          type="button"
          disabled={!canGenerate || generating}
          onClick={() => void generate(false)}
          data-ga="form_pamphlet_download"
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-semibold px-4 py-2 text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating && !usingForPhoto
            ? isHi
              ? "बन रहा है…"
              : "Generating…"
            : isHi
              ? "पैम्फलेट डाउनलोड करें"
              : "Download pamphlet"}
        </button>
        <button
          type="button"
          disabled={!canGenerate || generating}
          onClick={() => void generate(true)}
          data-ga="form_pamphlet_use_as_photo"
          className="inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-sindoor-700 text-sindoor-700 hover:bg-sindoor-700 hover:text-cream-50 font-semibold px-4 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating && usingForPhoto
            ? isHi
              ? "अपलोड हो रहा है…"
              : "Uploading…"
            : isHi
              ? "+ इसी को भंडारा की फ़ोटो बनाएँ"
              : "+ Use as bhandara photo"}
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-xs text-alert-500">
          {isHi ? "त्रुटि: " : "Error: "}
          {error}
        </p>
      ) : null}
      {doneUrl ? (
        <p className="mt-3 text-xs text-leaf-600 font-medium">
          {isHi
            ? "✓ पैम्फलेट तैयार। डाउनलोड डाउनलोड्स में सहेजा गया।"
            : "✓ Pamphlet ready. PNG saved to your Downloads."}
          {state.photoUrl ? (
            <span className="block mt-1 text-ink-600">
              {isHi
                ? "और भंडारा की फ़ोटो भी इस पैम्फलेट से सेट हो गई।"
                : "Bhandara photo also set from this pamphlet."}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "bhandara"
  );
}
