"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getOlaMapsClient,
  OLA_DARK_STYLE,
  isOlaConfigured,
  attachMapControls,
} from "@/lib/olaMaps";
import {
  delistSpotAction,
  rejectAction,
  rejectMentionAction,
} from "@/app/admin/actions";

/**
 * Real Ola Maps (dark style) embedded in the admin dashboard hero.
 *
 * Same three layers + click-popover-with-delete as the SVG schematic
 * it replaces:
 *   • Live spots (cyan dot)
 *   • Listed bhandaras (saffron dot)
 *   • Recent chat mentions (violet dot)
 *
 * Why a custom thin wrapper (vs reusing the public `BhandaraMap`):
 *   • BhandaraMap is 800 LOC of public-site UX (popups branded for
 *     end users, gada SVG markers, share buttons, ...). The admin
 *     wants ops-grade dot markers + an action popover that fires the
 *     same delistSpotAction / rejectAction / rejectMentionAction the
 *     queue rows use.
 *   • The dark style is hard-coded here, the public site uses light
 *     by default, the admin always uses dark to match the AI/ops
 *     console palette.
 *   • Falls back to a friendly "Map unavailable" panel with a hint
 *     when Ola's API key origin restriction blocks the request
 *     (which is the most common failure in local dev).
 */

type Coord = { lat: number | null; lng: number | null };

export type MapSpot = Coord & {
  id: string;
  area: string | null;
  caption?: string | null;
  createdAt: Date | string;
};

export type MapBhandara = Coord & {
  id: string;
  slug: string;
  name: string;
  area: string | null;
  isVerified: boolean;
};

export type MapMention = Coord & {
  id: string;
  cleanedText: string | null;
  originalText: string;
  senderName: string | null;
  locationLabel: string | null;
  createdAt: Date | string;
};

type Props = {
  spots: MapSpot[];
  bhandaras: MapBhandara[];
  mentions: MapMention[];
  /** Hint label used in the corner badge. */
  count?: number;
};

// Lucknow rough centre + initial zoom that keeps Hazratganj + the
// outer ring (Sushant Golf City, Para, Sitapur Road) in frame.
const LUCKNOW_CENTER: [number, number] = [80.945, 26.85];
const INITIAL_ZOOM = 11;

type Selected =
  | { kind: "spot"; data: MapSpot }
  | { kind: "bhandara"; data: MapBhandara }
  | { kind: "mention"; data: MapMention }
  | null;

function isValidCoord(c: Coord): boolean {
  return c.lat !== null && c.lng !== null && c.lat !== 0 && c.lng !== 0;
}

export default function AdminOlaMap({
  spots,
  bhandaras,
  mentions,
  count,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<Selected>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOlaConfigured()) {
      setErrorMsg("Ola Maps API key missing in env");
      return;
    }
    if (!ref.current) return;

    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any = null;
    let resizeObserver: ResizeObserver | null = null;

    // CRITICAL: defer the SDK init by one microtask so React's commit
    // phase has fully painted the container to the DOM before Ola /
    // MapLibre calls getBoundingClientRect() on it. Without this,
    // dashboard renders where the hero is briefly 0-height (during
    // Suspense → final swap) get a silently-broken canvas: the WebGL
    // context can't initialise on a zero-sized element and the map
    // never paints, but no error is thrown so our catch block never
    // fires either. The other two map components on the site
    // (BhandaraMap, MentionHeatmap) use this same pattern; AdminOlaMap
    // was the only one missing it, which is why this one alone has
    // shown up as "map not loading" in dev.
    queueMicrotask(() => {
      if (cancelled) return;
      void runInit();
    });

    async function runInit() {
      try {
        if (cancelled || !ref.current) return;
        // Container may still be measuring 0×0 on the very first
        // microtask after a Suspense swap. Bail and retry on next
        // animation frame, by then layout is guaranteed committed.
        const rect = ref.current.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          requestAnimationFrame(() => {
            if (!cancelled) void runInit();
          });
          return;
        }
        const ola = getOlaMapsClient();
        // NOTE: do NOT call ref.current.replaceChildren() here. The
        // ref div has no JSX children (overlays are siblings of the
        // ref div, not descendants). On HMR re-runs replaceChildren
        // would race with the previous init's canvas insertion and
        // wipe the canvas the user is staring at.
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.info("[AdminOlaMap] initialising", {
            w: rect.width,
            h: rect.height,
          });
        }
        map = await ola.init({
          style: OLA_DARK_STYLE,
          container: ref.current,
          center: LUCKNOW_CENTER,
          zoom: INITIAL_ZOOM,
          // cooperativeGestures matches MentionHeatmap (the closest
          // sibling map on this codebase that's confirmed working).
          // scrollZoom: true was wired here originally; the dashboard
          // doesn't need page-scroll-hijack to zoom, so we drop it.
          cooperativeGestures: true,
        });
        if (cancelled) {
          map?.remove?.();
          return;
        }

        attachMapControls(map, {
          showGeolocate: false,
          position: "top-right",
        });

        // Swallow Ola's known-benign style noise, the same allowlist
        // BhandaraMap + MentionHeatmap use. ONLY surface a real error
        // overlay for hard failures the user can act on (the original
        // code flashed the "rejected" message on any 4xx-shaped string,
        // including sprite 404s, which made it look perma-broken).
        map.on("error", (e: { error?: { message?: string } }) => {
          const msg = e?.error?.message ?? "";
          if (
            msg.includes("3d_model") ||
            msg.includes("Source layer") ||
            msg.includes("Expected value to be of type") ||
            /^[Ff]ailed to fetch tile/.test(msg) ||
            /styleimagemissing/.test(msg) ||
            /sprite/i.test(msg)
          ) {
            return; // benign
          }
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.warn("[AdminOlaMap] non-fatal map error:", msg || e);
          }
        });

        // Drop the three marker layers as soon as the style is loaded.
        // MapLibre fires `load` once the first style is fully parsed +
        // applied; safe to add markers any time after that.
        map.on("load", () => {
          if (cancelled) return;
          // Belt-and-braces: explicitly resize once the style has
          // loaded. Handles the case where the canvas was created at
          // the right size but the surrounding flexbox finalised its
          // dimensions a frame later (e.g. when sibling Suspense
          // boundaries hydrate after the map mounts). Cheap call,
          // always safe.
          map.resize();
          addMarkers(map, spots, "spot", setSelected);
          addMarkers(map, bhandaras, "bhandara", setSelected);
          addMarkers(map, mentions, "mention", setSelected);
        });

        // ResizeObserver keeps the WebGL canvas in sync with the
        // container's actual painted size as the layout shifts.
        // CSS-only resizes (e.g. responsive grid breakpoints, the
        // Live-chat merge below stacking columns at lg vs md) don't
        // emit window resize events, so MapLibre would otherwise paint
        // a stretched / clipped canvas. Observing the ref element +
        // calling map.resize() on every change is the canonical fix.
        if (ref.current && typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => {
            try {
              map?.resize?.();
            } catch {
              // Map may already have been removed during a fast unmount
              // resize on a torn-down map throws. Safe to ignore.
            }
          });
          resizeObserver.observe(ref.current);
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.warn("[AdminOlaMap] init failed:", err);
        }
        setErrorMsg(msg);
      }
    }

    return () => {
      cancelled = true;
      try {
        resizeObserver?.disconnect();
      } catch {
        // ignore
      }
      try {
        map?.remove?.();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally one-shot, data refresh handled by parent revalidate

  return (
    // Outer positioned container, hosts the absolutely-positioned
    // overlays (legend, count badge, error overlay, marker popover).
    // CRITICAL: hard pixel/rem heights here, NOT `h-full`. The
    // previous `h-full` approach silently failed because the
    // dashboard slot's flex-1 chain didn't propagate a definite
    // height through to the ref div, `height: 100%` of an "auto"
    // parent collapses to 0 and the WebGL canvas can't initialise.
    // BhandaraMap (which has worked since launch) uses the exact
    // same hard-height pattern (see BhandaraMap.tsx line 556:
    // `h-[420px] sm:h-[520px] w-full`). Mirror it here verbatim
    // so the map paints regardless of parent layout fragility.
    <div className="relative w-full h-[22rem] sm:h-[24rem] lg:h-[28rem]">
      {/* Map canvas container, ref directly here. Inline
          `position: relative` (not via a Tailwind class) because
          MapLibre's canvas is positioned `absolute` and pins to its
          container's nearest positioned ancestor; declaring relative
          inline guarantees the canvas anchors to THIS div, not some
          distant ancestor. Same pattern BhandaraMap + MentionHeatmap
          use (see BhandaraMap.tsx line 549). */}
      <div
        ref={ref}
        style={{ position: "relative" }}
        data-map-status={errorMsg ? "error" : "init"}
        className="w-full h-full rounded-2xl overflow-hidden bg-[#0B0E16]"
        aria-label="Live admin map of Lucknow bhandara activity"
        role="region"
      />

      {/* Top-LEFT legend.
          Was top-right but it collided with two things: Ola Maps'
          default navigation controls (zoom +/− land at top-right
          unless re-anchored), and the map's place-name labels
          ("Industrial Area" / "Vrindavan Township" etc. that the
          tile layer draws around the visible canvas, they cluster
          toward the right edge for Lucknow's typical centered
          framing). Top-left is clear on both counts: Ola attribution
          sits at bottom-left, zoom at top-right, this stays out of
          the way of both. */}
      <div
        aria-hidden
        className="absolute top-3 left-3 z-10 font-mono text-[9.5px] text-cream-50/65 tracking-wide leading-tight space-y-0.5 bg-[#0B0E16]/85 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-cyan-400/15"
      >
        <div className="flex items-center justify-end gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span>spot · {spots.filter(isValidCoord).length}</span>
        </div>
        <div className="flex items-center justify-end gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-saffron-500" />
          <span>listed · {bhandaras.filter(isValidCoord).length}</span>
        </div>
        <div className="flex items-center justify-end gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400" />
          <span>chat · {mentions.filter(isValidCoord).length}</span>
        </div>
      </div>

      {/* Bottom-CENTER count badge.
          Moved from bottom-right because: (a) it overlapped the Ola
          zoom controls at narrow viewport widths, (b) the bottom-left
          carries the Ola Maps attribution which we can't reposition.
          Bottom-center via left-1/2 + -translate-x-1/2 keeps the
          pill visually anchored to the map's horizontal centerline,
          which doubles as a soft "primary CTA" cue ("tap a pin"
          reads like a sentence under the city). */}
      <div
        aria-hidden
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1.5 rounded-full border border-cyan-400/25 bg-[#0B0E16]/85 backdrop-blur-sm px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300/85"
      >
        <span className="relative inline-flex h-1.5 w-1.5">
          <span className="absolute inset-0 rounded-full bg-cyan-400/70 motion-safe:animate-ping" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
        </span>
        <span>{count ?? spots.length} live · tap a pin</span>
      </div>

      {/* Error overlay */}
      {errorMsg ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
          <div className="max-w-sm rounded-2xl border border-sindoor-700/40 bg-[#0B0E16]/95 backdrop-blur-md p-5 text-center text-sm text-cream-50/85 font-mono">
            <div className="text-sindoor-700 text-xs uppercase tracking-[0.18em] mb-2">
              ⚠ Map unavailable
            </div>
            <p className="leading-relaxed">{errorMsg}</p>
            <p className="mt-3 text-xs text-cream-50/55">
              In the Ola Krutrim console, add{" "}
              <span className="text-cyan-300">http://localhost:3030</span>{" "}
              to the API key's allowed origins.
            </p>
          </div>
        </div>
      ) : null}

      {/* Selected-marker popover */}
      {selected ? (
        <MarkerPopover
          selected={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}

/* ────── Markers ─────────────────────────────────────────────── */

function makeDot(kind: "spot" | "bhandara" | "mention"): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "width:18px;height:18px;cursor:pointer;display:block;";
  const inner = document.createElement("span");
  const colour =
    kind === "spot"
      ? { core: "#a5f3fc", mid: "#22d3ee" }
      : kind === "bhandara"
        ? { core: "#fed7aa", mid: "#f2944c" }
        : { core: "#ddd6fe", mid: "#a78bfa" };
  inner.style.cssText = `position:relative;display:block;width:18px;height:18px;border-radius:9999px;background:radial-gradient(closest-side, ${colour.core} 10%, ${colour.mid} 65%, transparent 100%);box-shadow:0 0 12px ${colour.mid}88;`;
  const center = document.createElement("span");
  center.style.cssText = `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:4px;height:4px;border-radius:9999px;background:${colour.core};`;
  inner.appendChild(center);
  wrapper.appendChild(inner);
  return wrapper;
}

function addMarkers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: any,
  items: Array<MapSpot | MapBhandara | MapMention>,
  kind: "spot" | "bhandara" | "mention",
  onSelect: (next: Selected) => void,
): void {
  const ola = getOlaMapsClient();
  for (const item of items) {
    if (!isValidCoord(item)) continue;
    const el = makeDot(kind);
    el.addEventListener("click", () => {
      if (kind === "spot") onSelect({ kind: "spot", data: item as MapSpot });
      else if (kind === "bhandara")
        onSelect({ kind: "bhandara", data: item as MapBhandara });
      else onSelect({ kind: "mention", data: item as MapMention });
    });
    try {
      const marker = ola
        .addMarker({ element: el, anchor: "center", offset: [0, 0] })
        .setLngLat([item.lng as number, item.lat as number])
        .addTo(map);
      // Hold reference on the element so React's tree retains it for
      // GC reasons (the SDK's internal store does the same).
      (el as unknown as { __marker: unknown }).__marker = marker;
    } catch {
      /* Marker init failed, skip */
    }
  }
}

/* ────── Popover ─────────────────────────────────────────────── */

function MarkerPopover({
  selected,
  onClose,
}: {
  selected: NonNullable<Selected>;
  onClose: () => void;
}) {
  // Centre-screen popover (Ola maplibre doesn't give us reliable
  // pixel coords for a dynamic element without a render loop, and
  // the admin doesn't need spatial pointing, a centred sheet works
  // for moderation actions).
  return (
    <div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 admin-listbox-pop"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="rounded-2xl border border-cyan-400/30 bg-[#0B0E16]/95 backdrop-blur-md shadow-[0_24px_50px_-12px_rgba(0,0,0,0.7)] p-3 w-[20rem] max-w-[80vw]">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-cyan-300/85">
            {selected.kind === "spot"
              ? "Live spot"
              : selected.kind === "bhandara"
                ? "Listed bhandara"
                : "Chat mention"}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center w-6 h-6 rounded-md text-cream-50/55 hover:text-cream-50 hover:bg-cyan-400/[0.08] transition-colors"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
        </div>
        {selected.kind === "spot" ? (
          <SpotBody data={selected.data} />
        ) : null}
        {selected.kind === "bhandara" ? (
          <BhandaraBody data={selected.data} />
        ) : null}
        {selected.kind === "mention" ? (
          <MentionBody data={selected.data} />
        ) : null}
      </div>
    </div>
  );
}

function SpotBody({ data }: { data: MapSpot }) {
  return (
    <>
      <div className="mt-2 text-sm text-cream-50 font-medium truncate">
        {data.area || "Unknown area"}
      </div>
      {data.caption ? (
        <div className="mt-1 text-xs text-cream-50/65 line-clamp-2 font-mono">
          {data.caption}
        </div>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        <Link
          href={`/admin/edit-spot/${data.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-3 py-1.5 text-xs transition-colors font-mono font-medium"
        >
          ✎ Edit
        </Link>
        <form action={delistSpotAction.bind(null, data.id)}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-full border border-sindoor-700/45 text-sindoor-700 hover:bg-sindoor-700/[0.10] hover:border-sindoor-700/70 px-3 py-1.5 text-xs font-mono transition-colors"
            onClick={(e) => {
              if (!window.confirm("Delist this spot?")) e.preventDefault();
            }}
          >
            Delist
          </button>
        </form>
      </div>
    </>
  );
}

function BhandaraBody({ data }: { data: MapBhandara }) {
  return (
    <>
      <div className="mt-2 text-sm text-cream-50 font-medium truncate">
        {data.name}
      </div>
      {data.area ? (
        <div className="mt-1 text-xs text-cream-50/65 font-mono truncate">
          {data.area}
        </div>
      ) : null}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <Link
          href={`/bhandara/${data.slug}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 border border-cyan-300/40 px-3 py-1.5 text-xs text-cream-50 font-semibold font-mono shadow-[0_4px_14px_-4px_rgba(34,211,238,0.55)]"
        >
          View public ↗
        </Link>
        <Link
          href={`/admin/edit/${data.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-3 py-1.5 text-xs transition-colors font-mono font-medium"
        >
          ✎ Edit
        </Link>
        <form action={rejectAction.bind(null, data.id)}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-full border border-sindoor-700/45 text-sindoor-700 hover:bg-sindoor-700/[0.10] hover:border-sindoor-700/70 px-3 py-1.5 text-xs font-mono transition-colors"
            onClick={(e) => {
              if (!window.confirm("Reject this bhandara?"))
                e.preventDefault();
            }}
          >
            Reject
          </button>
        </form>
      </div>
    </>
  );
}

function MentionBody({ data }: { data: MapMention }) {
  const text =
    data.cleanedText ?? data.originalText.split("\n\n[bot:")[0] ?? "";
  return (
    <>
      <div className="mt-2 text-sm text-cream-50 font-medium truncate">
        {data.senderName ?? "Anonymous"}
      </div>
      <div className="mt-1 text-xs text-cream-50/65 line-clamp-3 font-mono">
        {text}
      </div>
      {data.locationLabel ? (
        <div className="mt-1 text-[11px] text-cream-50/45 font-mono truncate">
          📍 {data.locationLabel}
        </div>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        <Link
          href="/admin/mentions"
          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-3 py-1.5 text-xs transition-colors font-mono font-medium"
        >
          Open queue
        </Link>
        <form action={rejectMentionAction.bind(null, data.id)}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-full border border-sindoor-700/45 text-sindoor-700 hover:bg-sindoor-700/[0.10] hover:border-sindoor-700/70 px-3 py-1.5 text-xs font-mono transition-colors"
            onClick={(e) => {
              if (!window.confirm("Reject this mention?"))
                e.preventDefault();
            }}
          >
            Reject
          </button>
        </form>
      </div>
    </>
  );
}
