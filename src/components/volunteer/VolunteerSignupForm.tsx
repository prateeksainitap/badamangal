"use client";

/**
 * Volunteer signup form — single screen, two states (form / success).
 *
 * Approval flow: signup creates a PENDING Volunteer row with NO
 * code. Admin reviews + approves via /admin/volunteers, which
 * generates the code + delivers it to the volunteer's WhatsApp.
 *
 * So the success screen here does NOT show a code (there isn't one
 * yet) — it shows an "application under review, we'll WhatsApp you
 * within 24h" message instead. This is intentional: leaves no
 * unfiltered path for fakes to start submitting before admin OK.
 */

import { useState, type FormEvent } from "react";
import Link from "next/link";
import PhoneInput from "@/components/PhoneInput";
import { AREAS } from "@/lib/lucknow";
import { trackEvent } from "@/lib/ga";

type SignupResponse =
  | { ok: true; id: string; name: string; phoneLast4: string }
  | { ok: false; error: string; fields?: Record<string, string> };

type Phase =
  | { kind: "form" }
  | { kind: "submitting" }
  | { kind: "success"; name: string; phoneLast4: string }
  | { kind: "error"; message: string };

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
      setPhase({
        kind: "success",
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
    return <ApplicationReceivedCard name={phase.name} phoneLast4={phase.phoneLast4} />;
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
          UPI ID for payments <span className="text-sindoor-700">*</span>
        </span>
        <input
          name="upi"
          type="text"
          required
          maxLength={60}
          placeholder="e.g. 9876543210@upi, name@paytm, name@okhdfcbank"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
        />
        <span className="text-xs text-ink-600">
          Open your UPI app → tap profile → copy your UPI ID. We pay every Sunday to this ID.
        </span>
        {fieldErrors.upi ? (
          <span className="text-xs text-alert-500">{fieldErrors.upi}</span>
        ) : null}
      </label>

      {/* Areas — multiselect. Optional but encouraged. */}
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

/* ─── Application-received card ────────────────────────────── */
function ApplicationReceivedCard({
  name,
  phoneLast4,
}: {
  name: string;
  phoneLast4: string;
}) {
  return (
    <div className="grid gap-5 text-center">
      <div>
        <p className="text-3xl">🙏</p>
        <h2 className="font-fraunces text-2xl sm:text-3xl text-sindoor-700 mt-2">
          धन्यवाद {name} जी!
        </h2>
        <p className="mt-1 font-fraunces text-lg text-sindoor-700/80">
          Application received
        </p>
        <p className="mt-3 text-sm text-ink-900">
          आपका आवेदन प्राप्त हो गया है। हम जल्द ही आपसे संपर्क करेंगे।
        </p>
        <p className="mt-1 text-sm text-ink-600">
          Your application has been received. Our team will be in touch shortly.
        </p>
      </div>

      <div className="rounded-2xl border-2 border-saffron-600/40 bg-saffron-50 p-5 text-left">
        <p className="text-sm font-medium text-ink-900">
          🕐 आगे क्या होगा? · What happens next
        </p>
        <ol className="mt-3 space-y-3 text-sm text-ink-900 list-decimal list-inside">
          <li>
            हमारी टीम हर आवेदन को manually review करती है (आमतौर पर 24 घंटे के
            अंदर)।
            <br />
            <span className="text-ink-600 text-xs">
              Our team manually reviews each application (usually within 24
              hours).
            </span>
          </li>
          <li>
            Approve होने पर, आपका <strong>volunteer code</strong> और पहला भण्डारा
            submit करने का link हम WhatsApp पर भेजेंगे, आपके नंबर{" "}
            <strong className="font-mono">…{phoneLast4}</strong> पर।
            <br />
            <span className="text-ink-600 text-xs">
              Once approved, we'll WhatsApp your{" "}
              <strong>volunteer code</strong> plus a link to submit your first
              bhandara, to the number ending in{" "}
              <strong className="font-mono">…{phoneLast4}</strong>.
            </span>
          </li>
          <li>
            Code को safe जगह save कर लीजिए। हर submission में इसकी ज़रूरत होगी।
            <br />
            <span className="text-ink-600 text-xs">
              Save the code somewhere safe. You'll need it for every submission.
            </span>
          </li>
          <li>
            अगले बड़े मंगल (मंगलवार) या बड़े शनिवार से documenting शुरू कीजिए।
            <br />
            <span className="text-ink-600 text-xs">
              From the next Bada Mangal (Tuesday) or Bade Shanivar (Saturday),
              start documenting.
            </span>
          </li>
        </ol>
      </div>

      <div className="rounded-xl border border-gold-500/40 bg-cream-50 px-4 py-3 text-sm text-ink-900 text-left">
        <p className="font-medium">
          ⚠️ 24 घंटे बाद भी WhatsApp message नहीं मिला? · Not getting a WhatsApp
          message after 24 hours?
        </p>
        <p className="mt-1.5 text-xs text-ink-600">सबसे common reasons · Most common reasons:</p>
        <ul className="mt-1.5 list-disc list-inside space-y-1 text-xs text-ink-600">
          <li>
            जो number आपने दिया उसमें WhatsApp install नहीं है।
            <br />
            <span className="text-ink-600/80">
              The number you entered doesn't have WhatsApp installed.
            </span>
          </li>
          <li>
            WhatsApp settings में आपने unknown senders को block किया है।
            <br />
            <span className="text-ink-600/80">
              You've blocked unknown senders in WhatsApp settings.
            </span>
          </li>
          <li>
            हम busy हैं। कल फिर check कीजिए, फिर भी न मिले तो team को WhatsApp
            करें।
            <br />
            <span className="text-ink-600/80">
              We're swamped (re-check tomorrow before WhatsApping the team).
            </span>
          </li>
        </ul>
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
          🏠 मुख्य पृष्ठ · Back to BadaMangal
        </Link>
      </div>
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
