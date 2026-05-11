"use client";

/**
 * City map with bhandara markers + optional live-spot pins.
 *
 * Migrated from Leaflet → Ola Maps (which wraps MapLibre GL). Props are
 * unchanged so every caller (homepage MapBoard, /bhandara/[slug] detail
 * page) keeps working without modification.
 *
 * Coordinate order reminder: MapLibre uses `[lng, lat]`. We do the swap
 * at every API-boundary call below and accept `[lat, lng]` everywhere
 * else (props, brand consts, etc.) to keep the rest of the codebase
 * familiar.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  attachMapControls,
  createGadaMarkerElement,
  createLiveSpotMarkerElement,
  getOlaMapsClient,
  isOlaConfigured,
  pulseMarkerHalo,
  styleForLocale,
} from "@/lib/olaMaps";
import { DEFAULT_CENTER, DEFAULT_ZOOM } from "@/lib/lucknow";
import type { Bhandara } from "@/types/bhandara";

// Popup offset relative to the marker anchor point (= the coord, since
// markers are now bottom-anchored). The pin body extends ~46 px above
// the coord, so a popup that floats ABOVE the pin needs to clear the
// full pin height + a small breathing gap; a popup that flips below
// (when the user pans the pin near the top of the viewport) gets a
// smaller gap. MapLibre's anchor-keyed offset map handles all eight
// auto-flip directions; the four diagonals split the difference.
const PIN_POPUP_OFFSET: Record<string, [number, number]> = {
  top: [0, 6],
  bottom: [0, -54],
  left: [12, -22],
  right: [-12, -22],
  "top-left": [6, 0],
  "top-right": [-6, 0],
  "bottom-left": [6, -46],
  "bottom-right": [-6, -46],
  center: [0, 0],
};

export type LiveSpotPin = {
  id: string;
  lat: number;
  lng: number;
  caption: string | null;
  /** Photo uploaded with the spot, if any — shown as a thumbnail in the
   *  popup header so users see what was actually spotted. */
  photoUrl?: string | null;
  bhandaraSlug: string | null;
  bhandaraName: string | null;
};

type Props = {
  listings: Bhandara[];
  className?: string;
  onPinClick?: (b: Bhandara) => void;
  /** When set, overrides the auto-fit and centers the map here. */
  center?: { lat: number; lng: number };
  /** Zoom used when `center` is set or only one listing is present. */
  focusZoom?: number;
  /** Live spots (crowd-sourced sightings) to show as a pulsing layer. */
  liveSpots?: LiveSpotPin[];
};

export default function BhandaraMap({
  listings,
  className,
  onPinClick,
  center,
  focusZoom = 15,
  liveSpots,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  /** Keyed marker registry, kept for future features that need to look
   *  up a marker by its side-list entry key (`org:<id>` / `spot:<id>`).
   *  Currently unused but cheap to maintain. */
  const markerElByKey = useRef<Map<string, HTMLElement>>(new Map());
  /** The persistent MapLibre instance. Mounted once via Effect A
   *  below and reused for the component's entire lifetime — filter
   *  changes (All / Listed / Spotted) only touch the marker layer,
   *  never tear down the map itself. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  /** Markers currently on the map. Replaced wholesale by Effect B on
   *  every listings / liveSpots change — old markers `.remove()`,
   *  new ones get added. The map + tiles stay put. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  /** Stable single-popup-at-a-time gate, shared across re-renders of
   *  Effect B so a freshly-added marker's popup correctly closes the
   *  previously-open one (the gate used to live inside the combined
   *  effect's closure and reset on every prop change). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activePopupRef = useRef<any>(null);
  /** Bumped to `true` once the async init resolves. Effect B watches
   *  this so it can sync markers as soon as the map is ready, even
   *  if listings/liveSpots haven't changed since mount. */
  const [mapReady, setMapReady] = useState(false);
  /** Flips to true the moment the user manually pans or zooms the
   *  map. Effect B's fitBounds skips when this is set so the camera
   *  doesn't yank itself back to the "all pins in view" shot every
   *  time the user is mid-exploration. Reset to false implicitly on
   *  filter changes that meaningfully reshape the pin set (handled
   *  inside Effect B). */
  const userMovedMapRef = useRef(false);
  /** Set of marker IDs from the previous Effect B run. Used to
   *  decide whether the pin set changed materially (so we re-fit
   *  bounds) or whether it's the same set in a different reference
   *  (so we don't refit, preserving the user's current view + any
   *  open popup). */
  const prevMarkerKeysRef = useRef<string>("");

  // ────────────────────────────────────────────────────────────────
  // Effect A: mount the map ONCE on first render
  // ────────────────────────────────────────────────────────────────
  //
  // Previously this effect also rebuilt every marker, so its dep
  // array included `listings` and `liveSpots` — which meant flipping
  // the All/Listed/Spotted filter tore down the entire MapLibre
  // instance (canvas, tiles, controls) and re-initialised it from
  // scratch. Visible flash + 200-500 ms re-tile every click.
  //
  // The new split keeps this effect with empty deps so the map mounts
  // exactly once per component lifecycle, and a sibling effect (B,
  // below) handles marker sync when filters change. Marker `.remove()`
  // and `.addTo(map)` are cheap; nothing else has to re-init.
  //
  // The microtask deferral + StrictMode-race fix is preserved — see
  // the previous comment trail; that bug is structural to React 18
  // dev mode + MapLibre's sync canvas construction inside async init.
  useEffect(() => {
    if (!isOlaConfigured()) return;
    if (!ref.current) return;

    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      void runInit();
    });

    async function runInit() {
      try {
        if (cancelled || !ref.current) return;
        const olaMaps = getOlaMapsClient();

        const initialLat = center ? center.lat : DEFAULT_CENTER.lat;
        const initialLng = center ? center.lng : DEFAULT_CENTER.lng;
        const initialZoom = center ? focusZoom : DEFAULT_ZOOM;

        // Defensive: clear any stray canvas a previous run might have
        // left behind (HMR / fast edits / dev tooling).
        ref.current.replaceChildren();

        const map = await olaMaps.init({
          style: styleForLocale("en"),
          container: ref.current,
          center: [initialLng, initialLat],
          zoom: initialZoom,
          scrollZoom: false,
        });

        if (cancelled) {
          map?.remove?.();
          return;
        }

        attachMapControls(map, { showGeolocate: true, position: "top-right" });

        // Once the user starts panning or pinch-zooming the map, lock
        // in their viewport — Effect B's fitBounds will respect this
        // and stop refitting on incidental re-renders. MapLibre fires
        // `dragstart` for pans and `zoomstart` with an `originalEvent`
        // for user-initiated zooms (programmatic camera moves leave
        // `originalEvent` undefined, which is how we tell them apart).
        map.on("dragstart", () => {
          userMovedMapRef.current = true;
        });
        map.on("zoomstart", (e: { originalEvent?: Event }) => {
          if (e.originalEvent) {
            userMovedMapRef.current = true;
          }
        });

        // Known-benign Ola style noise filter — same list as before.
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
            console.warn("[BhandaraMap] non-fatal map error:", msg || e);
          }
        });
        // ── Strip POI clutter from the base style ─────────────────
        // Ola's standard style ships every commercial POI label in
        // the tile (gym, salon, ice-cream parlour, beer shop, …).
        // For a city map focused on bhandara discovery these compete
        // visually with our gada pins — the user's marker drowns
        // among unrelated shop labels at street-level zoom. We hide
        // every layer whose id flags it as POI / commercial / brand
        // content via the MapLibre style spec, leaving roads, place
        // labels, water bodies, parks, and transit stations untouched.
        //
        // Runs both on initial load and on style data updates (Ola
        // can re-fetch sprite/style chunks lazily as the user zooms).
        const POI_LAYER_PATTERNS = [
          "poi",
          "shop",
          "amenity",
          "leisure",
          "commercial",
          "brand",
          "office",
          "tourism",
          "restaurant",
          "cafe",
          "fast_food",
          "food",
          "hotel",
        ];
        const hidePoiLayers = () => {
          try {
            const layers = (map.getStyle?.()?.layers ?? []) as Array<{
              id: string;
              type?: string;
            }>;
            for (const layer of layers) {
              const id = layer.id?.toLowerCase?.() ?? "";
              if (layer.type !== "symbol" && layer.type !== "circle") continue;
              if (POI_LAYER_PATTERNS.some((p) => id.includes(p))) {
                try {
                  map.setLayoutProperty(layer.id, "visibility", "none");
                } catch {
                  /* layer disappeared mid-iteration — ignore */
                }
              }
            }
          } catch {
            /* style not ready yet — the styledata listener below
               will pick it up on the next event */
          }
        };
        // Initial pass once the style first loads, then again on any
        // styledata event (Ola sometimes ships layers in a later
        // delta). `idle` is the most reliable "style fully ready"
        // signal we have without a load-event subscription.
        map.on("load", hidePoiLayers);
        map.on("styledata", hidePoiLayers);
        // Fire once now in case the style had already loaded between
        // init() resolving and these listeners attaching.
        hidePoiLayers();

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

        // Delegated click handler for popup "Copy link" buttons. Wired
        // here (Effect A) rather than per-marker so it survives marker
        // diffs in Effect B.
        const CHECK_SVG =
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
        const onCopyClick = (ev: MouseEvent) => {
          const t = ev.target as HTMLElement | null;
          const btn = t?.closest?.<HTMLButtonElement>("button[data-bm-copy]");
          if (!btn) return;
          const url = btn.getAttribute("data-bm-copy");
          if (!url) return;
          ev.preventDefault();
          try {
            void navigator.clipboard.writeText(url);
            const originalHTML = btn.innerHTML;
            const originalColor = btn.style.color;
            const originalBorderColor = btn.style.borderColor;
            const originalBackground = btn.style.background;
            btn.innerHTML = CHECK_SVG;
            btn.style.color = "#6A8D44";
            btn.style.borderColor = "rgba(106,141,68,0.55)";
            btn.style.background = "rgba(106,141,68,0.10)";
            window.setTimeout(() => {
              if (!btn.isConnected) return;
              btn.innerHTML = originalHTML;
              btn.style.color = originalColor;
              btn.style.borderColor = originalBorderColor;
              btn.style.background = originalBackground;
            }, 1400);
            window.dispatchEvent(
              new CustomEvent("bm:toast", { detail: { text: "Link copied" } }),
            );
          } catch {
            /* ignore */
          }
        };
        ref.current?.addEventListener("click", onCopyClick);
        (map as { __bmCopyHandler?: typeof onCopyClick }).__bmCopyHandler =
          onCopyClick;

        mapRef.current = map;
        setMapReady(true);
      } catch (err) {
        console.error("[BhandaraMap] Ola Maps init failed:", err);
      }
    }

    return () => {
      cancelled = true;
      const map = mapRef.current;
      if (map) {
        const handler = (map as { __bmCopyHandler?: (ev: MouseEvent) => void })
          .__bmCopyHandler;
        if (handler && ref.current) {
          ref.current.removeEventListener("click", handler);
        }
        for (const m of markersRef.current) {
          try {
            m.remove?.();
          } catch {
            /* ignore */
          }
        }
        markersRef.current = [];
        try {
          map.remove?.();
        } catch {
          /* ignore */
        }
        mapRef.current = null;
      }
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — map mounts once for the page's life

  // ────────────────────────────────────────────────────────────────
  // Effect B: sync markers when listings / liveSpots / handlers change
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const olaMaps = getOlaMapsClient();

    // Remove previous markers; they detach their own DOM + popups.
    for (const m of markersRef.current) {
      try {
        m.remove?.();
      } catch {
        /* ignore */
      }
    }
    markersRef.current = [];
    markerElByKey.current.clear();

    // Single-popup-at-a-time gate. Same logic as before but the
    // active-popup pointer lives on a ref so it survives across
    // Effect B re-runs (filter changes shouldn't reset who's open).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registerExclusive = (popup: any) => {
      popup.on?.("open", () => {
        if (activePopupRef.current && activePopupRef.current !== popup) {
          try {
            activePopupRef.current.remove();
          } catch {
            /* already removed */
          }
        }
        activePopupRef.current = popup;
      });
      popup.on?.("close", () => {
        if (activePopupRef.current === popup) activePopupRef.current = null;
      });
    };

    const bounds: [number, number][] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newMarkers: any[] = [];

    for (const l of listings) {
      const el = createGadaMarkerElement({
        size: 38,
        sponsored: Boolean(l.isSponsored),
      });
      el.title = `${l.name}, ${l.area}`;

      const popupHtml = buildListedBhandaraPopupHtml(l);
      const popup = olaMaps
        .addPopup({
          offset: PIN_POPUP_OFFSET,
          closeButton: true,
          className: "bm-listed-popup-wrap",
          maxWidth: "340px",
        })
        .setHTML(popupHtml);
      registerExclusive(popup);

      const marker = olaMaps
        .addMarker({ element: el, anchor: "bottom" })
        .setLngLat([l.lng, l.lat])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        pulseMarkerHalo(el);
        if (onPinClick) {
          onPinClick(l);
          return;
        }
        try {
          marker.togglePopup();
        } catch {
          router.push(`/bhandara/${l.slug}`);
        }
      });

      newMarkers.push(marker);
      bounds.push([l.lng, l.lat]);
      markerElByKey.current.set(`org:${l.id}`, el);
    }

    if (liveSpots && liveSpots.length > 0) {
      for (const s of liveSpots) {
        const el = createLiveSpotMarkerElement();
        const popupHtml = buildSpotPopupHtml(s);
        const popup = olaMaps
          .addPopup({
            offset: PIN_POPUP_OFFSET,
            closeButton: true,
            className: "bm-spot-popup-wrap",
            maxWidth: "320px",
          })
          .setHTML(popupHtml);
        registerExclusive(popup);
        const marker = olaMaps
          .addMarker({ element: el, anchor: "bottom" })
          .setLngLat([s.lng, s.lat])
          .setPopup(popup)
          .addTo(map);
        newMarkers.push(marker);
        bounds.push([s.lng, s.lat]);
        markerElByKey.current.set(`spot:${s.id}`, el);
      }
    }

    markersRef.current = newMarkers;

    // Compute a stable signature of the current pin set so we can
    // decide whether to refit the camera. Joining sorted keys gives
    // us "have the pins meaningfully changed?" without doing a
    // membership diff. The shape includes counts so a same-IDs but
    // different-coords scenario (admin edit) still triggers a refit.
    const newKeys = [
      ...listings.map((l) => `o:${l.id}`),
      ...(liveSpots ?? []).map((s) => `s:${s.id}`),
    ]
      .sort()
      .join(",");
    const pinsChanged = newKeys !== prevMarkerKeysRef.current;
    prevMarkerKeysRef.current = newKeys;

    // Auto-fit rules:
    //   1. Skip if `center` was explicitly passed (detail page case).
    //   2. Skip if the pin set is identical to the previous render —
    //      Effect B re-fires on unrelated prop changes; refitting in
    //      that case is exactly the "map keeps zooming out + popup
    //      closes" symptom the visitor was complaining about.
    //   3. Skip if the user has manually panned / pinch-zoomed —
    //      they've taken control; respect their viewport.
    //   4. When a filter change DOES reshape the pin set, reset the
    //      user-moved flag so the next refit will run, and ease the
    //      camera with a 400 ms animation.
    const shouldRefit =
      !center && pinsChanged && bounds.length > 0;
    if (shouldRefit) {
      // Filter changed meaningfully — let the camera re-frame.
      userMovedMapRef.current = false;
    }
    if (shouldRefit && !userMovedMapRef.current) {
      if (bounds.length > 1) {
        const lngs = bounds.map((p) => p[0]);
        const lats = bounds.map((p) => p[1]);
        const sw: [number, number] = [
          Math.min(...lngs),
          Math.min(...lats),
        ];
        const ne: [number, number] = [
          Math.max(...lngs),
          Math.max(...lats),
        ];
        try {
          map.fitBounds([sw, ne], {
            padding: 60,
            maxZoom: 14,
            duration: 400,
          });
        } catch {
          /* style not loaded yet — fine, default centre stands */
        }
      } else if (bounds.length === 1) {
        try {
          map.easeTo({ center: bounds[0], duration: 400 });
        } catch {
          /* ignore */
        }
      }
    }
  }, [mapReady, listings, liveSpots, onPinClick, router, center]);

  return (
    <div
      ref={ref}
      // Inline `position: relative` so MapLibre's absolutely-positioned
      // canvas always pins to this container, never to a distant
      // positioned ancestor (or the page body). See PinDropMap for the
      // full story — same bug bites both maps.
      style={{ position: "relative" }}
      className={
        className ??
        "h-[420px] sm:h-[520px] w-full rounded-2xl overflow-hidden border border-gold-500/40 bg-saffron-50"
      }
      role="region"
      aria-label="Map of Bada Mangal bhandaras in Lucknow"
    />
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Live-spot popup. No header strip, the pulsing saffron ring on the
 * marker itself already signals "live". Card opens with the spot photo
 * (if uploaded) as a 16:9 hero, then the bhandara/spot name, optional
 * caption as an italic pull-quote, and a single-line CTA row:
 *
 *   [   Directions   ] [   Share   ] [📋]
 *
 * Width set to 296px so the three CTAs fit on one line without
 * wrapping; Copy collapses to an icon-only round button on the right.
 */
function buildSpotPopupHtml(s: LiveSpotPin): string {
  const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`;
  const mapsUrl = `https://www.google.com/maps?q=${s.lat},${s.lng}&z=18`;
  const shareText = s.caption
    ? `${s.caption}, live at ${mapsUrl}`
    : `Live bhandara spotted: ${mapsUrl}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const headline = s.bhandaraName ?? "Spotted live";
  const photo = s.photoUrl ?? null;

  return `
    <div class="bm-spot-popup" style="font-family:'Mukta',system-ui,sans-serif;width:296px;color:#1A1410;background:#FFFFFF;">
      ${photo ? buildPhotoBlock(photo) : ""}
      <div style="padding:14px 16px 16px;background:#FFFFFF;">
        <p style="margin:0;font-family:'Tiro Devanagari Hindi','Tiro Devanagari',serif;font-size:18px;line-height:1.25;color:#9C2A2A;font-weight:500;">${escapeHtml(headline)}</p>
        ${
          s.caption
            ? `<p style="margin:8px 0 0;padding:6px 0 6px 10px;font-size:13px;line-height:1.45;color:#1A1410;border-left:2px solid #F2944C;font-style:italic;">${escapeHtml(s.caption)}</p>`
            : ""
        }
        <div style="margin-top:14px;display:flex;align-items:stretch;gap:6px;">
          <a href="${dirUrl}" target="_blank" rel="noopener noreferrer"
             data-ga="spot_popup_directions"
             style="flex:1 1 0;min-width:0;display:inline-flex;align-items:center;justify-content:center;gap:5px;background:#E07A1F;color:#FBF7F0;border-radius:9999px;padding:7px 10px;font-size:11.5px;font-weight:600;text-decoration:none;box-shadow:0 2px 6px rgba(224,122,31,0.30);white-space:nowrap;">
             <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 22s7-7.58 7-13a7 7 0 1 0-14 0c0 5.42 7 13 7 13zm0-10.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>
             Directions
          </a>
          <a href="${waUrl}" target="_blank" rel="noopener noreferrer"
             data-ga="spot_popup_whatsapp"
             style="flex:1 1 0;min-width:0;display:inline-flex;align-items:center;justify-content:center;gap:5px;border:1px solid rgba(106,141,68,0.55);color:#6A8D44;border-radius:9999px;padding:6px 10px;font-size:11.5px;font-weight:600;text-decoration:none;background:#FFFFFF;white-space:nowrap;">
             <svg width="11" height="11" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M16 3C8.82 3 3 8.82 3 16c0 2.29.6 4.43 1.65 6.3L3 29l6.86-1.62A12.95 12.95 0 0 0 16 29c7.18 0 13-5.82 13-13S23.18 3 16 3zm0 23.5c-1.93 0-3.74-.5-5.32-1.4l-.38-.22-4.07.96.97-3.96-.25-.4A10.5 10.5 0 1 1 16 26.5z"/></svg>
             Share
          </a>
          <button type="button" data-bm-copy="${escapeHtml(mapsUrl)}" title="Copy link" aria-label="Copy link to this spot"
             style="flex:0 0 32px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(201,162,74,0.55);color:#9C2A2A;border-radius:9999px;width:32px;height:32px;padding:0;background:#FFFFFF;cursor:pointer;">
             <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
          </button>
        </div>
      </div>
    </div>`;
}

/**
 * Inline photo block used by both popups. The image is rendered with
 * `object-contain` so vertical posters / square shots / wide landscape
 * photos all show their full content without cropping. A blurred-and-
 * scaled copy of the same image sits behind it as a colour-aware fill,
 * so the blank area around a tall poster looks intentional rather than
 * an empty letterbox. Same trick used in the live-feed cards.
 */
function buildPhotoBlock(photoUrl: string): string {
  // Single-quoted in CSS url() so escapeHtml's `&"<>` escaping inside
  // the attribute is enough, the only special char that could break
  // is a literal single-quote, which never appears in Supabase Storage
  // filenames (UUID + extension).
  const safe = escapeHtml(photoUrl);
  return `<div style="position:relative;width:100%;height:170px;overflow:hidden;background:#1A1410;">
    <span aria-hidden="true" style="position:absolute;inset:0;background-image:url('${safe}');background-size:cover;background-position:center;filter:blur(28px) saturate(1.1);transform:scale(1.15);opacity:0.55;"></span>
    <span aria-hidden="true" style="position:absolute;inset:0;background:rgba(26,20,16,0.18);"></span>
    <img src="${safe}" alt="" referrerpolicy="no-referrer" style="position:relative;display:block;width:100%;height:100%;object-fit:contain;" />
  </div>`;
}

/**
 * Listed-bhandara popup. Same card family as the spot popup, but
 * tuned for an organised listing, no "LIVE" pulse, primary CTA is
 * "View details" (deep-links to /bhandara/[slug]). Photo at top if
 * one is uploaded. Width 320px so the wider button labels
 * ("View details" + "Directions") fit without truncation.
 */
function buildListedBhandaraPopupHtml(b: Bhandara): string {
  const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`;
  const detailUrl = `/bhandara/${b.slug}`;
  const photo = b.photoUrl ?? null;
  const timeRange = (() => {
    const start = b.timeStart ? format12hShort(b.timeStart) : "";
    const end = b.timeEnd ? format12hShort(b.timeEnd) : "";
    if (start && end) return `${start} – ${end}`;
    return start || "";
  })();

  return `
    <div class="bm-listed-popup" style="font-family:'Mukta',system-ui,sans-serif;width:320px;color:#1A1410;background:#FFFFFF;">
      ${photo ? buildPhotoBlock(photo) : ""}
      <div style="padding:14px 16px 16px;background:#FFFFFF;">
        <p style="margin:0;font-family:'Tiro Devanagari Hindi','Tiro Devanagari',serif;font-size:18px;line-height:1.25;color:#9C2A2A;font-weight:500;">${escapeHtml(b.name)}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#6B5E51;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <span style="display:inline-flex;align-items:center;gap:3px;">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#E07A1F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6.5-7-6.5-12a6.5 6.5 0 1 1 13 0c0 5-6.5 12-6.5 12z"/><circle cx="12" cy="9" r="2.25"/></svg>
            ${escapeHtml(b.area)}
          </span>
          ${
            timeRange
              ? `<span aria-hidden style="color:#C9A24A;">·</span>
                <span style="display:inline-flex;align-items:center;gap:3px;">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#E07A1F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                  ${escapeHtml(timeRange)}
                </span>`
              : ""
          }
          ${
            b.isVerified
              ? `<span aria-hidden style="color:#C9A24A;">·</span>
                <span style="display:inline-flex;align-items:center;gap:3px;color:#6A8D44;font-weight:600;">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="#6A8D44" aria-hidden="true"><path d="M12 2 14.39 4.39 17.66 3.66 18.39 6.93 21.66 7.66 20.93 10.93 23.32 12 20.93 13.07 21.66 16.34 18.39 17.07 17.66 20.34 14.39 19.61 12 22 9.61 19.61 6.34 20.34 5.61 17.07 2.34 16.34 3.07 13.07 0.68 12 3.07 10.93 2.34 7.66 5.61 6.93 6.34 3.66 9.61 4.39z"/><path d="M9 12l2 2 4-4" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
                  Verified
                </span>`
              : ""
          }
        </p>
        ${
          b.description
            ? `<p style="margin:8px 0 0;padding:6px 0 6px 10px;font-size:13px;line-height:1.45;color:#1A1410;border-left:2px solid #F2944C;">${escapeHtml(b.description)}</p>`
            : ""
        }
        <div style="margin-top:14px;display:flex;align-items:stretch;gap:6px;">
          <a href="${escapeHtml(detailUrl)}"
             data-ga="listed_popup_view"
             style="flex:1 1 0;min-width:0;display:inline-flex;align-items:center;justify-content:center;gap:5px;background:#9C2A2A;color:#FBF7F0;border-radius:9999px;padding:7px 12px;font-size:11.5px;font-weight:600;text-decoration:none;box-shadow:0 2px 6px rgba(156,42,42,0.30);white-space:nowrap;">
             View details
          </a>
          <a href="${dirUrl}" target="_blank" rel="noopener noreferrer"
             data-ga="listed_popup_directions"
             style="flex:1 1 0;min-width:0;display:inline-flex;align-items:center;justify-content:center;gap:5px;background:#E07A1F;color:#FBF7F0;border-radius:9999px;padding:7px 12px;font-size:11.5px;font-weight:600;text-decoration:none;box-shadow:0 2px 6px rgba(224,122,31,0.30);white-space:nowrap;">
             <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 22s7-7.58 7-13a7 7 0 1 0-14 0c0 5.42 7 13 7 13zm0-10.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>
             Directions
          </a>
          <button type="button" data-bm-copy="${escapeHtml(`https://www.google.com/maps?q=${b.lat},${b.lng}&z=18`)}" title="Copy link" aria-label="Copy Google Maps link"
             style="flex:0 0 32px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(201,162,74,0.55);color:#9C2A2A;border-radius:9999px;width:32px;height:32px;padding:0;background:#FFFFFF;cursor:pointer;">
             <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
          </button>
        </div>
      </div>
    </div>`;
}

/** Short 12h time formatter for popup meta line ("11:00 AM" → "11 AM" cleanup). */
function format12hShort(time: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return time;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const display = ((h + 11) % 12) + 1;
  return min === 0
    ? `${display} ${period}`
    : `${display}:${String(min).padStart(2, "0")} ${period}`;
}
