"use client";

import { useState } from "react";
import { useLocaleFromContext } from "@/lib/locale-context";
import { InnerShell, PageHero, Kicker, FormPanel, Field, Button, Icon, Heading, Plate } from "@/components/v2";
import { HOME_ART } from "@/content/home-art";

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

  const lang = isHi ? "hi" : "en";
  const opt = isHi ? "वैकल्पिक" : "optional";

  if (stage === "ok") {
    return (
      <InnerShell>
        <section className="bmi-sec">
          <div className="bmi-wrap narrow">
            <FormPanel>
              <div className="bmi-done" aria-live="polite">
                <div className="bmi-done-tick" aria-hidden>
                  <Icon name="check" />
                </div>
                <p className="bmi-kick" style={{ justifyContent: "center" }}>
                  {isHi ? "धन्यवाद" : "Thank you"}
                </p>
                <Heading as="h1" size="section" en="We've received your request." hi="आपका अनुरोध मिल गया।" />
                <p className="bmi-lede">
                  {isHi
                    ? "हमारी टीम 1 से 2 कार्य दिवसों में आपको कॉल करेगी और सब कुछ व्यवस्थित करने में मदद करेगी।"
                    : "Our team will call you within 1 to 2 working days to help arrange pandit, mandali, tent, prasad, whatever you need."}
                </p>
                <p className="bmi-fine" style={{ marginTop: 18, color: "var(--sindoor)", fontWeight: 700 }} lang="hi">
                  जय श्री राम। जय हनुमान।
                </p>
              </div>
            </FormPanel>
          </div>
        </section>
      </InnerShell>
    );
  }

  return (
    <InnerShell>
      <PageHero
        kicker={<Kicker>{isHi ? "अपने यहाँ आयोजन" : "Host at your place"}</Kicker>}
        title={{
          en: "Organise a Sundar Kaand or Hanuman puja",
          hi: "सुंदर काण्ड / हनुमान पूजा अपने यहाँ कराइए",
        }}
        lede={
          isHi
            ? "घर, सोसाइटी या स्थानीय मंदिर में आयोजन कराइए। पंडित जी, भजन मंडली, टेंट, प्रसाद, सब हम मिलकर व्यवस्थित कर देंगे।"
            : "At your home, your society, or your local mandir in Lucknow. Pandit Ji, bhajan mandali, tent, prasad, we'll help arrange the rest."
        }
      />
      <section className="bmi-sec tight" style={{ paddingTop: 0 }}>
        <div className="bmi-wrap bmi-formgrid">
          <FormPanel>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="bmi-form"
        style={{ gap: 26 }}
      >
        {/* What kind of event */}
        <fieldset className="bmi-fieldset grid gap-3">
          <legend className="bmi-field-label" lang={lang} style={{ marginBottom: 10 }}>
            {isHi ? "क्या आयोजन है?" : "What are you hosting?"}
          </legend>
          <div className="bmi-choices">
            {([
              { v: "SUNDAR_KAAND", en: "Sundar Kaand path", hi: "सुंदर काण्ड पाठ" },
              { v: "HANUMAN_PUJA", en: "Hanuman puja", hi: "हनुमान पूजा" },
              { v: "BOTH", en: "Both, a combined evening", hi: "दोनों, एक ही शाम में" },
            ] as const).map((o) => (
              <label key={o.v} className="bmi-choice" lang={lang}>
                <input
                  type="radio"
                  name="eventType"
                  value={o.v}
                  checked={eventType === o.v}
                  onChange={() => setEventType(o.v)}
                />
                {eventType === o.v ? <Icon name="check" /> : null}
                <span>{isHi ? o.hi : o.en}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Contact */}
        <div className="bmi-grid2">
          <Field asLabel lang={lang} label={isHi ? "आपका नाम" : "Your name"}>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
          </Field>
          <Field asLabel lang={lang} label={isHi ? "मोबाइल नंबर (10 अंक)" : "Mobile number (10 digits)"}>
            <input
              type="tel"
              required
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={15}
              placeholder="9876543210"
            />
          </Field>
          <Field asLabel lang={lang} label={isHi ? "ईमेल" : "Email"} optional={opt}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={120}
            />
          </Field>
        </div>

        {/* Where */}
        <div className="grid gap-5 bmi-vsec">
          <h3 className="bmi-fh" lang={lang}>
            {isHi ? "कहाँ आयोजन?" : "Where?"}
          </h3>
          <Field asLabel lang={lang} label={isHi ? "इलाक़ा" : "Area / neighbourhood"} optional={opt}>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              maxLength={60}
              placeholder={isHi ? "जैसे, अलीगंज" : "e.g. Aliganj"}
            />
          </Field>
          <Field asLabel lang={lang} label={isHi ? "पता / सोसाइटी / मंदिर" : "Address / society / mandir"} optional={opt}>
            <textarea
              value={addressNotes}
              onChange={(e) => setAddressNotes(e.target.value)}
              maxLength={400}
              rows={2}
              style={{ minHeight: 88 }}
            />
          </Field>
        </div>

        {/* When */}
        <div className="grid gap-5 bmi-vsec">
          <h3 className="bmi-fh" lang={lang}>
            {isHi ? "कब?" : "When?"}
          </h3>
          <div className="bmi-field">
            <span className="bmi-field-label" lang={lang}>
              {isHi ? "पसंदीदा तिथियाँ" : "Preferred dates"}
              <span className="opt">{isHi ? "अधिकतम 5" : "up to 5"}</span>
            </span>
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={datePickerValue}
                onChange={(e) => setDatePickerValue(e.target.value)}
                aria-label={isHi ? "तिथि चुनें" : "Pick a date"}
                className="flex-1"
              />
              <button
                type="button"
                onClick={addDate}
                disabled={
                  !datePickerValue ||
                  preferredDates.length >= 5 ||
                  preferredDates.includes(datePickerValue)
                }
                className="bmi-b bmi-b-s shrink-0"
              >
                <Icon name="plus" />
                <span>{isHi ? "जोड़ें" : "Add"}</span>
              </button>
            </div>
            {preferredDates.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {preferredDates.map((d) => (
                  <li key={d} className="bmi-tag">
                    <span className="tabular-nums">
                      {new Date(`${d}T04:30:00Z`).toLocaleDateString(isHi ? "hi-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPreferredDates((prev) =>
                          prev.filter((x) => x !== d),
                        )
                      }
                      aria-label="Remove"
                    >
                      <Icon name="plus" className="rotate-45" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="bmi-grid2">
            <Field asLabel lang={lang} label={isHi ? "पसंदीदा समय" : "Preferred time of day"} optional={opt}>
              <input
                type="text"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                maxLength={60}
                placeholder={
                  isHi ? "जैसे, शाम 6 बजे के बाद" : "e.g. evening, after 6 pm"
                }
              />
            </Field>
            <Field asLabel lang={lang} label={isHi ? "अनुमानित लोग" : "Approximate attendance"} optional={opt}>
              <input
                type="number"
                min={1}
                max={10000}
                value={audienceSize}
                onChange={(e) => setAudienceSize(e.target.value)}
                placeholder="50"
              />
            </Field>
          </div>
        </div>

        {/* What's needed */}
        <fieldset className="bmi-fieldset grid gap-3 bmi-vsec">
          <legend className="bmi-fh" lang={lang} style={{ float: "left", width: "100%", marginBottom: 4 }}>
            {isHi ? "क्या-क्या चाहिए?" : "What do you need help with?"}
          </legend>
          <p className="bmi-field-hint" style={{ clear: "both" }}>
            {isHi
              ? "जो लागू हो उसे चुनिए, फ़ोन पर बात करते वक़्त बाकी तय कर लेंगे।"
              : "Pick whatever applies, we'll fill in the rest on the call."}
          </p>
          <div className="bmi-choices">
            {ALL_SERVICES.map((sv) => {
              const checked = services.has(sv);
              return (
                <label key={sv} className="bmi-choice" lang={lang}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleService(sv)}
                  />
                  {checked ? <Icon name="check" /> : null}
                  <span>{isHi ? SERVICE_LABELS[sv].hi : SERVICE_LABELS[sv].en}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Notes */}
        <Field asLabel lang={lang} label={isHi ? "अन्य कोई बात" : "Anything else we should know"} optional={opt}>
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
          />
        </Field>

        {/* Submit */}
        <div className="grid gap-3">
          {stage === "error" ? (
            <p className="bmi-alert" role="alert">
              {isHi
                ? "अभी कुछ गड़बड़ है, दोबारा कोशिश करें।"
                : "Something went wrong. Try again."}
              {errorMsg ? ` (${errorMsg})` : null}
            </p>
          ) : null}
          <Button type="submit" disabled={!canSubmit} block iconEnd={stage === "submitting" ? null : "chevron"}>
            {stage === "submitting"
              ? isHi
                ? "भेजा जा रहा है…"
                : "Sending…"
              : isHi
                ? "अनुरोध भेजें"
                : "Submit request"}
          </Button>
          <p className="bmi-fine text-center">
            {isHi
              ? "हम 1 से 2 कार्य दिवसों में कॉल करेंगे। जय श्री राम। जय हनुमान।"
              : "We'll call you within 1 to 2 working days. Jai Shri Ram. Jai Hanuman."}
          </p>
        </div>
      </form>
          </FormPanel>
          <div className="bmi-formart" aria-hidden>
            <Plate
              src={HOME_ART.hanumanSitting.src}
              width={HOME_ART.hanumanSitting.width}
              height={HOME_ART.hanumanSitting.height}
              alt=""
              fade="bottom"
            />
          </div>
        </div>
      </section>
    </InnerShell>
  );
}
