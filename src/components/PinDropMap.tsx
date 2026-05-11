"use client";

/**
 * Tap-to-drop / drag-to-move pin map. Wraps the Ola Maps Web SDK.
 *
 * Props match the previous Leaflet implementation exactly so callers
 * (PinDropStep, SpotQuickForm) don't have to change:
 *   { lat, lng, onChange({lat, lng}), className? }
 *
 * Internally the map uses MapLibre's `[lng, lat]` order — we handle the
 * swap at the API boundary so nothing else in the codebase has to know.
 */

import { useEffect, useRef } from "react";
import {
  attachMapControls,
  createGadaMarkerElement,
  getOlaMapsClient,
  isOlaConfigured,
  styleForLocale,
} from "@/lib/olaMaps";
import { DEFAULT_CENTER } from "@/lib/lucknow";

type Props = {
  lat: number | null;
  lng: number | null;
  onChange: (latlng: { lat: number; lng: number }) => void;
  className?: string;
};

export default function PinDropMap({ lat, lng, onChange, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Loose types, OlaMaps types most things as `any`. We isolate the
  // `any` to these refs and use explicit shapes at API boundaries.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // One-time init.
  useEffect(() => {
    if (!isOlaConfigured()) return;

    let cancelled = false;

    // Microtask-deferred init — same Strict-Mode race fix as
    // BhandaraMap.tsx. See the long comment there for the full
    // explanation. Short version: deferring past React's strict-mode
    // mount/cleanup/remount cycle means the first (throw-away) mount
    // never reaches `new maplibregl.Map(...)`, so the container only
    // ever ends up with one canvas.
    queueMicrotask(() => {
      if (cancelled) return;
      void runInit();
    });

    async function runInit() {
      try {
        if (cancelled || !containerRef.current) return;
        const olaMaps = getOlaMapsClient();

        const startLat = lat ?? DEFAULT_CENTER.lat;
        const startLng = lng ?? DEFAULT_CENTER.lng;

        // Defensive: nuke any stray canvas from a previous run.
        containerRef.current.replaceChildren();

        const map = await olaMaps.init({
          style: styleForLocale("en"),
          container: containerRef.current,
          center: [startLng, startLat], // MapLibre order: [lng, lat]
          zoom: 13,
          // Don't hijack page scrolling — same UX as the Leaflet version.
          scrollZoom: false,
        });

        if (cancelled) {
          map?.remove?.();
          return;
        }
        mapRef.current = map;

        // Zoom + "find my location" controls — sit in the top-right
        // corner so they don't fight the form fields below the map.
        attachMapControls(map, { showGeolocate: true, position: "top-right" });

        // Swallow non-fatal style errors. We filter out the two messages
        // Ola's standard style produces on every map init since they're
        // harmless noise (see BhandaraMap for the same handler).
        map.on("error", (e: { error?: { message?: string } }) => {
          const msg = e?.error?.message ?? "";
          if (
            msg.includes("3d_model") ||
            msg.includes("Source layer") ||
            msg.includes("Expected value to be of type")
          ) {
            return;
          }
          if (process.env.NODE_ENV !== "production") {
            console.warn("[PinDropMap] non-fatal map error:", msg || e);
          }
        });

        // Same sprite-image fallback as the city map — drop a 1×1
        // transparent placeholder for any icon Ola's style requests
        // that isn't in the actual sprite atlas.
        map.on("styleimagemissing", (e: { id: string }) => {
          if (!map.hasImage?.(e.id)) {
            try {
              map.addImage(e.id, {
                width: 1,
                height: 1,
                data: new Uint8Array(4),
              });
            } catch {
              /* concurrent add — ignore */
            }
          }
        });

        // Click → drop / move marker, emit coords.
        map.on("click", (e: { lngLat: { lng: number; lat: number } }) => {
          const lat = e.lngLat.lat;
          const lng = e.lngLat.lng;
          placeMarkerAt(lat, lng);
          onChangeRef.current({ lat, lng });
        });

        if (lat != null && lng != null) {
          placeMarkerAt(lat, lng);
        }
      } catch (err) {
        // Map init failed — log so devs see why; UI stays in the
        // empty-map placeholder state.
        console.error("[PinDropMap] Ola Maps init failed:", err);
      }
    }

    return () => {
      cancelled = true;
      try {
        markerRef.current?.remove?.();
      } catch {
        /* ignore */
      }
      try {
        mapRef.current?.remove?.();
      } catch {
        /* ignore */
      }
      markerRef.current = null;
      mapRef.current = null;
    };
    // Initialise the map exactly once. Subsequent lat/lng updates flow
    // through the second effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External lat/lng changes (e.g. user picked a search suggestion) →
  // move the marker + recentre.
  useEffect(() => {
    if (lat == null || lng == null) return;
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
    } else {
      placeMarkerAt(lat, lng);
    }
    try {
      map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom?.() ?? 13, 16), duration: 450 });
    } catch {
      /* flyTo can throw mid-load; ignore */
    }
  }, [lat, lng]);

  function placeMarkerAt(latNum: number, lngNum: number) {
    const olaMaps = (() => {
      try {
        return getOlaMapsClient();
      } catch {
        return null;
      }
    })();
    const map = mapRef.current;
    if (!olaMaps || !map) return;

    if (markerRef.current) {
      markerRef.current.setLngLat([lngNum, latNum]);
      return;
    }

    const el = createGadaMarkerElement({ size: 42 });
    // `anchor: "bottom"` locks the gada's tip to the geographic point
    // at every zoom (the previous pixel-offset hack drifted at
    // non-default zooms because the offset stayed constant in pixels
    // while each pixel covered different ground area). Mirror of the
    // fix in BhandaraMap.tsx.
    const marker = olaMaps
      .addMarker({
        element: el,
        anchor: "bottom",
        draggable: true,
      })
      .setLngLat([lngNum, latNum])
      .addTo(map);

    marker.on("dragend", () => {
      const ll = marker.getLngLat();
      onChangeRef.current({ lat: ll.lat, lng: ll.lng });
    });
    markerRef.current = marker;
  }

  return (
    <div
      ref={containerRef}
      // `position: relative` is critical — MapLibre injects its canvas
      // as `position: absolute; top: 0; left: 0; width:100%; height:100%`
      // and pins to the nearest positioned ancestor. Without this style
      // the canvas escapes the container and renders at the page body's
      // top-left corner (see the broken-layout bug fix). Inline style
      // beats Tailwind's `relative` class because it can't be missed by
      // a caller passing a custom className that omits `relative`.
      style={{ position: "relative" }}
      className={
        className ??
        "h-[60vh] sm:h-[420px] w-full rounded-2xl overflow-hidden border border-gold-500/40 bg-saffron-50"
      }
      role="region"
      aria-label="Drop a pin to choose your bhandara location"
    />
  );
}
