import type { SVGProps } from "react";

type Props = Omit<SVGProps<SVGSVGElement>, "color"> & {
  size?: number;
  color?: string;
};

/**
 * Tiny gada (mace) glyph used as a bullet marker in storytelling lists,
 * replacing the standard `•`.
 */
export default function GadaBullet({
  size = 14,
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
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...rest}
    >
      <circle cx="8" cy="4" r="3" fill={color} />
      <rect x="7" y="6.5" width="2" height="6.5" rx="0.6" fill={color} />
      <ellipse cx="8" cy="13.5" rx="2.2" ry="0.8" fill={color} opacity="0.85" />
    </svg>
  );
}
