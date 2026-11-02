"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { InnerShell, PageHero, Kicker, Section, FormPanel, Field as KitField, Button, Band, Actions, Plate } from "@/components/v2";
import { HOME_ART } from "@/content/home-art";
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

  const lang = isHi ? "hi" : "en";
  return (
    <InnerShell>
      <PageHero
        kicker={<Kicker>{isHi ? "मुफ़्त, बिना साइन-अप" : "Free, no sign-up"}</Kicker>}
        title={{
          en: "Bada Mangal Bhandara Pamphlet Generator",
          hi: "बड़ा मंगल भंडारा पैम्फलेट जनरेटर",
        }}
        lede={
          isHi
            ? "AI को बताइए, अपना पुराना पर्चा अपलोड कीजिए, या ख़ुद टाइप कीजिए। 30 सेकंड में A4 प्रिंट-तैयार भक्ति डिज़ाइन वाला पैम्फलेट तैयार।"
            : "Tell AI in one line, upload an old pamphlet, or type the details. Get an A4 print-ready devotional pamphlet in 30 seconds."
        }
      />

      <section className="bmi-sec tight" style={{ paddingTop: 0 }}>
        <div className="bmi-wrap bmi-formgrid">
          <div className="grid gap-10">
      {/* AI INPUT, the fast path, above the form. Describe in words or
          upload an image; both feed the same pre-fill code path. */}
      <FormPanel>
      <section aria-labelledby="ai-fill-heading" className="bmi-form" style={{ gap: 16 }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 id="ai-fill-heading" className="bmi-fh" lang={lang}>
            <span className="ic" aria-hidden><SparkleIcon /></span>
            {isHi ? "AI से एक पल में भरें" : "Fill instantly with AI"}
          </h2>
          {aiFilled ? (
            <span className="bmi-chip leaf">
              <CheckIcon />
              {isHi ? "AI ने भर दिया" : "AI filled the form"}
            </span>
          ) : null}
        </div>

        <p className="bmi-field-hint" style={{ marginTop: -6 }}>
          {isHi
            ? "एक लाइन में बताइए या अपना पुराना पर्चा/बैनर अपलोड कीजिए, नीचे का फ़ॉर्म अपने-आप भर जाएगा।"
            : "Describe in one line OR upload an old pamphlet/banner, the form below pre-fills automatically."}
        </p>

        {/* Submits on Enter (without Shift) so the mobile keyboard's
            tick triggers the AI call. Shift+Enter inserts a newline. */}
        <textarea
          value={aiText}
          onChange={(e) => setAiText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void aiFillFromText();
            }
          }}
          aria-label={isHi ? "एक लाइन में बताइए" : "Describe in one line"}
          placeholder={
            isHi
              ? "जैसे: 23 मई को अलीगंज में सुबह 11 बजे श्रीवास्तव परिवार का भंडारा, पूरी सब्ज़ी, मो. 98765 43210"
              : "e.g. Shrivastav Pariwar bhandara on 23 May at 11am in Aliganj, puri sabzi, ph 98765 43210"
          }
          rows={3}
          maxLength={2000}
          disabled={aiBusy !== null}
        />

        <div className="flex flex-wrap gap-3 items-center">
          <button
            type="button"
            onClick={() => void aiFillFromText()}
            disabled={aiText.trim().length < 4 || aiBusy !== null}
            data-ga="pamphlet_ai_fill_text"
            className="bmi-b bmi-b-s sm"
          >
            {aiBusy === "text" ? <Spinner /> : <SparkleIcon />}
            <span>
              {aiBusy === "text"
                ? isHi ? "पढ़ रहे हैं…" : "Reading…"
                : isHi ? "AI से भरें" : "Fill with AI"}
            </span>
          </button>

          <span aria-hidden className="bmi-field-hint">
            {isHi ? "या" : "or"}
          </span>

          {/* Hidden file input + visible button pair. */}
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
            className="bmi-b bmi-b-s sm"
          >
            {aiBusy === "image" ? <Spinner /> : <UploadIcon />}
            <span>
              {aiBusy === "image"
                ? isHi ? "पर्चा पढ़ रहे हैं…" : "Reading pamphlet…"
                : isHi ? "पुराना पर्चा अपलोड करें" : "Upload old pamphlet"}
            </span>
          </button>
        </div>

        {aiError ? (
          <p className="bmi-alert" role="alert">
            {aiError}
          </p>
        ) : null}
      </section>
      </FormPanel>

      {/* REVIEW & EDIT: the same fields, framed as "tweak what AI
          filled" once it has run. */}
      <section aria-labelledby="pamphlet-details-h">
        <div className="bmi-sec-head" style={{ marginBottom: 20 }}>
          <div>
            <h2 id="pamphlet-details-h" className={`bmi-h2 ${isHi ? "" : "lat"}`} lang={lang}>
              {aiFilled
                ? isHi
                  ? "विवरण की समीक्षा करें"
                  : "Review the details"
                : isHi
                  ? "या ख़ुद विवरण भरें"
                  : "Or fill the details yourself"}
            </h2>
          </div>
        </div>

        <FormPanel>
        <form
          className="bmi-form"
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

          <div className="bmi-grid2">
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

          <div className="bmi-grid2">
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

          <div className="bmi-grid2">
            <Field
              label={isHi ? "आयोजक का नाम" : "Organizer name"}
              value={state.organizerName}
              onChange={(v) => set("organizerName", v)}
              placeholder={isHi ? "जैसे श्रीवास्तव परिवार" : "e.g. Shrivastav Pariwar"}
            />
            {/* Same +91 chip and 10-digit input as the other organiser
                forms; state stores only the raw 10 digits. */}
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

          {/* THEME PICKER: pick by look. Every theme is zero cost. */}
          <fieldset className="bmi-fieldset bmi-vsec">
            <legend className="bmi-field-label" lang={lang} style={{ float: "left", width: "100%", marginBottom: 14 }}>
              {isHi ? "डिज़ाइन शैली चुनें" : "Pick a design style"}
            </legend>
            <div className="bmi-themes" role="radiogroup" style={{ clear: "both" }}>
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
                    className={`bmi-theme ${active ? "on" : ""}`.trim()}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.thumb} alt="" loading="lazy" />
                    <span className="t" lang={lang}>{isHi ? t.label.hi : t.label.en}</span>
                    <span className="s" lang={lang}>{isHi ? t.tagline.hi : t.tagline.en}</span>
                    {active ? (
                      <span className="tick" aria-hidden><CheckIcon /></span>
                    ) : null}
                  </button>
                );
              })}
              {/* Classic: instant, no AI call, the original template. */}
              <button
                type="button"
                role="radio"
                aria-checked={theme === "classic"}
                onClick={() => setTheme("classic")}
                data-ga="pamphlet_theme_pick"
                data-ga-theme="classic"
                className={`bmi-theme ${theme === "classic" ? "on" : ""}`.trim()}
              >
                <span className="ph" aria-hidden>
                  <span lang="hi">जय श्री राम</span>
                </span>
                <span className="t" lang={lang}>{isHi ? "क्लासिक" : "Classic"}</span>
                <span className="s" lang={lang}>{isHi ? "बिना AI, तुरंत तैयार" : "No AI, instant"}</span>
                {theme === "classic" ? (
                  <span className="tick" aria-hidden><CheckIcon /></span>
                ) : null}
              </button>
            </div>
            <p className="bmi-field-hint" style={{ marginTop: 14 }}>
              {theme === "classic"
                ? isHi
                  ? "तुरंत तैयार। AI नहीं चलेगा।"
                  : "Ready instantly, no AI generation."
                : isHi
                  ? "AI आपके विवरण से व्यक्तिगत हिंदी निमंत्रण लिखेगा (लगभग 5 से 8 सेकंड)। पूरी तरह मुफ़्त।"
                  : "AI writes a personalised Hindi invitation from your details (about 5 to 8 seconds). Completely free."}
            </p>
          </fieldset>

          {error ? (
            <p className="bmi-alert" role="alert">
              {isHi ? `नहीं बन पाया: ${error}` : `Couldn't generate: ${error}`}
            </p>
          ) : null}

          {/* The one saffron action; enabled once the four required
              fields are present. */}
          <div className="bmi-form-foot">
            <button
              type="submit"
              disabled={!canGenerate || generating}
              data-ga="pamphlet_generate"
              className="bmi-b bmi-b-p"
            >
              {generating ? <Spinner /> : null}
              <span>
                {generating
                  ? isHi ? "बना रहे हैं…" : "Generating…"
                  : isHi ? "पैम्फलेट बनाएँ (PNG)" : "Generate pamphlet (PNG)"}
              </span>
            </button>
            {doneUrl ? (
              <a
                href={doneUrl}
                download="bada-mangal-pamphlet.png"
                data-ga="pamphlet_redownload"
                className="bmi-b bmi-b-s"
              >
                {isHi ? "फिर से डाउनलोड करें" : "Download again"}
              </a>
            ) : null}
          </div>
          <p className="bmi-fine">
            {isHi
              ? "टिप: इस PNG को WhatsApp पर लेकर किसी भी स्थानीय प्रेस शॉप पर जाएँ, वे A4 / A5 कॉपी ₹2 से कम में प्रिंट कर देंगे।"
              : "Tip: Walk into any local press shop with this PNG on WhatsApp, they'll print A4 / A5 copies for under ₹2 each."}
          </p>
        </form>
        </FormPanel>
      </section>
          </div>
          <div className="bmi-formart" aria-hidden>
            <Plate
              src={HOME_ART.hanumanStanding.src}
              width={HOME_ART.hanumanStanding.width}
              height={HOME_ART.hanumanStanding.height}
              alt=""
              fade="bottom"
            />
          </div>
        </div>
      </section>

      {/* Cross-sell: pre-fills /list-bhandara with the same fields so
          the organiser can publish in one tap. */}
      <Band
        kicker={<Kicker>{isHi ? "एक और कदम (वैकल्पिक)" : "One more step (optional)"}</Kicker>}
        heading={
          <h2 className={`bmi-h2 ${isHi ? "" : "lat"}`} lang={lang}>
            {isHi
              ? "इस भंडारे को BadaMangal.com पर भी सूचीबद्ध करें"
              : "Also list this bhandara on BadaMangal.com"}
          </h2>
        }
        lede={
          isHi
            ? "मुफ़्त। आपने जो जानकारी भरी है वही लिस्टिंग फ़ॉर्म में पहले से भर जाती है। लखनऊ में भंडारे खोज रहे भक्तगण नक़्शे पर आपका भंडारा पाएँगे।"
            : "Free. The same details you just typed pre-fill the listing form, so it's a one-tap publish. Devotees searching for bhandaras in Lucknow will find yours on the map."
        }
        actions={
          <Actions>
            <Button href={listHref} variant="secondary" iconEnd="chevron" data-ga="pamphlet_cross_sell_list">
              {isHi ? "मेरा भंडारा सूचीबद्ध करें, मुफ़्त" : "List my bhandara, free"}
            </Button>
          </Actions>
        }
      />
    </InnerShell>
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
  const m = label.match(/^(.*?)\s*\((optional|वैकल्पिक)\)$/);
  return (
    <KitField asLabel label={m ? m[1] : label} optional={m ? m[2] : undefined} hint={hint}>
      <div className="bm-phone flex items-stretch overflow-hidden">
        <span className="inline-flex items-center justify-center select-none tabular-nums">
          +91
        </span>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          pattern="[0-9]{10}"
          maxLength={10}
          value={value}
          // Re-strip non-digits so a pasted "+91 98765 43210" collapses
          // to its 10-digit core.
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="98765 43210"
          className="flex-1 tabular-nums tracking-wide"
        />
      </div>
    </KitField>
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
  const m = label.match(/^(.*?)\s*\((?:Hindi, )?(optional|वैकल्पिक)\)$/);
  const hindiOpt = /\(हिंदी, वैकल्पिक\)$/.test(label);
  const clean = hindiOpt ? label.replace(/\s*\(हिंदी, वैकल्पिक\)$/, " (हिंदी)") : m ? m[1] + (/Hindi, optional/.test(label) ? " (Hindi)" : "") : label;
  return (
    <KitField
      asLabel
      label={clean}
      optional={hindiOpt ? "वैकल्पिक" : m ? m[2] : undefined}
    >
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </KitField>
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
