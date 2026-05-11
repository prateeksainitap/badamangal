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

  // CRITICAL: MapLibre adds the `maplibregl-marker` class DIRECTLY to
  // the element we pass — it does NOT wrap our element in a parent.
  // That class brings `position: absolute` (essential for the marker to
  // float over the map canvas at its projected pixel) plus a per-frame
  // `transform: translate(...)` update. If we set `position: relative`
  // (or any other `position` value) inline on this element, our inline
  // style wins over the class rule and the marker falls back to flowing
  // in the document — at extreme zoom-out, where many markers project
  // to the same pixel, this manifests as a vertical line of pins
  // stacking by DOM order instead of clustering. THIS WAS THE BUG.
  //
  // Fix: do not set `position` on the outer element at all. Move the
  // halo/ring children into an inner relatively-positioned wrapper so
  // they still have a positioned ancestor to anchor to.
  const wrapper = document.createElement("div");
  wrapper.className = "bm-pin-wrap";
  wrapper.style.cssText = `width:${width}px;height:${height}px;cursor:pointer;`;

  // Inner positioning context. `position: relative` HERE is safe
  // because this element is purely ours — MapLibre never touches it.
  // The drop-shadow on this inner wrapper has been bumped (was
  // `0 2px 3px rgba(...,0.32)`) so the gada has a stronger lift
  // against the busier Ola base style — at high zoom, the tile
  // already carries native POI labels and our pin needs more visual
  // weight to win the focal contest.
  const inner = document.createElement("span");
  inner.style.cssText = `position:relative;display:block;width:${width}px;height:${height}px;filter:drop-shadow(0 3px 5px rgba(26,20,16,0.40)) drop-shadow(0 1px 1px rgba(26,20,16,0.30));`;
  wrapper.appendChild(inner);

  // Cream backdrop disc behind the gada head. Lifts the pin off any
  // remaining POI noise (small shop labels, road shields) by giving
  // the icon a high-contrast "sticker" surround. Sized to match the
  // gada's head (~58% of total height); the mace handle below
  // protrudes out naturally without a halo.
  const backdrop = document.createElement("span");
  backdrop.setAttribute("aria-hidden", "true");
  const discSize = Math.round(width * 0.78);
  const discLeft = Math.round((width - discSize) / 2);
  backdrop.style.cssText = `position:absolute;top:0;left:${discLeft}px;width:${discSize}px;height:${discSize}px;border-radius:9999px;background:#FBF7F0;border:1.5px solid rgba(201,162,74,0.55);box-shadow:0 1px 2px rgba(26,20,16,0.10) inset;pointer-events:none;`;
  inner.appendChild(backdrop);

  const img = document.createElement("img");
  img.src = "/brand/map-pin-gada.svg";
  img.alt = "";
  img.width = width;
  img.height = height;
  img.style.cssText = `position:relative;display:block;width:${width}px;height:${height}px;object-fit:contain;`;
  inner.appendChild(img);

  // Halo for click-pulse animation. Sits inside `inner` so its
  // `position: absolute; inset: -6px` anchors to the gada bounds.
  const halo = document.createElement("span");
  halo.className = "pin-halo";
  halo.setAttribute("aria-hidden", "true");
  halo.style.cssText =
    "position:absolute;inset:-6px;border-radius:9999px;pointer-events:none;";
  inner.appendChild(halo);

  if (opts?.sponsored) {
    const ring = document.createElement("span");
    ring.setAttribute("aria-hidden", "true");
    ring.style.cssText =
      "position:absolute;inset:-4px;border-radius:9999px;border:2px solid #C9A24A;box-shadow:0 0 0 1px rgba(242,148,76,0.6);pointer-events:none;";
    inner.appendChild(ring);
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
  // Same structural pattern as the listed-pin variant: outer element
  // is the one MapLibre receives (must keep its `position: absolute`
  // class rule, so we don't override `position` inline here), inner
  // span owns the relative positioning context for the halo + ring.
  const wrapper = document.createElement("div");
  wrapper.className = "bm-livepin bm-pin-wrap";
  wrapper.style.cssText = "width:42px;height:50px;cursor:pointer;";

  const inner = document.createElement("span");
  // Stronger stacked drop-shadow lifts the spot pin off Ola's busy
  // base style — same treatment as the listed variant.
  inner.style.cssText =
    "position:relative;display:block;width:42px;height:50px;filter:drop-shadow(0 3px 5px rgba(26,20,16,0.42)) drop-shadow(0 1px 1px rgba(26,20,16,0.30));";
  wrapper.appendChild(inner);

  // Cream backdrop disc behind the gada head — same "sticker ring"
  // treatment used on the listed pin so spotted pins also stand out
  // against any commercial POI noise the base style leaks through.
  // The pulse ring and steady halo below are anchored to this disc's
  // geometry rather than the wrapper's rectangle, so they read as
  // concentric circles instead of stretched ovals.
  const PIN_W = 42;
  const PIN_H = 50;
  const DISC_SIZE = Math.round(PIN_W * 0.78); // 33 px
  const DISC_LEFT = Math.round((PIN_W - DISC_SIZE) / 2);
  const DISC_CENTER_Y = Math.round(DISC_SIZE / 2); // disc anchored at top:0
  const RING_SIZE = DISC_SIZE + 6; // a hair larger than the disc

  // Steady saffron halo behind the disc — gives the pin a warm glow
  // between pulse cycles. Centered on the disc, perfectly circular.
  const halo = document.createElement("span");
  halo.setAttribute("aria-hidden", "true");
  halo.style.cssText = `position:absolute;top:${DISC_CENTER_Y - Math.round((DISC_SIZE + 14) / 2)}px;left:${Math.round((PIN_W - (DISC_SIZE + 14)) / 2)}px;width:${DISC_SIZE + 14}px;height:${DISC_SIZE + 14}px;border-radius:9999px;background:radial-gradient(closest-side, rgba(242,148,76,0.40), rgba(242,148,76,0) 70%);pointer-events:none;`;
  inner.appendChild(halo);

  // Pulsing saffron ring — fixed circular size centered on the disc,
  // so the bm-pin-ring keyframe's uniform scale animates a TRUE
  // circle rather than the previous wrapper-inset ellipse.
  const ring = document.createElement("span");
  ring.setAttribute("aria-hidden", "true");
  ring.style.cssText = `position:absolute;top:${DISC_CENTER_Y - Math.round(RING_SIZE / 2)}px;left:${Math.round((PIN_W - RING_SIZE) / 2)}px;width:${RING_SIZE}px;height:${RING_SIZE}px;border-radius:9999px;border:2px solid #F2944C;opacity:0.85;animation:bm-pin-ring 1.6s ease-out infinite;pointer-events:none;transform-origin:center center;`;
  inner.appendChild(ring);

  // Cream backdrop disc — the high-contrast "sticker" behind the
  // gada head. Drawn after halo + ring so the disc clips the animation
  // visually (ring expands from behind the disc, not over it).
  const backdrop = document.createElement("span");
  backdrop.setAttribute("aria-hidden", "true");
  backdrop.style.cssText = `position:absolute;top:0;left:${DISC_LEFT}px;width:${DISC_SIZE}px;height:${DISC_SIZE}px;border-radius:9999px;background:#FBF7F0;border:1.5px solid rgba(242,148,76,0.65);box-shadow:0 1px 2px rgba(26,20,16,0.10) inset;pointer-events:none;`;
  inner.appendChild(backdrop);

  // The gada itself — sits above the backdrop disc.
  const img = document.createElement("img");
  img.src = "/brand/map-pin-gada.svg";
  img.alt = "";
  img.width = PIN_W;
  img.height = PIN_H;
  img.style.cssText = `position:relative;display:block;width:${PIN_W}px;height:${PIN_H}px;object-fit:contain;`;
  inner.appendChild(img);

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
