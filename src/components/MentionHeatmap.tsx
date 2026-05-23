"use client";

/**
 * Mention-density heatmap for the homepage LiveChatterBoard.
 *
 * Bucket-based "where is the conversation hottest" overlay on top of a
 * small Ola Maps instance scoped to Lucknow. Not a true raster heatmap
 * (MapLibre's built-in `heatmap` layer needs raw map access we'd rather
 * not retrofit yet) — instead each ~500m grid cell with ≥1 mention
 * gets a translucent saffron disc marker whose colour intensity scales
 * with count.
 *
 * Why bucket-and-disc instead of one marker per mention:
 *   • Privacy: a 1:1 mention→pin map would expose individual locations
 *     even when the source mention's location was a fuzzy address
 *     geocode. Aggregating to a 500m cell adds spatial uncertainty
 *     comparable to a "neighbourhood" — the right level for a public
 *     "what's the city doing" view.
 *   • Performance: a 500m grid covers Lucknow with ~3,200 cells max,
 *     in practice <50 are populated at peak. Each cell is one DOM node
 *     vs hundreds of independent markers.
 *   • Visual clarity: stacked individual pins read as clutter; coloured
 *     cells read as a story.
 *
 * Polls the same /api/mentions/feed endpoint as the chatter feed but
 * with `?withCoords=1` so we don't pay for the text-only mentions we
 * can't render here. The parent component already pre-filters its
 * `mentions` prop to geo-only, so the in-component fetch is a refresh
 * loop for live updates, not the initial hydration.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getOlaMapsClient,
  isOlaConfigured,
  attachMapControls,
  OLA_DARK_STYLE,
} from "@/lib/olaMaps";

/** Mention with guaranteed coords (parent narrows the type). */
type GeoMention = {
  id: string;
  lat: number;
  lng: number;
  intent: "ASKING" | "SHARING" | "MENTIONING";
  locationLabel: string | null;
  locationSource: string;
  createdAt: string;
};

/** Lucknow centroid + sensible default zoom. Matches the values used
 *  by BhandaraMap so the heatmap reads as the same "city view" the
 *  main map opens on. */
const LKO_CENTER = { lat: 26.8467, lng: 80.9462 };
const DEFAULT_ZOOM = 11;

/** Grid resolution. 0.005° ≈ 500m at Lucknow's latitude. Smaller
 *  buckets give more spatial detail but balloon the marker count;
 *  500m is a good "neighbourhood block" granularity. */
const BUCKET_SIZE = 0.005;

/** Visual ramp: count → background colour. Tuned for the DARK map
 *  backdrop the homepage now uses — saturated oranges that read as
 *  warm-glow markers against the dark navy/charcoal tiles. Borders
 *  bump to near-opaque so cells stay crisp at the cell edge even
 *  over busy tile labels. */
const CELL_RAMP = [
  { min: 1, max: 1, bg: "rgba(242, 148, 76, 0.50)", border: "rgba(242, 148, 76, 0.85)" },     // 1: light saffron
  { min: 2, max: 3, bg: "rgba(242, 148, 76, 0.70)", border: "rgba(231, 110, 33, 0.95)" },     // 2-3: medium saffron
  { min: 4, max: 6, bg: "rgba(231, 110, 33, 0.85)", border: "rgba(193, 56, 24, 1.0)" },       // 4-6: dense saffron-red
  { min: 7, max: Infinity, bg: "rgba(193, 56, 24, 0.95)", border: "rgba(255, 220, 130, 0.95)" }, // 7+: deep red with gold ring
] as const;

function rampFor(count: number): (typeof CELL_RAMP)[number] {
  return CELL_RAMP.find((r) => count >= r.min && count <= r.max) ?? CELL_RAMP[0];
}

/** Replace the alpha channel of an rgba(...) string. Used to derive a
 *  faded version of a ramp colour for the cell's outer-glow gradient
 *  stop. Falls back to the input string for non-rgba inputs. */
function withAlpha(rgba: string, alpha: number): string {
  return rgba.replace(
    /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/,
    `rgba($1, $2, $3, ${alpha})`,
  );
}

/** Keyframes used by the per-cell breathing pulse + the freshly-
 *  arrived cell's ripple ring. Injected once at module load (idempotent
 *  via a sentinel class on <html>) so every MentionHeatmap on the page
 *  shares one stylesheet. Animations live in CSS, not JS, so they cost
 *  zero per-frame work after the initial paint.
 *
 *  Kept out of styled-jsx because the cell markers are raw DOM (not
 *  JSX), and styled-jsx's component-scoped classes wouldn't reach
 *  them. Global injection is the simplest way to expose keyframes to
 *  inline-styled DOM. */
if (typeof document !== "undefined") {
  const SENTINEL = "bm-heat-anims";
  if (!document.head.querySelector(`style[data-anim="${SENTINEL}"]`)) {
    const style = document.createElement("style");
    style.dataset.anim = SENTINEL;
    style.textContent = `
      /* Faster, livelier breathe. Old: 3.6s, scale 1↔1.06 — felt
         static at a glance. New: 1.6s, scale 1↔1.14, with the
         saffron glow halo also pulsing on the same cycle so the
         eye picks up motion even on a quiet panel. */
      @keyframes bm-heat-breathe {
        0%, 100% {
          transform: scale(1);
          opacity: 0.9;
          box-shadow:
            0 0 8px rgba(242, 148, 76, 0.32),
            0 2px 6px rgba(0, 0, 0, 0.4);
        }
        50% {
          transform: scale(1.14);
          opacity: 1;
          box-shadow:
            0 0 22px rgba(242, 148, 76, 0.7),
            0 2px 10px rgba(0, 0, 0, 0.5);
        }
      }
      /* Continuous outer halo — every cell now broadcasts a soft
         expanding ring all the time, not just the <60s-fresh ones.
         Reads as "live signal" rather than "marker on a map". */
      @keyframes bm-heat-halo {
        0%   { transform: translate(-50%, -50%) scale(0.85); opacity: 0.6; }
        100% { transform: translate(-50%, -50%) scale(1.9);  opacity: 0; }
      }
      .bm-heat-halo {
        animation: bm-heat-halo 1.8s ease-out infinite;
      }
      /* Fresh-mention ripple — same shape as before but punched up
         so a new arrival visibly stands out from the always-on halo:
         faster ring, brighter alpha at start, wider final scale. */
      @keyframes bm-heat-ripple {
        0%   { transform: translate(-50%, -50%) scale(1);   opacity: 0.95; }
        100% { transform: translate(-50%, -50%) scale(2.8); opacity: 0; }
      }
      .bm-heat-ripple {
        animation: bm-heat-ripple 1.2s ease-out forwards;
      }
      /* Respect reduced-motion: kill every animation. Cells still
         render in their static state, just don't move. */
      @media (prefers-reduced-motion: reduce) {
        .bm-heat-disc  { animation: none !important; }
        .bm-heat-halo  { animation: none !important; opacity: 0 !important; }
        .bm-heat-ripple { animation: none !important; opacity: 0 !important; }
      }
    `;
    document.head.appendChild(style);
  }
}

/** Cell radius scales gently with count so dense areas read bigger.
 *  Capped at 56px so a single super-busy zone doesn't smother its
 *  neighbours. */
function cellRadius(count: number): number {
  const base = 22;
  const grow = Math.min(34, count * 4);
  return base + grow;
}

type Cell = {
  key: string;
  lat: number; // centroid of the cell
  lng: number;
  count: number;
  /** Most recent mention timestamp in the cell, used for the cell's
   *  tooltip ("3 mentions, most recent 4m ago"). */
  mostRecent: Date;
  /** Unique location labels (Hazratganj, "near GPO", "Ram Mandir",
   *  etc.) that people actually mentioned in chat for this cell.
   *  Surfaced in the hover tooltip so an admin scanning the heatmap
   *  knows which venues the chatter clusters around, not just that
   *  there's chatter. Capped at the first 5 distinct labels per cell
   *  to keep the tooltip readable. */
  labels: string[];
};

/** Bucket a list of geo-mentions into cell aggregates. Cell centroid
 *  is the midpoint of the bucket, not the average of contained mentions
 *  — that way the cells tile cleanly even when mention density inside
 *  is uneven. */
function bucketMentions(mentions: GeoMention[]): Cell[] {
  const map = new Map<string, Cell>();
  for (const m of mentions) {
    const bLat = Math.floor(m.lat / BUCKET_SIZE);
    const bLng = Math.floor(m.lng / BUCKET_SIZE);
    const key = `${bLat}:${bLng}`;
    const created = new Date(m.createdAt);
    const label = m.locationLabel?.trim();
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      if (created > existing.mostRecent) existing.mostRecent = created;
      // Append the label only when it's distinct AND we still have
      // room (cap at 5). Case-insensitive compare so "Aliganj" and
      // "aliganj" collapse — chat language is messy.
      if (
        label &&
        existing.labels.length < 5 &&
        !existing.labels.some(
          (l) => l.toLowerCase() === label.toLowerCase(),
        )
      ) {
        existing.labels.push(label);
      }
    } else {
      map.set(key, {
        key,
        lat: (bLat + 0.5) * BUCKET_SIZE,
        lng: (bLng + 0.5) * BUCKET_SIZE,
        count: 1,
        mostRecent: created,
        labels: label ? [label] : [],
      });
    }
  }
  return [...map.values()];
}

/** Build the styled DIV that becomes a custom marker for a cell.
 *  Returns a fresh element every call (MapLibre requires per-marker
 *  DOM ownership).
 *
 *  Layered structure:
 *    • outer wrap  → MapLibre attaches its `maplibregl-marker` class;
 *      must NOT have any inline `position` set or stacking breaks at
 *      extreme zoom-out (markers fall back to document flow). Same
 *      caveat documented in lib/olaMaps.ts createGadaMarkerElement.
 *    • inner disc  → the actual coloured cell (radial-gradient bg
 *      for warm-glow feel). Has a slow per-cell breathing animation
 *      so the map feels alive even when nothing's incoming.
 *    • outer ring  → an expanding ripple, only on cells whose most-
 *      recent mention is < 60s old. Signals "this cell just got a new
 *      message"; fades out 60s after that mention. */
function buildCellElement(cell: Cell): HTMLDivElement {
  const ramp = rampFor(cell.count);
  const r = cellRadius(cell.count);
  const ageSec = Math.floor((Date.now() - cell.mostRecent.getTime()) / 1000);
  const isFresh = ageSec < 60; // ripple ring active during the first minute
  const breatheDelay = `-${(cell.lat * 1000) % 4}s`; // stagger via lat

  // CRITICAL: outer wrap is the element MapLibre receives. MapLibre
  // attaches its `.maplibregl-marker` class to it, which brings
  // `position: absolute` and a per-frame `transform: translate(px, px)`
  // that pins the marker to its lng/lat projection. If we set ANY
  // `position` value inline here, our inline style wins over the
  // class rule and the marker falls back to document flow, on
  // zoom/pan the cells drift away from their actual coordinates
  // (and at extreme zoom-out stack vertically by DOM order). Same
  // bug + fix as `createGadaMarkerElement` in lib/olaMaps.ts.
  //
  // The relative positioning context the ripple + disc need lives in
  // a child element (`relWrap`) that we own end-to-end.
  const wrap = document.createElement("div");
  wrap.className = "bm-heat-cell";
  wrap.style.cssText = `width:${r}px;height:${r}px;pointer-events:auto;cursor:default;`;

  const relWrap = document.createElement("span");
  relWrap.style.cssText = `position:relative;display:block;width:${r}px;height:${r}px;`;
  wrap.appendChild(relWrap);

  // Ripple ring — only rendered for fresh cells. CSS-keyframe expands
  // and fades out an outer ring once. We rebuild markers on every poll
  // tick (parent effect tears down + reattaches), so each rebuild
  // re-fires the animation on cells that are still inside the 60s
  // window. Pure decoration; pointer-events off so hovers still hit
  // the inner disc + its tooltip.
  // Always-on halo: a soft expanding ring every cell broadcasts at
  // 1.8s cadence. Reads as a live signal rather than a static
  // marker. Sits BEHIND the inner disc in DOM order — pointer-
  // events:none so hovers still hit the disc + its tooltip.
  const halo = document.createElement("span");
  halo.className = "bm-heat-halo";
  halo.style.cssText = [
    "position:absolute",
    "left:50%",
    "top:50%",
    `width:${r}px`,
    `height:${r}px`,
    "transform:translate(-50%,-50%) scale(0.85)",
    "border-radius:9999px",
    `border:1.5px solid ${withAlpha(ramp.border, 0.55)}`,
    "pointer-events:none",
    "opacity:0",
  ].join(";");
  relWrap.appendChild(halo);

  // Fresh-mention ripple: punchier ring that only fires when the
  // cell's most recent mention is < 60s old. Visibly louder than
  // the always-on halo so a brand-new arrival pops.
  if (isFresh) {
    const ripple = document.createElement("span");
    ripple.className = "bm-heat-ripple";
    ripple.style.cssText = [
      "position:absolute",
      "left:50%",
      "top:50%",
      `width:${r}px`,
      `height:${r}px`,
      "transform:translate(-50%,-50%)",
      "border-radius:9999px",
      `border:2px solid ${ramp.border}`,
      "pointer-events:none",
      "opacity:0",
    ].join(";");
    relWrap.appendChild(ripple);
  }

  const inner = document.createElement("span");
  inner.className = "bm-heat-disc";
  inner.style.cssText = [
    "position:absolute",
    "left:0",
    "top:0",
    "display:block",
    `width:${r}px`,
    `height:${r}px`,
    // Radial gradient: brighter at the centre, fade to ramp colour at
    // edge. Reads as a warm glow instead of a flat dot — more "living"
    // on the dark map.
    `background:radial-gradient(circle at 50% 50%, ${ramp.bg} 0%, ${ramp.bg} 60%, ${withAlpha(ramp.bg, 0.4)} 100%)`,
    `border:1.5px solid ${ramp.border}`,
    "border-radius:9999px",
    "box-shadow:0 0 12px rgba(242,148,76,0.35), 0 2px 6px rgba(0,0,0,0.4)",
    // Per-cell breathing — slow scale 1 ↔ 1.06 with a staggered start
    // (offset by latitude). Doesn't interfere with the ripple above
    // since they animate on different transform targets.
    "animation:bm-heat-breathe 3.6s ease-in-out infinite",
    `animation-delay:${breatheDelay}`,
  ].join(";");
  relWrap.appendChild(inner);
  const sec = Math.floor((Date.now() - cell.mostRecent.getTime()) / 1000);
  const ago =
    sec < 60
      ? `${sec}s`
      : sec < 3600
        ? `${Math.floor(sec / 60)}m`
        : `${Math.floor(sec / 3600)}h`;
  // Tooltip composition: count + recency + the actual location names
  // people mentioned in chat. Native title attribute renders multi-line
  // via \n (every major browser respects this) so we don't need a
  // custom hover popover for the read-only tooltip — the OS-styled
  // tooltip matches the rest of the map UI.
  const head = `${cell.count} mention${cell.count === 1 ? "" : "s"} · most recent ${ago} ago`;
  const labelLine =
    cell.labels.length > 0
      ? `\nMentioned: ${cell.labels.slice(0, 3).join(", ")}${
          cell.labels.length > 3 ? ` + ${cell.labels.length - 3} more` : ""
        }`
      : "";
  wrap.title = `${head}${labelLine}`;
  return wrap;
}

export default function MentionHeatmap({
  mentions,
}: {
  mentions: GeoMention[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);
  // Tracks whether we've done the one-shot auto-fit yet. Once true,
  // we leave the user's map view alone — subsequent polls don't
  // re-snap the camera back to the data bounds, which would feel
  // like the map is fighting them. New mentions still add cells; the
  // user can pan/zoom freely after first fit.
  const hasAutoFittedRef = useRef<boolean>(false);

  // ── Effect A: mount map once on first render ──────────────────
  // Same one-shot init pattern as BhandaraMap (microtask deferral to
  // dodge React 18 StrictMode double-invoke + MapLibre's sync canvas
  // attach race). Empty deps so the SDK boots exactly once per mount.
  useEffect(() => {
    if (!isOlaConfigured()) return;
    if (!containerRef.current) return;

    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      void runInit();
    });

    async function runInit() {
      try {
        if (cancelled || !containerRef.current) return;
        const olaMaps = getOlaMapsClient();
        containerRef.current.replaceChildren();
        const map = await olaMaps.init({
          // Dark cartography so the heatmap blends with the section's
          // dark band on the homepage. Saffron / orange cell markers
          // pop against the dark tiles, which is the whole point of
          // pairing them. Uses Ola's `default-dark-standard` style
          // (verified via the styles API — see lib/olaMaps.ts).
          style: OLA_DARK_STYLE,
          container: containerRef.current,
          center: [LKO_CENTER.lng, LKO_CENTER.lat],
          zoom: DEFAULT_ZOOM,
          // cooperativeGestures: scrolling the page does NOT zoom the
          // map (which would hijack scroll-through-content UX), but
          // Ctrl+scroll / two-finger pinch DOES zoom. MapLibre shows
          // a "Use ctrl + scroll to zoom" overlay when a single-finger
          // / bare-wheel gesture lands on the map, so users discover
          // the right gesture organically. Better than scrollZoom:false
          // (which locks zoom out entirely) AND scrollZoom:true (which
          // makes the homepage feel broken when the map sits mid-scroll).
          cooperativeGestures: true,
        });
        if (cancelled) {
          map?.remove?.();
          return;
        }
        // Minimal controls — no geolocate on a heatmap (it isn't
        // a navigation surface). Just the zoom +/- pair so curious
        // visitors can drill into a hot cell.
        attachMapControls(map, {
          showGeolocate: false,
          position: "top-right",
        });
        // Swallow Ola's known-benign style warnings (same allowlist
        // as BhandaraMap).
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
            console.warn("[MentionHeatmap] non-fatal map error:", msg || e);
          }
        });
        mapRef.current = map;
        setMapReady(true);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[MentionHeatmap] init failed:", err);
        }
      }
    }

    return () => {
      cancelled = true;
      try {
        markersRef.current.forEach((m) => m?.remove?.());
        markersRef.current = [];
        mapRef.current?.remove?.();
        mapRef.current = null;
      } catch {
        // Defensive — nothing to do if the SDK already torn down.
      }
    };
  }, []);

  // ── Effect B: sync cell markers whenever the mentions array
  // changes (parent re-renders on each poll). Cheap: drop the old
  // markers, build new ones from the bucketed cells. We don't try
  // to diff cell-by-cell — typical cell counts (<50) make full
  // rebuild faster than reconciling, and the visual flicker is
  // imperceptible (each marker is just a coloured disc, no animation).
  const cells = useMemo(() => bucketMentions(mentions), [mentions]);
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    // Tear down previous cells.
    markersRef.current.forEach((m) => m?.remove?.());
    markersRef.current = [];
    if (cells.length === 0) return;
    try {
      const olaMaps = getOlaMapsClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newMarkers: any[] = [];
      let minLat = cells[0].lat, maxLat = cells[0].lat;
      let minLng = cells[0].lng, maxLng = cells[0].lng;
      for (const cell of cells) {
        const el = buildCellElement(cell);
        const marker = olaMaps
          .addMarker({ element: el, anchor: "center" })
          .setLngLat([cell.lng, cell.lat])
          .addTo(map);
        newMarkers.push(marker);
        if (cell.lat < minLat) minLat = cell.lat;
        if (cell.lat > maxLat) maxLat = cell.lat;
        if (cell.lng < minLng) minLng = cell.lng;
        if (cell.lng > maxLng) maxLng = cell.lng;
      }
      markersRef.current = newMarkers;

      // Auto-fit-bounds — frame the actual data so a single cell in
      // Aliganj doesn't sit lost on a city-wide view. We only fit
      // when the user hasn't manually moved the map yet; once they
      // pan/zoom, their view wins and subsequent renders don't
      // snap it back. (Tracking that is harder than it looks since
      // the SDK fires move events for our own fitBounds call too;
      // we shim it via a one-shot flag on first render only.)
      if (!hasAutoFittedRef.current) {
        hasAutoFittedRef.current = true;
        try {
          if (cells.length === 1) {
            // Single cell: keep the city around it visible. Zoom 13
            // was too tight — only ~1.5 km radius showed, so a lone
            // Aliganj pin landed surrounded by unrelated streets
            // with no Lucknow context. Zoom 11 (~5 km radius) frames
            // the cell against the rest of the city.
            map.flyTo?.({
              center: [cells[0].lng, cells[0].lat],
              zoom: 11,
              duration: 600,
            });
          } else {
            // 60-px padding on each side keeps cells off the map
            // edges. maxZoom 12 (was 14) prevents a too-tight crop
            // when 2-3 cells happen to be in the same neighbourhood;
            // the surrounding city stays visible so the reader can
            // place the active zones.
            map.fitBounds(
              [
                [minLng, minLat],
                [maxLng, maxLat],
              ],
              { padding: 60, duration: 600, maxZoom: 12 },
            );
          }
        } catch {
          /* fitBounds is best-effort; init zoom is already sensible */
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[MentionHeatmap] failed to render cells:", err);
      }
    }
  }, [cells, mapReady]);

  // Empty / config-miss states surface their own copy rather than
  // rendering an empty card — keeps the section visually balanced
  // with the chatter feed on the left.
  if (!isOlaConfigured()) {
    return (
      <div className="p-6 text-sm text-cream-50/70 italic min-h-[18rem] flex items-center justify-center">
        Map key missing — heatmap unavailable. (Set
        NEXT_PUBLIC_OLA_MAPS_API_KEY in environment.)
      </div>
    );
  }

  return (
    // grid wrapper fills its parent on lg+ so the map matches the
    // adjacent chat panel's height. min-h-0 lets the map cell shrink
    // properly inside a grid row of fixed height; without it the
    // aspect-ratio fallback forces the cell taller than the row.
    //
    // No card-chrome on this wrapper: the parent <LiveChatterBoard/>
    // now wraps the map + chat in ONE shared frosted-glass frame, so
    // the map just needs to be a plain bare canvas inside it. The
    // bottom-left corner is rounded so it follows the parent's
    // rounded-2xl edge cleanly on the lg+ side-by-side layout.
    <div className="grid gap-0 lg:h-full lg:grid-rows-[1fr_auto] lg:min-h-0">
      <div
        ref={containerRef}
        className="w-full aspect-[4/3] sm:aspect-[5/4] lg:aspect-auto lg:h-full lg:min-h-0 bg-ink-900 overflow-hidden"
        aria-label="Bhandara mention density heatmap"
        role="img"
      />
      {/* Legend strip below the map.
          Frosted-glass pill bar, sits flush with the map's bottom edge.
          Each ramp tier is a chip: animated breathing dot in the ramp
          colour + bracketed count label, separated by hairline dividers.
          A "Mention density" eyebrow on the left anchors what the
          numbers represent; the active-zones counter sits hard-right.
          Reads as a self-contained instrument rather than a stray row
          of swatches. */}
      <div className="heatmap-legend px-3 py-2 sm:px-4 sm:py-2.5 flex items-center gap-x-2 gap-y-1.5 flex-wrap border-t border-cream-50/10">
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] font-semibold text-cream-50/70">
          <DensityIcon />
          Density
        </span>
        <span aria-hidden className="h-3.5 w-px bg-cream-50/15 hidden sm:inline-block" />
        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
          {CELL_RAMP.map((r, idx) => {
            const label =
              r.max === Infinity
                ? `${r.min}+`
                : r.min === r.max
                  ? `${r.min}`
                  : `${r.min}–${r.max}`;
            const labelLong =
              r.max === Infinity
                ? `${r.min} or more mentions`
                : r.min === r.max
                  ? `${r.min} mention`
                  : `${r.min} to ${r.max} mentions`;
            return (
              <span
                key={idx}
                className="heatmap-legend-chip inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium text-cream-50/90"
                title={labelLong}
              >
                <span
                  aria-hidden
                  className="heatmap-legend-dot relative inline-block h-2.5 w-2.5 rounded-full"
                  style={{
                    background: r.bg,
                    border: `1.5px solid ${r.border}`,
                    boxShadow: `0 0 8px ${withAlpha(r.bg, 0.5)}`,
                    animationDelay: `${idx * -0.35}s`,
                  }}
                />
                <span className="tabular-nums">{label}</span>
              </span>
            );
          })}
        </div>
        <span aria-hidden className="ml-auto h-3.5 w-px bg-cream-50/15 hidden sm:inline-block" />
        {cells.length === 0 ? (
          <span className="text-[11px] text-cream-50/55 italic">
            No located mentions in the last 24h
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-cream-50/85">
            <span className="relative inline-block w-1.5 h-1.5">
              <span
                aria-hidden
                className="heatmap-active-dot absolute inset-0 rounded-full bg-leaf-600"
              />
            </span>
            <span className="tabular-nums font-semibold text-cream-50">
              {cells.length}
            </span>
            <span className="text-cream-50/65">
              active zone{cells.length === 1 ? "" : "s"}
            </span>
          </span>
        )}
      </div>
      <style jsx>{`
        :global(.heatmap-legend) {
          background-color: rgba(26, 20, 16, 0.72);
          background-image: linear-gradient(
              135deg,
              rgba(255, 255, 255, 0.06) 0%,
              rgba(255, 255, 255, 0) 38%
            );
          backdrop-filter: blur(14px) saturate(140%);
          -webkit-backdrop-filter: blur(14px) saturate(140%);
          border: 1px solid rgba(251, 247, 240, 0.08);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 10px 28px -16px rgba(0, 0, 0, 0.65);
        }
        :global(.heatmap-legend-chip) {
          background: rgba(0, 0, 0, 0.42);
          border: 1px solid rgba(251, 247, 240, 0.06);
          transition:
            background 180ms ease,
            border-color 180ms ease,
            transform 180ms ease;
        }
        :global(.heatmap-legend-chip):hover {
          background: rgba(0, 0, 0, 0.6);
          border-color: rgba(242, 148, 76, 0.35);
          transform: translateY(-1px);
        }
        @keyframes heatmap-legend-dot-breathe {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.18); }
        }
        :global(.heatmap-legend-dot) {
          animation: heatmap-legend-dot-breathe 3.6s ease-in-out infinite;
        }
        @keyframes heatmap-active-pulse {
          0%, 100% { transform: scale(1);   opacity: 0.95; }
          50%      { transform: scale(1.9); opacity: 0; }
        }
        :global(.heatmap-active-dot)::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          background: currentColor;
          animation: heatmap-active-pulse 1.8s ease-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.heatmap-legend-dot),
          :global(.heatmap-active-dot)::after {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

/** Tiny heatmap glyph (3 concentric arcs) for the legend eyebrow.
 *  Inline SVG so it inherits currentColor and stays crisp at 12×12. */
function DensityIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="11"
      height="11"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
      <path d="M6.5 12a5.5 5.5 0 0 1 11 0" />
      <path d="M3 12a9 9 0 0 1 18 0" opacity="0.55" />
    </svg>
  );
}
