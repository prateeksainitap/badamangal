"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/ga";

export type NearMeState = {
  status: "idle" | "locating" | "active" | "error" | "unsupported";
  coords: { lat: number; lng: number } | null;
};

type Props = {
  onChange: (state: NearMeState) => void;
  active: boolean;
  /** Optional override for ARIA + visible label. */
  label?: { hi: string; en: string };
  isHi: boolean;
  /** Where this button lives, sent as `source` on the GA event. */
  source: string;
  size?: "sm" | "md";
  className?: string;
};

/**
 * "Bhandara near me" toggle: when off, asks the browser for the user's
 * geolocation and surfaces a `coords` payload via `onChange`. When on
 * (already located), tapping it again clears the filter.
 *
 * The button is visually a small saffron pill with a crosshair icon; it
 * does NOT do the filtering itself, the parent decides what "nearby"
 * means (3 km on the map list, on the live feed, etc.) and re-renders.
 */
export default function NearMeButton({
  onChange,
  active,
  label,
  isHi,
  source,
  size = "sm",
  className,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const labelText = active
    ? isHi
      ? "नज़दीकी फ़िल्टर हटाएँ"
      : "Clear nearby"
    : label
      ? isHi
        ? label.hi
        : label.en
      : isHi
        ? "मेरे पास के भंडारे"
        : "Bhandaras near me";

  const onClick = () => {
    setError(null);
    if (active) {
      trackEvent("near_me_clear", { source });
      onChange({ status: "idle", coords: null });
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError(isHi ? "लोकेशन सपोर्ट नहीं है।" : "Location not supported.");
      onChange({ status: "unsupported", coords: null });
      return;
    }
    setPending(true);
    trackEvent("near_me_request", { source });
    onChange({ status: "locating", coords: null });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPending(false);
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        trackEvent("near_me_success", { source });
        onChange({ status: "active", coords });
      },
      (err) => {
        setPending(false);
        setError(err.message);
        trackEvent("near_me_error", { source, code: err.code });
        onChange({ status: "error", coords: null });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60_000 },
    );
  };

  // Asymmetric padding-y mirrors the .btn rule so Mukta's cap-height sits
  // optically centred, slightly more padding-TOP drops the glyph cluster
  // into the visual middle of the pill. The `sm` preset matches `.btn-sm`
  // (36 px min-height) so this control sits flush with neighbouring
  // `btn-sm` CTAs in toolbars like the homepage MapBoard.
  const sizeClass =
    size === "md"
      ? "min-h-[40px] pt-[0.58rem] pb-[0.42rem] px-4 text-sm leading-none"
      : "min-h-[36px] pt-[0.58rem] pb-[0.42rem] px-3 text-[0.8rem] leading-none";

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={active}
        className={`inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors disabled:opacity-60 ${sizeClass} ${
          active
            ? "bg-saffron-600 border-saffron-600 text-cream-50 hover:bg-saffron-500"
            : "bg-cream-50 border-saffron-500/45 text-sindoor-700 hover:border-saffron-500"
        }`}
      >
        <CrosshairIcon spin={pending} />
        {pending
          ? isHi
            ? "लोकेट कर रहे हैं…"
            : "Locating…"
          : labelText}
      </button>
      {error ? (
        <p className="mt-1 text-[10px] text-alert-500">{error}</p>
      ) : null}
    </div>
  );
}

function CrosshairIcon({ spin }: { spin?: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={spin ? "animate-spin" : ""}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}
