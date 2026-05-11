/**
 * Shared Ola Maps client + brand-themed marker helpers.
 *
 * Every map component on the site (BhandaraMap, PinDropMap, …) goes
 * through this module so we only pay one SDK initialisation cost per
 * page load and the marker styling stays consistent.
 *
 * The Ola Maps Web SDK is a thin wrapper around MapLibre GL, so the
 * underlying map / marker objects accept all the usual MapLibre options
 * (centre as `[lng, lat]`, not `[lat, lng]` — note the order swap from
 * Leaflet).
 *
 * Key, restrictions, billing: see `.env.local` + the Ola Krutrim console.
 */

"use client";

import { OlaMaps } from "olamaps-web-sdk";

export const OLA_API_KEY =
  process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY ?? "";

/**
 * Default map style — light/standard variant carries the full POI set
 * (shops, landmarks, hospitals, …) and Ola's polished cartography. The
 * busier visuals are intentional; users navigating to a bhandara want
 * the landmarks around it as orientation cues.
 *
 * Both `map.on('error', …)` and `map.on('styleimagemissing', …)` are
 * wired in every map component to swallow non-fatal style/sprite
 * warnings this style occasionally fires (Ola's bug, harmless).
 */
export const OLA_DEFAULT_STYLE =
  "https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json";

/**
 * Hindi-locale map style — same standard variant with देवनागरी place
 * names. Used when the user's locale is `hi`.
 */
export const OLA_HINDI_STYLE =
  "https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard-hi/style.json";

let _client: OlaMaps | null = null;

/**
 * Lazily create (and reuse) the single OlaMaps client. Throws a
 * descriptive error if the env key is missing — every caller is expected
 * to catch this and degrade gracefully (the UI shows a "map unavailable"
 * placeholder rather than a white square).
 */
export function getOlaMapsClient(): OlaMaps {
  if (!OLA_API_KEY) {
    throw new Error(
      "NEXT_PUBLIC_OLA_MAPS_API_KEY is missing, map cannot initialise. Check .env.local and Netlify env vars.",
    );
  }
  if (!_client) {
    _client = new OlaMaps({ apiKey: OLA_API_KEY });
  }
  return _client;
}

/** Quick check used by components to short-circuit before any SDK work. */
export function isOlaConfigured(): boolean {
  return Boolean(OLA_API_KEY);
}

/** Pick the right style URL based on locale. */
export function styleForLocale(locale: "hi" | "en"): string {
  return locale === "hi" ? OLA_HINDI_STYLE : OLA_DEFAULT_STYLE;
}

/**
 * Build the DOM element used as a custom marker — wraps the commissioned
 * `gada` (mace) SVG with optional pulse halo + sponsor ring.
 *
 * MapLibre expects an actual HTMLElement (not a string of HTML), so we
 * build the DOM tree in JS. Returning a fresh element each call keeps
 * markers independent — the same node can't be appended to multiple
 * markers without breaking.
 */
export function createGadaMarkerElement(opts?: {
  size?: number; // px (width). Height auto-scales to keep the 38×46 aspect.
  /** Adds an extra outer ring for sponsored listings. */
  sponsored?: boolean;
}): HTMLDivElement {
  const width = opts?.size ?? 38;
  const height = Math.round((width * 46) / 38);

  const wrapper = document.createElement("div");
  wrapper.className = "bm-pin-wrap";
  wrapper.style.cssText = `position:relative;display:inline-block;width:${width}px;height:${height}px;filter:drop-shadow(0 2px 3px rgba(26,20,16,0.32));cursor:pointer;`;

  const img = document.createElement("img");
  img.src = "/brand/map-pin-gada.svg";
  img.alt = "";
  img.width = width;
  img.height = height;
  img.style.cssText = `display:block;width:${width}px;height:${height}px;object-fit:contain;`;
  wrapper.appendChild(img);

  // Halo for click-pulse animation. CSS keyframe `bm-pin-pulse` is defined
  // in globals.css; we add the `pin-pulse` class on marker click and
  // remove it after the animation finishes.
  const halo = document.createElement("span");
  halo.className = "pin-halo";
  halo.setAttribute("aria-hidden", "true");
  halo.style.cssText =
    "position:absolute;inset:-6px;border-radius:9999px;pointer-events:none;";
  wrapper.appendChild(halo);

  if (opts?.sponsored) {
    const ring = document.createElement("span");
    ring.setAttribute("aria-hidden", "true");
    ring.style.cssText =
      "position:absolute;inset:-4px;border-radius:9999px;border:2px solid #C9A24A;box-shadow:0 0 0 1px rgba(242,148,76,0.6);pointer-events:none;";
    wrapper.appendChild(ring);
  }

  return wrapper;
}

/**
 * Live-spot marker — the same gada (mace) icon used for listed
 * bhandaras, wrapped in a continuous saffron pulse ring so it reads as
 * "live, just spotted" without breaking the visual language between
 * listed and spotted pins.
 *
 * Replaces the previous "saffron disc + 🪔 emoji" design: unifying on
 * the gada makes filtering between listed/spotted feel like a tag, not
 * a different category of pin.
 */
export function createLiveSpotMarkerElement(): HTMLDivElement {
  const wrapper = document.createElement("div");
  // `bm-livepin` is kept on the wrapper so existing CSS / hover targets
  // still hit. `bm-pin-wrap` is added too so the same hover-scale rule
  // applies to spotted pins as to listed ones.
  wrapper.className = "bm-livepin bm-pin-wrap";
  wrapper.style.cssText =
    "position:relative;display:inline-block;width:42px;height:50px;filter:drop-shadow(0 2px 3px rgba(26,20,16,0.34));cursor:pointer;";

  // Pulsing saffron ring sitting BEHIND the gada. Inset kept close to
  // the pin (-3px) and animated with the tighter `bm-pin-ring` keyframe
  // (scale 0.9 → 1.45) so the ripple reads as a warm halo, not a wide
  // wave. The wider `bm-live-ping` keyframe stays available for the
  // small saffron-disc legend dot in MapBoard.
  const ring = document.createElement("span");
  ring.setAttribute("aria-hidden", "true");
  ring.style.cssText =
    "position:absolute;inset:-3px;border-radius:9999px;border:2px solid #F2944C;opacity:0.85;animation:bm-pin-ring 1.6s ease-out infinite;pointer-events:none;";
  wrapper.appendChild(ring);

  // Soft saffron halo (steady, no animation) — gives the pin a warm
  // glow even between ping pulses.
  const halo = document.createElement("span");
  halo.setAttribute("aria-hidden", "true");
  halo.style.cssText =
    "position:absolute;inset:-4px;border-radius:9999px;background:radial-gradient(closest-side, rgba(242,148,76,0.40), rgba(242,148,76,0) 70%);pointer-events:none;";
  wrapper.appendChild(halo);

  // The gada itself — same SVG, slightly smaller than the listed
  // variant so the ring around it has visual breathing room.
  const img = document.createElement("img");
  img.src = "/brand/map-pin-gada.svg";
  img.alt = "";
  img.width = 42;
  img.height = 50;
  img.style.cssText =
    "position:relative;display:block;width:42px;height:50px;object-fit:contain;";
  wrapper.appendChild(img);

  return wrapper;
}

/**
 * Attach the standard MapLibre zoom + compass + (optionally) geolocate
 * controls to a map. Called by both BhandaraMap and PinDropMap so the
 * positioning, styling, and feature-flag stay consistent.
 *
 * The Ola SDK exposes its control classes as static properties on the
 * `OlaMaps` class. We instantiate via `OlaMaps.NavigationControl` (and
 * friends) rather than constructing maplibre's own classes directly,
 * since maplibre-gl isn't an installed peer.
 *
 * Returns the list of control instances so the caller can detach them
 * on unmount if needed (most components just let the map's own remove()
 * tear everything down together).
 */
export function attachMapControls(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: any,
  opts?: {
    /** Whether to also add a "find my location" control. Default true. */
    showGeolocate?: boolean;
    /** Whether to show the compass / rotation arrow. Default false — the
     *  map doesn't rotate, so the compass is noise. */
    showCompass?: boolean;
    /** Corner placement. Defaults to top-right. */
    position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  const position = opts?.position ?? "top-right";
  const showGeolocate = opts?.showGeolocate ?? true;
  const showCompass = opts?.showCompass ?? false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attached: any[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Nav = (OlaMaps as any).NavigationControl;
    if (Nav) {
      const nav = new Nav({ showCompass, showZoom: true });
      map.addControl(nav, position);
      attached.push(nav);
    }
    if (showGeolocate) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Geo = (OlaMaps as any).GeolocateControl;
      if (Geo) {
        const geo = new Geo({
          positionOptions: { enableHighAccuracy: true, timeout: 10000 },
          trackUserLocation: false,
          showAccuracyCircle: true,
        });
        map.addControl(geo, position);
        attached.push(geo);
      }
    }
  } catch (err) {
    // Controls aren't critical — log and move on if the SDK refuses.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[olaMaps] failed to attach controls:", err);
    }
  }
  return attached;
}

/**
 * Convenience: trigger the gold-ring pulse animation on a marker DOM
 * element. Called by the city map when a pin is clicked so the user
 * gets feedback even when the click-handler navigates away.
 */
export function pulseMarkerHalo(markerEl: HTMLElement): void {
  const halo = markerEl.querySelector(".pin-halo");
  if (!(halo instanceof HTMLElement)) return;
  halo.classList.remove("pin-pulse");
  // Force reflow so the animation restarts.
  void halo.offsetWidth;
  halo.classList.add("pin-pulse");
  window.setTimeout(() => halo.classList.remove("pin-pulse"), 800);
}
