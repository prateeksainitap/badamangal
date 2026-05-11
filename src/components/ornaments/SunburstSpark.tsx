import type { SVGProps } from "react";

type Props = Omit<SVGProps<SVGSVGElement>, "color"> & {
  size?: number;
  color?: string;
};

/**
 * Small 8-ray sunburst, used as a section anchor and loading indicator.
 * Mirrors the brand mark's solar motif.
 */
export default function SunburstSpark({
  size = 120,
  color = "currentColor",
  className,
  ...rest
}: Props) {
  return (
    <svg
      role="presentation"
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...rest}
    >
      <g transform="translate(60 60)">
        {/* Long rays */}
        <g fill={color} opacity="0.85">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <g key={`l-${deg}`} transform={`rotate(${deg})`}>
              <polygon points="0,-54 4,-26 -4,-26" />
            </g>
          ))}
        </g>
        {/* Short rays */}
        <g fill={color} opacity="0.55">
          {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((deg) => (
            <g key={`s-${deg}`} transform={`rotate(${deg})`}>
              <polygon points="0,-44 3,-22 -3,-22" />
            </g>
          ))}
        </g>
        {/* Centre dot */}
        <circle cx={0} cy={0} r={10} fill={color} opacity="0.9" />
        <circle cx={0} cy={0} r={4} fill="#FBF7F0" />
      </g>
    </svg>
  );
}
