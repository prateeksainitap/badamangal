"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/ga";

/**
 * Compact "paste anything Google-Maps-y → get coordinates" widget.
 *
 * Extracted out of MapLocationInput so the /admin/scan review form can
 * reuse it without inheriting MapLocationInput's full lat+lng input
 * pair (ScanReview already has its own Field-based lat/lng inputs and
 * its own React state, so it just wants the resolver, not the full
 * coordinate widget).
 *
 * Behaviour:
 *   • Paste a Maps URL, Plus Code, or raw "lat,lng" into the input
 *   • Click Resolve (or hit Enter) → POSTs to /api/admin/resolve-coords
 *   • On success: calls `onResolved(lat, lng)` so the parent can fill
 *     its own form fields, and shows a short ✓ confirmation with the
 *     resolver source ("place_url", "short_link", "plus_code", etc.)
 *   • Soft warning if the resolved coords sit outside the Lucknow
 *     bounding box, so a stray paste from a different city can't get
 *     silently published.
 *
 * Why this lives in its own file (vs inlined in ScanReview):
 *   The same paste UX exists in MapLocationInput; a future refactor
 *   can swap that copy to use this component. For now we ship the
 *   minimum needed for ScanReview without touching the
 *   already-working bot-row edit form.
 */
type Feedback =
  | { kind: "idle" }
  | { kind: "ok"; source: string; inLucknow: boolean }
  | { kind: "err"; message: string };

const LKO_BBOX = {
  latMin: 26.6,
  latMax: 27.0,
  lngMin: 80.7,
  lngMax: 81.2,
};

function inLucknow(lat: number, lng: number): boolean {
  return (
    lat >= LKO_BBOX.latMin &&
    lat <= LKO_BBOX.latMax &&
    lng >= LKO_BBOX.lngMin &&
    lng <= LKO_BBOX.lngMax
  );
}

export default function MapPasteResolver({
  onResolved,
  label = "Paste a Google Maps link, Plus Code, or coords",
}: {
  /** Fired when the server returns valid coordinates. The parent owns
   *  the actual lat/lng form-state, this component never persists. */
  onResolved: (lat: string, lng: string) => void;
  label?: string;
}) {
  const [paste, setPaste] = useState("");
  const [resolving, setResolving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle" });

  async function resolve(): Promise<void> {
    const input = paste.trim();
    if (!input) return;
    // Telemetry: input_len is a coarse signal for "are admins pasting
    // full URLs (long) or raw lat/lng (short)?" without leaking the
    // actual URL into GA. Keep it bounded so we don't accidentally
    // ship a 4 KB URL into a GA param (GA caps param values anyway).
    trackEvent("admin_maps_resolve_attempt", { input_len: input.length });
    setResolving(true);
    setFeedback({ kind: "idle" });
    try {
      const res = await fetch("/api/admin/resolve-coords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        lat?: number;
        lng?: number;
        source?: string;
        inLucknow?: boolean;
        error?: string;
        detail?: string;
      };
      if (
        !res.ok ||
        !json.ok ||
        typeof json.lat !== "number" ||
        typeof json.lng !== "number"
      ) {
        const message =
          json.detail ??
          json.error ??
          "Couldn't extract coordinates from that input.";
        // Slice the message so a long server-side stack-ish string
        // doesn't get sent to GA (params cap at 100 chars per value).
        trackEvent("admin_maps_resolve_error", { msg: message.slice(0, 90) });
        setFeedback({ kind: "err", message });
        return;
      }
      onResolved(json.lat.toFixed(6), json.lng.toFixed(6));
      const inBox =
        typeof json.inLucknow === "boolean"
          ? json.inLucknow
          : inLucknow(json.lat, json.lng);
      trackEvent("admin_maps_resolve_success", {
        source: json.source ?? "resolved",
        in_lucknow: inBox,
      });
      setFeedback({
        kind: "ok",
        source: json.source ?? "resolved",
        inLucknow: inBox,
      });
      setPaste("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      trackEvent("admin_maps_resolve_error", { msg: message.slice(0, 90) });
      setFeedback({ kind: "err", message });
    } finally {
      setResolving(false);
    }
  }

  return (
    <label className="grid gap-1.5">
      <span className="text-sm text-ink-600">{label}</span>
      <div className="flex gap-2">
        <input
          type="text"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void resolve();
            }
          }}
          placeholder="https://maps.app.goo.gl/…  ·  VXR6+QP Lucknow  ·  26.89,80.96"
          className="flex-1 rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
        />
        <button
          type="button"
          onClick={() => void resolve()}
          disabled={resolving || !paste.trim()}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-4 py-2 text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resolving ? (
            <>
              <Spinner />
              Resolving…
            </>
          ) : (
            "Resolve"
          )}
        </button>
      </div>
      {feedback.kind === "ok" ? (
        <span className="text-xs text-leaf-600">
          ✓ Coordinates filled from {feedback.source.replace(/_/g, " ")}.
          {!feedback.inLucknow ? (
            <span className="ml-1 text-alert-500">
              ⚠ Outside Lucknow bbox, double-check before saving.
            </span>
          ) : null}
        </span>
      ) : feedback.kind === "err" ? (
        <span className="text-xs text-alert-500">{feedback.message}</span>
      ) : (
        <span className="text-xs text-ink-600">
          On Google Maps: search the venue → Share → Copy link → paste here.
        </span>
      )}
    </label>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 motion-safe:animate-spin rounded-full border-2 border-cream-50/40 border-t-cream-50"
    />
  );
}
