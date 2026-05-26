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
        "⚠️ यह आपका active WhatsApp नंबर होना चाहिए। आपका volunteer code यहीं भेजा जाएगा। बिना WhatsApp वाले नंबर approve नहीं होंगे।",
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
      submitting: "आपका application भेजा जा रहा है…",
      idle: "🙏 मेरा application भेजें",
      tnc:
        "हर application हम मैनुअली review करते हैं। आपका volunteer code 24 घंटे के अंदर आपके WhatsApp पर भेज दिया जाएगा।",
    },
    success: {
      greetingPrefix: "जय श्री राम,",
      greetingSuffix: "जी",
      codeLabel: "आपका volunteer code",
      saveHint: "यह code save कर लीजिए। हर submission में इसकी ज़रूरत होगी।",
      copy: "📋 Code कॉपी करें",
      copied: "✓ कॉपी हो गया",
      saveToWa: "💬 WhatsApp में save करें",
      readyHeading: "✅ आप अभी से शुरू कर सकते हैं",
      step1: "अगले बड़े मंगल (मंगलवार) या बड़े शनिवार को अपने इलाके के किसी भण्डारे पर जाइए।",
      step2: "तस्वीरें + video + जानकारी फॉर्म में भर दीजिए।",
      step3:
        "हम 24 घंटे के अंदर समीक्षा करेंगे, फिर आपका भण्डारा directory पर live हो जाएगा।",
      submitFirst: "📸 अपना पहला भण्डारा भेजें →",
      savedHint:
        "आपका code इस browser में save हो गया है, अगली बार खुद से भर जाएगा।",
      backToOverview: "← पीछे",
      backHome: "🏠 मुख्य पृष्ठ",
      phoneOnRecord: "आपका दर्ज नंबर:",
      // WhatsApp self-share message
      waShareLines: {
        title: "🚩 BadaMangal स्वयंसेवक",
        codeLabel: "*Volunteer code:*",
        nameLabel: "*नाम:*",
        submitLink: "भण्डारा भेजें:",
        signOff: "जय बजरंगबली 🙏",
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
        "⚠️ This MUST be a working WhatsApp number. Your volunteer code is delivered here. Numbers without WhatsApp won't get approved.",
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
      idle: "🙏 Submit my application",
      tnc:
        "Applications are reviewed manually. Your volunteer code will be sent to your WhatsApp within 24 hours.",
    },
    success: {
      greetingPrefix: "Jai Shree Ram,",
      greetingSuffix: "ji",
      codeLabel: "Your volunteer code",
      saveHint: "Save this code, you'll need it for every submission.",
      copy: "📋 Copy code",
      copied: "✓ Copied",
      saveToWa: "💬 Save to WhatsApp",
      readyHeading: "✅ You can start right now",
      step1:
        "On the next Bada Mangal (Tuesday) or Bade Shanivar (Saturday), visit any bhandara in your area.",
      step2: "Take photos + a video + fill the listing form.",
      step3:
        "We review within 24 hours, then your bhandara goes live on the public directory.",
      submitFirst: "📸 Submit your first bhandara →",
      savedHint:
        "Your code is saved in this browser, it'll auto-fill next time.",
      backToOverview: "← Back to overview",
      backHome: "🏠 BadaMangal home",
      phoneOnRecord: "Your phone on record:",
      waShareLines: {
        title: "🚩 BadaMangal Volunteer",
        codeLabel: "*Volunteer code:*",
        nameLabel: "*Name:*",
        submitLink: "Submit a bhandara:",
        signOff: "Jai Bajrang Bali 🙏",
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
    <form onSubmit={onSubmit} className="grid gap-5">
      {phase.kind === "error" ? (
        <div className="rounded-xl border border-alert-500/40 bg-alert-500/10 px-3 py-2 text-sm text-alert-500">
          {phase.message}
        </div>
      ) : null}

      <label className="grid gap-1.5">
        <span className="text-sm text-ink-600">
          {t.labels.name} <span className="text-sindoor-700">*</span>
        </span>
        <input
          name="name"
          type="text"
          required
          maxLength={80}
          placeholder={t.placeholders.name}
          className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
        />
        {fieldErrors.name ? (
          <span className="text-xs text-alert-500">{fieldErrors.name}</span>
        ) : null}
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm text-ink-600">
          {t.labels.phone} <span className="text-sindoor-700">*</span>
        </span>
        <PhoneInput name="phone" hint={t.hints.phone} />
        {fieldErrors.phone ? (
          <span className="text-xs text-alert-500">{fieldErrors.phone}</span>
        ) : null}
      </label>

      {/* UPI ID field removed 2026-05-26. The pure-seva framing made
          the field a distraction. DB column + API still accept upi
          for back-compat; the field just no longer appears in the
          UI. */}

      {/* Areas, multiselect. Optional but encouraged. */}
      <div className="grid gap-2">
        <span className="text-sm text-ink-600">{t.labels.areas}</span>
        <p className="text-xs text-ink-600">{t.hints.areasHelper}</p>
        <div className="flex flex-wrap gap-2">
          {AREAS.map((area) => {
            const active = selectedAreas.includes(area);
            return (
              <button
                key={area}
                type="button"
                onClick={() => toggleArea(area)}
                className={`text-sm rounded-full px-3 py-1.5 border transition-colors ${
                  active
                    ? "bg-saffron-600 border-saffron-600 text-cream-50"
                    : "bg-white border-gold-500/50 text-ink-900 hover:bg-saffron-50"
                }`}
              >
                {active ? "✓ " : ""}
                {area}
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
          className="mt-1 rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
        />
      </div>

      {/* Submit + terms */}
      <div className="mt-2 grid gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-6 py-3 text-base shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Spinner /> {t.submit.submitting}
            </>
          ) : (
            <>{t.submit.idle}</>
          )}
        </button>
        <p className="text-center text-xs text-ink-600">{t.submit.tnc}</p>
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
    <div className="grid gap-5 text-center">
      <div>
        <p className="text-3xl">🙏</p>
        <h2 className="font-fraunces text-2xl sm:text-3xl text-sindoor-700 mt-2">
          {t.greetingPrefix} {firstName}
          {t.greetingSuffix ? ` ${t.greetingSuffix}` : ""}
        </h2>
      </div>

      {/* Big bold code block, focal point of the card. */}
      <div className="rounded-2xl border-2 border-saffron-600 bg-saffron-50 p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-saffron-600 font-medium">
          {t.codeLabel}
        </p>
        <p
          className="mt-2 font-fraunces font-bold text-3xl sm:text-4xl text-sindoor-700 tracking-wider select-all"
          aria-label={`Your volunteer code is ${code}`}
        >
          {code}
        </p>
        <p className="mt-2 text-xs text-ink-600">{t.saveHint}</p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={copyCode}
            className="inline-flex items-center gap-1.5 rounded-full border border-saffron-600/55 bg-white hover:bg-cream-50 text-ink-900 font-medium px-4 py-2 text-sm transition-colors"
          >
            {copied ? t.copied : t.copy}
          </button>
          <a
            href={waMeUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-ga="volunteer_code_save_to_whatsapp"
            className="inline-flex items-center gap-1.5 rounded-full border border-saffron-600/55 bg-white hover:bg-cream-50 text-ink-900 font-medium px-4 py-2 text-sm transition-colors"
          >
            {t.saveToWa}
          </a>
        </div>
      </div>

      {/* What happens next */}
      <div className="rounded-xl border border-gold-500/40 bg-cream-50 px-4 py-3 text-sm text-ink-900 text-left">
        <p className="font-medium">{t.readyHeading}</p>
        <ul className="mt-2 list-disc list-inside space-y-1.5 text-sm text-ink-900">
          <li>{t.step1}</li>
          <li>{t.step2}</li>
          <li>{t.step3}</li>
        </ul>
      </div>

      {/* Primary CTA */}
      <div className="flex flex-col gap-3 items-stretch">
        <Link
          href={`/volunteer/submit?code=${encodeURIComponent(code)}`}
          data-ga="volunteer_signup_submit_first"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-6 py-3 text-base shadow-sm transition-colors"
        >
          {t.submitFirst}
        </Link>
        <p className="text-xs text-ink-600">{t.savedHint}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/volunteer"
          data-ga="volunteer_signup_back_to_overview"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-gold-500/60 bg-white hover:bg-cream-50 text-ink-900 font-medium px-5 py-2.5 text-sm transition-colors"
        >
          {t.backToOverview}
        </Link>
        <Link
          href="/"
          data-ga="volunteer_signup_back_to_home"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-gold-500/60 bg-white hover:bg-cream-50 text-ink-900 font-medium px-5 py-2.5 text-sm transition-colors"
        >
          {t.backHome}
        </Link>
      </div>

      <p className="text-xs text-ink-600/80">
        {t.phoneOnRecord} <span className="font-mono">…{phoneLast4}</span>
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-cream-50/40 border-t-cream-50"
    />
  );
}
