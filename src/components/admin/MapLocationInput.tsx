"use client";

import { useState } from "react";
import { IconCheck } from "@/components/admin/AdminIcons";

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
  /** When true, the lat/lng inputs lose their `required` attribute
   *  and the helper hint above swaps to "(optional)". Used on the
   *  spot edit form where a spot without coords still has value
   *  (caption + photo on the feed; just doesn't appear on the map).
   *  Default false keeps the bhandara edit form's existing strict
   *  behavior unchanged. */
  optional?: boolean;
  /** When the server pre-filled the lat/lng on load (typically when
   *  the row was at 0,0 and we resolved a candidate via the geocode
   *  fallback chain, organizer / landmark / venue / etc.), pass the
   *  candidate tag here (e.g. "organizer+area", "landmark", "venue").
   *  We surface it as a small saffron "auto-resolved from X" notice
   *  so the operator sees that the pre-fill was a best-guess (not a
   *  human-confirmed pin) and can sanity-check before saving. */
  autoResolvedFrom?: string;
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

export default function MapLocationInput({
  initialLat,
  initialLng,
  optional = false,
  autoResolvedFrom,
}: Props) {
  const [lat, setLat] = useState<string>(String(initialLat));
  const [lng, setLng] = useState<string>(String(initialLng));
  const [paste, setPaste] = useState<string>("");
  const [resolving, setResolving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<
    | { kind: "idle" }
    | { kind: "ok"; source: string; inLucknow: boolean }
    | { kind: "err"; message: string }
  >(
    // Seed the feedback strip with the server-side auto-resolve hit
    // so the operator sees "auto-resolved from organizer+area" on
    // first paint, without having to click Resolve. The user can
    // overwrite by pasting a real Maps link if the auto-guess is
    // wrong, the same flow that handles the manual case.
    autoResolvedFrom
      ? {
          kind: "ok",
          source: `auto / ${autoResolvedFrom}`,
          inLucknow:
            Number.isFinite(initialLat) &&
            Number.isFinite(initialLng) &&
            initialLat >= 26.6 &&
            initialLat <= 27.0 &&
            initialLng >= 80.7 &&
            initialLng <= 81.2,
        }
      : { kind: "idle" },
  );

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
        <span className="text-sm text-cream-50/65">
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
            className="flex-1 rounded-xl border border-cyan-400/20 bg-[#080A10]/70 backdrop-blur-sm px-3 py-2 text-cream-50 font-mono placeholder:text-cream-50/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/45 focus:border-cyan-400/55 transition-colors"
          />
          <button
            type="button"
            onClick={() => void resolve()}
            disabled={resolving || !paste.trim()}
            className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-cream-50 font-mono font-semibold border border-cyan-300/40 px-4 py-2 text-sm shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
          <span className="text-xs text-leaf-400 inline-flex items-center gap-1.5">
            <IconCheck size={12} />
            <span>Coordinates filled from {feedback.source.replace(/_/g, " ")}.</span>
            {!feedback.inLucknow ? (
              <span className="ml-1 text-alert-500">
                ⚠ Outside Lucknow bbox, double-check before saving.
              </span>
            ) : null}
          </span>
        ) : feedback.kind === "err" ? (
          <span className="text-xs text-alert-500">{feedback.message}</span>
        ) : (
          <span className="text-xs text-cream-50/55 font-mono">
            On Google Maps: search the venue → Share → Copy link → paste here.
          </span>
        )}
      </label>

      {/* Actual form fields, name="lat"/"lng" so the server action
          reads them. Number inputs preserve the keyboard-friendly UX
          for admins who already have coordinates handy. */}
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="grid gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/70 font-mono">
            Latitude{" "}
            {optional ? (
              <span className="text-cream-50/50">(optional)</span>
            ) : (
              <span className="text-sindoor-300">*</span>
            )}
          </span>
          <input
            name="lat"
            type="number"
            step="any"
            required={!optional}
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className="rounded-xl border border-cyan-400/20 bg-[#080A10]/70 backdrop-blur-sm px-3 py-2 text-cream-50 font-mono placeholder:text-cream-50/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/45 focus:border-cyan-400/55 transition-colors"
          />
          <span className="text-xs text-cream-50/55 font-mono">Lucknow ≈ 26.6 – 27.0</span>
        </label>
        <label className="grid gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/70 font-mono">
            Longitude{" "}
            {optional ? (
              <span className="text-cream-50/50">(optional)</span>
            ) : (
              <span className="text-sindoor-300">*</span>
            )}
          </span>
          <input
            name="lng"
            type="number"
            step="any"
            required={!optional}
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            className="rounded-xl border border-cyan-400/20 bg-[#080A10]/70 backdrop-blur-sm px-3 py-2 text-cream-50 font-mono placeholder:text-cream-50/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/45 focus:border-cyan-400/55 transition-colors"
          />
          <span className="text-xs text-cream-50/55 font-mono">Lucknow ≈ 80.7 – 81.2</span>
        </label>
      </div>

      {/* Status strip below the inputs, surfaces the most common
          footgun (lat=lng=0 silently published as a "null island"
          pin on the public map) BEFORE the admin clicks Save. */}
      {hasCoords ? (
        coordsInLucknow ? (
          <p className="text-xs text-leaf-400 inline-flex items-center gap-1.5">
            <IconCheck size={12} />
            <span>Coords look correct for Lucknow.</span>{" "}
            <a
              href={`https://www.google.com/maps?q=${latNum},${lngNum}&z=18`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted underline-offset-4 hover:text-leaf-400/80"
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
