"use client";

import { useState } from "react";

/**
 * Admin-only coordinate picker. Wraps the existing `lat` and `lng`
 * number inputs and adds a "paste anything Google-Maps-y" helper on
 * top that figures out the coordinates for you.
 *
 * What it understands (server resolves the heavy cases via
 * /api/admin/resolve-coords):
 *   • Raw `26.89,80.96`
 *   • Full Maps URL: `https://www.google.com/maps/place/.../@LAT,LNG,...`
 *   • Short Maps URL: `https://maps.app.goo.gl/xyz`
 *   • Plus Code: `VXR6+QP Lucknow`
 *
 * The lat/lng <input> fields below the helper are the actual form
 * fields (their `name="lat"` / `name="lng"` is what the server
 * action reads). The helper just *writes* their values via React
 * state, no shadow fields, no double-source-of-truth bugs.
 *
 * Why this exists:
 *   Hand-typing coordinates is error-prone and slow. The most
 *   common failure mode was bot-ingested rows getting published
 *   with lat=lng=0 because the admin didn't have time to look up
 *   coordinates from a Google Maps link. Now the admin pastes the
 *   link, clicks Resolve, and the fields fill in one second.
 */
type Props = {
  initialLat: number;
  initialLng: number;
};

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

export default function MapLocationInput({ initialLat, initialLng }: Props) {
  const [lat, setLat] = useState<string>(String(initialLat));
  const [lng, setLng] = useState<string>(String(initialLng));
  const [paste, setPaste] = useState<string>("");
  const [resolving, setResolving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<
    | { kind: "idle" }
    | { kind: "ok"; source: string; inLucknow: boolean }
    | { kind: "err"; message: string }
  >({ kind: "idle" });

  const latNum = Number(lat);
  const lngNum = Number(lng);
  const hasCoords = Number.isFinite(latNum) && Number.isFinite(lngNum) && (latNum !== 0 || lngNum !== 0);
  const coordsInLucknow = hasCoords && inLucknow(latNum, lngNum);

  async function resolve() {
    const input = paste.trim();
    if (!input) return;
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
      if (!res.ok || !json.ok || typeof json.lat !== "number" || typeof json.lng !== "number") {
        setFeedback({
          kind: "err",
          message:
            json.detail ??
            json.error ??
            "Couldn't extract coordinates from that input.",
        });
        return;
      }
      setLat(String(json.lat));
      setLng(String(json.lng));
      setFeedback({
        kind: "ok",
        source: json.source ?? "resolved",
        inLucknow: Boolean(json.inLucknow),
      });
      // Clear the paste box on success, keeps the workflow tidy
      // when the admin pastes → resolves → continues.
      setPaste("");
    } catch (err) {
      setFeedback({
        kind: "err",
        message: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="grid gap-3">
      {/* Paste-anything input */}
      <label className="grid gap-1.5">
        <span className="text-sm text-ink-600">
          Paste a Google Maps link, Plus Code, or coords
        </span>
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

      {/* Actual form fields, name="lat"/"lng" so the server action
          reads them. Number inputs preserve the keyboard-friendly UX
          for admins who already have coordinates handy. */}
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="grid gap-1.5">
          <span className="text-sm text-ink-600">
            Latitude <span className="text-sindoor-700">*</span>
          </span>
          <input
            name="lat"
            type="number"
            step="any"
            required
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
          />
          <span className="text-xs text-ink-600">Lucknow ≈ 26.6 – 27.0</span>
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm text-ink-600">
            Longitude <span className="text-sindoor-700">*</span>
          </span>
          <input
            name="lng"
            type="number"
            step="any"
            required
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
          />
          <span className="text-xs text-ink-600">Lucknow ≈ 80.7 – 81.2</span>
        </label>
      </div>

      {/* Status strip below the inputs, surfaces the most common
          footgun (lat=lng=0 silently published as a "null island"
          pin on the public map) BEFORE the admin clicks Save. */}
      {hasCoords ? (
        coordsInLucknow ? (
          <p className="text-xs text-leaf-600">
            ✓ Coords look correct for Lucknow.{" "}
            <a
              href={`https://www.google.com/maps?q=${latNum},${lngNum}&z=18`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted underline-offset-4 hover:text-leaf-600/80"
            >
              Preview on Google Maps ↗
            </a>
          </p>
        ) : (
          <p className="text-xs text-alert-500">
            ⚠ Coords ({latNum.toFixed(4)}, {lngNum.toFixed(4)}) are
            outside the Lucknow bounding box. The pin will display in
            the wrong city, verify before saving.
          </p>
        )
      ) : (
        <p className="text-xs text-alert-500">
          ⚠ Coordinates are 0,0, saving will publish the pin to the
          middle of the ocean. Paste a Maps link above or type the
          coordinates manually.
        </p>
      )}
    </div>
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
