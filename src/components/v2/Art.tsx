import type { ReactNode } from "react";

/**
 * Painted art that melts into the ground (never boxed). Use the
 * existing painted set only (src/content/home-art.ts); never generate
 * new art. `fade="edges"` for a vignette, "bottom" for a figure
 * standing on the page. Never put text over Hanuman ji.
 */
export function Plate({
  src,
  alt,
  width,
  height,
  fade = "edges",
  priority,
  className = "",
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  fade?: "edges" | "bottom" | "none";
  priority?: boolean;
  className?: string;
}) {
  return (
    <figure className={`bmi-plate ${fade === "edges" ? "fade" : fade === "bottom" ? "fade-b" : ""} ${className}`.trim()} data-rv>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={width} height={height} loading={priority ? "eager" : "lazy"} decoding="async" />
    </figure>
  );
}

/**
 * A real photo or pamphlet, mounted like the homepage's prints: white
 * mat, one soft shadow, a slight tilt. Contained, never cropped, so a
 * tall pamphlet shows whole. `href` makes it open the full image.
 */
export function Print({
  src,
  alt,
  caption,
  href,
  tilt = -1.2,
  priority,
}: {
  src: string;
  alt: string;
  caption?: ReactNode;
  href?: string;
  tilt?: number;
  priority?: boolean;
}) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
  const style = { ["--tilt" as string]: `${tilt}deg` };
  return (
    <figure className="bmi-print" style={style} data-rv>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="bmi-print-a">
          {img}
        </a>
      ) : (
        img
      )}
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
