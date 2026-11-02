"use client";

/**
 * Volunteer signup form, single screen, two states (form / success).
 *
 * Approval flow: signup creates a PENDING Volunteer row with NO
 * code. Admin reviews + approves via /admin/volunteers, which
 * generates the code + delivers it to the volunteer's WhatsApp.
 *
 * So the success screen here does NOT show a code (there isn't one
 * yet), it shows an "application under review, we'll WhatsApp you
 * within 24h" message instead. This is intentional: leaves no
 * unfiltered path for fakes to start submitting before admin OK.
 *
 * 2026-05-26: form converted to single-language render driven by
 * `useLocaleFromContext`. The page used to mix Hindi + English in
 * every label / hint / success-state copy, which got increasingly
 * confusing on a page already heavy with bilingual content
 * everywhere else. Now: header LangToggle picks one language and
 * the entire form (labels, placeholders, hints, errors, success
 * card) renders in that language alone.
 */

import { useState, type FormEvent } from "react";
import Link from "next/link";
import PhoneInput from "@/components/PhoneInput";
import { Field, Button, Icon } from "@/components/v2";
import { AREAS } from "@/lib/lucknow";
import { trackEvent } from "@/lib/ga";
import { useLocaleFromContext } from "@/lib/locale-context";

type SignupResponse =
  | { ok: true; id: string; code: string; name: string; phoneLast4: string }
  | { ok: false; error: string; fields?: Record<string, string> };

type Phase =
  | { kind: "form" }
  | { kind: "submitting" }
  | { kind: "success"; code: string; name: string; phoneLast4: string }
  | { kind: "error"; message: string };

// Must match VolunteerSubmitForm.tsx so the code persists across
// signup → submit → return-visits in the same browser.
const STORAGE_KEY = "bm.volunteer.code";

/** Single-language copy bundle keyed by locale. Keeps every UI
 *  string co-located with its sibling translation so a copy tweak
 *  is a one-file edit, no chance of HI/EN versions drifting. */
const COPY = {
  hi: {
    labels: {
      name: "आपका नाम",
      phone: "WhatsApp नंबर",
      areas: "आप कौन से इलाके cover कर सकते हैं? (कई चुन सकते हैं)",
    },
    placeholders: {
      name: "जैसे: राहुल शर्मा",
      otherArea: "अन्य इलाका लिखें (जैसे कोई colony का नाम)",
    },
    hints: {
      phone:
        "यह आपका active WhatsApp नंबर होना चाहिए। आपका volunteer code यहीं भेजा जाएगा। बिना WhatsApp वाले नंबर approve नहीं होंगे।",
      areasHelper:
        "ज़रूरी नहीं पर मददगार है। इससे हम coordinate कर पाते हैं कि दो स्वयंसेवक एक ही भण्डारे पर न पहुँचें।",
    },
    errors: {
      rateLimited:
        "इस connection से आज बहुत signups हो चुके हैं। कृपया कल फिर कोशिश करें।",
      validation: "कृपया highlighted fields ठीक करें।",
      generic: "कुछ गड़बड़ी हुई। फिर से कोशिश करें।",
    },
    submit: {
      submitting: "आपका आवेदन भेजा जा रहा है…",
      idle: "मेरा आवेदन भेजें",
      tnc:
        "हर आवेदन की हम स्वयं समीक्षा करते हैं। आपका स्वयंसेवक कोड 24 घंटे के भीतर आपके वॉट्सऐप पर भेज दिया जाएगा।",
      viewTerms: "नियम और शर्तें पढ़ें →",
      tncPrefix: "आवेदन भेजने से पहले कृपया",
      tncSuffix: "देख लीजिए।",
    },
    success: {
      greetingPrefix: "जय श्री राम,",
      greetingSuffix: "जी",
      codeLabel: "आपका volunteer code",
      saveHint: "यह code save कर लीजिए। हर submission में इसकी ज़रूरत होगी।",
      copy: "Code कॉपी करें",
      copied: "कॉपी हो गया",
      saveToWa: "WhatsApp में save करें",
      readyHeading: "आप अभी से शुरू कर सकते हैं",
      step1: "अगले बड़े मंगल (मंगलवार) या बड़े शनिवार को अपने इलाके के किसी भण्डारे पर जाइए।",
      step2: "तस्वीरें + video + जानकारी फॉर्म में भर दीजिए।",
      step3:
        "हम 24 घंटे के अंदर समीक्षा करेंगे, फिर आपका भण्डारा directory पर live हो जाएगा।",
      submitFirst: "अपना पहला भण्डारा भेजें",
      savedHint:
        "आपका code इस browser में save हो गया है, अगली बार खुद से भर जाएगा।",
      backToOverview: "← पीछे",
      backHome: "मुख्य पृष्ठ",
      phoneOnRecord: "आपका दर्ज नंबर:",
      // WhatsApp self-share message
      waShareLines: {
        title: "BadaMangal स्वयंसेवक",
        codeLabel: "*Volunteer code:*",
        nameLabel: "*नाम:*",
        submitLink: "भण्डारा भेजें:",
        signOff: "जय बजरंगबली",
      },
    },
  },
  en: {
    labels: {
      name: "Your name",
      phone: "WhatsApp number",
      areas: "Which areas can you cover? (pick multiple)",
    },
    placeholders: {
      name: "e.g. Rahul Sharma",
      otherArea: "Type a custom area (e.g. a specific colony name)",
    },
    hints: {
      phone:
        "This MUST be a working WhatsApp number. Your volunteer code is delivered here. Numbers without WhatsApp won't get approved.",
      areasHelper:
        "Optional but helpful. Lets us coordinate so two volunteers don't end up at the same bhandara.",
    },
    errors: {
      rateLimited:
        "Too many signups from this connection today. Please try again tomorrow.",
      validation: "Please fix the highlighted fields.",
      generic: "Something went wrong. Please try again.",
    },
    submit: {
      submitting: "Submitting your application…",
      idle: "Submit my application",
      tnc:
        "Applications are reviewed manually. Your volunteer code will be sent to your WhatsApp within 24 hours.",
      viewTerms: "View terms & conditions →",
      tncPrefix: "Before submitting, please review our",
      tncSuffix: ".",
    },
    success: {
      greetingPrefix: "Jai Shree Ram,",
      greetingSuffix: "ji",
      codeLabel: "Your volunteer code",
      saveHint: "Save this code, you'll need it for every submission.",
      copy: "Copy code",
      copied: "Copied",
      saveToWa: "Save to WhatsApp",
      readyHeading: "You can start right now",
      step1:
        "On the next Bada Mangal (Tuesday) or Bade Shanivar (Saturday), visit any bhandara in your area.",
      step2: "Take photos + a video + fill the listing form.",
      step3:
        "We review within 24 hours, then your bhandara goes live on the public directory.",
      submitFirst: "Submit your first bhandara",
      savedHint:
        "Your code is saved in this browser, it'll auto-fill next time.",
      backToOverview: "← Back to overview",
      backHome: "BadaMangal home",
      phoneOnRecord: "Your phone on record:",
      waShareLines: {
        title: "BadaMangal Volunteer",
        codeLabel: "*Volunteer code:*",
        nameLabel: "*Name:*",
        submitLink: "Submit a bhandara:",
        signOff: "Jai Bajrang Bali",
      },
    },
  },
};

export default function VolunteerSignupForm() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const t = COPY[isHi ? "hi" : "en"];

  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [otherArea, setOtherArea] = useState<string>("");

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (phase.kind === "submitting") return;
    setFieldErrors({});
    setPhase({ kind: "submitting" });
    trackEvent("volunteer_signup_attempt", {});

    const fd = new FormData(ev.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const phone = String(fd.get("phone") ?? "").trim();
    // UPI field removed from the UI 2026-05-26. Empty string keeps
    // the API contract stable for older clients hitting the same
    // endpoint.
    const upi = "";

    const areas = Array.from(
      new Set(
        [...selectedAreas, otherArea.trim()].filter((s) => s.length > 0),
      ),
    );

    try {
      const res = await fetch("/api/volunteer/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, upi, areas }),
      });
      const json = (await res.json()) as SignupResponse;
      if (!res.ok || !json.ok) {
        if (!json.ok && json.fields) {
          setFieldErrors(json.fields);
        }
        const msg =
          !json.ok && json.fields?._form
            ? json.fields._form
            : !json.ok && json.error === "rate_limited"
              ? t.errors.rateLimited
              : !json.ok && json.error === "validation"
                ? t.errors.validation
                : t.errors.generic;
        trackEvent("volunteer_signup_error", {
          status: res.status,
          err: !json.ok ? json.error : "unknown",
        });
        setPhase({ kind: "error", message: msg });
        return;
      }
      trackEvent("volunteer_signup_success", {});
      try {
        window.localStorage.setItem(STORAGE_KEY, json.code);
      } catch {
        /* private mode or quota exceeded, fine */
      }
      setPhase({
        kind: "success",
        code: json.code,
        name: json.name,
        phoneLast4: json.phoneLast4,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      trackEvent("volunteer_signup_error", { msg: msg.slice(0, 80) });
      setPhase({ kind: "error", message: msg });
    }
  }

  function toggleArea(area: string) {
    setSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area],
    );
  }

  // ─── SUCCESS STATE ────────────────────────────────────────────
  if (phase.kind === "success") {
    return (
      <CodeIssuedCard
        code={phase.code}
        name={phase.name}
        phoneLast4={phase.phoneLast4}
        t={t.success}
      />
    );
  }

  // ─── FORM STATE ───────────────────────────────────────────────
  const submitting = phase.kind === "submitting";
  return (
    <form onSubmit={onSubmit} className="bmi-form">
      {phase.kind === "error" ? (
        <div className="bmi-alert" role="alert">
          {phase.message}
        </div>
      ) : null}

      <Field asLabel label={t.labels.name} error={fieldErrors.name}>
        <input
          name="name"
          type="text"
          required
          maxLength={80}
          placeholder={t.placeholders.name}
        />
      </Field>

      <Field asLabel label={t.labels.phone} error={fieldErrors.phone}>
        <PhoneInput name="phone" hint={t.hints.phone} />
      </Field>

      {/* UPI ID field removed 2026-05-26. The pure-seva framing made
          the field a distraction. DB column + API still accept upi
          for back-compat; the field just no longer appears in the
          UI. */}

      {/* Areas, multiselect. Optional but encouraged. */}
      <div className="bmi-field">
        <span className="bmi-field-label">{t.labels.areas}</span>
        <span className="bmi-field-hint">{t.hints.areasHelper}</span>
        <div className="bmi-choices" style={{ marginTop: 6 }}>
          {AREAS.map((area) => {
            const active = selectedAreas.includes(area);
            return (
              <button
                key={area}
                type="button"
                onClick={() => toggleArea(area)}
                aria-pressed={active}
                className="bmi-choice"
              >
                {active ? <Icon name="check" /> : null}
                <span>{area}</span>
              </button>
            );
          })}
        </div>
        <input
          name="otherArea"
          type="text"
          maxLength={60}
          value={otherArea}
          onChange={(e) => setOtherArea(e.target.value)}
          placeholder={t.placeholders.otherArea}
          aria-label={t.placeholders.otherArea}
          style={{ marginTop: 6 }}
        />
      </div>

      {/* Submit + terms */}
      <div className="grid gap-3">
        <Button type="submit" disabled={submitting} block iconEnd={submitting ? null : "chevron"}>
          {submitting ? t.submit.submitting : t.submit.idle}
        </Button>
        <p className="bmi-field-hint text-center">{t.submit.tnc}</p>
        <p className="bmi-field-hint text-center">
          {t.submit.tncPrefix}{" "}
          <Link
            href="/volunteer/terms"
            target="_blank"
            rel="noopener noreferrer"
            data-ga="volunteer_signup_view_terms"
            className="bmi-tl inline"
          >
            {t.submit.viewTerms}
          </Link>
          {t.submit.tncSuffix}
        </p>
      </div>
    </form>
  );
}

/* ─── Code-issued card ─────────────────────────────────────────
   Shown immediately after successful signup. */
type SuccessCopy = (typeof COPY)["en"]["success"];

function CodeIssuedCard({
  code,
  name,
  phoneLast4,
  t,
}: {
  code: string;
  name: string;
  phoneLast4: string;
  t: SuccessCopy;
}) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(code).then(
      () => {
        setCopied(true);
        trackEvent("volunteer_code_copy", {});
        setTimeout(() => setCopied(false), 1800);
      },
      () => {
        /* clipboard blocked; the code is also rendered on screen */
      },
    );
  }

  // Pre-filled wa.me message the volunteer sends to themselves so
  // the code lives permanently in their chat history.
  const waMeMessage = encodeURIComponent(
    `${t.waShareLines.title}\n\n${t.waShareLines.codeLabel} ${code}\n${t.waShareLines.nameLabel} ${name}\n\n${t.waShareLines.submitLink}\nhttps://badamangal.com/volunteer/submit?code=${code}\n\n${t.waShareLines.signOff}`,
  );
  const waMeUrl = `https://wa.me/?text=${waMeMessage}`;

  // Use first name + ji (or जी) so the greeting reads as a warm
  // namaskar rather than a formal full-name salutation. "Jai Shree
  // Ram, Prateek ji" feels right; "Jai Shree Ram, Prateek Saini ji"
  // reads like a wedding invitation. If a single-word name was
  // submitted, firstName equals name, no change in output.
  const firstName = (name.split(/\s+/)[0] ?? name).trim();

  return (
    <div className="bmi-done grid gap-6">
      <div>
        <div className="bmi-done-tick" aria-hidden>
          <Icon name="check" />
        </div>
        <h2 className="bmi-h3" style={{ color: "var(--sindoor)" }}>
          {t.greetingPrefix} {firstName}
          {t.greetingSuffix ? ` ${t.greetingSuffix}` : ""}
        </h2>
      </div>

      {/* The code is the focal point. */}
      <div className="bmi-code">
        <p className="bmi-ilabel" style={{ justifyContent: "center" }}>{t.codeLabel}</p>
        <p className="bmi-code-v select-all" aria-label={`Your volunteer code is ${code}`}>
          {code}
        </p>
        <p className="bmi-field-hint">{t.saveHint}</p>
        <div className="bmi-actions" style={{ justifyContent: "center", marginTop: 14 }}>
          <button type="button" onClick={copyCode} className="bmi-b bmi-b-s sm">
            <Icon name={copied ? "check" : "copy"} />
            <span>{copied ? t.copied : t.copy}</span>
          </button>
          <a
            href={waMeUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-ga="volunteer_code_save_to_whatsapp"
            className="bmi-b bmi-b-s sm"
          >
            <Icon name="whatsapp" />
            <span>{t.saveToWa}</span>
          </a>
        </div>
      </div>

      {/* What happens next */}
      <div className="text-left">
        <p className="bmi-ilabel">{t.readyHeading}</p>
        <ol className="bmi-next" style={{ margin: "12px 0 0", maxWidth: "none" }}>
          <li>{t.step1}</li>
          <li>{t.step2}</li>
          <li>{t.step3}</li>
        </ol>
      </div>

      {/* Primary CTA */}
      <div className="grid gap-2">
        <Button
          href={`/volunteer/submit?code=${encodeURIComponent(code)}`}
          data-ga="volunteer_signup_submit_first"
          block
          iconEnd="chevron"
        >
          {t.submitFirst}
        </Button>
        <p className="bmi-field-hint">{t.savedHint}</p>
      </div>

      <div className="bmi-actions" style={{ justifyContent: "center" }}>
        <Button href="/volunteer" variant="text" data-ga="volunteer_signup_back_to_overview">
          {t.backToOverview}
        </Button>
        <Button href="/" variant="text" data-ga="volunteer_signup_back_to_home">
          {t.backHome}
        </Button>
      </div>

      <p className="bmi-fine">
        {t.phoneOnRecord} <span className="tabular-nums">…{phoneLast4}</span>
      </p>
    </div>
  );
}
