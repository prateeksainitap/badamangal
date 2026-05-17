"use client";

import { useEffect, useRef, useState } from "react";
import { AREAS } from "@/lib/lucknow";
import { ALL_SEASON_ISO } from "@/lib/dates";
import { JaliCorner, MarigoldDivider } from "@/components/ornaments";
import { trackEvent } from "@/lib/ga";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * /organise-bhandara page body.
 *
 * Sections (top → bottom):
 *   1. Hero            — pitch + scroll-to-form CTA
 *   2. How it works    — 3-step explainer (pick, request, we arrange)
 *   3. Packages        — Small / Medium / Large cards; clicking one
 *                        pre-selects it in the form and scrolls down
 *   4. Form            — name, phone, email, area, date, time,
 *                        quantity (plates|kg), notes, hidden honeypot
 *   5. Thank-you       — replaces the form on successful submit
 *
 * The form is the only interactive piece; everything above it is
 * static markup that benefits from being in a client component only
 * so the LocaleProvider context can flip Hindi labels without a
 * round-trip.
 */

type Tier = "SMALL" | "MEDIUM" | "LARGE" | "CUSTOM";
type QuantityType = "PLATES" | "WHEAT_KG";

type PackageDef = {
  id: Exclude<Tier, "CUSTOM">;
  /** Suggested headcount used to pre-populate the form's quantityValue
   *  when the user clicks a package. Picked off the package label so
   *  the user lands on the form with a sensible number already typed. */
  suggestedPlates: number;
  labels: {
    en: { name: string; tagline: string; range: string };
    hi: { name: string; tagline: string; range: string };
  };
  /** What's included in each tier. Bullet-list rendered as the card
   *  body. Same set of items across tiers so the user can scan
   *  vertically to compare; the upgrade is depth + headcount, not
   *  capability. */
  includes: {
    en: string[];
    hi: string[];
  };
};

const PACKAGES: PackageDef[] = [
  {
    id: "SMALL",
    suggestedPlates: 200,
    labels: {
      en: {
        name: "Mohalla",
        tagline: "Neighbourhood bhandara",
        range: "100 – 300 plates",
      },
      hi: {
        name: "मोहल्ला",
        tagline: "मोहल्ले का भंडारा",
        range: "100 – 300 थाली",
      },
    },
    includes: {
      en: [
        "Shamiana / tent (small)",
        "Catering + cooks (puri, sabzi, halwa, prasad)",
        "Plates, glasses, serving staff",
        "LPG / wood stove + utensils",
        "Coordination on the day",
      ],
      hi: [
        "शामियाना / टेंट (छोटा)",
        "कैटरिंग + रसोइया (पूड़ी, सब्ज़ी, हलवा, प्रसाद)",
        "थाली, गिलास, परिचारक",
        "गैस / लकड़ी का चूल्हा + बर्तन",
        "कार्यक्रम के दिन समन्वय",
      ],
    },
  },
  {
    id: "MEDIUM",
    suggestedPlates: 500,
    labels: {
      en: {
        name: "Pariwar",
        tagline: "Community-scale bhandara",
        range: "300 – 800 plates",
      },
      hi: {
        name: "परिवार",
        tagline: "मोहल्ला-व्यापी भंडारा",
        range: "300 – 800 थाली",
      },
    },
    includes: {
      en: [
        "Shamiana / tent (medium)",
        "Catering + cooks, full thali menu",
        "Plates, glasses, serving staff",
        "LPG + wood stoves, full utensil set",
        "Drinking water + waste management",
        "Coordination on the day",
      ],
      hi: [
        "शामियाना / टेंट (मध्यम)",
        "कैटरिंग + रसोइया, पूरी थाली",
        "थाली, गिलास, परिचारक",
        "गैस + लकड़ी के चूल्हे, बर्तन का पूरा सेट",
        "पीने का पानी + सफ़ाई",
        "कार्यक्रम के दिन समन्वय",
      ],
    },
  },
  {
    id: "LARGE",
    suggestedPlates: 1500,
    labels: {
      en: {
        name: "Vishal",
        tagline: "Large-scale bhandara",
        range: "800 – 3000+ plates",
      },
      hi: {
        name: "विशाल",
        tagline: "विशाल भंडारा",
        range: "800 – 3000+ थाली",
      },
    },
    includes: {
      en: [
        "Shamiana / tent (large), multiple serving rows",
        "Full catering team + 24-hour cooks",
        "Plates, glasses, cutlery for the full count",
        "Industrial gas + wood stoves, all utensils",
        "Drinking water tanks + bio-toilets",
        "Volunteer coordination + crowd flow",
        "Sound system (kirtan / aarti) if needed",
      ],
      hi: [
        "शामियाना / टेंट (बड़ा), कई परोसने की पंक्तियाँ",
        "पूरी कैटरिंग टीम + 24-घंटे रसोइए",
        "पूरी संख्या के लिए थाली, गिलास, चम्मच",
        "औद्योगिक गैस + लकड़ी के चूल्हे, सभी बर्तन",
        "पीने के पानी की टंकी + बायो-शौचालय",
        "स्वयंसेवक समन्वय + भीड़ प्रबंधन",
        "ज़रूरत हो तो साउंड (कीर्तन / आरती)",
      ],
    },
  },
];

export default function OrganiseBhandaraView() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const t = (en: string, hi: string) => (isHi ? hi : en);

  // Form state. `tier === "CUSTOM"` until the user clicks one of the
  // three package cards, then the relevant tier is pre-selected
  // (with its suggested plates count). Custom stays selectable in the
  // form too, for organisers who don't fit a tier.
  const [tier, setTier] = useState<Tier>("CUSTOM");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [area, setArea] = useState("");
  const [addressNotes, setAddressNotes] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("11:00");
  const [quantityType, setQuantityType] = useState<QuantityType>("PLATES");
  const [quantityValue, setQuantityValue] = useState<string>("500");
  const [notes, setNotes] = useState("");
  const [honeypot, setHoneypot] = useState(""); // bot trap, must stay empty

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Source attribution: read ?from= once on mount so the email + DB row
  // remember whether the user came in from the homepage banner,
  // BhandaraForm upsell, footer, or directly. Defaults to "page" for
  // direct visits.
  const [source, setSource] = useState<string>("page");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const from = new URL(window.location.href).searchParams.get("from");
    if (from && /^[a-z_-]{1,30}$/.test(from)) setSource(from);
    // One impression event per mount so GA can compute view → submit
    // conversion. Source param distinguishes inbound channels.
    trackEvent("organise_view", { source: from || "page" });
  }, []);

  const formRef = useRef<HTMLFormElement | null>(null);

  function pickPackage(p: PackageDef) {
    setTier(p.id);
    setQuantityType("PLATES");
    setQuantityValue(String(p.suggestedPlates));
    trackEvent("organise_package_click", { tier: p.id });
    // Scroll into the form so the click feels like a follow-through,
    // smooth + offset so the form header sits below the sticky nav.
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setFieldErrors({});
    setFormError(null);
    setSubmitting(true);

    trackEvent("organise_submit_attempt", {
      tier,
      quantity_type: quantityType,
      has_date: eventDate ? 1 : 0,
      source,
    });

    try {
      const res = await fetch("/api/organise-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email,
          area,
          addressNotes,
          eventDate,
          eventTime,
          quantityType,
          quantityValue: Number(quantityValue),
          packageTier: tier,
          notes,
          source,
          website: honeypot, // honeypot
        }),
      });
      if (res.ok) {
        trackEvent("organise_submit_success", { tier, source });
        setSuccess(true);
        return;
      }
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        fields?: Record<string, string>;
      };
      trackEvent("organise_submit_error", { status: res.status, msg: j.error });
      if (j.fields) setFieldErrors(j.fields);
      setFormError(
        j.message ||
          t(
            "Couldn't send your request. Please try again or call us.",
            "अनुरोध भेजने में दिक़्क़त हुई। कृपया दोबारा कोशिश करें या फ़ोन करें।",
          ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      trackEvent("organise_submit_error", { status: 0, msg });
      setFormError(
        t("Network error. Please try again.", "नेटवर्क समस्या। दोबारा कोशिश करें।"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* ────────── Render ────────── */

  if (success) {
    return (
      <SuccessView
        isHi={isHi}
        name={name}
        phone={phone}
        tier={tier}
      />
    );
  }

  return (
    <main>
      {/* HERO */}
      <section className="relative isolate overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(800px 500px at 20% 20%, rgba(242,148,76,0.22), transparent 65%), radial-gradient(800px 500px at 80% 80%, rgba(201,162,74,0.18), transparent 65%), linear-gradient(180deg, #FFF7EB 0%, #FBF7F0 70%, #FBF7F0 100%)",
          }}
        />
        <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-12 pb-8 sm:pt-16 sm:pb-10 text-center">
          <p className="font-mukta uppercase tracking-[0.3em] text-saffron-600 text-[0.7rem] sm:text-xs font-semibold inline-flex items-center gap-2">
            <span className="block w-1.5 h-1.5 rounded-full bg-saffron-600 motion-safe:animate-pulse" />
            {t("Full-service organising", "पूर्ण सेवा आयोजन")}
          </p>
          <h1
            className={`mt-4 text-3xl sm:text-5xl leading-tight text-sindoor-700 [text-wrap:balance] ${
              isHi ? "font-tiro" : "font-fraunces font-semibold"
            }`}
          >
            {t(
              "Want to organise a bhandara? We'll handle the rest.",
              "भंडारा आयोजित करना चाहते हैं? बाक़ी सब हम पर छोड़ दें।",
            )}
          </h1>
          <p className="mt-5 mx-auto max-w-2xl text-ink-600 leading-relaxed text-sm sm:text-base">
            {t(
              "Tent, catering, plates, prasad, transport, volunteers. Pick a package or build your own, our team coordinates every piece end-to-end and you focus on the seva.",
              "टेंट, कैटरिंग, थाली, प्रसाद, परिवहन, स्वयंसेवक, हमारी टीम हर चीज़ का इंतज़ाम करेगी, आप बस सेवा पर ध्यान दें।",
            )}
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#request"
              className="btn btn-primary"
              data-ga="organise_hero_cta"
              data-ga-source={source}
            >
              {t("Request a free quote", "मुफ़्त क़ीमत मँगवाएँ")}
              <span aria-hidden>→</span>
            </a>
            <a
              href="#packages"
              className="btn btn-ghost"
              data-ga="organise_hero_packages"
            >
              {t("See packages", "पैकेज देखें")}
            </a>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-12 sm:py-16">
        <header className="text-center">
          <p className="font-mukta uppercase tracking-[0.3em] text-saffron-600 text-[0.65rem] sm:text-xs font-semibold">
            {t("How it works", "कैसे काम करता है")}
          </p>
          <h2
            className={`mt-2 text-2xl sm:text-3xl text-sindoor-700 ${
              isHi ? "font-tiro" : "font-fraunces font-semibold"
            }`}
          >
            {t("Three steps to your bhandara", "आपके भंडारे के तीन क़दम")}
          </h2>
        </header>
        <ol className="mt-8 grid gap-5 sm:grid-cols-3">
          <Step
            n={1}
            title={t("Pick a package or build your own", "पैकेज चुनें या अपना बनाएँ")}
            body={t(
              "Three published sizes cover most bhandaras; pick the closest fit or send a custom request below.",
              "तीन पैकेज ज़्यादातर भंडारों के लिए हैं; नज़दीकी चुनें या नीचे कस्टम अनुरोध भेजें।",
            )}
          />
          <Step
            n={2}
            title={t("Tell us your date + headcount", "तारीख़ और संख्या बताएँ")}
            body={t(
              "Date, time, area, and how many plates (or how many kg of wheat). Anything else relevant goes in the notes.",
              "तारीख़, समय, क्षेत्र, और कितनी थाली (या कितने किलो गेहूँ)। बाक़ी जानकारी नोट्स में।",
            )}
          />
          <Step
            n={3}
            title={t("We call back within a day", "एक दिन में कॉल करते हैं")}
            body={t(
              "Our team calls you to confirm, share a quote, and start arranging tent, catering, plates, and logistics.",
              "हमारी टीम कॉल करके पुष्टि करेगी, क़ीमत देगी, और टेंट, कैटरिंग, थाली, और बाक़ी इंतज़ाम शुरू करेगी।",
            )}
          />
        </ol>
      </section>

      {/* PACKAGES */}
      <section
        id="packages"
        className="bg-cream-50/60 border-y border-gold-500/30 py-12 sm:py-16 scroll-mt-20"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <header className="text-center">
            <p className="font-mukta uppercase tracking-[0.3em] text-saffron-600 text-[0.65rem] sm:text-xs font-semibold">
              {t("Bhandara packages", "भंडारा पैकेज")}
            </p>
            <h2
              className={`mt-2 text-2xl sm:text-3xl text-sindoor-700 ${
                isHi ? "font-tiro" : "font-fraunces font-semibold"
              }`}
            >
              {t("Three ready-to-go sizes", "तीन तैयार पैकेज")}
            </h2>
            <p className="mt-2 text-sm text-ink-600">
              {t(
                "Pricing is custom to your venue, date, and headcount, click a package and we'll share a quote.",
                "क़ीमत आपके स्थान, तारीख़ और संख्या के अनुसार, पैकेज पर क्लिक करें, क़ीमत बताएँगे।",
              )}
            </p>
          </header>
          <ul className="mt-8 grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PACKAGES.map((p) => (
              <PackageCard
                key={p.id}
                pkg={p}
                isHi={isHi}
                active={tier === p.id}
                onPick={() => pickPackage(p)}
              />
            ))}
          </ul>
        </div>
      </section>

      {/* FORM */}
      <section
        id="request"
        className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16 scroll-mt-20"
      >
        <header className="text-center">
          <p className="font-mukta uppercase tracking-[0.3em] text-saffron-600 text-[0.65rem] sm:text-xs font-semibold">
            {t("Send a request", "अनुरोध भेजें")}
          </p>
          <h2
            className={`mt-2 text-2xl sm:text-3xl text-sindoor-700 ${
              isHi ? "font-tiro" : "font-fraunces font-semibold"
            }`}
          >
            {tier === "CUSTOM"
              ? t("Tell us about your bhandara", "अपने भंडारे के बारे में बताएँ")
              : t(
                  `Request the ${selectedPackageName(tier, "en")} package`,
                  `${selectedPackageName(tier, "hi")} पैकेज माँगें`,
                )}
          </h2>
          <p className="mt-2 text-sm text-ink-600">
            {t(
              "We call back within a working day with a quote and next steps.",
              "हम एक कामकाजी दिन में क़ीमत और अगले क़दम के साथ कॉल करते हैं।",
            )}
          </p>
        </header>

        <form
          ref={formRef}
          onSubmit={onSubmit}
          className="mt-8 grid gap-4 sm:gap-5"
        >
          {/* Honeypot. Real users leave it blank; bots fill every input. */}
          <label
            aria-hidden
            className="absolute left-[-9999px] w-px h-px overflow-hidden"
          >
            Website
            <input
              type="text"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              autoComplete="off"
              tabIndex={-1}
            />
          </label>

          {/* Package tier as a quick chip row inside the form — lets the
              user switch tier without scrolling back up to the cards. */}
          <fieldset className="grid gap-2">
            <legend className="text-xs uppercase tracking-wider text-ink-600 mb-1">
              {t("Package", "पैकेज")}
            </legend>
            <div className="flex flex-wrap gap-2">
              {PACKAGES.map((p) => (
                <TierChip
                  key={p.id}
                  label={p.labels[isHi ? "hi" : "en"].name}
                  active={tier === p.id}
                  onClick={() => setTier(p.id)}
                />
              ))}
              <TierChip
                label={t("Custom", "कस्टम")}
                active={tier === "CUSTOM"}
                onClick={() => setTier("CUSTOM")}
              />
            </div>
          </fieldset>

          <div className="grid sm:grid-cols-2 gap-4">
            <FieldText
              label={t("Your name", "आपका नाम")}
              value={name}
              onChange={setName}
              required
              error={fieldErrors.name}
            />
            <FieldText
              label={t("Phone (we call back)", "फ़ोन (कॉलबैक)")}
              value={phone}
              onChange={setPhone}
              type="tel"
              required
              maxLength={20}
              error={fieldErrors.phone}
              hint={t("Indian mobile, 10 digits", "भारतीय मोबाइल, 10 अंक")}
            />
          </div>

          <FieldText
            label={t("Email (optional)", "ईमेल (वैकल्पिक)")}
            value={email}
            onChange={setEmail}
            type="email"
            error={fieldErrors.email}
            hint={t(
              "Used only to email you the quote",
              "केवल क़ीमत ईमेल करने के लिए",
            )}
          />

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="grid gap-1.5">
              <span className="text-sm text-ink-900 font-medium">
                {t("Area in Lucknow", "लखनऊ में क्षेत्र")}
              </span>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
              >
                <option value="">
                  {t("Select an area", "क्षेत्र चुनें")}
                </option>
                {AREAS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <FieldText
              label={t("Venue / landmark", "स्थान / लैंडमार्क")}
              value={addressNotes}
              onChange={setAddressNotes}
              error={fieldErrors.addressNotes}
              hint={t(
                "E.g. Hanuman Mandir, Aliganj",
                "जैसे, हनुमान मंदिर, अलीगंज",
              )}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="grid gap-1.5">
              <span className="text-sm text-ink-900 font-medium">
                {t("Date", "तारीख़")}
              </span>
              <select
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
              >
                <option value="">
                  {t("Pick a Tuesday / Saturday", "मंगल / शनि चुनें")}
                </option>
                {ALL_SEASON_ISO.map((iso) => (
                  <option key={iso} value={iso}>
                    {formatIsoForOption(iso, isHi)}
                  </option>
                ))}
              </select>
              {fieldErrors.eventDate ? (
                <span className="text-xs text-alert-500">
                  {fieldErrors.eventDate}
                </span>
              ) : null}
            </label>
            <FieldText
              label={t("Time (24h)", "समय (24 घंटे)")}
              value={eventTime}
              onChange={setEventTime}
              type="time"
              error={fieldErrors.eventTime}
            />
          </div>

          {/* Size: plates OR kg of wheat. Two-button toggle so the
              unit is obvious, then a single numeric input. */}
          <fieldset className="grid gap-2">
            <legend className="text-sm text-ink-900 font-medium mb-1">
              {t("How big?", "कितना बड़ा?")}
            </legend>
            <div className="flex gap-2">
              <TierChip
                label={t("Plates", "थाली")}
                active={quantityType === "PLATES"}
                onClick={() => setQuantityType("PLATES")}
              />
              <TierChip
                label={t("Wheat (kg)", "गेहूँ (किलो)")}
                active={quantityType === "WHEAT_KG"}
                onClick={() => setQuantityType("WHEAT_KG")}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={100000}
                value={quantityValue}
                onChange={(e) => setQuantityValue(e.target.value)}
                required
                className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600 w-40 tabular-nums"
              />
              <span className="text-sm text-ink-600">
                {quantityType === "PLATES"
                  ? t("plates", "थाली")
                  : t("kg of wheat", "किलो गेहूँ")}
              </span>
            </div>
            {fieldErrors.quantityValue ? (
              <span className="text-xs text-alert-500">
                {fieldErrors.quantityValue}
              </span>
            ) : null}
            <p className="text-xs text-ink-600">
              {t(
                "Rough estimate is fine, we'll refine it on the call.",
                "अंदाज़ा भी चलेगा, कॉल पर बात करके पक्का करेंगे।",
              )}
            </p>
          </fieldset>

          <label className="grid gap-1.5">
            <span className="text-sm text-ink-900 font-medium">
              {t("Anything else?", "और कुछ बताना है?")}
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder={t(
                "e.g. sound system for kirtan, separate veg / non-prasad section, parking constraints…",
                "जैसे, कीर्तन के लिए साउंड, अलग प्रसाद-शाकाहारी कक्ष, पार्किंग…",
              )}
              className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
            />
          </label>

          {formError ? (
            <div className="rounded-xl border border-alert-500/45 bg-cream-50 p-3 text-sm text-alert-500">
              {formError}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 mt-2">
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
            >
              {submitting
                ? t("Sending…", "भेज रहे हैं…")
                : t("Send request", "अनुरोध भेजें")}
              {submitting ? null : <span aria-hidden>→</span>}
            </button>
            <p className="text-xs text-ink-600">
              {t(
                "We don't share your number. Callback within one working day.",
                "हम आपका नंबर साझा नहीं करते। एक कामकाजी दिन में कॉल।",
              )}
            </p>
          </div>
        </form>
      </section>

      <div className="flex justify-center pb-12">
        <MarigoldDivider size={220} className="text-gold-500" />
      </div>
    </main>
  );
}

/* ────────── Helpers ────────── */

function selectedPackageName(tier: Tier, lang: "en" | "hi"): string {
  const p = PACKAGES.find((x) => x.id === tier);
  return p ? p.labels[lang].name : tier;
}

function formatIsoForOption(iso: string, isHi: boolean): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = isHi
    ? ["जन", "फ़र", "मार्च", "अप्रैल", "मई", "जून", "जुल", "अग", "सित", "अक्ट", "नव", "दिस"]
    : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // Lightweight weekday from JS Date — only used for the SELECT label
  // so the timezone offset doesn't matter for "is this a Tuesday?"
  const dow = new Date(`${iso}T04:30:00Z`).getUTCDay();
  const dowLabel = dow === 2 ? (isHi ? "मंगल" : "Tue") : (isHi ? "शनि" : "Sat");
  return `${dowLabel} · ${d} ${months[m - 1]} ${y}`;
}

/* ────────── Sub-components ────────── */

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="relative rounded-2xl border border-gold-500/40 bg-cream-50 p-5 shadow-warm">
      <span className="absolute -top-3 -left-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-saffron-600 text-cream-50 font-numerals font-bold shadow-warm">
        {n}
      </span>
      <h3 className="font-fraunces text-lg font-semibold text-sindoor-700 mt-2">
        {title}
      </h3>
      <p className="mt-1.5 text-sm text-ink-600 leading-relaxed">{body}</p>
    </li>
  );
}

function PackageCard({
  pkg,
  isHi,
  active,
  onPick,
}: {
  pkg: PackageDef;
  isHi: boolean;
  active: boolean;
  onPick: () => void;
}) {
  const labels = pkg.labels[isHi ? "hi" : "en"];
  const includes = pkg.includes[isHi ? "hi" : "en"];
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className={`relative w-full text-left rounded-3xl border bg-cream-50 p-6 sm:p-7 shadow-warm transition-transform hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-600 ${
          active
            ? "border-saffron-500 ring-2 ring-saffron-500/40"
            : "border-gold-500/45"
        }`}
        data-ga="organise_package_pick"
        data-ga-tier={pkg.id}
      >
        <JaliCorner position="tl" className="absolute top-3 left-3 w-7 h-7 text-gold-500/55" />
        <JaliCorner position="tr" className="absolute top-3 right-3 w-7 h-7 text-gold-500/55" />
        <p className="font-mukta uppercase tracking-[0.22em] text-[0.7rem] text-saffron-600 font-semibold">
          {labels.tagline}
        </p>
        <h3
          className={`mt-1 text-2xl text-sindoor-700 ${
            isHi ? "font-tiro" : "font-fraunces font-semibold"
          }`}
        >
          {labels.name}
        </h3>
        <p className="text-sm text-ink-600 font-medium mt-0.5">{labels.range}</p>
        <ul className="mt-4 space-y-1.5 text-sm text-ink-900">
          {includes.map((line) => (
            <li key={line} className="flex items-start gap-1.5">
              <span aria-hidden className="text-saffron-600 mt-0.5">✓</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-saffron-600">
          {active
            ? isHi
              ? "चुना गया"
              : "Selected"
            : isHi
              ? "इसी पर अनुरोध भेजें →"
              : "Request this →"}
        </span>
      </button>
    </li>
  );
}

function TierChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "border-saffron-500 bg-saffron-50 text-sindoor-700"
          : "border-gold-500/40 bg-cream-50 text-ink-600 hover:border-saffron-500/60"
      }`}
    >
      {label}
    </button>
  );
}

function FieldText({
  label,
  value,
  onChange,
  type = "text",
  required,
  maxLength,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
  error?: string;
  hint?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm text-ink-900 font-medium">
        {label}
        {required ? <span className="text-sindoor-700"> *</span> : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        maxLength={maxLength}
        className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
      />
      {error ? (
        <span className="text-xs text-alert-500">{error}</span>
      ) : hint ? (
        <span className="text-xs text-ink-600">{hint}</span>
      ) : null}
    </label>
  );
}

function SuccessView({
  isHi,
  name,
  phone,
  tier,
}: {
  isHi: boolean;
  name: string;
  phone: string;
  tier: Tier;
}) {
  const tierLabel = selectedPackageName(tier, isHi ? "hi" : "en");
  return (
    <section className="mx-auto max-w-2xl px-4 sm:px-6 py-16 sm:py-24 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-leaf-600 text-cream-50 shadow-warm">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h1
        className={`mt-5 text-3xl sm:text-4xl text-sindoor-700 ${
          isHi ? "font-tiro" : "font-fraunces font-semibold"
        }`}
      >
        {isHi ? `धन्यवाद ${name}!` : `Thank you, ${name}!`}
      </h1>
      <p className="mt-3 text-ink-600 leading-relaxed">
        {isHi
          ? `आपका ${tier === "CUSTOM" ? "कस्टम" : tierLabel} पैकेज का अनुरोध हमें मिल गया है। हमारी टीम एक कामकाजी दिन में ${phone} पर कॉल करेगी।`
          : `Your request for the ${tier === "CUSTOM" ? "custom" : tierLabel} package has reached us. Our team will call you on ${phone} within one working day.`}
      </p>
      <p className="mt-2 text-sm text-ink-600">
        {isHi
          ? "अगर कुछ बदलना हो तो बस वही नंबर वापस भेजें।"
          : "Need to change anything? Just reply on the same number."}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <a href="/" className="btn btn-ghost">
          {isHi ? "← होम" : "← Home"}
        </a>
      </div>
    </section>
  );
}
