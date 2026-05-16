"use client";

import { useState } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/ga";

/**
 * Pamphlet generator form + download flow.
 *
 * Why this lives in the product:
 *   Lucknow bhandara organisers distribute physical pamphlets in
 *   their neighbourhoods — taped to temple walls, handed out at
 *   the mandir, photocopied at the corner press shop. Most pay
 *   ₹50-200 to a local "designer" for a poorly-aligned MS Word
 *   file. We offer a free, devotionally-correct template with a
 *   QR code on it that points back into the BadaMangal directory.
 *   Every printed pamphlet becomes a real-world discovery vector.
 *
 * Flow:
 *   1. Organiser fills minimal form (name, date, time, place,
 *      organizer, optional menu).
 *   2. Clicks Generate → POST /api/pamphlet → returns A4 PNG.
 *   3. PNG opens in a new tab + saves to Downloads (browser default).
 *   4. Cross-sell prompt: "Also list this on BadaMangal.com so
 *      devotees searching online can find it" — pre-fills the
 *      /list-bhandara form with the same data via URL params.
 *
 * Why we don't list it automatically:
 *   /list-bhandara has stricter validation (server-side geocode,
 *   admin moderation queue). Some pamphlet users are testing the
 *   tool or generating for a private family bhandara they don't
 *   want public. Opt-in cross-sell respects that.
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

export default function PamphletGenerator() {
  const [state, setState] = useState<FormState>(INITIAL);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneUrl, setDoneUrl] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

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
    trackEvent("pamphlet_generate_start", {});
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
          organizerPhone: state.organizerPhone.trim() || undefined,
          // QR code points to a homepage search URL pre-filled with
          // the bhandara name. Recipients who scan land on a page
          // that highlights this specific bhandara (or shows the
          // search results if it's not listed yet — gentle nudge to
          // explore the directory).
          qrUrl: `${window.location.origin}/?q=${encodeURIComponent(state.name.trim())}`,
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
      // Auto-trigger download
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
  // re-type. The form picks these up on mount.
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

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 pt-10 sm:pt-14 pb-24">
      <header className="text-center">
        <p className="font-mukta uppercase tracking-[0.3em] text-saffron-600 text-xs font-semibold">
          Free · No Sign-up
        </p>
        <h1 className="mt-3 font-fraunces font-bold text-3xl sm:text-[2.4rem] text-sindoor-700 leading-tight">
          Bada Mangal Bhandara Pamphlet Generator
        </h1>
        <p className="mt-3 text-ink-600 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          Fill the form, get a print-ready A4 pamphlet in 30 seconds.
          Devotional design, Hindi + English, QR code that points back
          to your bhandara on BadaMangal.com. Print at any local press
          shop.
        </p>
      </header>

      <form
        className="mt-10 grid gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void generate();
        }}
      >
        <Field
          label="Bhandara name (English)"
          required
          value={state.name}
          onChange={(v) => set("name", v)}
          placeholder="e.g. Shrivastav Pariwar Bhandara"
        />
        <Field
          label="Bhandara name (Hindi, optional)"
          value={state.nameHi}
          onChange={(v) => set("nameHi", v)}
          placeholder="उदाहरण: श्रीवास्तव परिवार भंडारा"
        />

        <div className="grid sm:grid-cols-2 gap-5">
          <Field
            label="Area / locality"
            value={state.area}
            onChange={(v) => set("area", v)}
            placeholder="e.g. Aliganj"
          />
          <Field
            label="Bhandara date"
            required
            type="date"
            value={state.date}
            onChange={(v) => set("date", v)}
          />
        </div>

        <Field
          label="Full address"
          required
          value={state.address}
          onChange={(v) => set("address", v)}
          placeholder="e.g. Hanuman Mandir, Sector C, Aliganj, Lucknow"
        />

        <div className="grid sm:grid-cols-2 gap-5">
          <Field
            label="Start time"
            required
            type="time"
            value={state.timeStart}
            onChange={(v) => set("timeStart", v)}
          />
          <Field
            label="End time (optional)"
            type="time"
            value={state.timeEnd}
            onChange={(v) => set("timeEnd", v)}
          />
        </div>

        <Field
          label="Prasad / menu (optional)"
          value={state.menu}
          onChange={(v) => set("menu", v)}
          placeholder="e.g. puri, sabzi, halwa, prasad"
        />

        <div className="grid sm:grid-cols-2 gap-5">
          <Field
            label="Organizer name"
            value={state.organizerName}
            onChange={(v) => set("organizerName", v)}
            placeholder="e.g. Shrivastav Pariwar"
          />
          <Field
            label="Organizer phone (optional)"
            type="tel"
            value={state.organizerPhone}
            onChange={(v) => set("organizerPhone", v)}
            placeholder="98765 43210"
          />
        </div>

        {error ? (
          <p className="text-sm text-alert-500">Couldn't generate: {error}</p>
        ) : null}

        <div className="flex flex-wrap gap-3 items-center justify-center pt-2">
          <button
            type="submit"
            disabled={!canGenerate || generating}
            data-ga="pamphlet_generate"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-semibold px-6 py-3 text-base shadow-warm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {generating ? "Generating…" : "Generate pamphlet (PNG)"}
          </button>
          {doneUrl ? (
            <a
              href={doneUrl}
              download="bada-mangal-pamphlet.png"
              data-ga="pamphlet_redownload"
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-saffron-600 text-saffron-600 hover:bg-saffron-50 font-semibold px-5 py-3 text-sm"
            >
              Download again
            </a>
          ) : null}
        </div>
      </form>

      {/* Post-generate cross-sell: pre-fills /list-bhandara with the
          same fields so the organiser can publish to the directory in
          one click. Tucked below the form so it never interrupts the
          primary "generate pamphlet" flow. */}
      <section className="mt-12 rounded-2xl border border-gold-500/45 bg-gradient-to-br from-saffron-50 to-cream-50 px-6 py-7 sm:px-8 sm:py-9 shadow-warm">
        <p className="font-mukta uppercase tracking-[0.2em] text-saffron-600 text-[0.65rem] font-semibold">
          One More Step (Optional)
        </p>
        <h2 className="mt-2 font-fraunces font-bold text-xl sm:text-2xl text-sindoor-700">
          Also list this bhandara on BadaMangal.com
        </h2>
        <p className="mt-2 text-sm sm:text-base text-ink-600">
          Free. The same details you just typed pre-fill the listing
          form, so it's a one-tap publish. Devotees searching for
          bhandaras in Lucknow will find yours on the map. Mention
          BadaMangal.com on your printed pamphlet via the QR code at
          the bottom — every scan goes here.
        </p>
        <div className="mt-4">
          <Link
            href={listHref}
            data-ga="pamphlet_cross_sell_list"
            className="inline-flex items-center gap-2 rounded-full bg-leaf-600 hover:bg-leaf-600/90 text-cream-50 font-semibold px-5 py-2.5 text-sm shadow-sm"
          >
            List my bhandara — free →
          </Link>
        </div>
      </section>

      <p className="mt-6 text-center text-xs text-ink-600">
        Tip: Walk into any local press shop with this PNG on WhatsApp
        — they'll print A4 / A5 copies for under ₹2 each.
      </p>
    </div>
  );
}

/** Single-line input wrapper — same look as the rest of the site forms. */
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
  return (
    <label className="grid gap-1.5">
      <span className="text-sm text-ink-600">
        {label}
        {required ? <span className="text-sindoor-700"> *</span> : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-gold-500/50 bg-white px-3 py-2.5 text-ink-900 placeholder:text-ink-600/55 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
      />
    </label>
  );
}
