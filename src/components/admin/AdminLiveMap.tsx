"use client";

/**
 * Interactive live-map for the admin ops console.
 *
 * Plots THREE layers over a Lucknow schematic:
 *
 *   • Live spots (cyan)            — APPROVED + un-expired Spot rows
 *   • Listed bhandaras (saffron)   — APPROVED Bhandara rows with coords
 *   • Chat mentions (violet)       — APPROVED BhandaraMention rows
 *                                    with lat/lng pinned by Gemini
 *
 * Click any marker → a popover anchored to it shows the row's
 * details and quick actions:
 *
 *   spot       → View edit · Delist
 *   bhandara   → View public · Edit · Reject
 *   mention    → View chat · Reject
 *
 * Each delete/delist routes through an existing server action
 * (delistSpotAction, rejectAction, rejectMentionAction). After the
 * action returns the page is revalidated by the server, so the
 * marker disappears on the next paint without a manual refresh.
 *
 * Why client-side (vs the previous server-rendered SVG):
 *   • Need click handlers and a popover.
 *   • All the data is already cheap (parent fetches it via Prisma
 *     and serialises into props), so going client doesn't move any
 *     work off the server.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import {
  delistSpotAction,
  rejectAction,
  rejectMentionAction,
} from "@/app/admin/actions";

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
  /** Optional counter ("147 live") used by the legend / corner badge. */
  count?: number;
};

// Lucknow bbox tuned wide enough that outskirts (Para, Sushant
// Golf City, Sitapur Road extension) land inside the frame.
const NORTH = 27.0;
const SOUTH = 26.70;
const WEST = 80.80;
const EAST = 81.12;
const VIEW_W = 600;
const VIEW_H = 380;

function project(lat: number, lng: number): { x: number; y: number } {
  const clampedLat = Math.max(SOUTH, Math.min(NORTH, lat));
  const clampedLng = Math.max(WEST, Math.min(EAST, lng));
  const x = ((clampedLng - WEST) / (EAST - WEST)) * VIEW_W;
  const y = ((NORTH - clampedLat) / (NORTH - SOUTH)) * VIEW_H;
  return { x, y };
}

type Marker =
  | { kind: "spot"; data: MapSpot; x: number; y: number }
  | { kind: "bhandara"; data: MapBhandara; x: number; y: number }
  | { kind: "mention"; data: MapMention; x: number; y: number };

function isValidCoord(c: Coord): boolean {
  return c.lat !== null && c.lng !== null && c.lat !== 0 && c.lng !== 0;
}

export default function AdminLiveMap({
  spots,
  bhandaras,
  mentions,
  count,
}: Props) {
  const [selected, setSelected] = useState<Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the popover on outside-click or Escape.
  useEffect(() => {
    if (!selected) return;
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSelected(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelected(null);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [selected]);

  const handleSelect = useCallback((m: Marker) => {
    setSelected((prev) =>
      prev && prev.kind === m.kind && prev.data.id === m.data.id ? null : m,
    );
  }, []);

  // Pre-project every coord once into SVG-space.
  const spotMarkers: Marker[] = spots.filter(isValidCoord).map((s) => ({
    kind: "spot",
    data: s,
    ...project(s.lat as number, s.lng as number),
  }));
  const bhandaraMarkers: Marker[] = bhandaras
    .filter(isValidCoord)
    .map((b) => ({
      kind: "bhandara",
      data: b,
      ...project(b.lat as number, b.lng as number),
    }));
  const mentionMarkers: Marker[] = mentions
    .filter(isValidCoord)
    .map((m) => ({
      kind: "mention",
      data: m,
      ...project(m.lat as number, m.lng as number),
    }));

  return (
    <div ref={containerRef} className="relative h-full">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 w-full h-full"
        aria-label="Live map of Lucknow showing spots, bhandaras, and chat mentions"
      >
        <defs>
          <pattern
            id="live-map-grid"
            x="0"
            y="0"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(34, 211, 238, 0.10)"
              strokeWidth="0.5"
            />
          </pattern>
          <radialGradient id="dot-cyan" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a5f3fc" stopOpacity="1" />
            <stop offset="55%" stopColor="#22d3ee" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="dot-saffron" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fdba74" stopOpacity="1" />
            <stop offset="55%" stopColor="#f2944c" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#f2944c" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="dot-violet" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ddd6fe" stopOpacity="1" />
            <stop offset="55%" stopColor="#a78bfa" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
          </radialGradient>
          <filter id="dot-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width={VIEW_W} height={VIEW_H} fill="url(#live-map-grid)" />

        {/* Stylized Gomti river curve for orientation. */}
        <path
          d={`M ${VIEW_W * 0.10} ${VIEW_H * 0.20} C ${VIEW_W * 0.30} ${VIEW_H * 0.35}, ${VIEW_W * 0.55} ${VIEW_H * 0.40}, ${VIEW_W * 0.95} ${VIEW_H * 0.78}`}
          fill="none"
          stroke="rgba(96, 165, 230, 0.15)"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Hazratganj crosshair. */}
        {(() => {
          const c = project(26.85, 80.945);
          return (
            <g>
              <line x1={c.x - 6} y1={c.y} x2={c.x + 6} y2={c.y} stroke="rgba(34,211,238,0.35)" strokeWidth="0.8" />
              <line x1={c.x} y1={c.y - 6} x2={c.x} y2={c.y + 6} stroke="rgba(34,211,238,0.35)" strokeWidth="0.8" />
              <text x={c.x + 8} y={c.y + 12} fontSize="9" fill="rgba(34,211,238,0.55)" fontFamily="monospace">
                lucknow.core
              </text>
            </g>
          );
        })()}

        {/* Layer order: bhandaras (smaller saffron) under spots
            (mid cyan) under mentions (smaller violet). Spots get the
            biggest dot so the "city is firing right now" reads
            first. */}
        <g filter="url(#dot-glow)">
          {bhandaraMarkers.map((m) => (
            <DotButton key={`b-${m.data.id}`} marker={m} onSelect={handleSelect} active={selected?.kind === "bhandara" && selected.data.id === m.data.id} />
          ))}
          {mentionMarkers.map((m) => (
            <DotButton key={`m-${m.data.id}`} marker={m} onSelect={handleSelect} active={selected?.kind === "mention" && selected.data.id === m.data.id} />
          ))}
          {spotMarkers.map((m) => (
            <DotButton key={`s-${m.data.id}`} marker={m} onSelect={handleSelect} active={selected?.kind === "spot" && selected.data.id === m.data.id} />
          ))}
        </g>

        <rect x="0.5" y="0.5" width={VIEW_W - 1} height={VIEW_H - 1} fill="none" stroke="rgba(34, 211, 238, 0.12)" strokeWidth="1" />
      </svg>

      {/* Top-right legend */}
      <div aria-hidden className="absolute top-3 right-3 font-mono text-[9.5px] text-cream-50/55 tracking-wide leading-tight space-y-0.5">
        <div className="flex items-center justify-end gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span>spot · {spotMarkers.length}</span>
        </div>
        <div className="flex items-center justify-end gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-saffron-500" />
          <span>listed · {bhandaraMarkers.length}</span>
        </div>
        <div className="flex items-center justify-end gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400" />
          <span>chat · {mentionMarkers.length}</span>
        </div>
      </div>

      {/* Bottom-right corner badge with the count + nudge to click. */}
      <div
        aria-hidden
        className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-cyan-400/25 bg-[#0B0E16]/85 backdrop-blur-sm px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300/85"
      >
        <span className="relative inline-flex h-1.5 w-1.5">
          <span className="absolute inset-0 rounded-full bg-cyan-400/70 motion-safe:animate-ping" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
        </span>
        <span>{count ?? spotMarkers.length} live · tap a pin</span>
      </div>

      {/* Selected-marker popover */}
      {selected ? (
        <MarkerPopover marker={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}

/* ─────────────────── Dot button ────────────────────────────── */

function DotButton({
  marker,
  onSelect,
  active,
}: {
  marker: Marker;
  onSelect: (m: Marker) => void;
  active: boolean;
}) {
  const { x, y } = marker;
  const fill =
    marker.kind === "spot"
      ? "url(#dot-cyan)"
      : marker.kind === "bhandara"
        ? "url(#dot-saffron)"
        : "url(#dot-violet)";
  const core =
    marker.kind === "spot"
      ? "#a5f3fc"
      : marker.kind === "bhandara"
        ? "#fdba74"
        : "#ddd6fe";
  const r = marker.kind === "spot" ? 9 : marker.kind === "bhandara" ? 7 : 6;

  return (
    <g
      onClick={() => onSelect(marker)}
      style={{ cursor: "pointer" }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(marker);
        }
      }}
    >
      {/* Glow halo (bigger when active). */}
      <circle cx={x} cy={y} r={active ? r + 4 : r} fill={fill} opacity={active ? 1 : 0.9} />
      <circle cx={x} cy={y} r={1.6} fill={core} />
      {/* Invisible hitbox so taps are easy on mobile. */}
      <circle cx={x} cy={y} r={14} fill="transparent" />
    </g>
  );
}

/* ─────────────────── Popover ───────────────────────────────── */

function MarkerPopover({
  marker,
  onClose,
}: {
  marker: Marker;
  onClose: () => void;
}) {
  // Render the popover anchored using the SVG point as a percentage
  // of the parent container. The container is `relative h-full`.
  const left = `${(marker.x / VIEW_W) * 100}%`;
  const top = `${(marker.y / VIEW_H) * 100}%`;

  return (
    <div
      style={{ left, top }}
      className="absolute z-30 -translate-x-1/2 -translate-y-[calc(100%+18px)] admin-listbox-pop"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="rounded-2xl border border-cyan-400/30 bg-[#0B0E16]/95 backdrop-blur-md shadow-[0_24px_50px_-12px_rgba(0,0,0,0.7)] p-3 w-[18rem] max-w-[80vw]">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-cyan-300/85">
            {marker.kind === "spot"
              ? "Live spot"
              : marker.kind === "bhandara"
                ? "Listed bhandara"
                : "Chat mention"}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center w-6 h-6 rounded-md text-cream-50/55 hover:text-cream-50 hover:bg-cyan-400/[0.08] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
        </div>

        {marker.kind === "spot" ? <SpotPopoverBody data={marker.data} /> : null}
        {marker.kind === "bhandara" ? (
          <BhandaraPopoverBody data={marker.data} />
        ) : null}
        {marker.kind === "mention" ? (
          <MentionPopoverBody data={marker.data} />
        ) : null}
      </div>
      {/* Pointer triangle hanging from the popover toward the marker. */}
      <div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 top-full w-3 h-3 -mt-1.5 rotate-45 border-r border-b border-cyan-400/30 bg-[#0B0E16]/95"
      />
    </div>
  );
}

function SpotPopoverBody({ data }: { data: MapSpot }) {
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
            className="inline-flex items-center gap-1.5 rounded-full border border-sindoor-500/45 text-sindoor-300 hover:bg-sindoor-500/[0.10] hover:border-sindoor-500/70 px-3 py-1.5 text-xs font-mono transition-colors"
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

function BhandaraPopoverBody({ data }: { data: MapBhandara }) {
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
            className="inline-flex items-center gap-1.5 rounded-full border border-sindoor-500/45 text-sindoor-300 hover:bg-sindoor-500/[0.10] hover:border-sindoor-500/70 px-3 py-1.5 text-xs font-mono transition-colors"
            onClick={(e) => {
              if (!window.confirm("Reject this bhandara?")) e.preventDefault();
            }}
          >
            Reject
          </button>
        </form>
      </div>
    </>
  );
}

function MentionPopoverBody({ data }: { data: MapMention }) {
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
            className="inline-flex items-center gap-1.5 rounded-full border border-sindoor-500/45 text-sindoor-300 hover:bg-sindoor-500/[0.10] hover:border-sindoor-500/70 px-3 py-1.5 text-xs font-mono transition-colors"
            onClick={(e) => {
              if (!window.confirm("Reject this mention?")) e.preventDefault();
            }}
          >
            Reject
          </button>
        </form>
      </div>
    </>
  );
}
