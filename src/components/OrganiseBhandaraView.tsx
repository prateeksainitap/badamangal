"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AREAS } from "@/lib/lucknow";
import { listingSeason } from "@/lib/season";
import { InnerShell, PageHero, Kicker, Actions, Button, Section, Heading, FormPanel, Field, Icon, Plate } from "@/components/v2";
import { HOME_ART } from "@/content/home-art";
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
 *   1. Hero           , pitch + scroll-to-form CTA
 *   2. How it works   , 3-step explainer (pick, request, we arrange)
 *   3. Packages       , Small / Medium / Large cards; clicking one
 *                        pre-selects it in the form and scrolls down
 *   4. Form           , name, phone, email, area, date, time,
 *                        quantity (plates|kg), notes, hidden honeypot
 *   5. Thank-you      , replaces the form on successful submit
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
        range: "100 to 300 plates",
      },
      hi: {
        name: "मोहल्ला",
        tagline: "मोहल्ले का भंडारा",
        range: "100 से 300 थाली",
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
        range: "300 to 800 plates",
      },
      hi: {
        name: "परिवार",
        tagline: "मोहल्ला-व्यापी भंडारा",
        range: "300 से 800 थाली",
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
        range: "800 to 3000+ plates",
      },
      hi: {
        name: "विशाल",
        tagline: "विशाल भंडारा",
        range: "800 से 3000+ थाली",
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
  // sentinel, picking it flips customAreaMode on and the dropdown
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

  // Date preset chips, Bada Mangal Tuesdays + Bade Shanivars from
  // the season list. We slice off dates already past (IST) so the
  // organiser never picks a chip that's invalid, plus the custom
  // picker below is bounded to today→season-end. The season is the one
  // people list for now (src/lib/season.ts), so it rolls over by itself.
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const todayIso = ist.toISOString().slice(0, 10);
  const season = listingSeason();
  const SEASON_START_ISO = season.startISO;
  const SEASON_END_ISO = season.endISO;
  const minIso = todayIso > SEASON_START_ISO ? todayIso : SEASON_START_ISO;
  const presetTuesdays = season.tuesdays.filter((d) => d >= todayIso);
  const presetSaturdays = season.saturdays.filter((d) => d >= todayIso);
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

  const lang = isHi ? "hi" : "en";
  const fmtRange = (iso: string) => {
    const d = new Date(`${iso}T04:30:00Z`);
    return d.toLocaleDateString(isHi ? "hi-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  };

  return (
    <InnerShell>
      {/* HERO */}
      <PageHero
        kicker={<Kicker>{t("Full-service organising", "पूर्ण सेवा आयोजन")}</Kicker>}
        title={{
          en: "Want to organise a bhandara? We'll handle the rest.",
          hi: "भंडारा आयोजित करना चाहते हैं? बाक़ी सब हम पर छोड़ दें।",
        }}
        lede={t(
          "Tent, catering, plates, prasad, transport, volunteers. Pick a package or build your own, our team coordinates every piece end-to-end and you focus on the seva.",
          "टेंट, कैटरिंग, थाली, प्रसाद, परिवहन, स्वयंसेवक, हमारी टीम हर चीज़ का इंतज़ाम करेगी, आप बस सेवा पर ध्यान दें।",
        )}
        actions={
          <Actions split>
            <Button href="#request" iconEnd="chevron" data-ga="organise_hero_cta" data-ga-source={source}>
              {t("Request a free quote", "मुफ़्त क़ीमत मँगवाएँ")}
            </Button>
            <Button href="#packages" variant="secondary" data-ga="organise_hero_packages">
              {t("See packages", "पैकेज देखें")}
            </Button>
          </Actions>
        }
        art={
          <Plate
            src={HOME_ART.bhandaraLine.src}
            width={HOME_ART.bhandaraLine.width}
            height={HOME_ART.bhandaraLine.height}
            alt={t("Hands frying puris and serving at a bhandara", "भंडारे में पूड़ी तलते और परोसते हाथ")}
            priority
          />
        }
      />

      {/* HOW IT WORKS */}
      <Section
        id="how"
        kicker={<Kicker>{t("How it works", "कैसे काम करता है")}</Kicker>}
        title={{ en: "Three steps to your bhandara", hi: "आपके भंडारे के तीन क़दम" }}
      >
        <ol className="bmi-steplist three" data-rv>
          <Step
            n={1}
            title={t("Pick a package or build your own", "पैकेज चुनें या अपना बनाएँ")}
            body={t(
              "Three published sizes cover most bhandaras; pick the closest fit or send a custom request below.",
              "तीन पैकेज ज़्यादातर भंडारों के लिए हैं; नज़दीकी चुनें या नीचे कस्टम अनुरोध भेजें।",
            )}
            lang={lang}
          />
          <Step
            n={2}
            title={t("Tell us your date + headcount", "तारीख़ और संख्या बताएँ")}
            body={t(
              "Date, time, area, and how many plates (or how many kg of wheat). Anything else relevant goes in the notes.",
              "तारीख़, समय, क्षेत्र, और कितनी थाली (या कितने किलो गेहूँ)। बाक़ी जानकारी नोट्स में।",
            )}
            lang={lang}
          />
          <Step
            n={3}
            title={t("We call back within a day", "एक दिन में कॉल करते हैं")}
            body={t(
              "Our team calls you to confirm, share a quote, and start arranging tent, catering, plates, and logistics.",
              "हमारी टीम कॉल करके पुष्टि करेगी, क़ीमत देगी, और टेंट, कैटरिंग, थाली, और बाक़ी इंतज़ाम शुरू करेगी।",
            )}
            lang={lang}
          />
        </ol>
      </Section>

      {/* PACKAGES */}
      <Section
        id="packages"
        tone="paper"
        className="scroll-mt-20"
        kicker={<Kicker>{t("Bhandara packages", "भंडारा पैकेज")}</Kicker>}
        title={{ en: "Three ready-to-go sizes", hi: "तीन तैयार पैकेज" }}
        lede={t(
          "Pricing is custom to your venue, date, and headcount, click a package and we'll share a quote.",
          "क़ीमत आपके स्थान, तारीख़ और संख्या के अनुसार, पैकेज पर क्लिक करें, क़ीमत बताएँगे।",
        )}
      >
        <ul className="bmi-pkgs" data-rv>
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
      </Section>

      {/* FORM */}
      <Section
        id="request"
        className="scroll-mt-20"
        kicker={<Kicker>{t("Send a request", "अनुरोध भेजें")}</Kicker>}
        heading={
          <Heading
            as="h2"
            id="request-h"
            en={
              tier === "CUSTOM"
                ? "Tell us about your bhandara"
                : `Request the ${selectedPackageName(tier, "en")} package`
            }
            hi={
              tier === "CUSTOM"
                ? "अपने भंडारे के बारे में बताएँ"
                : `${selectedPackageName(tier, "hi")} पैकेज माँगें`
            }
          />
        }
        lede={t(
          "We call back within a working day with a quote and next steps.",
          "हम एक कामकाजी दिन में क़ीमत और अगले क़दम के साथ कॉल करते हैं।",
        )}
      >
        <div className="bmi-formgrid">
        <FormPanel>
        <form
          ref={formRef}
          onSubmit={onSubmit}
          className="bmi-form"
          style={{ gap: 0 }}
        >
          {/* Honeypot removed, modern password managers / autofill
              extensions were filling the hidden `website` field on
              legitimate users, causing their submissions to silently
              200 without ever being saved. Rate-limit + ipHash +
              validation in /api/organise-request are sufficient
              protection for this low-volume lead-capture surface. */}

          {/* ── Package tier chip row ─────────────────────────────── */}
          <fieldset className="bmi-fieldset grid gap-3">
            <SectionLabel
              title={t("Package", "पैकेज")}
              hint={t(
                "Switch tier anytime, the request body adjusts.",
                "अभी भी बदल सकते हैं, अनुरोध उसी के अनुसार बनेगा।",
              )}
            />
            <div className="bmi-choices">
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
          <div className="bmi-grid2" style={{ marginTop: 18 }}>
            <FieldText
              label={t("Your name", "आपका नाम")}
              value={name}
              onChange={setName}
              required
              error={fieldErrors.name}
            />
            <Field asLabel label={t("Phone (we call back)", "फ़ोन (कॉलबैक)")}>
              {/* Shared PhoneInput: +91 prefix locked in visually, 10-digit
                  cap, numeric keyboard on mobile. */}
              <PhoneInput
                value={phone}
                onChange={setPhone}
                required
                error={fieldErrors.phone}
                hint={t("10-digit Indian mobile", "10-अंकीय भारतीय मोबाइल")}
              />
            </Field>
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
            kicker={t("Where and when", "कहाँ और कब")}
            body={t(
              "Pick one or many dates. Skip the date if you haven't fixed it yet.",
              "एक या कई तारीख़ें चुनें। अगर अभी तय नहीं की तो छोड़ दें।",
            )}
          />
          <div className="bmi-grid2" style={{ marginTop: 18 }}>
            <Field asLabel label={t("Area in Lucknow", "लखनऊ में क्षेत्र")}>
              {customAreaMode ? (
                // Free-text mode for areas outside the curated list.
                <div className="grid gap-1">
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
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setArea("");
                      setCustomAreaMode(false);
                    }}
                    className="bmi-tl"
                    style={{ justifySelf: "start" }}
                  >
                    <Icon name="back" />
                    <span>{t("Pick from list", "सूची से चुनें")}</span>
                  </button>
                </div>
              ) : (
                <FancySelect
                  ariaLabel={t("Area in Lucknow", "लखनऊ में क्षेत्र")}
                  value={area}
                  onChange={(v) => {
                    // Sentinel handoff to free-text mode.
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
            </Field>
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

          {/* Multi-date tiles (season dates from lib/season.ts, past
              dates dropped), then any other date in the season. */}
          <div className="grid gap-4" style={{ marginTop: 26 }}>
            <span className="bmi-field-label" lang={lang}>
              {t("Pick service dates", "तारीख़ें चुनें")}
              <span className="opt">{t("pick as many as you like", "कई चुन सकते हैं")}</span>
            </span>

            {presetTuesdays.length > 0 ? (
              <div>
                <p className="bmi-ilabel" style={{ marginBottom: 12 }}>
                  {t("Bada Mangal Tuesdays", "बड़े मंगल")}
                </p>
                <div className="bmi-dates">
                  {presetTuesdays.map((iso) => (
                    <DateChip
                      key={iso}
                      iso={iso}
                      weekday="Tue"
                      weekdayHi="मंगलवार"
                      checked={eventDates.includes(iso)}
                      onToggle={() => toggleDate(iso)}
                      isHi={isHi}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {presetSaturdays.length > 0 ? (
              <div style={{ marginTop: 8 }}>
                <p className="bmi-ilabel" style={{ marginBottom: 12 }}>
                  {t("Bade Shanivar Saturdays", "बड़े शनिवार")}
                </p>
                <div className="bmi-dates">
                  {presetSaturdays.map((iso) => (
                    <DateChip
                      key={iso}
                      iso={iso}
                      weekday="Sat"
                      weekdayHi="शनिवार"
                      checked={eventDates.includes(iso)}
                      onToggle={() => toggleDate(iso)}
                      isHi={isHi}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {/* Custom date, any day in the season window. */}
            <div style={{ marginTop: 8 }}>
              <p className="bmi-ilabel" style={{ marginBottom: 12 }}>
                {t("Custom date", "कोई और दिन")}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <SeasonDatePicker
                  minIso={minIso}
                  maxIso={SEASON_END_ISO}
                  selectedIsos={eventDates}
                  onPick={addCustomDate}
                  locale={isHi ? "hi" : "en"}
                />
                <span className="bmi-field-hint tabular-nums">
                  {t(`${fmtRange(SEASON_START_ISO)} to ${fmtRange(SEASON_END_ISO)}`, `${fmtRange(SEASON_START_ISO)} से ${fmtRange(SEASON_END_ISO)} तक`)}
                </span>
              </div>
              {customDates.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {customDates.map((iso) => (
                    <li key={iso}>
                      <span className="bmi-tag">
                        <span>{formatIsoShort(iso, isHi)}</span>
                        <button
                          type="button"
                          onClick={() => removeDate(iso)}
                          aria-label={t("Remove", "हटाएँ")}
                        >
                          <Icon name="plus" className="rotate-45" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {eventDates.length > 0 ? (
              <p className="bmi-field-hint">
                {isHi
                  ? `${eventDates.length} तारीख़${eventDates.length === 1 ? "" : "ें"} चुनी गईं।`
                  : `${eventDates.length} date${eventDates.length === 1 ? "" : "s"} selected.`}
              </p>
            ) : null}
            {fieldErrors.eventDates ? (
              <span className="bmi-field-err" role="alert">
                {fieldErrors.eventDates}
              </span>
            ) : null}
          </div>

          {/* Time on its own row so the picker popover has room. */}
          <div className="bmi-grid2" style={{ marginTop: 22 }}>
            <Field asLabel label={t("Time", "समय")} error={fieldErrors.eventTime}>
              <TimeField
                ariaLabel={t("Pick a time", "समय चुनें")}
                value={eventTime}
                onChange={setEventTime}
              />
            </Field>
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
          <fieldset className="bmi-fieldset grid gap-4" style={{ marginTop: 18 }}>
            <legend className="bmi-sr">{t("How big?", "कितना बड़ा?")}</legend>
            <div className="bmi-choices">
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
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={100000}
                value={quantityValue}
                onChange={(e) => setQuantityValue(e.target.value)}
                required
                aria-label={quantityType === "PLATES" ? t("plates", "थाली") : t("kg of wheat", "किलो गेहूँ")}
                className="tabular-nums"
                style={{ width: 160 }}
              />
              <span className="bmi-field-hint" style={{ fontSize: 16 }}>
                {quantityType === "PLATES"
                  ? t("plates", "थाली")
                  : t("kg of wheat", "किलो गेहूँ")}
              </span>
            </div>
            {fieldErrors.quantityValue ? (
              <span className="bmi-field-err" role="alert">
                {fieldErrors.quantityValue}
              </span>
            ) : null}
          </fieldset>

          <div style={{ marginTop: 22 }}>
            <Field asLabel label={t("Anything else?", "और कुछ बताना है?")} optional={t("optional", "वैकल्पिक")}>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder={t(
                  "e.g. sound system for kirtan, separate veg / non-prasad section, parking constraints…",
                  "जैसे, कीर्तन के लिए साउंड, अलग प्रसाद-शाकाहारी कक्ष, पार्किंग…",
                )}
              />
            </Field>
          </div>

          {formError ? (
            <div className="bmi-alert" role="alert" style={{ marginTop: 22 }}>
              {formError}
            </div>
          ) : null}

          <div className="bmi-form-foot" style={{ marginTop: 28 }}>
            <Button type="submit" disabled={submitting} iconEnd={submitting ? null : "chevron"}>
              {submitting
                ? t("Sending…", "भेज रहे हैं…")
                : t("Send request", "अनुरोध भेजें")}
            </Button>
            <p className="bmi-fine">
              {t(
                "We don't share your number. Callback within one working day.",
                "हम आपका नंबर साझा नहीं करते। एक कामकाजी दिन में कॉल।",
              )}
            </p>
          </div>
        </form>
        </FormPanel>
        <div className="bmi-formart" aria-hidden>
          <Plate
            src={HOME_ART.sevaHands.src}
            width={HOME_ART.sevaHands.width}
            height={HOME_ART.sevaHands.height}
            alt=""
          />
        </div>
        </div>
      </Section>
    </InnerShell>
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
  // Lightweight weekday from JS Date, only used for the SELECT label
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

/** A group heading inside the form: kicker and one line. */
function SectionHeading({
  kicker,
  body,
}: {
  kicker: string;
  body?: string;
}) {
  return (
    <header>
      <p className="bmi-fh" style={{ fontSize: 22 }}>{kicker}</p>
      {body ? (
        <p className="bmi-field-hint" style={{ marginTop: 4 }}>{body}</p>
      ) : null}
    </header>
  );
}

/** Compact label for the package chip row. */
function SectionLabel({ title, hint }: { title: string; hint?: string }) {
  return (
    <legend className="bmi-field-label" style={{ marginBottom: 2 }}>
      {title}
      {hint ? <span className="opt">{hint}</span> : null}
    </legend>
  );
}

/** Gold hairline between form groups. */
function SectionDivider() {
  return <hr className="bmi-rule" style={{ margin: "30px 0" }} />;
}

/** One season date to tick (kit date tile). */
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
  const day = y && m && d ? `${d} ${(isHi ? monthsHi : monthsEn)[m - 1]}` : iso;
  const wk = isHi ? weekdayHi : weekday === "Tue" ? "Tuesday" : "Saturday";
  return (
    <label className="bmi-date" title={iso}>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <span className="min-w-0">
        <span className="d" lang={isHi ? "hi" : "en"}>{day}</span>
        <span className="w">{wk} {y}</span>
      </span>
      <span className="tick" aria-hidden>
        <Icon name="check" />
      </span>
    </label>
  );
}

function Step({ n, title, body, lang }: { n: number; title: string; body: string; lang: string }) {
  return (
    <li>
      <span className="n" aria-hidden>{n}</span>
      <span>
        <h3 lang={lang}>{title}</h3>
        <p lang={lang}>{body}</p>
      </span>
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
  const lang = isHi ? "hi" : "en";
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        aria-pressed={active}
        className={`bmi-pkg ${active ? "on" : ""}`.trim()}
        data-ga="organise_package_pick"
        data-ga-tier={pkg.id}
      >
        <span className="k" lang={lang}>{labels.tagline}</span>
        <h3 lang={lang}>{labels.name}</h3>
        <span className="r" lang={lang}>{labels.range}</span>
        <ul>
          {includes.map((line) => (
            <li key={line} lang={lang}>{line}</li>
          ))}
        </ul>
        <span className="bmi-tl" style={{ marginTop: "auto" }}>
          {active ? <Icon name="check" /> : null}
          <span>
            {active
              ? isHi
                ? "चुना गया"
                : "Selected"
              : isHi
                ? "इसी पर अनुरोध भेजें"
                : "Request this"}
          </span>
          {active ? null : <Icon name="chevron" className="go" />}
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
    <button type="button" onClick={onClick} aria-pressed={active} className="bmi-choice">
      {active ? <Icon name="check" /> : null}
      <span>{label}</span>
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
  const m = label.match(/^(.*?)\s*\((optional|वैकल्पिक)\)$/);
  return (
    <Field asLabel label={m ? m[1] : label} optional={m ? m[2] : undefined} hint={hint} error={error}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
      />
    </Field>
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
    <InnerShell>
      <section className="bmi-sec">
        <div className="bmi-wrap narrow">
          <FormPanel>
            <div className="bmi-done" aria-live="polite">
              <div className="bmi-done-tick" aria-hidden>
                <Icon name="check" />
              </div>
              <h1 className={`bmi-h2 ${isHi ? "" : "lat"}`}>
                {isHi ? `धन्यवाद ${name}!` : `Thank you, ${name}!`}
              </h1>
              <p className="bmi-lede">
                {isHi
                  ? `आपका ${tier === "CUSTOM" ? "कस्टम" : tierLabel} पैकेज का अनुरोध हमें मिल गया है। हमारी टीम एक कामकाजी दिन में ${phone} पर कॉल करेगी।`
                  : `Your request for the ${tier === "CUSTOM" ? "custom" : tierLabel} package has reached us. Our team will call you on ${phone} within one working day.`}
              </p>
              <p className="bmi-fine" style={{ marginTop: 8 }}>
                {isHi
                  ? "अगर कुछ बदलना हो तो बस वही नंबर वापस भेजें।"
                  : "Need to change anything? Just reply on the same number."}
              </p>
              <div className="bmi-actions">
                <Button href="/" variant="secondary" icon="back" iconEnd={null}>
                  {isHi ? "होम" : "Home"}
                </Button>
              </div>
            </div>
          </FormPanel>
        </div>
      </section>
    </InnerShell>
  );
}
