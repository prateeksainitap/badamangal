"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PhotoPicker from "@/components/PhotoPicker";
import SeasonDatePicker from "@/components/SeasonDatePicker";
import { playJaiShreeRam } from "@/lib/playJaiShreeRam";
import PinDropStep, { type PinValue } from "@/components/PinDropStep";
import { useT } from "@/lib/useT";
import FancySelect from "@/components/FancySelect";
import TimeField from "@/components/TimeField";
import {
  ALL_TUESDAY_ISO,
  ALL_SATURDAY_ISO,
  SEASON_START_ISO,
  SEASON_END_ISO,
  formatHindiDate,
  formatEnglishDate,
} from "@/lib/dates";
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
  photoUrl: "",
};

type ApiOk = { id: string; slug: string };
type ApiErr = {
  error: string;
  issues?: { fieldErrors: FieldErrors; formErrors: string[] };
};

const inputBase =
  "w-full rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 placeholder:text-ink-600/60 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600";

const TOTAL_STEPS = 6;

export default function BhandaraForm() {
  const { locale } = useT();
  const [step, setStep] = useState<number>(1);
  const [state, setState] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<ApiOk | null>(null);

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

  // Compact Tuesday-chip data: short label (`12 May`) + year (`2026`) so
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
    const tuesdays = ALL_TUESDAY_ISO.map((iso) => ({ iso, weekday: "tue" as const }));
    const saturdays = ALL_SATURDAY_ISO.map((iso) => ({ iso, weekday: "sat" as const }));
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
      case 1: return st.pin !== null;
      case 2: return st.name.trim().length >= 2 && st.area !== "";
      case 3: return st.tuesdayDates.length > 0 && /^\d{2}:\d{2}$/.test(st.timeStart) && (st.timeEnd === "" || /^\d{2}:\d{2}$/.test(st.timeEnd));
      case 4: return st.menu.length + st.menuOther.length > 0;
      case 5:
        return (
          st.organizerName.trim().length >= 2 &&
          isValidIndianMobile(st.organizerPhone)
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
    trackEvent("form_submit_attempt", {
      area: state.area,
      tuesday_count: state.tuesdayDates.length,
      has_photo: state.photoUrl ? 1 : 0,
    });
    setSubmitting(true);
    setErrors({});
    setFormError(null);

    const pin = state.pin;
    if (!pin) {
      setSubmitting(false);
      setFormError("Please drop a pin first.");
      return;
    }

    const finalAddress = state.addressOverride.trim() || pin.address || `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`;

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
      name: nameValue,
      nameHi: nameValue,
      description: descriptionValue || undefined,
      descriptionHi: descriptionValue || undefined,
      area: state.area,
      address: finalAddress,
      landmark: state.landmark || undefined,
      lat: pin.lat,
      lng: pin.lng,
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
      geoNeighborhood: pin.geoNeighborhood,
      geoDistrict: pin.geoDistrict,
      geoState: pin.geoState,
    };

    try {
      const res = await fetch("/api/bhandaras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const ok = (await res.json()) as ApiOk;
        trackEvent("form_submit_success", { slug: ok.slug });
        setSuccess(ok);
        return;
      }
      trackEvent("form_submit_error", { status: res.status });
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

  return (
    <div className="grid gap-6">
      {formError ? (
        <div className="rounded-xl border border-alert-500 bg-alert-500/10 text-alert-500 px-4 py-3 text-sm">
          {formError}
        </div>
      ) : null}

      {/* Step body */}
      <fieldset className="rounded-3xl border border-gold-500/40 bg-cream-50 p-5 sm:p-8">
        <legend className="px-3 text-[10px] uppercase tracking-[0.3em] text-gold-500">
          {STEP_TITLES[step - 1]}
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

      {/* Nav */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={back}
          disabled={step === 1 || submitting}
          className="text-sm text-ink-600 hover:text-sindoor-700 disabled:opacity-40"
        >
          ← Back
        </button>
        {step < TOTAL_STEPS ? (
          <button
            type="button"
            onClick={advance}
            disabled={!canAdvance(step, state) || submitting}
            className="inline-flex items-center rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-6 py-3 shadow-warm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className={[
              "diya-morph btn btn-sindoor",
              submitting ? "is-on" : "",
            ].join(" ")}
          >
            <span className="relative z-10 inline-flex items-center gap-2">
              {submitting ? "🪔 Submitting…" : "जमा करें / Submit"}
            </span>
          </button>
        )}
      </div>

    </div>
  );
}

const STEP_TITLES = [
  "Step 1 · Where",
  "Step 2 · Bhandara",
  "Step 3 · When",
  "Step 4 · Thali",
  "Step 5 · Organizer",
  "Step 6 · Photo",
];

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
  return (
    <header className="mt-1 mb-5">
      <h3 className="font-tiro text-2xl text-sindoor-700">{hi}</h3>
      <p className="font-fraunces italic text-ink-600 mt-1">{en}</p>
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

// Sentinel value for the "Other — type your own" entry in the area
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
      <div className="grid gap-4 sm:grid-cols-2 items-start">
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
            placeholder="Bada Mangal Bhandara"
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
                className="text-[11px] uppercase tracking-[0.18em] text-ink-600 hover:text-sindoor-700"
              >
                ← {locale === "hi" ? "सूची से चुनें" : "Pick from the list"}
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
                      ? "अन्य — अपना क्षेत्र लिखें"
                      : "Other — type your own",
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
            placeholder="Aliganj police chowki"
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
            placeholder="हर मंगल को 12,000 थाली / 12,000 plates every Tuesday"
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

  // ISO of any picked date that isn't in our preset list — these are the
  // organizer's free calendar picks, surfaced as removable pills.
  const presetIsoSet = new Set(dates.map((d) => d.iso));
  const customDates = state.tuesdayDates.filter((iso) => !presetIsoSet.has(iso));

  // Today, in IST, as the lower bound of the calendar picker — same logic
  // we use to filter past chips out of the preset grid.
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const todayIso = ist.toISOString().slice(0, 10);
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

  const DateChip = ({ d }: { d: typeof dates[number] }) => {
    const checked = state.tuesdayDates.includes(d.iso);
    const weekdayHi = d.weekday === "tue" ? "मंगलवार" : "शनिवार";
    const weekdayEn = d.weekday === "tue" ? "Tuesday" : "Saturday";
    return (
      <label
        className={`relative flex items-center justify-between gap-2 rounded-xl border px-3 py-2 cursor-pointer select-none transition-colors ${
          checked
            ? "bg-saffron-50 border-saffron-600 text-sindoor-700"
            : "bg-white border-gold-500/40 text-ink-900 hover:border-saffron-500"
        }`}
        title={`${weekdayEn}, ${d.en}`}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={() => toggle("tuesdayDates", d.iso)}
        />
        <span className="leading-tight min-w-0">
          <span className="block font-deva font-semibold text-[0.95rem]">
            {d.hiShort}
          </span>
          <span className="block font-mukta text-[0.7rem] text-ink-600 mt-0.5 font-numerals tabular-nums">
            {weekdayEn}, {d.enShort} {d.year}
          </span>
        </span>
        <span
          aria-hidden
          className={`shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full border transition-colors ${
            checked
              ? "bg-saffron-600 border-saffron-600 text-cream-50"
              : "bg-cream-50 border-gold-500/55 text-transparent"
          }`}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <span className="sr-only">{weekdayHi}</span>
      </label>
    );
  };

  const GroupLabel = ({ hi, en }: { hi: string; en: string }) => (
    <p className="font-mukta uppercase tracking-[0.24em] text-[0.65rem] text-gold-500 font-semibold mb-2">
      <span className="font-tiro normal-case tracking-normal text-sm text-sindoor-700 mr-2">
        {hi}
      </span>
      / {en}
    </p>
  );

  return (
    <div>
      <StepHeading hi="किन-किन दिन को सेवा है?" en="Which days, and what time?" />

      {tuesdays.length > 0 ? (
        <>
          <GroupLabel hi="बड़े मंगल" en="Bada Mangal Tuesdays" />
          <div className="grid gap-1.5 grid-cols-2 sm:grid-cols-4" role="group" aria-label="Tuesdays">
            {tuesdays.map((d) => <DateChip key={d.iso} d={d} />)}
          </div>
        </>
      ) : null}

      {saturdays.length > 0 ? (
        <div className="mt-5">
          <GroupLabel hi="बड़े शनिवार" en="Bada Shanivar Saturdays" />
          <div className="grid gap-1.5 grid-cols-2 sm:grid-cols-4" role="group" aria-label="Saturdays">
            {saturdays.map((d) => <DateChip key={d.iso} d={d} />)}
          </div>
        </div>
      ) : null}

      {/* Free calendar pick — any day in the 2026 Bada Mangal season. */}
      <div className="mt-5 rounded-2xl border border-gold-500/40 bg-cream-50 px-4 py-3">
        <p className="font-mukta uppercase tracking-[0.24em] text-[0.65rem] text-gold-500 font-semibold">
          <span className="font-tiro normal-case tracking-normal text-sm text-sindoor-700 mr-2">
            कोई और दिन?
          </span>
          / Pick any other date
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <SeasonDatePicker
            minIso={minIso}
            maxIso={SEASON_END_ISO}
            selectedIsos={state.tuesdayDates}
            onPick={(iso) => onPickCustomDate(iso)}
            locale={locale}
          />
          <span className="text-xs text-ink-600 font-numerals tabular-nums">
            {SEASON_START_ISO} – {SEASON_END_ISO}
          </span>
        </div>

        {customDates.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {customDates.map((iso) => {
              const d = new Date(`${iso}T04:30:00Z`);
              return (
                <li key={iso}>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron-50 border border-saffron-500/50 text-ink-900 text-xs px-2.5 py-1">
                    <span className="font-numerals tabular-nums">{iso}</span>
                    <span className="text-ink-600">·</span>
                    <span className="text-ink-600">{formatEnglishDate(d)}</span>
                    <button
                      type="button"
                      onClick={() => removeDate(iso)}
                      aria-label={`Remove ${iso}`}
                      className="text-ink-600 hover:text-alert-500 leading-none"
                    >
                      ×
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      {errors.tuesdayDates ? (
        <p className="text-xs text-alert-500 mt-2">{errors.tuesdayDates[0]}</p>
      ) : null}

      {/* Timing row, section divider + two compact time pickers. */}
      <div className="mt-7 pt-5 border-t border-gold-500/30 grid gap-4 sm:grid-cols-2 items-start">
        <Field hi="शुरू होने का समय" en="Start time" required error={errors.timeStart?.[0]}>
          <TimeField
            ariaLabel="Start time"
            value={state.timeStart}
            onChange={(v) => setField("timeStart", v)}
            placeholder="Pick start time"
          />
        </Field>
        <Field
          hi="समाप्ति का समय"
          en="End time (optional)"
          error={errors.timeEnd?.[0]}
        >
          <div className="grid gap-2">
            <TimeField
              ariaLabel="End time"
              value={state.timeEnd}
              onChange={(v) => setField("timeEnd", v)}
              placeholder="प्रभु इच्छा तक"
            />
            {/* Toggle pill: when end-time is empty, show the "Prabhu iccha
                tak" tag as the implicit value. Clicking it (when set)
                clears the field back to blank. */}
            {state.timeEnd ? (
              <button
                type="button"
                onClick={() => setField("timeEnd", "")}
                className="self-start inline-flex items-center gap-1.5 rounded-full border border-gold-500/45 bg-cream-50 px-3 py-1 text-xs text-ink-900 hover:border-saffron-500 transition-colors"
              >
                <span aria-hidden>×</span>
                <span>
                  <span className="font-tiro text-sindoor-700">प्रभु इच्छा तक</span>
                  <span className="text-ink-600"> · clear end time</span>
                </span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full border border-saffron-500/40 bg-saffron-50 px-3 py-1 text-xs self-start">
                <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-saffron-600 motion-safe:animate-pulse" />
                <span>
                  <span className="font-tiro text-sindoor-700">प्रभु इच्छा तक</span>
                  <span className="text-ink-600"> · open-ended</span>
                </span>
              </span>
            )}
          </div>
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
      <div className="flex flex-wrap gap-2">
        {MENU_ITEMS.map((m) => {
          const checked = state.menu.includes(m.en);
          return (
            <label
              key={m.en}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 cursor-pointer transition-colors text-sm ${
                checked
                  ? "bg-saffron-600 border-saffron-600 text-cream-50"
                  : "bg-white border-gold-500/40 text-ink-900 hover:border-saffron-500"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={() => toggle("menu", m.en)}
              />
              <span className="font-tiro">{m.hi}</span>
              <span>· {m.en}</span>
            </label>
          );
        })}
      </div>
      {errors.menu ? <p className="text-xs text-alert-500 mt-2">{errors.menu[0]}</p> : null}

      {/* Free-form items the organizer types in */}
      <div className="mt-6">
        <p className="text-sm font-medium text-ink-900">
          <span className="font-tiro text-base text-sindoor-700 mr-1">और कुछ?</span>
          <span className="text-ink-600">
            / Anything else? Type and press Enter
          </span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-gold-500/50 bg-white px-2 py-2 focus-within:ring-2 focus-within:ring-saffron-600 focus-within:border-saffron-600">
          {state.menuOther.map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="inline-flex items-center gap-1 rounded-full bg-saffron-50 border border-saffron-500/50 text-ink-900 text-sm px-2.5 py-1"
            >
              <span className="font-mukta">{item}</span>
              <button
                type="button"
                onClick={() =>
                  setField(
                    "menuOther",
                    state.menuOther.filter((_, idx) => idx !== i),
                  )
                }
                aria-label={`Remove ${item}`}
                className="text-ink-600 hover:text-alert-500 leading-none"
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
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
                ? "इमरती / chana / lassi"
                : ""
            }
            className="min-w-[140px] flex-1 bg-transparent text-ink-900 px-2 py-1 outline-none placeholder:text-ink-600/60 font-mukta"
          />
        </div>
        <p className="mt-1 text-xs text-ink-600">
          Type each item and press Enter (or use commas). Hindi or English both work.
        </p>
        {errors.menuOther ? (
          <p className="text-xs text-alert-500 mt-1">{errors.menuOther[0]}</p>
        ) : null}
      </div>

    </div>
  );
}

/**
 * Step 5 — organizer contact details.
 *
 * Option-4 launch model: no OTP at all. The bhandara team calls the
 * submitted number to confirm details before flipping the listing live.
 * Step 5 therefore collects just Name + Mobile, with a saffron banner that
 * sets the expectation up-front. The form's submit gate only checks for a
 * structurally-valid Indian mobile — there's no separate "verified" state
 * to track or persist.
 */
function Step5({ state, errors, setField }: StepProps) {
  const { locale } = useT();
  const phone = state.organizerPhone.trim();
  const phoneValid = isValidIndianMobile(phone);

  return (
    <div>
      <StepHeading hi="व्यवस्थापक की जानकारी" en="Your contact details" />

      {/* Honest expectation-setter — we WILL call this number. Keeping
          the language explicit avoids surprise + builds trust ("they
          actually picked up the phone" is the verification model). */}
      <div className="mb-5 rounded-2xl border border-saffron-500/40 bg-saffron-50/60 px-4 py-3 flex items-center gap-3">
        <span
          aria-hidden
          className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-saffron-600 text-cream-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </span>
        <p className="text-sm text-ink-900 leading-relaxed">
          <span className="font-semibold text-sindoor-700">
            {locale === "hi" ? "कन्फ़र्मेशन" : "Confirmation"}:
          </span>{" "}
          {locale === "hi"
            ? "हम इस नंबर पर कॉल करके जानकारी सत्यापित करेंगे, फिर भंडारा लाइव होगा। नंबर कहीं सार्वजनिक नहीं होगा।"
            : "Our team will call you on this number to confirm the details, your bhandara goes live right after. Your number is never shown publicly."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 items-start">
        <Field hi="नाम" en="Full name" required error={errors.organizerName?.[0]}>
          <input
            required
            className={inputBase}
            value={state.organizerName}
            onChange={(e) => setField("organizerName", e.target.value)}
            placeholder="Ramesh Tiwari"
          />
        </Field>
        <Field
          hi="मोबाइल"
          en="Mobile"
          required
          error={
            errors.organizerPhone?.[0] ??
            (state.organizerPhone.length > 0 && !phoneValid
              ? "Enter a valid 10-digit Indian mobile number"
              : undefined)
          }
        >
          <div className="flex flex-1 items-stretch rounded-xl border bg-white overflow-hidden focus-within:ring-2 focus-within:ring-saffron-600 focus-within:border-saffron-600 border-gold-500/50">
            <span className="inline-flex items-center justify-center px-3 text-ink-600 text-base font-medium border-r border-gold-500/40 bg-saffron-50/40 select-none">
              +91
            </span>
            <input
              required
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              pattern="[0-9]{10}"
              maxLength={10}
              className="flex-1 bg-transparent px-3 py-2 text-ink-900 placeholder:text-ink-600/60 focus:outline-none font-numerals tabular-nums tracking-wide"
              // State stores only the raw 10 digits, `+91` is a visual
              // prefix in the chip on the left, never baked into state.
              value={state.organizerPhone}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                setField("organizerPhone", digits);
              }}
              placeholder="98765 43210"
            />
          </div>
        </Field>

      </div>
    </div>
  );
}

function Step6({ state, setField, locale }: StepProps & { locale: "hi" | "en" }) {
  const isHi = locale === "hi";
  return (
    <div>
      <StepHeading hi="फ़ोटो (वैकल्पिक)" en="Add a photo (optional)" />

      {/* Hint card, surface the pamphlet/banner use-case up-front so
          organizers know they can upload printed invites, not just food
          photos. */}
      <div className="mb-4 rounded-2xl border border-saffron-500/40 bg-saffron-50/60 px-4 py-3 flex items-center gap-3">
        <span
          aria-hidden
          className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-saffron-600 text-cream-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="m3 18 5-5 4 4 3-3 6 6" />
          </svg>
        </span>
        <p className="text-sm text-ink-900 leading-relaxed">
          <span className="font-semibold text-saffron-600">
            {isHi ? "टिप:" : "Tip:"}
          </span>{" "}
          {isHi
            ? "आप यहाँ अपना भंडारा का पर्चा (पैम्फ़्लेट), बैनर या निमंत्रण की तस्वीर भी अपलोड कर सकते हैं।"
            : "You can also upload your pamphlet, banner, or invite-card photo here."}
        </p>
      </div>

      <PhotoPicker
        value={state.photoUrl}
        onChange={(url) => setField("photoUrl", url)}
        locale={locale}
      />
      <p className="mt-4 text-xs text-ink-600">
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
  required,
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
  // Fixed-height label row so Devanagari + Latin labels render at the same
  // baseline across columns. Without this, Hindi labels with different
  // ascender heights nudge the input below them out of alignment.
  return (
    <label className="grid gap-1.5 self-start">
      <span className="flex items-baseline gap-2 text-sm min-h-[1.6rem] leading-tight">
        <span className="font-tiro text-base text-sindoor-700">{hi}</span>
        <span className="text-ink-600">/ {en}</span>
        {required ? <span className="text-alert-500">*</span> : null}
      </span>
      {children}
      {helper && !error ? <span className="text-xs text-ink-600">{helper}</span> : null}
      {error ? <span className="text-xs text-alert-500">{error}</span> : null}
    </label>
  );
}

// ── Thank-you ────────────────────────────────────────────────────────────

function ThankYou(_props: { slug: string }) {
  const cardRef = useRef<HTMLDivElement | null>(null);

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
    <div
      ref={cardRef}
      className="relative overflow-hidden rounded-3xl border border-saffron-500/40 bg-cream-50 p-8 sm:p-12 text-center shadow-warm"
    >
      {/* Soft saffron glow behind the tick */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(420px 260px at 50% 18%, rgba(242,148,76,0.22), transparent 65%)",
        }}
      />

      {/* Animated success tick */}
      <div className="flex justify-center">
        <span className="relative inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-leaf-600 text-cream-50 shadow-warm">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full ring-2 ring-leaf-600/25 motion-safe:animate-ping"
          />
          <svg
            viewBox="0 0 52 52"
            className="relative w-6 h-6 sm:w-7 sm:h-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path
              d="M14 27 L23 36 L38 18"
              className="motion-safe:[stroke-dasharray:50] motion-safe:[stroke-dashoffset:50] motion-safe:[animation:bm-tick_500ms_ease-out_180ms_forwards]"
            />
          </svg>
        </span>
      </div>

      {/* Devanagari "जय हनुमान" needs tighter tracking than the rest of
          the kicker line — the global Hindi tracking reset would let the
          letters drift apart at this size, so we override locally. */}
      <p className="mt-6 font-mukta uppercase text-saffron-600 text-xs font-semibold">
        <span className="font-deva [letter-spacing:0.02em]">जय हनुमान</span>
        <span className="mx-1.5">·</span>
        <span className="tracking-[0.3em]">JAI HANUMAN</span>
      </p>
      <h2 className="mt-3 font-tiro text-3xl sm:text-4xl text-sindoor-700">
        भंडारा लाइव हो गया!
      </h2>
      <p className="mt-1 font-fraunces italic text-lg text-ink-900">
        Your bhandara is now live on the city map.
      </p>
      <p className="mt-3 mx-auto max-w-md text-sm text-ink-600 leading-relaxed">
        Our team will call you within 24 hours to confirm the details
        and add a{" "}
        <span className="inline-flex items-center gap-1 align-middle px-1.5 py-0.5 rounded-full bg-leaf-600/10 border border-leaf-600/40 text-leaf-600 font-semibold text-[0.7rem]">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2 14.39 4.39 17.66 3.66 18.39 6.93 21.66 7.66 20.93 10.93 23.32 12 20.93 13.07 21.66 16.34 18.39 17.07 17.66 20.34 14.39 19.61 12 22 9.61 19.61 6.34 20.34 5.61 17.07 2.34 16.34 3.07 13.07 0.68 12 3.07 10.93 2.34 7.66 5.61 6.93 6.34 3.66 9.61 4.39z" />
            <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          Verified
        </span>{" "}
        badge.
      </p>

      {/* What-happens-next stepper. Listing is live the moment the user
          lands on this card, so steps 1 + 2 are both ticked; only the
          team's confirmation call remains. */}
      <ol className="mt-7 mx-auto max-w-md grid gap-3 text-left">
        <NextStep
          n={1}
          title="आपका भंडारा"
          en="Submission received"
          done
        />
        <NextStep
          n={2}
          title="लाइव हो गया"
          en="Live on the city map"
          done
        />
        <NextStep
          n={3}
          title="सत्यापन कॉल"
          en="Our team calls to verify (within 24h)"
        />
      </ol>

      {/* Single CTA back home — we removed the WhatsApp share + copy-link
          row because there's no public URL to share yet. */}
      <div className="mt-7 mx-auto max-w-md">
        <Link
          href="/"
          className="btn btn-primary w-full justify-center"
          data-ga="thankyou_home"
        >
          Home
        </Link>
      </div>
    </div>
  );
}

/**
 * One row in the post-submit "what happens next" stepper. `done` collapses
 * the leaf-green tick over the step number, so step 1 reads as completed
 * the instant the user lands on this card.
 */
function NextStep({
  n,
  title,
  en,
  done,
}: {
  n: number;
  title: string;
  en: string;
  done?: boolean;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full border ${
          done
            ? "bg-leaf-600 border-leaf-600 text-cream-50"
            : "bg-cream-50 border-gold-500/50 text-sindoor-700 font-semibold"
        }`}
        aria-hidden
      >
        {done ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <span className="font-numerals tabular-nums text-sm">{n}</span>
        )}
      </span>
      <span className="pt-0.5 leading-snug">
        <span className="block font-tiro text-base text-sindoor-700">
          {title}
        </span>
        <span className="block text-xs text-ink-600">{en}</span>
      </span>
    </li>
  );
}
