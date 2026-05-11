import type { SVGProps } from "react";

type Position = "tl" | "tr" | "bl" | "br";

type Props = Omit<SVGProps<SVGSVGElement>, "color"> & {
  size?: number;
  color?: string;
  /** Which corner the motif sits in, rotates the artwork accordingly. */
  position?: Position;
};

const ROTATION: Record<Position, number> = {
  tl: 0,
  tr: 90,
  br: 180,
  bl: 270,
};

/**
 * Awadhi jali (lattice) corner ornament. Default art faces the top-left;
 * pass `position` to rotate to other corners.
 */
export default function JaliCorner({
  size = 80,
  color = "currentColor",
  position = "tl",
  className,
  ...rest
}: Props) {
  const rotate = ROTATION[position];
  return (
    <svg
      role="presentation"
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...rest}
    >
      <g transform={`rotate(${rotate} 50 50)`} stroke={color} strokeWidth="1.2" fill="none">
        {/* Outer arc */}
        <path d="M 8 8 L 92 8" opacity="0.6" />
        <path d="M 8 8 L 8 92" opacity="0.6" />
        {/* 6-pointed star */}
        <path d="M 22 22 L 30 14 L 38 22 L 30 30 Z" />
        <path d="M 22 22 L 30 30 L 22 38 L 14 30 Z" opacity="0.7" />
        {/* Quatrefoil */}
        <circle cx="46" cy="22" r="5" />
        <circle cx="22" cy="46" r="5" />
        {/* Connecting lattice */}
        <path d="M 14 30 Q 30 50 50 50" opacity="0.55" />
        <path d="M 30 14 Q 50 30 50 50" opacity="0.55" />
        {/* Inner ring */}
        <circle cx="50" cy="50" r="3" fill={color} opacity="0.4" />
      </g>
    </svg>
  );
}
