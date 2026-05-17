"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/ga";
import { useLocaleFromContext } from "@/lib/locale-context";
import { PAMPHLET_THEMES, type PamphletArtTheme } from "@/lib/pamphlet-themes";

/** Sentinel + literal type for the theme picker. "classic" keeps the
 *  legacy all-CSS Satori template available as a fallback / option. */
type ThemeChoice = PamphletArtTheme | "classic";

/**
 * Pamphlet generator, AI-first redesign.
 *
 * Why the redesign:
 *   The old UI asked the organiser to fill 9 separate fields before
 *   they could see anything. Lucknow bhandara hosts are mostly
 *   non-tech-native, a 9-field tax-form posture was killing
 *   completion. New flow puts AI at the top: describe in one line OR
 *   upload an existing pamphlet/poster, Gemini parses → form fills →
 *   organiser tweaks and downloads. The form is still there in a
 *   "review & edit" section below, no field is hidden, but typing
 *   from scratch is now the slow path, not the only path.
 *
 * Two AI inputs, mutually exclusive at any moment:
 *   1. Text: "23 मई को अलीगंज में सुबह 11 बजे श्रीवास्तव परिवार
 *      का भंडारा, पूरी सब्ज़ी"
 *   2. Image: upload an old printed pamphlet / WhatsApp screenshot
 *      / handwritten notice. Same Gemini extractor used by /admin.
 *
 * Both POST to /api/pamphlet/ai-fill which returns
 * `ExtractedBhandara`. We map that into the local FormState below
 * and the rest of the existing generate → PNG → download pipeline
 * runs unchanged.
 */
type FormState = {
  name: string;
  nameHi: string;
  organizerName: string;
  area: string;
  address: string;
  date: string; // YYYY-MM-DD
  timeStart: string; // HH:MM
  timeEnd: string;
  menu: string;
  organizerPhone: string;
};

const INITIAL: FormState = {
  name: "",
  nameHi: "",
  organizerName: "",
  area: "",
  address: "",
  date: "",
  timeStart: "11:00",
  timeEnd: "",
  menu: "",
  organizerPhone: "",
};

/**
 * Strip every non-digit, drop a leading "91" country code if present
 * (so "+91 98765 43210" / "91-9876543210" / "919876543210" all
 * collapse to "9876543210"), then cap at 10 digits. The pamphlet
 * field stores ONLY the 10-digit national number, the +91 chip in
 * the UI is purely visual.
 */
function normalisePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  // "919876543210" → "9876543210". Only strip the leading 91 if the
  // remaining number is exactly 10 digits, otherwise the user might
  // have typed a Lucknow landline like 0522... and we shouldn't lop
  // off real digits.
  const trimmed =
    digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return trimmed.slice(0, 10);
}

function formatHumanDate(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const date = new Date(`${iso}T00:00:00`);
  const weekdays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return `${weekdays[date.getDay()]}, ${d} ${months[m - 1]} ${y}`;
}

/**
 * `ExtractedBhandara` shape returned by /api/pamphlet/ai-fill (kept
 * loose here so we don't import the zod schema into a client bundle
 *, it lives in src/lib/vision and pulls in zod transitively).
 */
type ExtractedBhandara = {
  name?: string;
  nameHi?: string;
  area?: string;
  address?: string;
  addressHi?: string;
  landmark?: string;
  dateIso?: string;
  timeStart?: string;
  timeEnd?: string;
  menu?: string[];
  menuOther?: string[];
  organizerName?: string;
  organizerPhone?: string;
  notes?: string;
};

export default function PamphletGenerator() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const [state, setState] = useState<FormState>(INITIAL);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneUrl, setDoneUrl] = useState<string | null>(null);

  // AI-fill state, owned at the top of the component so the textarea
  // and the image-upload button can share the same loading flag and
  // success notification.
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState<"text" | "image" | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiFilled, setAiFilled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Theme defaults to the first AI preset (Classical Mandir). Lucknow
  // hosts mostly produce mandir-style pamphlets so this is the
  // statistically-right starting point. Users can switch with the
  // visual picker below the form.
  const [theme, setTheme] = useState<ThemeChoice>(PAMPHLET_THEMES[0]!.id);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  /**
   * Drop AI-parsed fields into the form. Only overwrites fields the
   * extractor actually returned, leaves anything else untouched so
   * a second parse (e.g. user uploads a poster after typing a
   * description) merges rather than wipes.
   *
   * Phone is normalised to the raw 10-digit national number, the
   * UI shows the +91 country code as a fixed chip, so the state
   * must never include any prefix or spacing. Gemini sometimes
   * returns "+919876543210" or "91 9876543210"; this normaliser
   * collapses those into "9876543210" before they hit the field.
   */
  const applyExtracted = (data: ExtractedBhandara) => {
    setState((s) => ({
      ...s,
      name: data.name?.trim() || s.name,
      nameHi: data.nameHi?.trim() || s.nameHi,
      organizerName: data.organizerName?.trim() || s.organizerName,
      area: data.area?.trim() || s.area,
      address: data.address?.trim() || s.address,
      date: data.dateIso || s.date,
      timeStart: data.timeStart || s.timeStart,
      timeEnd: data.timeEnd || s.timeEnd,
      menu:
        [...(data.menu ?? []), ...(data.menuOther ?? [])].join(", ").trim() ||
        s.menu,
      organizerPhone:
        normalisePhone(data.organizerPhone ?? "") || s.organizerPhone,
    }));
    setAiFilled(true);
    setAiError(null);
  };

  const aiFillFromText = async () => {
    const text = aiText.trim();
    if (!text || aiBusy) return;
    setAiBusy("text");
    setAiError(null);
    trackEvent("pamphlet_ai_fill_text", { len: text.length });
    try {
      const res = await fetch("/api/pamphlet/ai-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: ExtractedBhandara;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.data) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      applyExtracted(json.data);
      trackEvent("pamphlet_ai_fill_success", { from: "text" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setAiError(msg);
      trackEvent("pamphlet_ai_fill_error", { from: "text", msg });
    } finally {
      setAiBusy(null);
    }
  };

  const aiFillFromImage = async (file: File) => {
    if (aiBusy) return;
    setAiBusy("image");
    setAiError(null);
    trackEvent("pamphlet_ai_fill_image", { size_kb: Math.round(file.size / 1024) });
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/pamphlet/ai-fill", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: ExtractedBhandara;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.data) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      applyExtracted(json.data);
      trackEvent("pamphlet_ai_fill_success", { from: "image" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setAiError(msg);
      trackEvent("pamphlet_ai_fill_error", { from: "image", msg });
    } finally {
      setAiBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const canGenerate =
    state.name.trim().length >= 2 &&
    state.date &&
    state.timeStart &&
    state.address.trim().length >= 3;

  const generate = async () => {
    if (!canGenerate || generating) return;
    setGenerating(true);
    setError(null);
    setDoneUrl(null);
    trackEvent("pamphlet_generate_start", { theme });
    try {
      const res = await fetch("/api/pamphlet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.name.trim(),
          nameHi: state.nameHi.trim() || undefined,
          organizerName: state.organizerName.trim() || undefined,
          area: state.area.trim() || undefined,
          address: state.address.trim() || undefined,
          date: formatHumanDate(state.date) || state.date,
          timeStart: state.timeStart || undefined,
          timeEnd: state.timeEnd || undefined,
          menu: state.menu.trim() || undefined,
          // Format the phone for the pamphlet body. State holds the
          // raw 10-digit national number; the +91 country code lives
          // only in the UI chip. Prepend it here so the printed
          // pamphlet shows "+91 98765 43210", what people expect to
          // see on a flyer. Skip entirely if the user left the
          // optional phone field empty or hasn't finished typing.
          organizerPhone:
            state.organizerPhone.length === 10
              ? `+91 ${state.organizerPhone.slice(0, 5)} ${state.organizerPhone.slice(5)}`
              : undefined,
          qrUrl: `${window.location.origin}/?q=${encodeURIComponent(state.name.trim())}`,
          // Selected theme drives the API path: any "ai-*" theme runs
          // the Gemini hero generation + new clean composer; "classic"
          // falls through to the original all-CSS Satori template.
          theme,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setDoneUrl(url);
      trackEvent("pamphlet_generate_success", {});
      const a = document.createElement("a");
      a.href = url;
      a.download = `bada-mangal-pamphlet.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      trackEvent("pamphlet_generate_error", { msg });
    } finally {
      setGenerating(false);
    }
  };

  // Pre-fill /list-bhandara via URL params so the organiser doesn't
  // re-type. The listing form picks these up on mount.
  const listParams = new URLSearchParams();
  if (state.name) listParams.set("name", state.name);
  if (state.area) listParams.set("area", state.area);
  if (state.address) listParams.set("address", state.address);
  if (state.organizerName) listParams.set("organizerName", state.organizerName);
  if (state.organizerPhone) listParams.set("organizerPhone", state.organizerPhone);
  if (state.timeStart) listParams.set("timeStart", state.timeStart);
  if (state.timeEnd) listParams.set("timeEnd", state.timeEnd);
  if (state.date) listParams.set("date", state.date);
  if (state.menu) listParams.set("menu", state.menu);
  const listHref = `/list-bhandara${listParams.toString() ? `?${listParams.toString()}` : ""}`;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-10 sm:pt-14 pb-24">
      {/* HEADER */}
      <header className="text-center">
        <p className="font-mukta uppercase tracking-[0.3em] text-saffron-600 text-xs font-semibold">
          {isHi ? "मुफ़्त · बिना साइन-अप" : "Free · No Sign-up"}
        </p>
        <h1
          className={`mt-3 font-bold text-3xl sm:text-[2.4rem] text-sindoor-700 leading-tight ${
            isHi ? "font-tiro" : "font-fraunces"
          }`}
        >
          {isHi
            ? "बड़ा मंगल भंडारा पैम्फलेट जनरेटर"
            : "Bada Mangal Bhandara Pamphlet Generator"}
        </h1>
        <p className="mt-3 text-ink-600 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          {isHi
            ? "AI को बताइए, अपना पुराना पर्चा अपलोड कीजिए, या ख़ुद टाइप कीजिए। 30 सेकंड में A4 प्रिंट-तैयार भक्ति डिज़ाइन वाला पैम्फलेट तैयार।"
            : "Tell AI in one line, upload an old pamphlet, or type the details. Get an A4 print-ready devotional pamphlet in 30 seconds."}
        </p>
      </header>

      {/* AI INPUT, primary, sits above the form so first-time visitors
          discover the fast path before scrolling into the field-heavy
          form. Two paths share one band: describe-in-words on the
          left, upload-an-image on the right. Both feed the same
          pre-fill code path. */}
      <section
        aria-labelledby="ai-fill-heading"
        className="mt-10 rounded-3xl border border-saffron-500/50 bg-gradient-to-br from-saffron-50 via-cream-50 to-cream-50 px-5 sm:px-7 py-6 sm:py-8 shadow-warm"
      >
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2
            id="ai-fill-heading"
            className="inline-flex items-center gap-2 font-mukta uppercase tracking-[0.22em] text-saffron-600 text-[0.7rem] font-semibold"
          >
            <SparkleIcon />
            {isHi ? "AI से एक पल में भरें" : "Fill instantly with AI"}
          </h2>
          {aiFilled ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-leaf-600/15 border border-leaf-600/40 text-leaf-600 px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em]">
              <CheckIcon />
              {isHi ? "AI ने भर दिया" : "AI filled the form"}
            </span>
          ) : null}
        </div>

        <p className="text-sm sm:text-[0.95rem] text-ink-600 leading-relaxed">
          {isHi
            ? "एक लाइन में बताइए या अपना पुराना पर्चा/बैनर अपलोड कीजिए, नीचे का फ़ॉर्म अपने-आप भर जाएगा।"
            : "Describe in one line OR upload an old pamphlet/banner, the form below pre-fills automatically."}
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {/* Textarea: free-form description. Submits on Enter (without
              Shift) so mobile keyboards' green tick actually triggers
              the AI call. Shift+Enter still inserts a newline. */}
          <textarea
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void aiFillFromText();
              }
            }}
            placeholder={
              isHi
                ? "जैसे: 23 मई को अलीगंज में सुबह 11 बजे श्रीवास्तव परिवार का भंडारा, पूरी सब्ज़ी, मो. 98765 43210"
                : "e.g. Shrivastav Pariwar bhandara on 23 May at 11am in Aliganj, puri sabzi, ph 98765 43210"
            }
            rows={3}
            maxLength={2000}
            disabled={aiBusy !== null}
            className="w-full rounded-2xl border border-gold-500/45 bg-white px-4 py-3 text-ink-900 text-sm sm:text-base placeholder:text-ink-600/50 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600 resize-y disabled:opacity-60"
          />

          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="button"
              onClick={() => void aiFillFromText()}
              disabled={aiText.trim().length < 4 || aiBusy !== null}
              data-ga="pamphlet_ai_fill_text"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-semibold px-5 py-2.5 text-sm shadow-warm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {aiBusy === "text" ? (
                <>
                  <Spinner />
                  {isHi ? "पढ़ रहे हैं…" : "Reading…"}
                </>
              ) : (
                <>
                  <SparkleIcon />
                  {isHi ? "AI से भरें" : "Fill with AI"}
                </>
              )}
            </button>

            <span aria-hidden className="text-gold-500/70 text-sm font-medium">
              {isHi ? "या" : "or"}
            </span>

            {/* Hidden file input + visible label-button pair: lets us
                style the button without losing native picker UX. */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void aiFillFromImage(file);
              }}
              disabled={aiBusy !== null}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={aiBusy !== null}
              data-ga="pamphlet_ai_fill_image"
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-saffron-600 text-saffron-600 hover:bg-saffron-600 hover:text-cream-50 font-semibold px-5 py-2.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {aiBusy === "image" ? (
                <>
                  <Spinner />
                  {isHi ? "पर्चा पढ़ रहे हैं…" : "Reading pamphlet…"}
                </>
              ) : (
                <>
                  <UploadIcon />
                  {isHi ? "पुराना पर्चा अपलोड करें" : "Upload old pamphlet"}
                </>
              )}
            </button>
          </div>

          {aiError ? (
            <p className="text-sm text-alert-500" role="alert">
              {aiError}
            </p>
          ) : null}
        </div>
      </section>

      {/* REVIEW & EDIT, same fields as before, just framed as "tweak
          what AI filled" instead of "fill from scratch". When the AI
          has run successfully, the section header reflects that;
          otherwise it reads as the primary entry point for users who
          prefer to type. */}
      <section className="mt-10">
        <header className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2
            className={`text-xl sm:text-2xl text-sindoor-700 ${
              isHi ? "font-tiro" : "font-fraunces font-semibold"
            }`}
          >
            {aiFilled
              ? isHi
                ? "विवरण की समीक्षा करें"
                : "Review the details"
              : isHi
                ? "या ख़ुद विवरण भरें"
                : "Or fill the details yourself"}
          </h2>
          <p className="text-xs text-ink-600">
            <span aria-hidden className="text-sindoor-700">*</span>{" "}
            {isHi ? "ज़रूरी फ़ील्ड" : "required"}
          </p>
        </header>

        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
        >
          <Field
            label={isHi ? "भंडारा का नाम (अंग्रेज़ी)" : "Bhandara name (English)"}
            required
            value={state.name}
            onChange={(v) => set("name", v)}
            placeholder={isHi ? "जैसे Shrivastav Pariwar Bhandara" : "e.g. Shrivastav Pariwar Bhandara"}
          />
          <Field
            label={isHi ? "भंडारा का नाम (हिंदी, वैकल्पिक)" : "Bhandara name (Hindi, optional)"}
            value={state.nameHi}
            onChange={(v) => set("nameHi", v)}
            placeholder="उदाहरण: श्रीवास्तव परिवार भंडारा"
          />

          <div className="grid sm:grid-cols-2 gap-5">
            <Field
              label={isHi ? "क्षेत्र / मोहल्ला" : "Area / locality"}
              value={state.area}
              onChange={(v) => set("area", v)}
              placeholder={isHi ? "जैसे अलीगंज" : "e.g. Aliganj"}
            />
            <Field
              label={isHi ? "भंडारा तिथि" : "Bhandara date"}
              required
              type="date"
              value={state.date}
              onChange={(v) => set("date", v)}
            />
          </div>

          <Field
            label={isHi ? "पूरा पता" : "Full address"}
            required
            value={state.address}
            onChange={(v) => set("address", v)}
            placeholder={
              isHi
                ? "जैसे हनुमान मंदिर, सेक्टर C, अलीगंज, लखनऊ"
                : "e.g. Hanuman Mandir, Sector C, Aliganj, Lucknow"
            }
          />

          <div className="grid sm:grid-cols-2 gap-5">
            <Field
              label={isHi ? "शुरू होने का समय" : "Start time"}
              required
              type="time"
              value={state.timeStart}
              onChange={(v) => set("timeStart", v)}
            />
            <Field
              label={isHi ? "समाप्ति समय (वैकल्पिक)" : "End time (optional)"}
              type="time"
              value={state.timeEnd}
              onChange={(v) => set("timeEnd", v)}
            />
          </div>

          <Field
            label={isHi ? "प्रसाद / मेन्यू (वैकल्पिक)" : "Prasad / menu (optional)"}
            value={state.menu}
            onChange={(v) => set("menu", v)}
            placeholder={
              isHi ? "जैसे पूरी, सब्ज़ी, हलवा, प्रसाद" : "e.g. puri, sabzi, halwa, prasad"
            }
          />

          <div className="grid sm:grid-cols-2 gap-5">
            <Field
              label={isHi ? "आयोजक का नाम" : "Organizer name"}
              value={state.organizerName}
              onChange={(v) => set("organizerName", v)}
              placeholder={isHi ? "जैसे श्रीवास्तव परिवार" : "e.g. Shrivastav Pariwar"}
            />
            {/* Phone uses the same +91-chip + 10-digit input pattern
                as BhandaraForm so the two organiser flows feel
                identical. The visual +91 chip is read-only; state
                stores only the raw 10 digits. The post-input check
                surfaces a soft-warning helper line when the user has
                started typing but hasn't reached 10 digits yet. */}
            <PhoneField
              label={isHi ? "आयोजक का फ़ोन (वैकल्पिक)" : "Organizer phone (optional)"}
              value={state.organizerPhone}
              onChange={(v) => set("organizerPhone", normalisePhone(v))}
              hint={
                state.organizerPhone.length > 0 && state.organizerPhone.length < 10
                  ? isHi
                    ? "10 अंकों का मोबाइल नंबर डालें"
                    : "Enter a 10-digit mobile number"
                  : undefined
              }
            />
          </div>

          {/* THEME PICKER, two free options:
              • AI Invitation: Gemini Flash (free) writes personalised
                Devanagari invitation copy, Satori composes a rich
                reference-style layout around a static Hanuman.
                ~5-8s.
              • Classic: the original all-CSS template, no AI at all.
                Instant.
              Both are zero-cost per pamphlet. The 4 paid Gemini
              image themes were removed at the user's request. */}
          <fieldset className="pt-4">
            <legend className="inline-flex items-center gap-2 font-mukta uppercase tracking-[0.22em] text-saffron-600 text-[0.7rem] font-semibold mb-3">
              <SparkleIcon />
              {isHi ? "डिज़ाइन शैली चुनें" : "Pick a design style"}
            </legend>
            {/* Visual picker, each AI theme card shows a thumbnail
                of its Hanuman illustration so the organiser picks
                by look, not by name. Classic theme stays as a
                text-only card at the end (no thumbnail because the
                classic template doesn't use a pre-baked bg). */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-5">
              {PAMPHLET_THEMES.map((t) => {
                const active = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setTheme(t.id)}
                    data-ga="pamphlet_theme_pick"
                    data-ga-theme={t.id}
                    className={[
                      "relative text-left rounded-2xl border-2 overflow-hidden transition-all",
                      active
                        ? "border-saffron-600 shadow-warm -translate-y-0.5"
                        : "border-gold-500/40 hover:border-saffron-500/70",
                    ].join(" ")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.thumb}
                      alt=""
                      loading="lazy"
                      className="block w-full aspect-[3/4] object-cover bg-saffron-50"
                    />
                    <div className="px-3 py-2.5 bg-cream-50">
                      <span className="block font-fraunces font-semibold text-sm text-sindoor-700 leading-tight">
                        {isHi ? t.label.hi : t.label.en}
                      </span>
                      <span className="mt-1 block text-[10px] text-ink-600 leading-snug line-clamp-2">
                        {isHi ? t.tagline.hi : t.tagline.en}
                      </span>
                    </div>
                    {/* AI · Free chip, bottom-left over the thumb */}
                    <span
                      aria-hidden
                      className="absolute top-2 left-2 inline-flex items-center gap-0.5 rounded-full bg-leaf-600 text-cream-50 text-[0.55rem] uppercase tracking-[0.16em] font-bold px-1.5 py-0.5"
                    >
                      <SparkleIcon /> {isHi ? "मुफ़्त" : "Free"}
                    </span>
                    {active ? (
                      <span
                        aria-hidden
                        className="absolute top-2 right-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-saffron-600 text-cream-50 border-2 border-cream-50 shadow-warm"
                      >
                        <CheckIcon />
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {/* Classic, instant, no AI call, the original Satori
                  template with decorative marigolds + bells built
                  from CSS. No thumbnail (no pre-baked bg), distinct
                  text-only card so the picker still reads as one
                  unified row. */}
              <button
                type="button"
                role="radio"
                aria-checked={theme === "classic"}
                onClick={() => setTheme("classic")}
                data-ga="pamphlet_theme_pick"
                data-ga-theme="classic"
                className={[
                  "relative text-left rounded-2xl border-2 overflow-hidden transition-all flex flex-col",
                  theme === "classic"
                    ? "border-saffron-600 shadow-warm -translate-y-0.5"
                    : "border-gold-500/40 hover:border-saffron-500/70",
                ].join(" ")}
              >
                <div className="flex-1 aspect-[3/4] bg-gradient-to-br from-saffron-50 via-cream-50 to-saffron-200 flex items-center justify-center">
                  <span aria-hidden className="text-5xl">🪔</span>
                </div>
                <div className="px-3 py-2.5 bg-cream-50">
                  <span className="block font-fraunces font-semibold text-sm text-sindoor-700 leading-tight">
                    {isHi ? "क्लासिक" : "Classic"}
                  </span>
                  <span className="mt-1 block text-[10px] text-ink-600 leading-snug">
                    {isHi ? "बिना AI, तुरंत तैयार" : "No AI, instant"}
                  </span>
                </div>
                <span
                  aria-hidden
                  className="absolute top-2 left-2 inline-flex items-center rounded-full bg-ink-700 text-cream-50 text-[0.55rem] uppercase tracking-[0.16em] font-bold px-1.5 py-0.5"
                >
                  ⚡ {isHi ? "तुरंत" : "Instant"}
                </span>
                {theme === "classic" ? (
                  <span
                    aria-hidden
                    className="absolute top-2 right-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-saffron-600 text-cream-50 border-2 border-cream-50 shadow-warm"
                  >
                    <CheckIcon />
                  </span>
                ) : null}
              </button>
            </div>
            <p className="mt-4 text-xs text-ink-600 inline-flex items-center gap-1.5">
              {theme === "classic" ? (
                <>
                  <span aria-hidden>⚡</span>
                  {isHi
                    ? "तुरंत तैयार। AI नहीं चलेगा।"
                    : "Ready instantly, no AI generation."}
                </>
              ) : (
                <>
                  <SparkleIcon />
                  {isHi
                    ? "AI आपके विवरण से व्यक्तिगत हिंदी निमंत्रण लिखेगा (~5-8 सेकंड)। पूरी तरह मुफ़्त।"
                    : "AI writes a personalised Hindi invitation from your details (~5-8s). Completely free."}
                </>
              )}
            </p>
          </fieldset>

          {error ? (
            <p className="text-sm text-alert-500" role="alert">
              {isHi ? `नहीं बन पाया: ${error}` : `Couldn't generate: ${error}`}
            </p>
          ) : null}

          {/* Sticky-feeling generate row. Disabled until the four
              required fields are present so the visitor can scan
              missing ones quickly. */}
          <div className="flex flex-wrap gap-3 items-center justify-center pt-2">
            <button
              type="submit"
              disabled={!canGenerate || generating}
              data-ga="pamphlet_generate"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-semibold px-6 py-3 text-base shadow-warm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <Spinner />
                  {isHi ? "बना रहे हैं…" : "Generating…"}
                </>
              ) : isHi ? (
                "पैम्फलेट बनाएँ (PNG)"
              ) : (
                "Generate pamphlet (PNG)"
              )}
            </button>
            {doneUrl ? (
              <a
                href={doneUrl}
                download="bada-mangal-pamphlet.png"
                data-ga="pamphlet_redownload"
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-saffron-600 text-saffron-600 hover:bg-saffron-50 font-semibold px-5 py-3 text-sm"
              >
                {isHi ? "फिर से डाउनलोड करें" : "Download again"}
              </a>
            ) : null}
          </div>
        </form>
      </section>

      {/* Post-generate cross-sell: pre-fills /list-bhandara with the
          same fields so the organiser can publish to the directory in
          one click. Tucked below the form so it never interrupts the
          primary "generate pamphlet" flow. */}
      <section className="mt-12 rounded-2xl border border-gold-500/45 bg-gradient-to-br from-saffron-50 to-cream-50 px-6 py-7 sm:px-8 sm:py-9 shadow-warm">
        <p className="font-mukta uppercase tracking-[0.2em] text-saffron-600 text-[0.65rem] font-semibold">
          {isHi ? "एक और कदम (वैकल्पिक)" : "One More Step (Optional)"}
        </p>
        <h2
          className={`mt-2 font-bold text-xl sm:text-2xl text-sindoor-700 ${
            isHi ? "font-tiro" : "font-fraunces"
          }`}
        >
          {isHi
            ? "इस भंडारे को BadaMangal.com पर भी सूचीबद्ध करें"
            : "Also list this bhandara on BadaMangal.com"}
        </h2>
        <p className="mt-2 text-sm sm:text-base text-ink-600">
          {isHi
            ? "मुफ़्त। आपने अभी-अभी जो जानकारी भरी है वही लिस्टिंग फ़ॉर्म में पहले से भर जाती है, यानी एक-क्लिक प्रकाशन। लखनऊ में भंडारे खोज रहे भक्तगण नक़्शे पर आपका भंडारा पाएँगे। अपने प्रिंटेड पैम्फलेट पर नीचे लगे QR कोड के साथ BadaMangal.com का उल्लेख करें, हर स्कैन यहीं पहुँचेगा।"
            : "Free. The same details you just typed pre-fill the listing form, so it's a one-tap publish. Devotees searching for bhandaras in Lucknow will find yours on the map. Mention BadaMangal.com on your printed pamphlet via the QR code at the bottom, every scan goes here."}
        </p>
        <div className="mt-4">
          <Link
            href={listHref}
            data-ga="pamphlet_cross_sell_list"
            className="inline-flex items-center gap-2 rounded-full bg-leaf-600 hover:bg-leaf-600/90 text-cream-50 font-semibold px-5 py-2.5 text-sm shadow-sm"
          >
            {isHi ? "मेरा भंडारा सूचीबद्ध करें, मुफ़्त →" : "List my bhandara, free →"}
          </Link>
        </div>
      </section>

      <p className="mt-6 text-center text-xs text-ink-600">
        {isHi
          ? "टिप: इस PNG को WhatsApp पर लेकर किसी भी स्थानीय प्रेस शॉप पर जाएँ, वे A4 / A5 कॉपी ₹2 से कम में प्रिंट कर देंगे।"
          : "Tip: Walk into any local press shop with this PNG on WhatsApp, they'll print A4 / A5 copies for under ₹2 each."}
      </p>
    </div>
  );
}

/**
 * Indian mobile-number input with a fixed "+91" country-code chip on
 * the left and a 10-digit-only numeric input on the right. Same
 * pattern as BhandaraForm's organiser-mobile field so the two
 * organiser flows look identical. Strips every non-digit + clamps to
 * 10 digits in the onChange so paste of "+91 98765 43210" / "91-9876543210"
 * still produces a clean state value.
 */
function PhoneField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Optional helper line shown under the input, used for the
   *  "Enter a 10-digit mobile number" soft warning. */
  hint?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm text-ink-600">{label}</span>
      <div className="flex items-stretch rounded-xl border border-gold-500/50 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-saffron-600 focus-within:border-saffron-600">
        <span className="inline-flex items-center justify-center px-3 text-ink-600 text-base font-medium border-r border-gold-500/40 bg-saffron-50/50 select-none font-numerals tabular-nums">
          +91
        </span>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          pattern="[0-9]{10}"
          maxLength={10}
          value={value}
          // Re-strip non-digits inside the input itself so a paste of
          // a formatted number ("+91 98765 43210") instantly collapses
          // to its 10-digit core, without this, the chip would
          // briefly show the +91 doubled up.
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="98765 43210"
          className="flex-1 bg-transparent px-3 py-2.5 text-ink-900 placeholder:text-ink-600/55 focus:outline-none font-numerals tabular-nums tracking-wide"
        />
      </div>
      {hint ? <span className="text-xs text-saffron-600">{hint}</span> : null}
    </label>
  );
}

/** Single-line input wrapper, same look as the rest of the site forms. */
function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm text-ink-600">
        {label}
        {required ? <span className="text-sindoor-700"> *</span> : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-gold-500/50 bg-white px-3 py-2.5 text-ink-900 placeholder:text-ink-600/55 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
      />
    </label>
  );
}

/* ── Small inline icons ────────────────────────────────────────────── */

function SparkleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
      <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" />
    </svg>
  );
}

function UploadIcon() {
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
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="11"
      height="11"
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

function Spinner() {
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
      className="animate-spin"
    >
      <path d="M21 12a9 9 0 1 1-6.2-8.55" />
    </svg>
  );
}
