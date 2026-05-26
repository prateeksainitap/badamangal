"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PamphletArtTheme } from "@/lib/pamphlet-themes";
import { JaliCorner } from "@/components/ornaments";

/**
 * Free, no-login pamphlet builder. The user fills in their
 * bhandara details, picks one of the 4 art themes, hits "Preview".
 * We POST the same payload to /api/pamphlet that the admin scan
 * tool uses; the response is a PNG which we render in an <img>
 * tag and offer for download.
 *
 * This is a pure client component. No DB writes. Anyone visiting
 * /design can build a pamphlet without signing up, that's the
 * whole point. The lead-gen comes from organisers opting to also
 * "List on Bada Mangal" via the CTA at the bottom of the success
 * state.
 *
 * Themes:
 *   • panchmukhi-mandir, temple architecture motif
 *   • royal-awadhi     , Lucknow nawabi style
 *   • festive-marigold , bright marigold garland
 *   • minimal-modern   , clean Gen-Z friendly layout
 *   • classic          , the all-CSS Satori v2 template (no AI bg)
 */

type Theme = {
  id: PamphletArtTheme;
  label: { en: string; hi: string };
  tagline: { en: string; hi: string };
  thumb: string;
};

type Props = {
  themes: Theme[];
  tuesdayDates: string[];
  saturdayDates: string[];
};

const MENU_PRESETS = [
  "puri",
  "sabji",
  "kheer",
  "halwa",
  "boondi",
  "ladoo",
  "thandai",
  "chana",
  "rice",
  "raita",
  "chutney",
];

export default function PamphletBuilder({
  themes,
  tuesdayDates,
  saturdayDates,
}: Props) {
  const [name, setName] = useState("");
  const [nameHi, setNameHi] = useState("");
  const [organizerName, setOrganizerName] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState<string>(tuesdayDates[0] ?? "");
  const [timeStart, setTimeStart] = useState("11:00");
  const [timeEnd, setTimeEnd] = useState("15:00");
  const [organizerPhone, setOrganizerPhone] = useState("");
  const [menuItems, setMenuItems] = useState<string[]>(["puri", "sabji", "kheer"]);
  const [customMenuInput, setCustomMenuInput] = useState("");
  const [themeId, setThemeId] = useState<PamphletArtTheme | "classic">(
    themes[0]?.id ?? "classic",
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pamphletUrl, setPamphletUrl] = useState<string | null>(null);
  const [pamphletBlob, setPamphletBlob] = useState<Blob | null>(null);

  // Combined date list, Tuesdays + Saturdays, marked for the dropdown.
  const allDates = useMemo(() => {
    const ts = tuesdayDates.map((d) => ({ iso: d, kind: "Tue" as const }));
    const ss = saturdayDates.map((d) => ({ iso: d, kind: "Sat" as const }));
    return [...ts, ...ss].sort((a, b) => a.iso.localeCompare(b.iso));
  }, [tuesdayDates, saturdayDates]);

  // Clean up blob URLs to avoid memory leaks across regenerations.
  useEffect(() => {
    return () => {
      if (pamphletUrl) URL.revokeObjectURL(pamphletUrl);
    };
  }, [pamphletUrl]);

  function toggleMenu(item: string) {
    setMenuItems((prev) =>
      prev.includes(item) ? prev.filter((m) => m !== item) : [...prev, item],
    );
  }

  function addCustomMenuItem() {
    const v = customMenuInput.trim();
    if (!v) return;
    if (!menuItems.includes(v)) setMenuItems((prev) => [...prev, v]);
    setCustomMenuInput("");
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setPamphletUrl(null);
    setPamphletBlob(null);
    try {
      const resp = await fetch("/api/pamphlet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          nameHi,
          organizerName,
          area,
          address,
          date,
          timeStart,
          timeEnd,
          menu: menuItems.join(", "),
          organizerPhone,
          theme: themeId,
        }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || `Server returned ${resp.status}`);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      setPamphletBlob(blob);
      setPamphletUrl(url);
      // Scroll the preview into view on success.
      setTimeout(() => {
        const el = document.getElementById("pamphlet-preview");
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate pamphlet");
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!pamphletBlob) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(pamphletBlob);
    link.download = `badamangal-pamphlet-${(name || "bhandara")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")}.png`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <main className="min-h-dvh bg-cream-50">
      {/* HEADER */}
      <header className="border-b border-gold-500/30 bg-saffron-50/60 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
          <p className="text-[10px] uppercase tracking-[0.22em] text-saffron-500 font-semibold">
            Free tool · No signup
          </p>
          <h1 className="mt-1 font-fraunces text-3xl sm:text-4xl text-sindoor-700 leading-tight">
            Design your bhandara pamphlet
          </h1>
          <p className="mt-2 text-sm text-ink-700 max-w-2xl">
            Fill in the details, pick a theme, hit preview. Download a
            print-ready A4 PNG you can take to any photocopy shop in
            Lucknow.
          </p>
        </div>
      </header>

      {/* FORM */}
      <form
        onSubmit={handleGenerate}
        className="relative mx-auto max-w-5xl px-4 sm:px-6 py-8 grid lg:grid-cols-[1fr_18rem] gap-8"
      >
        <JaliCorner className="absolute right-2 top-2 opacity-30 hidden sm:block" />

        <div className="space-y-6">
          {/* Bhandara basics */}
          <fieldset className="rounded-2xl border border-gold-500/40 bg-white p-5">
            <legend className="px-2 font-fraunces text-lg text-sindoor-700">
              Basics
            </legend>
            <div className="grid sm:grid-cols-2 gap-3 mt-2">
              <Field
                label="Bhandara name (English)"
                value={name}
                onChange={setName}
                placeholder="e.g. Fourth Bada Mangal Bhandara"
                required
              />
              <Field
                label="भण्डारे का नाम (Hindi)"
                value={nameHi}
                onChange={setNameHi}
                placeholder="जैसे चतुर्थ बड़ा मंगल भण्डारा"
              />
              <Field
                label="Organiser name"
                value={organizerName}
                onChange={setOrganizerName}
                placeholder="Your or your samiti's name"
                required
              />
              <Field
                label="Phone (for the pamphlet)"
                value={organizerPhone}
                onChange={setOrganizerPhone}
                placeholder="10-digit, no +91"
                pattern="\d{10}"
              />
            </div>
          </fieldset>

          {/* Where + when */}
          <fieldset className="rounded-2xl border border-gold-500/40 bg-white p-5">
            <legend className="px-2 font-fraunces text-lg text-sindoor-700">
              Where & when
            </legend>
            <div className="grid gap-3 mt-2">
              <Field
                label="Area"
                value={area}
                onChange={setArea}
                placeholder="e.g. Gomti Nagar"
                required
              />
              <Field
                label="Full address"
                value={address}
                onChange={setAddress}
                placeholder="Plot / lane / landmark, near …"
              />
              <div className="grid sm:grid-cols-3 gap-3">
                <label className="grid gap-1.5 text-sm">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-ink-600 font-semibold">
                    Date
                  </span>
                  <select
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600"
                  >
                    {allDates.map((d) => (
                      <option key={d.iso} value={d.iso}>
                        {d.iso} · {d.kind}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  label="Start time"
                  type="time"
                  value={timeStart}
                  onChange={setTimeStart}
                />
                <Field
                  label="End time"
                  type="time"
                  value={timeEnd}
                  onChange={setTimeEnd}
                />
              </div>
            </div>
          </fieldset>

          {/* Menu */}
          <fieldset className="rounded-2xl border border-gold-500/40 bg-white p-5">
            <legend className="px-2 font-fraunces text-lg text-sindoor-700">
              Prasad menu
            </legend>
            <p className="mt-1 text-xs text-ink-600">
              Tap items you'll be serving. Add anything custom below.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {MENU_PRESETS.map((item) => {
                const isSelected = menuItems.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleMenu(item)}
                    className={`rounded-full px-3 py-1.5 text-sm capitalize transition-colors ${
                      isSelected
                        ? "bg-saffron-600 text-cream-50 shadow-warm"
                        : "border border-gold-500/40 text-ink-700 hover:border-saffron-500/55 hover:bg-saffron-500/[0.06]"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <input
                value={customMenuInput}
                onChange={(e) => setCustomMenuInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomMenuItem();
                  }
                }}
                placeholder="Add a custom item (e.g. malpua)"
                className="flex-1 rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600"
              />
              <button
                type="button"
                onClick={addCustomMenuItem}
                className="rounded-full border-2 border-saffron-600 text-saffron-600 hover:bg-saffron-600 hover:text-cream-50 font-medium px-4 py-1.5 text-sm transition-colors"
              >
                Add
              </button>
            </div>
            {menuItems.filter((m) => !MENU_PRESETS.includes(m)).length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {menuItems
                  .filter((m) => !MENU_PRESETS.includes(m))
                  .map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1.5 rounded-full bg-saffron-50 border border-saffron-500/40 px-3 py-1 text-sm text-ink-900"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() => toggleMenu(item)}
                        aria-label={`Remove ${item}`}
                        className="text-ink-600 hover:text-sindoor-700"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
              </div>
            ) : null}
          </fieldset>

          {/* Theme picker */}
          <fieldset className="rounded-2xl border border-gold-500/40 bg-white p-5">
            <legend className="px-2 font-fraunces text-lg text-sindoor-700">
              Style
            </legend>
            <p className="mt-1 text-xs text-ink-600">
              Each style has its own Hanuman ji illustration. Classic is
              the clean all-CSS option.
            </p>
            <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <ThemeChoice
                id="classic"
                label="Classic"
                description="Clean, all-text design with marigold accents."
                active={themeId === "classic"}
                onSelect={() => setThemeId("classic")}
              />
              {themes.map((t) => (
                <ThemeChoice
                  key={t.id}
                  id={t.id}
                  label={t.label.en}
                  description={t.tagline.en}
                  thumb={t.thumb}
                  active={themeId === t.id}
                  onSelect={() => setThemeId(t.id)}
                />
              ))}
            </div>
          </fieldset>

          {error ? (
            <div className="rounded-xl border border-alert-500/40 bg-alert-500/[0.06] px-4 py-3 text-sm text-alert-500">
              <strong>Could not generate.</strong>{" "}
              {error.length < 200 ? error : error.slice(0, 200) + "…"}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || !name || !organizerName || !area}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-saffron-600 hover:bg-saffron-500 disabled:opacity-60 text-cream-50 font-medium px-6 py-3 shadow-warm transition-colors w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Spinner />
                Generating pamphlet…
              </>
            ) : (
              <>✨ Preview pamphlet</>
            )}
          </button>
        </div>

        {/* Sticky info column */}
        <aside className="lg:sticky lg:top-6 self-start">
          <div className="rounded-2xl border border-gold-500/40 bg-saffron-50/60 p-4 text-sm text-ink-700">
            <p className="font-fraunces text-base text-sindoor-700 mb-2">
              Tips
            </p>
            <ul className="space-y-2 list-disc list-inside text-xs">
              <li>Print on A4 size for the cleanest result.</li>
              <li>
                Put your Hindi name first if the audience is older
                Lucknowis.
              </li>
              <li>
                Phone on the pamphlet rings, be ready for "kahan hai?"
                calls.
              </li>
              <li>
                Once printed, list your bhandara on{" "}
                <Link
                  href="/list-your-bhandara"
                  className="text-saffron-600 underline hover:text-sindoor-700"
                >
                  badamangal.com
                </Link>{" "}
                to reach 9,600+ Lucknowis.
              </li>
            </ul>
          </div>
        </aside>
      </form>

      {/* PREVIEW */}
      {pamphletUrl ? (
        <section
          id="pamphlet-preview"
          className="border-t border-gold-500/30 bg-saffron-50/40"
        >
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
            <p className="text-[10px] uppercase tracking-[0.22em] text-saffron-500 font-semibold">
              Preview
            </p>
            <h2 className="mt-1 font-fraunces text-2xl text-sindoor-700">
              Your pamphlet is ready
            </h2>
            <div className="mt-5 grid lg:grid-cols-[1fr_18rem] gap-8 items-start">
              <div className="rounded-2xl border border-gold-500/40 bg-white p-4 shadow-warm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pamphletUrl}
                  alt="Generated pamphlet preview"
                  className="block w-full h-auto rounded-lg"
                />
              </div>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-leaf-600 hover:bg-leaf-600/90 text-cream-50 font-medium px-5 py-2.5 text-sm shadow-sm transition-colors w-full"
                >
                  ⬇ Download print-ready PNG
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPamphletUrl(null);
                    setPamphletBlob(null);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-saffron-600 text-saffron-600 hover:bg-saffron-600 hover:text-cream-50 font-medium px-5 py-2.5 text-sm w-full"
                >
                  ✎ Edit details
                </button>
                <div className="rounded-xl border border-gold-500/40 bg-saffron-50/60 p-4 text-xs text-ink-700">
                  <p className="font-fraunces text-sm text-sindoor-700 mb-1.5">
                    Want this to actually reach people?
                  </p>
                  <p>
                    Pamphlet looks great but reaches the 100 people you
                    print for. List your bhandara on Bada Mangal, same
                    details, reaches 9,600+ Lucknowis on WhatsApp +{" "}
                    {`3,700+ web visitors`}.
                  </p>
                  <Link
                    href="/list-your-bhandara"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-4 py-1.5 text-xs shadow-warm transition-colors"
                  >
                    List your bhandara →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

/* ────────── Sub-components ────────── */

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  pattern,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  pattern?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-[11px] uppercase tracking-[0.16em] text-ink-600 font-semibold">
        {label}
        {required ? <span className="text-sindoor-700"> ·</span> : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        pattern={pattern}
        className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 placeholder:text-ink-600/40 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
      />
    </label>
  );
}

function ThemeChoice({
  id,
  label,
  description,
  thumb,
  active,
  onSelect,
}: {
  id: string;
  label: string;
  description: string;
  thumb?: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`text-left rounded-xl border p-3 transition-all ${
        active
          ? "border-saffron-500/80 bg-saffron-500/[0.08] ring-2 ring-saffron-500/40"
          : "border-gold-500/40 hover:border-saffron-500/55 hover:bg-saffron-500/[0.04]"
      }`}
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt=""
          aria-hidden
          className="block w-full h-20 object-cover rounded-md border border-gold-500/30 mb-2"
        />
      ) : (
        <div className="w-full h-20 rounded-md border border-dashed border-gold-500/40 bg-saffron-50/40 grid place-items-center text-[10px] uppercase tracking-[0.12em] text-ink-600/60 font-mono mb-2">
          classic
        </div>
      )}
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={`inline-block w-3 h-3 rounded-full ${
            active ? "bg-saffron-600" : "border border-gold-500/60"
          }`}
        />
        <span className="font-fraunces text-sm text-sindoor-700">{label}</span>
      </div>
      <p className="mt-1 text-xs text-ink-600 leading-snug">{description}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-ink-600/60 font-mono">
        {id}
      </p>
    </button>
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
