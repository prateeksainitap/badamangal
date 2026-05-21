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
 */

import { useState, type FormEvent } from "react";
import Link from "next/link";
import PhoneInput from "@/components/PhoneInput";
import { AREAS } from "@/lib/lucknow";
import { trackEvent } from "@/lib/ga";

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

export default function VolunteerSignupForm() {
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
    const upi = String(fd.get("upi") ?? "").trim();

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
              ? "Too many signups from this connection today. Please try again tomorrow."
              : !json.ok && json.error === "validation"
                ? "Please fix the highlighted fields."
                : "Something went wrong. Please try again.";
        trackEvent("volunteer_signup_error", {
          status: res.status,
          err: !json.ok ? json.error : "unknown",
        });
        setPhase({ kind: "error", message: msg });
        return;
      }
      trackEvent("volunteer_signup_success", {});
      // Cache the issued code to localStorage immediately so the
      // submit form can auto-pick it up on first use AND on every
      // return visit (until the volunteer clears their browser
      // storage). Wrapped in try/catch because private-browsing
      // mode disables setItem, fine, the success card still works
      // and they can copy/share the code manually.
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
          आपका नाम · Your name <span className="text-sindoor-700">*</span>
        </span>
        <input
          name="name"
          type="text"
          required
          maxLength={80}
          placeholder="e.g. Rahul Sharma"
          className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
        />
        {fieldErrors.name ? (
          <span className="text-xs text-alert-500">{fieldErrors.name}</span>
        ) : null}
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm text-ink-600">
          WhatsApp number <span className="text-sindoor-700">*</span>
        </span>
        <PhoneInput
          name="phone"
          hint="⚠️ This MUST be a working WhatsApp number. Your volunteer code is delivered here. Numbers without WhatsApp won't get approved."
        />
        {fieldErrors.phone ? (
          <span className="text-xs text-alert-500">{fieldErrors.phone}</span>
        ) : null}
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm text-ink-600">
          UPI ID <span className="text-ink-600/70">(optional)</span>
        </span>
        <input
          name="upi"
          type="text"
          maxLength={60}
          placeholder="e.g. 9876543210@upi, name@paytm, optional"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
        />
        <span className="text-xs text-ink-600">
          Optional. This season runs as pure seva, so no payment is
          being set up. We may add small acknowledgements in future
          seasons, share your UPI now if you'd like to be reachable
          for those.
        </span>
        {fieldErrors.upi ? (
          <span className="text-xs text-alert-500">{fieldErrors.upi}</span>
        ) : null}
      </label>

      {/* Areas, multiselect. Optional but encouraged. */}
      <div className="grid gap-2">
        <span className="text-sm text-ink-600">
          आप कौन से areas cover कर सकते हैं? (कई चुन सकते हैं)
        </span>
        <p className="text-xs text-ink-600">
          Optional but helpful. Lets us coordinate so two volunteers don't end up at the same bhandara.
        </p>
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
          placeholder="Or type a custom area (e.g. specific colony name)"
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
              <Spinner /> Submitting your application...
            </>
          ) : (
            <>🙏 Submit my application</>
          )}
        </button>
        <p className="text-center text-xs text-ink-600">
          Applications are reviewed manually. Your volunteer code will be sent to your WhatsApp within 24 hours.
        </p>
      </div>
    </form>
  );
}

/* ─── Code-issued card ─────────────────────────────────────────
   Shown immediately after successful signup. The volunteer code
   is generated server-side at signup time + stored in
   localStorage by the parent component before this card mounts,
   so the volunteer can leave/return/use it across browser
   sessions without re-typing. The "Submit your first bhandara"
   CTA carries the code in the URL so the submit form picks it
   up even before localStorage is read. */
function CodeIssuedCard({
  code,
  name,
  phoneLast4,
}: {
  code: string;
  name: string;
  phoneLast4: string;
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
        /* clipboard blocked, fine, the code is also rendered on screen */
      },
    );
  }

  // Pre-filled wa.me message the volunteer sends to themselves on
  // WhatsApp so the code lives permanently in their chat history.
  // Most reliable retrieval mechanism for people who don't trust
  // localStorage and won't bookmark a page.
  const waMeMessage = encodeURIComponent(
    `🚩 BadaMangal Volunteer\n\n*Volunteer code:* ${code}\n*Name:* ${name}\n\nSubmit a bhandara:\nhttps://badamangal.com/volunteer/submit?code=${code}\n\nजय बजरंगबली 🙏`,
  );
  const waMeUrl = `https://wa.me/?text=${waMeMessage}`;

  return (
    <div className="grid gap-5 text-center">
      <div>
        <p className="text-3xl">🙏</p>
        <h2 className="font-fraunces text-2xl sm:text-3xl text-sindoor-700 mt-2">
          स्वागत है {name} जी!
        </h2>
        <p className="mt-1 font-fraunces text-lg text-sindoor-700/80">
          Welcome aboard
        </p>
      </div>

      {/* Big bold code block, the focal point of the card. */}
      <div className="rounded-2xl border-2 border-saffron-600 bg-saffron-50 p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-saffron-600 font-medium">
          आपका volunteer code · Your volunteer code
        </p>
        <p
          className="mt-2 font-fraunces font-bold text-3xl sm:text-4xl text-sindoor-700 tracking-wider select-all"
          aria-label={`Your volunteer code is ${code}`}
        >
          {code}
        </p>
        <p className="mt-2 text-xs text-ink-600">
          यह code save कर लीजिए। हर submission में इसकी ज़रूरत होगी।
        </p>
        <p className="mt-1 text-xs text-ink-600">
          Save this code, you'll need it for every submission.
        </p>

        {/* Two save options + visual confirmation */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={copyCode}
            className="inline-flex items-center gap-1.5 rounded-full border border-saffron-600/55 bg-white hover:bg-cream-50 text-ink-900 font-medium px-4 py-2 text-sm transition-colors"
          >
            {copied ? "✓ Copied" : "📋 Copy code"}
          </button>
          <a
            href={waMeUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-ga="volunteer_code_save_to_whatsapp"
            className="inline-flex items-center gap-1.5 rounded-full border border-saffron-600/55 bg-white hover:bg-cream-50 text-ink-900 font-medium px-4 py-2 text-sm transition-colors"
          >
            💬 Save to WhatsApp
          </a>
        </div>
      </div>

      {/* What happens next, short, encouraging, no admin-wait copy. */}
      <div className="rounded-xl border border-gold-500/40 bg-cream-50 px-4 py-3 text-sm text-ink-900 text-left">
        <p className="font-medium">
          ✅ आप अभी से शुरू कर सकते हैं · You can start right now
        </p>
        <ul className="mt-2 list-disc list-inside space-y-1.5 text-sm text-ink-900">
          <li>
            अगले बड़े मंगल (मंगलवार) या बड़े शनिवार को अपने क्षेत्र के
            किसी भण्डारे पर जाइए।
            <br />
            <span className="text-xs text-ink-600">
              On the next Bada Mangal (Tuesday) or Bade Shanivar (Saturday),
              visit any bhandara in your area.
            </span>
          </li>
          <li>
            तस्वीरें + video + जानकारी फॉर्म में भर दीजिए।
            <br />
            <span className="text-xs text-ink-600">
              Take photos + a video + fill the listing form.
            </span>
          </li>
          <li>
            हम 24 घंटे के अंदर समीक्षा करेंगे, फिर आपका भण्डारा directory
            पर live हो जाएगा।
            <br />
            <span className="text-xs text-ink-600">
              We review within 24 hours, then your bhandara goes live on the
              public directory.
            </span>
          </li>
        </ul>
      </div>

      {/* Primary CTA: jump straight to the submit form with the code
          baked into the URL. The submit form will also see the code
          via localStorage on return visits, so the URL param is just
          the first-time helper. */}
      <div className="flex flex-col gap-3 items-stretch">
        <Link
          href={`/volunteer/submit?code=${encodeURIComponent(code)}`}
          data-ga="volunteer_signup_submit_first"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-6 py-3 text-base shadow-sm transition-colors"
        >
          📸 अपना पहला भण्डारा भेजें · Submit your first bhandara →
        </Link>
        <p className="text-xs text-ink-600">
          आपका code इस browser में save हो गया है, अगली बार खुद से fill हो जाएगा।
          <br />
          Your code is saved in this browser, it'll auto-fill next time.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/volunteer"
          data-ga="volunteer_signup_back_to_overview"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-gold-500/60 bg-white hover:bg-cream-50 text-ink-900 font-medium px-5 py-2.5 text-sm transition-colors"
        >
          ← पीछे · Back to overview
        </Link>
        <Link
          href="/"
          data-ga="volunteer_signup_back_to_home"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-gold-500/60 bg-white hover:bg-cream-50 text-ink-900 font-medium px-5 py-2.5 text-sm transition-colors"
        >
          🏠 मुख्य पृष्ठ · BadaMangal home
        </Link>
      </div>

      {/* Phone-number reminder if they want to send the code there
          themselves later. Tiny, last item, easy to ignore. */}
      <p className="text-xs text-ink-600/80">
        Your phone on record:{" "}
        <span className="font-mono">…{phoneLast4}</span>
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
