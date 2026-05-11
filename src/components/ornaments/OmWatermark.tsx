import type { SVGProps } from "react";

type Props = Omit<SVGProps<SVGSVGElement>, "color"> & {
  size?: number;
  color?: string;
  opacity?: number;
};

/**
 * Large pale-gold ॐ watermark for use as a section background motif.
 * Renders the glyph in Tiro Devanagari Hindi (loaded via next/font CSS var).
 */
export default function OmWatermark({
  size = 480,
  color = "currentColor",
  opacity = 0.08,
  className,
  ...rest
}: Props) {
  return (
    <svg
      role="presentation"
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 480 480"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...rest}
    >
      <text
        x="50%"
        y="62%"
        textAnchor="middle"
        fill={color}
        opacity={opacity}
        style={{
          fontFamily: "var(--font-tiro), serif",
          fontSize: 360,
          fontWeight: 400,
          letterSpacing: 0,
        }}
      >
        ॐ
      </text>
    </svg>
  );
}
