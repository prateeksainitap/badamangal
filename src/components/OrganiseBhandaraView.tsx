"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AREAS } from "@/lib/lucknow";
import {
  ALL_TUESDAY_ISO,
  ALL_SATURDAY_ISO,
  SEASON_END_ISO,
  SEASON_START_ISO,
} from "@/lib/dates";
import { JaliCorner, MarigoldDivider } from "@/components/ornaments";
import { trackEvent } from "@/lib/ga";
import { useLocaleFromContext } from "@/lib/locale-context";
import FancySelect, { type FancySelectOption } from "@/components/FancySelect";
import TimeField from "@/components/TimeField";
import SeasonDatePicker from "@/components/SeasonDatePicker";
import PhoneInput from "@/components/PhoneInput";

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
  // "Custom area" mode: organisers in neighbourhoods we haven't curated
  // (smaller localities, new colonies, areas outside the curated 36)
  // can type their own name. Picking the "Other (type your own)"
  // sentinel option flips this on; a small "← Pick from list" link
  // flips it back. Same pattern admin /scan + BhandaraForm use, so
  // the area picker behaves identically across every submission
  // surface on the site.
  const [customAreaMode, setCustomAreaMode] = useState(false);
  const [addressNotes, setAddressNotes] = useState("");
  // Multi-date: the preset chips toggle in/out of this array, and the
  // shared SeasonDatePicker appends any custom date the organiser
  // picks. Sorted on save so the email body reads chronologically.
  const [eventDates, setEventDates] = useState<string[]>([]);
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

  // Area dropdown options for the shared FancySelect. Memoised so the
  // 38-item array isn't rebuilt on every keystroke; recomputes only
  // when locale flips. Last entry is the "Other (type your own)"
  // sentinel — picking it flips customAreaMode on and the dropdown
  // swaps to a free-text input.
  const areaOptions: FancySelectOption[] = useMemo(
    () => [
      { value: "", label: t("Select an area", "क्षेत्र चुनें") },
      ...AREAS.map((a) => ({ value: a, label: a })),
      {
        value: "__custom__",
        label: t("Other (type your own)…", "अन्य (अपना लिखें)…"),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isHi],
  );

  // Date preset chips — Bada Mangal Tuesdays + Bade Shanivars from
  // the season list. We slice off dates already past (IST) so the
  // organiser never picks a chip that's invalid, plus the custom
  // picker below is bounded to today→season-end.
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const todayIso = ist.toISOString().slice(0, 10);
  const minIso = todayIso > SEASON_START_ISO ? todayIso : SEASON_START_ISO;
  const presetTuesdays = ALL_TUESDAY_ISO.filter((d) => d >= todayIso);
  const presetSaturdays = ALL_SATURDAY_ISO.filter((d) => d >= todayIso);
  const presetSet = useMemo(
    () => new Set<string>([...presetTuesdays, ...presetSaturdays]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todayIso],
  );
  const customDates = useMemo(
    () => eventDates.filter((d) => !presetSet.has(d)).sort(),
    [eventDates, presetSet],
  );

  const toggleDate = (iso: string): void => {
    setEventDates((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso].sort(),
    );
  };
  const addCustomDate = (iso: string): void => {
    if (!iso) return;
    if (iso < SEASON_START_ISO || iso > SEASON_END_ISO) return;
    setEventDates((prev) =>
      prev.includes(iso) ? prev : [...prev, iso].sort(),
    );
  };
  const removeDate = (iso: string): void => {
    setEventDates((prev) => prev.filter((d) => d !== iso));
  };

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
      date_count: eventDates.length,
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
          eventDates,
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

        {/* The whole form sits inside a card now (was bare on the
            page background, which made it read as a "loose collection
            of inputs" instead of a single submittable thing). Warm
            gradient + saffron border + jali corners mirror the
            chooser cards' visual language, so the form feels like
            the destination card of the same family. */}
        <form
          ref={formRef}
          onSubmit={onSubmit}
          className="relative mt-8 overflow-hidden rounded-3xl border border-saffron-500/45 p-6 sm:p-9 shadow-warm"
          style={{
            background:
              "radial-gradient(700px 360px at 18% 0%, rgba(242,148,76,0.13), transparent 65%), radial-gradient(700px 360px at 82% 100%, rgba(201,162,74,0.14), transparent 65%), linear-gradient(180deg, #FFF7EB 0%, #FBF7F0 100%)",
          }}
        >
          <JaliCorner position="tl" className="absolute top-3 left-3 w-8 h-8 text-gold-500/55" />
          <JaliCorner position="tr" className="absolute top-3 right-3 w-8 h-8 text-gold-500/55" />
          <JaliCorner position="bl" className="absolute bottom-3 left-3 w-8 h-8 text-gold-500/55" />
          <JaliCorner position="br" className="absolute bottom-3 right-3 w-8 h-8 text-gold-500/55" />

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

          {/* ── Package tier chip row ─────────────────────────────── */}
          <fieldset className="grid gap-2">
            <SectionLabel
              title={t("Package", "पैकेज")}
              hint={t(
                "Switch tier anytime, the request body adjusts.",
                "अभी भी बदल सकते हैं, अनुरोध उसी के अनुसार बनेगा।",
              )}
            />
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

          <SectionDivider />

          {/* ── Your contact ─────────────────────────────────────── */}
          <SectionHeading
            kicker={t("Your contact", "आपका संपर्क")}
            body={t(
              "We call back on this number within a working day.",
              "हम इसी नंबर पर एक कामकाजी दिन में कॉल करते हैं।",
            )}
          />
          <div className="mt-4 grid sm:grid-cols-2 gap-4 sm:gap-5">
            <FieldText
              label={t("Your name", "आपका नाम")}
              value={name}
              onChange={setName}
              required
              error={fieldErrors.name}
            />
            <label className="grid gap-1.5 self-start">
              <span className="text-sm text-ink-900 font-medium">
                {t("Phone (we call back)", "फ़ोन (कॉलबैक)")}
                <span className="text-sindoor-700"> *</span>
              </span>
              {/* Shared PhoneInput: +91 prefix locked in visually, 10-digit
                  cap, numeric keyboard on mobile. Same control everywhere
                  on the site. */}
              <PhoneInput
                value={phone}
                onChange={setPhone}
                required
                error={fieldErrors.phone}
                hint={t("10-digit Indian mobile", "10-अंकीय भारतीय मोबाइल")}
              />
            </label>
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
          </div>

          <SectionDivider />

          {/* ── Where + when ────────────────────────────────────── */}
          <SectionHeading
            kicker={t("Where + when", "कहाँ और कब")}
            body={t(
              "Pick one or many dates. Skip the date if you haven't fixed it yet.",
              "एक या कई तारीख़ें चुनें। अगर अभी तय नहीं की तो छोड़ दें।",
            )}
          />
          <div className="mt-4 grid sm:grid-cols-2 gap-4 sm:gap-5">
            <label className="grid gap-1.5 self-start">
              <span className="text-sm text-ink-900 font-medium">
                {t("Area in Lucknow", "लखनऊ में क्षेत्र")}
              </span>
              {customAreaMode ? (
                // Free-text mode: typed by organisers in areas not in
                // the curated 36-list (smaller localities, new
                // colonies). The "← Pick from list" link below flips
                // back to the dropdown without losing form state.
                <div className="grid gap-1.5">
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder={t(
                      "Type your area name",
                      "अपना क्षेत्र लिखें",
                    )}
                    maxLength={50}
                    autoFocus
                    className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setArea("");
                      setCustomAreaMode(false);
                    }}
                    className="self-start text-xs underline decoration-dotted underline-offset-4 text-ink-600 hover:text-sindoor-700"
                  >
                    {t("← Pick from list", "← सूची से चुनें")}
                  </button>
                </div>
              ) : (
                <FancySelect
                  ariaLabel={t("Area in Lucknow", "लखनऊ में क्षेत्र")}
                  value={area}
                  onChange={(v) => {
                    // Sentinel handoff to free-text mode. Clear the
                    // value first so the input renders empty + focused
                    // rather than carrying "__custom__" as text.
                    if (v === "__custom__") {
                      setArea("");
                      setCustomAreaMode(true);
                      return;
                    }
                    setArea(v);
                  }}
                  options={areaOptions}
                  variant="input"
                  size="md"
                  searchable
                  searchPlaceholder={t("Search areas…", "क्षेत्र खोजें…")}
                />
              )}
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

          {/* Multi-date chips (Bada Mangal Tuesdays + Bade Shanivars
              from ALL_TUESDAY_ISO / ALL_SATURDAY_ISO, past dates
              dropped). Same chip pattern BhandaraForm uses on its
              dates step, kept here so organisers used to the listing
              flow recognise it immediately. Below the presets, a
              shared SeasonDatePicker lets them add any other date
              inside the season window. */}
          <div className="mt-5 grid gap-3">
            <span className="text-sm text-ink-900 font-medium">
              {t("Pick service dates", "तारीख़ें चुनें")}
              <span className="ml-1.5 text-xs font-normal text-ink-600">
                {t("(multi-select)", "(कई चुन सकते हैं)")}
              </span>
            </span>

            {presetTuesdays.length > 0 ? (
              <div>
                <p className="font-mukta uppercase tracking-[0.22em] text-[0.65rem] text-gold-500 font-semibold mb-2">
                  {t("Bada Mangal Tuesdays", "बड़े मंगल")}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {presetTuesdays.map((iso) => (
                    <DateChip
                      key={iso}
                      iso={iso}
                      weekday="Tue"
                      weekdayHi="मंगल"
                      checked={eventDates.includes(iso)}
                      onToggle={() => toggleDate(iso)}
                      isHi={isHi}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {presetSaturdays.length > 0 ? (
              <div>
                <p className="font-mukta uppercase tracking-[0.22em] text-[0.65rem] text-gold-500 font-semibold mb-2">
                  {t("Bade Shanivar Saturdays", "बड़े शनिवार")}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {presetSaturdays.map((iso) => (
                    <DateChip
                      key={iso}
                      iso={iso}
                      weekday="Sat"
                      weekdayHi="शनि"
                      checked={eventDates.includes(iso)}
                      onToggle={() => toggleDate(iso)}
                      isHi={isHi}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {/* Custom date — any day in the season window. */}
            <div className="rounded-2xl border border-gold-500/40 bg-cream-50 px-4 py-3">
              <p className="font-mukta uppercase tracking-[0.22em] text-[0.65rem] text-gold-500 font-semibold">
                {t("Custom date", "कोई और दिन")}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <SeasonDatePicker
                  minIso={minIso}
                  maxIso={SEASON_END_ISO}
                  selectedIsos={eventDates}
                  onPick={addCustomDate}
                  locale={isHi ? "hi" : "en"}
                />
                <span className="text-xs text-ink-600 font-numerals tabular-nums">
                  {SEASON_START_ISO} – {SEASON_END_ISO}
                </span>
              </div>
              {customDates.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {customDates.map((iso) => (
                    <li key={iso}>
                      <button
                        type="button"
                        onClick={() => removeDate(iso)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-saffron-50 border border-saffron-500/60 text-sindoor-700 px-2.5 py-1 text-xs font-semibold hover:bg-saffron-100"
                        title={t("Remove", "हटाएँ")}
                      >
                        {formatIsoShort(iso, isHi)}
                        <span aria-hidden>×</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {eventDates.length > 0 ? (
              <p className="text-xs text-ink-600">
                {isHi
                  ? `${eventDates.length} तारीख़${eventDates.length === 1 ? "" : "ें"} चुनी गईं।`
                  : `${eventDates.length} date${eventDates.length === 1 ? "" : "s"} selected.`}
              </p>
            ) : null}
            {fieldErrors.eventDates ? (
              <span className="text-xs text-alert-500">
                {fieldErrors.eventDates}
              </span>
            ) : null}
          </div>

          {/* Time on its own row so the picker popover has room. */}
          <div className="mt-4 grid sm:grid-cols-2 gap-4 sm:gap-5">
            <label className="grid gap-1.5 self-start">
              <span className="text-sm text-ink-900 font-medium">
                {t("Time", "समय")}
              </span>
              <TimeField
                ariaLabel={t("Pick a time", "समय चुनें")}
                value={eventTime}
                onChange={setEventTime}
              />
              {fieldErrors.eventTime ? (
                <span className="text-xs text-alert-500">
                  {fieldErrors.eventTime}
                </span>
              ) : null}
            </label>
          </div>

          <SectionDivider />

          {/* ── Size + notes ─────────────────────────────────────── */}
          <SectionHeading
            kicker={t("How big?", "कितना बड़ा?")}
            body={t(
              "Rough estimate is fine, we'll refine on the call.",
              "अंदाज़ा भी चलेगा, कॉल पर पक्का कर लेंगे।",
            )}
          />
          <fieldset className="mt-4 grid gap-3">
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
          </fieldset>

          <div className="mt-5">
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
          </div>

          {formError ? (
            <div className="mt-5 rounded-xl border border-alert-500/45 bg-cream-50 p-3 text-sm text-alert-500">
              {formError}
            </div>
          ) : null}

          <div className="mt-7 flex flex-wrap items-center gap-3">
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

/** Short ISO → "19 May" (or Hindi equivalent) for custom-date pill chips. */
function formatIsoShort(iso: string, isHi: boolean): string {
  const [, m, d] = iso.split("-").map(Number);
  if (!m || !d) return iso;
  const months = isHi
    ? ["जन", "फ़र", "मार्च", "अप्रैल", "मई", "जून", "जुल", "अग", "सित", "अक्ट", "नव", "दिस"]
    : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[m - 1]}`;
}

/* ────────── Sub-components ────────── */

/** Section heading inside the form card. Saffron uppercase kicker
 *  + serif heading + optional body line. Used to break the form into
 *  scannable groups (Contact, Where + when, How big, etc.). */
function SectionHeading({
  kicker,
  body,
}: {
  kicker: string;
  body?: string;
}) {
  return (
    <header>
      <p className="font-mukta uppercase tracking-[0.24em] text-[0.65rem] text-saffron-600 font-semibold">
        {kicker}
      </p>
      {body ? (
        <p className="mt-1 text-xs text-ink-600">{body}</p>
      ) : null}
    </header>
  );
}

/** Compact section label for tighter rows like the package chip
 *  selector. Kicker + inline hint, no body line break. */
function SectionLabel({ title, hint }: { title: string; hint?: string }) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-2 mb-1">
      <span className="font-mukta uppercase tracking-[0.24em] text-[0.65rem] text-saffron-600 font-semibold">
        {title}
      </span>
      {hint ? (
        <span className="text-xs text-ink-600 normal-case tracking-normal">
          {hint}
        </span>
      ) : null}
    </span>
  );
}

/** Faint gold rule between form sections so the card reads as
 *  grouped blocks instead of one long stack. */
function SectionDivider() {
  return (
    <div
      aria-hidden
      className="my-6 sm:my-7 h-px bg-gradient-to-r from-transparent via-gold-500/45 to-transparent"
    />
  );
}

/** Single tappable date chip for the multi-select preset grid. Mirrors
 *  BhandaraForm's DateChip but flatter (no Devanagari label stack)
 *  because the Organise form is single-line per chip. */
function DateChip({
  iso,
  weekday,
  weekdayHi,
  checked,
  onToggle,
  isHi,
}: {
  iso: string;
  weekday: "Tue" | "Sat";
  weekdayHi: string;
  checked: boolean;
  onToggle: () => void;
  isHi: boolean;
}) {
  const [y, m, d] = iso.split("-").map(Number);
  const monthsEn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthsHi = ["जन","फ़र","मार्च","अप्रैल","मई","जून","जुल","अग","सित","अक्ट","नव","दिस"];
  const label =
    y && m && d
      ? `${isHi ? weekdayHi : weekday} · ${d} ${(isHi ? monthsHi : monthsEn)[m - 1]}`
      : iso;
  return (
    <label
      className={`relative flex items-center justify-between gap-2 rounded-xl border px-3 py-2 cursor-pointer select-none transition-colors text-sm ${
        checked
          ? "bg-saffron-50 border-saffron-600 text-sindoor-700"
          : "bg-white border-gold-500/40 text-ink-900 hover:border-saffron-500"
      }`}
      title={iso}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={onToggle}
      />
      <span className="font-medium tabular-nums">{label}</span>
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
    </label>
  );
}

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
    // `self-start` keeps each field anchored to the TOP of its grid
    // row, so a field WITH a hint doesn't push its sibling WITHOUT
    // one down by half a line. This is the alignment bug visible in
    // the earlier screenshot, "Phone" had a hint below it, "Your
    // name" didn't, and the row's natural stretch pulled the inputs
    // to different vertical positions.
    <label className="grid gap-1.5 self-start">
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
