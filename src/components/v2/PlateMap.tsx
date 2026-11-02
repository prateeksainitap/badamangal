import type { ReactNode } from "react";

export type PlatePoint = { x: number; y: number };

/**
 * A still window onto the painted Lucknow plate (the homepage map art)
 * with gada pins: the bhandara page's "where", the area page's art.
 * No map library, no client JS, static HTML. Compute the points on the
 * server with `placeOnPaintedMap` from src/lib/home-map.ts (same
 * projection as the homepage map).
 *
 *   <PlateMap pin={pins[0]} labels={labels} locale="en" href={directions}
 *             ariaLabel="Open directions in Google Maps" />
 *
 * `zoom` is the plate width as a percent of the window (260 = a
 * neighbourhood, 160 = a big part of the city). `others` adds small
 * gadas (other bhandaras in view).
 */
export default function PlateMap({
  pin,
  others = [],
  labels = [],
  locale = "en",
  zoom = "fit",
  href,
  ariaLabel,
  footer,
}: {
  pin?: PlatePoint | null;
  others?: PlatePoint[];
  labels?: { key: string; x: number; y: number; hi: string; en: string }[];
  locale?: "en" | "hi";
  /** Plate width as percent of the window, or "fit" to frame the pins. */
  zoom?: number | "fit";
  href?: string;
  ariaLabel?: string;
  footer?: ReactNode;
}) {
  const k = 1.6 / 1.5; // window is 16:10, plate is 3:2
  const pts = [pin, ...others].filter(Boolean) as PlatePoint[];
  let zoomPct: number;
  if (zoom === "fit") {
    // Frame every pin in the middle 55% of the window, between a
    // neighbourhood (420) and a big slice of the city (170).
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const bw = Math.max(1, Math.max(...xs, 0) - Math.min(...xs, 100));
    const bh = Math.max(1, Math.max(...ys, 0) - Math.min(...ys, 100));
    const fit = pts.length > 1 ? Math.min(5500 / bw, 5500 / (bh * k)) : 300;
    zoomPct = Math.max(170, Math.min(420, fit));
  } else zoomPct = zoom;
  const z = zoomPct / 100;
  const halfX = 50 / z;
  const halfY = 50 / (z * k);
  const cx = pts.length ? (Math.min(...pts.map((p) => p.x)) + Math.max(...pts.map((p) => p.x))) / 2 : 50;
  const cy = pts.length ? (Math.min(...pts.map((p) => p.y)) + Math.max(...pts.map((p) => p.y))) / 2 : 50;
  const fx = Math.min(100 - halfX, Math.max(halfX, pin?.x ?? cx));
  const fy = Math.min(100 - halfY, Math.max(halfY, pin?.y ?? cy));
  const at = (p: PlatePoint) => ({ left: `${50 + (p.x - fx) * z}%`, top: `${50 + (p.y - fy) * z * k}%` });
  const inView = (p: PlatePoint, m = 6) => {
    const l = 50 + (p.x - fx) * z;
    const t = 50 + (p.y - fy) * z * k;
    return l > m && l < 100 - m && t > m && t < 100 - m;
  };
  // Labels stay clear of every gada (window percent).
  const lbls = labels.filter(
    (l) => inView(l, 12) && pts.every((p) => Math.hypot((l.x - p.x) * z, (l.y - p.y) * z * k) > 9),
  );
  const body = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="bmi-pmap-plate"
        src="/illustrations/v2/map-lucknow.webp"
        alt=""
        width={1536}
        height={1024}
        loading="lazy"
        decoding="async"
        style={{ position: "absolute", width: `${zoomPct}%`, left: `${50 - fx * z}%`, top: `${50 - fy * z * k}%` }}
      />
      {lbls.map((l) => (
        <span key={l.key} className="bmi-pmap-lbl" style={at(l)} lang={locale}>
          {locale === "hi" ? l.hi : l.en}
        </span>
      ))}
      {others.filter((p) => inView(p, 3)).map((p, i) => (
        <span key={i} className="bmi-pmap-pin sm" style={{ ...at(p), ["--i" as string]: i }} aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/map-pin-gada.svg" alt="" />
        </span>
      ))}
      {pin ? (
        <>
          <span className="bmi-pmap-ring" style={at(pin)} aria-hidden />
          <span className="bmi-pmap-pin" style={at(pin)} aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/map-pin-gada.svg" alt="" />
          </span>
        </>
      ) : null}
    </>
  );
  return (
    <div className="bmi-pmap-w" data-rv>
      {href ? (
        <a className="bmi-pmap" href={href} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel}>
          {body}
        </a>
      ) : (
        <div className="bmi-pmap" role="img" aria-label={ariaLabel}>
          {body}
        </div>
      )}
      {footer ? <div className="bmi-pmap-foot">{footer}</div> : null}
    </div>
  );
}
