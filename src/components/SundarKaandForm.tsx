"use client";

import { useState } from "react";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * SundarKaandForm
 *
 * Public intake form for hosting a Sundar Kaand path or Hanuman puja.
 * Stays in one column on every viewport (forms with multi-column
 * grids feel cramped on Indian Android viewports), with the long
 * fields (notes, address) breathing properly.
 *
 * Field philosophy: only name + phone are required at the schema
 * level. Everything else is "if you know, share; if not, we'll ask
 * on the call." Frees the organiser to submit fast.
 *
 * The services checklist + preferred-date picker are kept generous
 * (multi-select dates, multi-select services) because in practice
 * the organiser is fuzzy about both and the team uses the answers
 * as a starting point, not a commitment.
 */
type EventType = "SUNDAR_KAAND" | "HANUMAN_PUJA" | "BOTH";

type Service =
  | "PANDIT"
  | "MANDALI"
  | "TABLA"
  | "HARMONIUM"
  | "TENT"
  | "CHAIRS"
  | "SOUND"
  | "PRASAD"
  | "PHOTOGRAPHY";

const SERVICE_LABELS: Record<Service, { en: string; hi: string }> = {
  PANDIT:      { en: "Pandit Ji",            hi: "पंडित जी" },
  MANDALI:     { en: "Bhajan mandali",       hi: "भजन मंडली" },
  TABLA:       { en: "Tabla / dholak",       hi: "तबला / ढोलक" },
  HARMONIUM:   { en: "Harmonium",            hi: "हारमोनियम" },
  TENT:        { en: "Tent / pandal",        hi: "टेंट / पंडाल" },
  CHAIRS:      { en: "Chairs / seating",     hi: "कुर्सियाँ / बैठने की व्यवस्था" },
  SOUND:       { en: "Sound system",         hi: "साउंड सिस्टम" },
  PRASAD:      { en: "Prasad arrangement",   hi: "प्रसाद की व्यवस्था" },
  PHOTOGRAPHY: { en: "Photographer",         hi: "फ़ोटोग्राफ़र" },
};

const ALL_SERVICES: Service[] = Object.keys(SERVICE_LABELS) as Service[];

export default function SundarKaandForm() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [eventType, setEventType] = useState<EventType>("SUNDAR_KAAND");
  const [area, setArea] = useState("");
  const [addressNotes, setAddressNotes] = useState("");
  const [preferredDates, setPreferredDates] = useState<string[]>([]);
  const [datePickerValue, setDatePickerValue] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [audienceSize, setAudienceSize] = useState("");
  const [services, setServices] = useState<Set<Service>>(new Set());
  const [notes, setNotes] = useState("");

  const [stage, setStage] = useState<"idle" | "submitting" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canSubmit =
    name.trim().length >= 2 &&
    phone.trim().length >= 10 &&
    stage !== "submitting";

  function toggleService(s: Service) {
    setServices((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function addDate() {
    const d = datePickerValue.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    if (preferredDates.includes(d)) {
      setDatePickerValue("");
      return;
    }
    if (preferredDates.length >= 5) return;
    setPreferredDates((prev) => [...prev, d].sort());
    setDatePickerValue("");
  }

  async function submit() {
    if (!canSubmit) return;
    setStage("submitting");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/organise/sundar-kaand", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          eventType,
          area: area.trim() || undefined,
          addressNotes: addressNotes.trim() || undefined,
          preferredDates,
          preferredTime: preferredTime.trim() || undefined,
          audienceSize: audienceSize ? Number(audienceSize) : undefined,
          servicesNeeded: Array.from(services),
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "submit_failed");
      }
      setStage("ok");
    } catch (e) {
      setStage("error");
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  }

  if (stage === "ok") {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-16 sm:py-24 text-center">
        <p className="font-mukta uppercase tracking-[0.32em] text-saffron-600 text-xs font-semibold">
          {isHi ? "धन्यवाद" : "Thank you"}
        </p>
        <h1
          className={`mt-3 text-3xl sm:text-4xl ${
            isHi
              ? "font-tiro text-sindoor-700"
              : "font-fraunces font-bold text-sindoor-700"
          }`}
        >
          {isHi
            ? "आपका अनुरोध मिल गया।"
            : "We've received your request."}
        </h1>
        <p className="mt-4 text-ink-600 leading-relaxed">
          {isHi
            ? "हमारी टीम 1-2 कार्य दिवसों में आपको कॉल करेगी और सब कुछ व्यवस्थित करने में मदद करेगी।"
            : "Our team will call you within 1-2 working days to help arrange pandit, mandali, tent, prasad, whatever you need."}
        </p>
        <p className="mt-8 text-2xl font-tiro text-sindoor-700">
          जय श्री राम। जय हनुमान।
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 pt-10 pb-24 sm:pt-14">
      <header className="text-center">
        <p className="font-mukta uppercase tracking-[0.32em] text-saffron-600 text-xs font-semibold">
          {isHi ? "अपने यहाँ आयोजन" : "Host at your place"}
        </p>
        <h1
          className={`mt-3 text-3xl sm:text-4xl ${
            isHi
              ? "font-tiro text-sindoor-700"
              : "font-fraunces font-bold text-sindoor-700"
          }`}
        >
          {isHi
            ? "सुंदर काण्ड / हनुमान पूजा अपने यहाँ कराइए"
            : "Organise a Sundar Kaand or Hanuman puja"}
        </h1>
        <p className="mt-3 text-sm sm:text-base text-ink-600 leading-relaxed max-w-xl mx-auto">
          {isHi
            ? "घर, सोसाइटी या स्थानीय मंदिर में आयोजन कराइए। पंडित जी, भजन मंडली, टेंट, प्रसाद, सब हम मिलकर व्यवस्थित कर देंगे।"
            : "At your home, your society, or your local mandir in Lucknow. Pandit Ji, bhajan mandali, tent, prasad, we'll help arrange the rest. Share a few details and we'll call you within 1-2 working days."}
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="mt-8 grid gap-5"
      >
        {/* What kind of event */}
        <fieldset className="grid gap-2 rounded-2xl border border-gold-500/40 bg-cream-50 p-4">
          <legend className="px-1 text-sm font-medium text-ink-900">
            {isHi ? "क्या आयोजन है?" : "What are you hosting?"}
          </legend>
          {([
            { v: "SUNDAR_KAAND", en: "Sundar Kaand path", hi: "सुंदर काण्ड पाठ" },
            { v: "HANUMAN_PUJA", en: "Hanuman puja", hi: "हनुमान पूजा" },
            { v: "BOTH", en: "Both, a combined evening", hi: "दोनों, एक ही शाम में" },
          ] as const).map((opt) => (
            <label key={opt.v} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="eventType"
                value={opt.v}
                checked={eventType === opt.v}
                onChange={() => setEventType(opt.v)}
                className="mt-1 accent-saffron-600"
              />
              <span>{isHi ? opt.hi : opt.en}</span>
            </label>
          ))}
        </fieldset>

        {/* Contact */}
        <div className="grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-sm text-ink-600">
              {isHi ? "आपका नाम" : "Your name"}{" "}
              <span className="text-sindoor-700">*</span>
            </span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm text-ink-600">
              {isHi ? "मोबाइल नंबर (10 अंक)" : "Mobile number (10 digits)"}{" "}
              <span className="text-sindoor-700">*</span>
            </span>
            <input
              type="tel"
              required
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={15}
              placeholder="9876543210"
              className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm text-ink-600">
              {isHi ? "ईमेल (वैकल्पिक)" : "Email (optional)"}
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={120}
              className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600"
            />
          </label>
        </div>

        {/* Where */}
        <div className="grid gap-4 rounded-2xl border border-gold-500/40 bg-cream-50 p-4">
          <h3 className="font-fraunces font-semibold text-sindoor-700">
            {isHi ? "कहाँ आयोजन?" : "Where?"}
          </h3>
          <label className="grid gap-1.5">
            <span className="text-sm text-ink-600">
              {isHi ? "इलाक़ा (वैकल्पिक)" : "Area / neighbourhood (optional)"}
            </span>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              maxLength={60}
              placeholder={isHi ? "जैसे, अलीगंज" : "e.g. Aliganj"}
              className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm text-ink-600">
              {isHi
                ? "पता / सोसाइटी / मंदिर (वैकल्पिक)"
                : "Address / society / mandir (optional)"}
            </span>
            <textarea
              value={addressNotes}
              onChange={(e) => setAddressNotes(e.target.value)}
              maxLength={400}
              rows={2}
              className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600"
            />
          </label>
        </div>

        {/* When */}
        <div className="grid gap-4 rounded-2xl border border-gold-500/40 bg-cream-50 p-4">
          <h3 className="font-fraunces font-semibold text-sindoor-700">
            {isHi ? "कब?" : "When?"}
          </h3>
          <div className="grid gap-1.5">
            <span className="text-sm text-ink-600">
              {isHi
                ? "पसंदीदा तिथियाँ (अधिकतम 5)"
                : "Preferred dates (up to 5)"}
            </span>
            <div className="flex gap-2">
              <input
                type="date"
                value={datePickerValue}
                onChange={(e) => setDatePickerValue(e.target.value)}
                className="flex-1 rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600"
              />
              <button
                type="button"
                onClick={addDate}
                disabled={
                  !datePickerValue ||
                  preferredDates.length >= 5 ||
                  preferredDates.includes(datePickerValue)
                }
                className="shrink-0 inline-flex items-center justify-center px-4 py-2 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isHi ? "जोड़ें" : "Add"}
              </button>
            </div>
            {preferredDates.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {preferredDates.map((d) => (
                  <li
                    key={d}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white border border-gold-500/40 px-3 py-1 text-xs"
                  >
                    {d}
                    <button
                      type="button"
                      onClick={() =>
                        setPreferredDates((prev) =>
                          prev.filter((x) => x !== d),
                        )
                      }
                      aria-label="Remove"
                      className="text-sindoor-700 hover:text-sindoor-700/80 font-bold"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <label className="grid gap-1.5">
            <span className="text-sm text-ink-600">
              {isHi
                ? "पसंदीदा समय (वैकल्पिक)"
                : "Preferred time of day (optional)"}
            </span>
            <input
              type="text"
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
              maxLength={60}
              placeholder={
                isHi ? "जैसे, शाम 6 बजे के बाद" : "e.g. evening, after 6 pm"
              }
              className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm text-ink-600">
              {isHi
                ? "अनुमानित लोगों की संख्या (वैकल्पिक)"
                : "Approximate attendance (optional)"}
            </span>
            <input
              type="number"
              min={1}
              max={10000}
              value={audienceSize}
              onChange={(e) => setAudienceSize(e.target.value)}
              placeholder="50"
              className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600"
            />
          </label>
        </div>

        {/* What's needed */}
        <fieldset className="grid gap-2 rounded-2xl border border-gold-500/40 bg-cream-50 p-4">
          <legend className="px-1 text-sm font-medium text-ink-900">
            {isHi ? "क्या-क्या चाहिए?" : "What do you need help with?"}
          </legend>
          <p className="text-xs text-ink-600 mb-1">
            {isHi
              ? "जो लागू हो उसे चुनिए, फ़ोन पर बात करते वक़्त बाकी तय कर लेंगे।"
              : "Pick whatever applies, we'll fill in the rest on the call."}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ALL_SERVICES.map((s) => {
              const checked = services.has(s);
              return (
                <label
                  key={s}
                  className={`flex items-center gap-2 text-sm rounded-xl border px-3 py-2 cursor-pointer transition-colors ${
                    checked
                      ? "border-saffron-500 bg-saffron-50 text-sindoor-700 font-medium"
                      : "border-gold-500/40 bg-white text-ink-900 hover:border-saffron-500/60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleService(s)}
                    className="accent-saffron-600"
                  />
                  <span>{isHi ? SERVICE_LABELS[s].hi : SERVICE_LABELS[s].en}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Notes */}
        <label className="grid gap-1.5">
          <span className="text-sm text-ink-600">
            {isHi
              ? "अन्य कोई बात (वैकल्पिक)"
              : "Anything else we should know (optional)"}
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={800}
            rows={4}
            placeholder={
              isHi
                ? "बजट, विशेष अनुरोध, या किसी से रेफरल की जानकारी।"
                : "Budget, special requests, who referred you, anything."
            }
            className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600"
          />
        </label>

        {/* Submit */}
        <div className="mt-2 flex flex-col items-stretch gap-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className={`inline-flex items-center justify-center px-6 py-3 rounded-full font-semibold transition-colors ${
              canSubmit
                ? "bg-saffron-600 text-cream-50 hover:bg-saffron-500 shadow-warm"
                : "bg-cream-50 text-ink-600 border border-gold-500/40 cursor-not-allowed opacity-60"
            }`}
          >
            {stage === "submitting"
              ? isHi
                ? "भेजा जा रहा है…"
                : "Sending…"
              : isHi
                ? "अनुरोध भेजें"
                : "Submit request"}
          </button>
          {stage === "error" ? (
            <p className="text-xs text-alert-500 text-center">
              {isHi
                ? "अभी कुछ गड़बड़ है, दोबारा कोशिश करें।"
                : "Something went wrong. Try again."}
              {errorMsg ? ` (${errorMsg})` : null}
            </p>
          ) : null}
          <p className="text-[11px] text-ink-600 text-center italic">
            {isHi
              ? "हम 1-2 कार्य दिवसों में कॉल करेंगे। जय श्री राम। जय हनुमान।"
              : "We'll call you within 1-2 working days. Jai Shri Ram. Jai Hanuman."}
          </p>
        </div>
      </form>
    </div>
  );
}
