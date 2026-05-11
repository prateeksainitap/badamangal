"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ALL_TUESDAY_ISO, formatHindiDate, formatEnglishDate } from "@/lib/dates";
import { AREAS, DEFAULT_CENTER } from "@/lib/lucknow";
import { strings, type Locale } from "@/content/strings";
import { JaliCorner, SunburstSpark } from "@/components/ornaments";

type Props = {
  locale: Locale;
};

type Result = { id: string; slug: string };

/**
 * Frictionless 60-second add. Captures only what's strictly needed and
 * posts to /api/bhandaras with sensible defaults for everything else.
 * Organisers who want to set photos, full menu, UPI, etc. can follow up
 * via the multi-step form linked from the success state.
 */
export default function QuickAddBhandara({ locale }: Props) {
  const t = strings[locale];
  const isHi = locale === "hi";

  const [address, setAddress] = useState("");
  const [area, setArea] = useState<string>("");
  const [tuesday, setTuesday] = useState<string>(
    ALL_TUESDAY_ISO.find(
      (d) => d >= new Date().toISOString().slice(0, 10),
    ) ?? ALL_TUESDAY_ISO[0],
  );
  const [timeStart, setTimeStart] = useState("11:00");
  const [timeEnd, setTimeEnd] = useState("15:00");
  const [organizerName, setOrganizerName] = useState("");
  const [organizerPhone, setOrganizerPhone] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locStatus, setLocStatus] = useState<
    "idle" | "asking" | "got" | "denied"
  >("idle");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Result | null>(null);

  // Suggest a sensible area based on a free-text address (heuristic, the
  // multi-step form pin-drops + reverse-geocodes for accuracy).
  useEffect(() => {
    if (area) return;
    const lower = address.toLowerCase();
    const match = AREAS.find((a) => lower.includes(a.toLowerCase()));
    if (match) setArea(match);
  }, [address, area]);

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocStatus("denied");
      return;
    }
    setLocStatus("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus("got");
      },
      () => setLocStatus("denied"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60_000 },
    );
  };

  const canSubmit =
    address.trim().length >= 5 &&
    area !== "" &&
    /^\d{2}:\d{2}$/.test(timeStart) &&
    /^\d{2}:\d{2}$/.test(timeEnd) &&
    organizerName.trim().length >= 2 &&
    /^[+\d\s\-]{8,20}$/.test(organizerPhone.trim());

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    const lat = coords?.lat ?? DEFAULT_CENTER.lat;
    const lng = coords?.lng ?? DEFAULT_CENTER.lng;
    const fallbackName = `Bhandara at ${address.trim().split(",")[0].slice(0, 60)}`;

    const payload = {
      // Quick-add defaults, organiser can refine later via /list-bhandara.
      organizerName: organizerName.trim(),
      organizerPhone: organizerPhone.trim(),
      name: fallbackName,
      nameHi: fallbackName,
      area,
      address: address.trim(),
      lat,
      lng,
      tuesdayDates: [tuesday],
      timeStart,
      timeEnd,
      menu: ["puri", "sabzi"],
      menuOther: [],
    };

    try {
      const res = await fetch("/api/bhandaras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const ok = (await res.json()) as Result;
        setSuccess(ok);
        return;
      }
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(data?.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Network error. Check your connection and retry.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) return <SuccessCard result={success} locale={locale} />;

  const tuesdayOptions = ALL_TUESDAY_ISO.map((iso) => {
    const d = new Date(`${iso}T04:30:00Z`);
    return {
      iso,
      label: isHi ? formatHindiDate(d) : formatEnglishDate(d),
      past: iso < new Date().toISOString().slice(0, 10),
    };
  });

  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 py-12 sm:py-16">
      <div className="relative rounded-[2rem] overflow-hidden border border-gold-500/45 bg-cream-50 shadow-warm">
        <JaliCorner
          position="tl"
          className="absolute top-3 left-3 w-12 h-12 text-gold-500/70"
        />
        <JaliCorner
          position="tr"
          className="absolute top-3 right-3 w-12 h-12 text-gold-500/70"
        />
        <JaliCorner
          position="bl"
          className="absolute bottom-3 left-3 w-12 h-12 text-gold-500/70"
        />
        <JaliCorner
          position="br"
          className="absolute bottom-3 right-3 w-12 h-12 text-gold-500/70"
        />

        <div className="relative px-6 sm:px-10 py-10 sm:py-12">
          <header className="text-center max-w-2xl mx-auto">
            <p className="font-mukta uppercase tracking-[0.32em] text-gold-500 text-[0.7rem]">
              {isHi ? "60 सेकंड में जोड़ें" : "Add yours in 60 seconds"}
            </p>
            <h2
              className={`mt-3 ${
                isHi
                  ? "font-deva font-semibold text-sindoor-700 text-3xl sm:text-4xl"
                  : "font-fraunces font-semibold text-sindoor-700 text-3xl sm:text-4xl"
              }`}
            >
              {isHi
                ? "अपना भंडारा शहर के नक़्शे पर लाइए"
                : "Put your bhandara on the city's map"}
            </h2>
            <p className="mt-3 text-ink-600 leading-relaxed">
              {isHi
                ? "बस पता, मंगल और समय भरिए। बाकी विवरण बाद में जोड़ा जा सकता है। 24 घंटे के अंदर समीक्षा होगी।"
                : "Just the address, the Tuesday, and your time window. Everything else can wait. We review every entry within 24 hours."}
            </p>
          </header>

          {error ? (
            <div className="mt-6 rounded-xl border border-alert-500/60 bg-alert-500/10 text-alert-500 px-4 py-3 text-sm">
              {error}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-8 grid gap-4 sm:gap-5">
            {/* Row 1: address + use-location */}
            <div className="grid gap-2">
              <label className="text-sm font-medium text-ink-900">
                <span className="font-tiro text-base text-sindoor-700 mr-1">
                  कहाँ?
                </span>
                <span className="text-ink-600">
                  / {isHi ? "पता या निशानी" : "Address or landmark"}
                </span>
                <span className="text-alert-500"> *</span>
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  required
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={
                    isHi
                      ? "अलीगंज, सेक्टर ए, हनुमान मंदिर के पास"
                      : "Aliganj Sector A, near Hanuman Mandir"
                  }
                  className="flex-1 rounded-xl border border-gold-500/50 bg-white px-3 py-2.5 text-ink-900 placeholder:text-ink-600/55 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
                />
                <button
                  type="button"
                  onClick={useMyLocation}
                  disabled={locStatus === "asking"}
                  className="btn btn-ghost btn-sm shrink-0"
                  aria-label="Use my current location"
                >
                  {locStatus === "got"
                    ? isHi ? "लोकेशन ✓" : "Location set ✓"
                    : locStatus === "asking"
                      ? isHi ? "लोकेट…" : "Locating…"
                      : locStatus === "denied"
                        ? isHi ? "अनुमति नहीं" : "No access"
                        : isHi
                          ? "मेरी लोकेशन"
                          : "Use my location"}
                </button>
              </div>
            </div>

            {/* Row 2: area + tuesday */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-ink-900">
                  <span className="font-tiro text-base text-sindoor-700 mr-1">
                    क्षेत्र
                  </span>
                  <span className="text-ink-600">/ {isHi ? "क्षेत्र" : "Area"}</span>
                  <span className="text-alert-500"> *</span>
                </label>
                <select
                  required
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="rounded-xl border border-gold-500/50 bg-white px-3 py-2.5 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
                >
                  <option value="">, {isHi ? "चुनें" : "Pick an area"} ,</option>
                  {AREAS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-ink-900">
                  <span className="font-tiro text-base text-sindoor-700 mr-1">
                    कब?
                  </span>
                  <span className="text-ink-600">
                    / {isHi ? "मंगल चुनिए" : "Which Tuesday"}
                  </span>
                  <span className="text-alert-500"> *</span>
                </label>
                <select
                  required
                  value={tuesday}
                  onChange={(e) => setTuesday(e.target.value)}
                  className="rounded-xl border border-gold-500/50 bg-white px-3 py-2.5 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
                >
                  {tuesdayOptions.map((d) => (
                    <option
                      key={d.iso}
                      value={d.iso}
                      disabled={d.past}
                    >
                      {d.label}
                      {d.past ? ` · ${isHi ? "बीत चुका" : "past"}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 3: time start + end */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-ink-900">
                  <span className="font-tiro text-base text-sindoor-700 mr-1">
                    शुरू
                  </span>
                  <span className="text-ink-600">
                    / {isHi ? "शुरू होने का समय" : "Start time"}
                  </span>
                </label>
                <input
                  required
                  type="time"
                  value={timeStart}
                  onChange={(e) => setTimeStart(e.target.value)}
                  className="rounded-xl border border-gold-500/50 bg-white px-3 py-2.5 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-ink-900">
                  <span className="font-tiro text-base text-sindoor-700 mr-1">
                    समाप्ति
                  </span>
                  <span className="text-ink-600">
                    / {isHi ? "समाप्ति का समय" : "End time"}
                  </span>
                </label>
                <input
                  required
                  type="time"
                  value={timeEnd}
                  onChange={(e) => setTimeEnd(e.target.value)}
                  className="rounded-xl border border-gold-500/50 bg-white px-3 py-2.5 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
                />
              </div>
            </div>

            {/* Row 4: name + phone */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-ink-900">
                  <span className="font-tiro text-base text-sindoor-700 mr-1">
                    नाम
                  </span>
                  <span className="text-ink-600">
                    / {isHi ? "आपका नाम" : "Your name"}
                  </span>
                  <span className="text-alert-500"> *</span>
                </label>
                <input
                  required
                  type="text"
                  value={organizerName}
                  onChange={(e) => setOrganizerName(e.target.value)}
                  placeholder="Ramesh Tiwari"
                  className="rounded-xl border border-gold-500/50 bg-white px-3 py-2.5 text-ink-900 placeholder:text-ink-600/55 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-ink-900">
                  <span className="font-tiro text-base text-sindoor-700 mr-1">
                    मोबाइल
                  </span>
                  <span className="text-ink-600">/ {isHi ? "मोबाइल" : "Mobile"}</span>
                  <span className="text-alert-500"> *</span>
                </label>
                <input
                  required
                  type="tel"
                  inputMode="tel"
                  value={organizerPhone}
                  onChange={(e) => setOrganizerPhone(e.target.value)}
                  placeholder="+91 ..........."
                  className="rounded-xl border border-gold-500/50 bg-white px-3 py-2.5 text-ink-900 placeholder:text-ink-600/55 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
                />
              </div>
            </div>

            {/* Submit row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-2">
              <button
                type="submit"
                disabled={!canSubmit || submitting}
                className="btn btn-sindoor btn-lg"
              >
                {submitting
                  ? isHi
                    ? "भेजा जा रहा है…"
                    : "Submitting…"
                  : isHi
                    ? "जोड़ें · समीक्षा में भेजें"
                    : "Add to map · queue for review"}
                <span aria-hidden>→</span>
              </button>
              <p className="text-xs text-ink-600 sm:max-w-[280px] leading-relaxed">
                {isHi
                  ? "विस्तृत विवरण? "
                  : "Need to add menu, photos, UPI? "}
                <Link
                  href={isHi ? "/list-bhandara" : "/list-bhandara?lang=en"}
                  className="text-sindoor-700 hover:underline font-medium"
                >
                  {isHi
                    ? "पूरा फ़ॉर्म खोलें →"
                    : "Open the full form →"}
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function SuccessCard({
  result,
  locale,
}: {
  result: Result;
  locale: Locale;
}) {
  const isHi = locale === "hi";
  const url = `/bhandara/${result.slug}${isHi ? "" : "?lang=en"}`;
  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16">
      <div className="relative rounded-[2rem] overflow-hidden border-2 border-gold-500/55 bg-saffron-50 shadow-warm px-6 sm:px-10 py-10 sm:py-14 text-center">
        <div className="flex justify-center">
          <SunburstSpark size={64} className="text-saffron-600" />
        </div>
        <p className="mt-4 font-cormorant uppercase tracking-[0.32em] text-gold-500 text-xs">
          {isHi ? "जय हनुमान" : "Pranam"}
        </p>
        <h3
          className={`mt-3 ${
            isHi
              ? "font-deva font-semibold text-sindoor-700 text-3xl"
              : "font-fraunces font-semibold text-sindoor-700 text-3xl"
          }`}
        >
          {isHi ? "आपका भंडारा समीक्षा में है" : "Your bhandara is queued"}
        </h3>
        <p className="mt-3 text-ink-600 max-w-lg mx-auto leading-relaxed">
          {isHi
            ? "हम 24 घंटे के अंदर पुष्टि करेंगे। अनुमोदन के बाद यह लिंक सबको दिखेगा। मेन्यू, फ़ोटो और UPI जोड़ने के लिए पूरा फ़ॉर्म खोलिए।"
            : "We'll confirm within 24 hours. Once approved, this link goes live. Add menu, photos and UPI from the full form."}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href={url} className="btn btn-ghost">
            {isHi ? "लिंक देखें" : "View future link"}
          </Link>
          <Link
            href={isHi ? "/list-bhandara" : "/list-bhandara?lang=en"}
            className="btn btn-sindoor"
          >
            {isHi ? "और विवरण जोड़ें →" : "Add more details →"}
          </Link>
        </div>
      </div>
    </section>
  );
}
