import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & {
  /** Rendered width in pixels. Height scales to keep aspect. */
  size?: number;
  /** Stroke + accent colour. Defaults to `currentColor`. */
  color?: string;
};

/**
 * Three stylized marigold heads on a thin gold thread. Use as a section
 * divider in place of `<hr />`.
 */
export default function MarigoldDivider({
  size = 240,
  color = "currentColor",
  className,
  ...rest
}: Props) {
  const aspect = 5;
  return (
    <svg
      role="presentation"
      aria-hidden="true"
      width={size}
      height={size / aspect}
      viewBox="0 0 500 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...rest}
    >
      <line x1="10" y1="50" x2="180" y2="50" stroke={color} strokeWidth="1" opacity="0.5" />
      <line x1="320" y1="50" x2="490" y2="50" stroke={color} strokeWidth="1" opacity="0.5" />
      <Marigold cx={210} cy={50} r={14} color={color} />
      <Marigold cx={250} cy={50} r={18} color={color} accent />
      <Marigold cx={290} cy={50} r={14} color={color} />
    </svg>
  );
}

function Marigold({
  cx,
  cy,
  r,
  color,
  accent = false,
}: {
  cx: number;
  cy: number;
  r: number;
  color: string;
  accent?: boolean;
}) {
  const petalCount = 8;
  const petals = Array.from({ length: petalCount }, (_, i) => {
    const angle = (i * 360) / petalCount;
    return (
      <ellipse
        key={i}
        cx={0}
        cy={-r * 0.55}
        rx={r * 0.32}
        ry={r * 0.55}
        fill={color}
        opacity={accent ? 0.9 : 0.7}
        transform={`rotate(${angle})`}
      />
    );
  });
  return (
    <g transform={`translate(${cx} ${cy})`}>
      {petals}
      <circle cx={0} cy={0} r={r * 0.22} fill={color} />
    </g>
  );
}
