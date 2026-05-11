import type { SVGProps } from "react";

type Props = Omit<SVGProps<SVGSVGElement>, "color"> & {
  size?: number;
  /** Colour of the lamp body. Defaults to `currentColor`. */
  color?: string;
  /** Colour of the flame. Defaults to saffron. */
  flameColor?: string;
};

/**
 * Three-lamp diya cluster, glowing. Used at the foot of cards or pages.
 */
export default function DiyaCluster({
  size = 120,
  color = "currentColor",
  flameColor = "#E07A1F",
  className,
  ...rest
}: Props) {
  return (
    <svg
      role="presentation"
      aria-hidden="true"
      width={size}
      height={size * 0.66}
      viewBox="0 0 240 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...rest}
    >
      <Diya cx={60} cy={110} scale={0.85} color={color} flameColor={flameColor} />
      <Diya cx={120} cy={104} scale={1.1} color={color} flameColor={flameColor} />
      <Diya cx={180} cy={110} scale={0.85} color={color} flameColor={flameColor} />
    </svg>
  );
}

function Diya({
  cx,
  cy,
  scale,
  color,
  flameColor,
}: {
  cx: number;
  cy: number;
  scale: number;
  color: string;
  flameColor: string;
}) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${scale})`}>
      {/* Flame glow */}
      <ellipse cx={0} cy={-30} rx={20} ry={26} fill={flameColor} opacity="0.18" />
      {/* Flame */}
      <path
        d="M 0 -42 C 6 -34 8 -22 0 -14 C -8 -22 -6 -34 0 -42 Z"
        fill={flameColor}
        opacity="0.95"
      />
      <path
        d="M 0 -38 C 3 -32 4 -22 0 -18 C -4 -22 -3 -32 0 -38 Z"
        fill="#FBF7F0"
        opacity="0.7"
      />
      {/* Wick */}
      <line x1={0} y1={-14} x2={0} y2={-6} stroke={color} strokeWidth="1.2" opacity="0.7" />
      {/* Lamp body */}
      <path d="M -30 -6 Q 0 16 30 -6 L 26 0 Q 0 12 -26 0 Z" fill={color} />
      <ellipse cx={0} cy={-6} rx={30} ry={6} fill={color} opacity="0.7" />
      {/* Base shadow */}
      <ellipse cx={0} cy={6} rx={18} ry={3} fill={color} opacity="0.15" />
    </g>
  );
}
