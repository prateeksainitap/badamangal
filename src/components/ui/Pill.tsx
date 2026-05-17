import type { ReactNode } from "react";

/**
 * Rounded pill chip used for filters, badges, status indicators,
 * relative-time labels, area tags. The version of `<Kicker />` that
 * gets a background, same typography (Mukta uppercase, tracked-out)
 * but sitting on a coloured pill instead of being a paragraph.
 *
 *   <Pill tone="saffron">Live</Pill>
 *   <Pill tone="sindoor" dot>Today</Pill>
 *   <Pill tone="gold">Read · listen</Pill>
 *
 * For interactive pills (filter tabs, language toggle pieces), keep
 * styling them inline, those need :focus-visible and aria-selected
 * which would bloat this primitive.
 */
type Tone = "saffron" | "sindoor" | "gold" | "leaf" | "cream";

type Size = "sm" | "md";

type Props = {
  children: ReactNode;
  tone?: Tone;
  size?: Size;
  /** Show a small pulsing dot before the text. */
  dot?: boolean;
  /** Render an icon inline before the text. */
  icon?: ReactNode;
  className?: string;
};

const TONE: Record<Tone, string> = {
  saffron:
    "border-saffron-500/40 bg-saffron-50 text-saffron-600",
  sindoor:
    "border-sindoor-700/35 bg-sindoor-700/8 text-sindoor-700",
  gold: "border-gold-500/45 bg-cream-50 text-ink-700",
  leaf: "border-leaf-600/40 bg-leaf-600/10 text-leaf-600",
  cream: "border-gold-500/45 bg-cream-50/95 backdrop-blur text-saffron-600",
};

const TONE_DOT: Record<Tone, string> = {
  saffron: "bg-saffron-600",
  sindoor: "bg-sindoor-700",
  gold: "bg-gold-500",
  leaf: "bg-leaf-600",
  cream: "bg-saffron-600",
};

const SIZE: Record<Size, string> = {
  sm: "px-2 py-0.5 text-[0.6rem]",
  md: "px-3 py-1 text-[0.65rem]",
};

export default function Pill({
  children,
  tone = "saffron",
  size = "md",
  dot = false,
  icon,
  className = "",
}: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-mukta uppercase tracking-[0.22em] font-semibold ${TONE[tone]} ${SIZE[size]} ${className}`}
    >
      {dot ? (
        <span
          aria-hidden
          className={`block w-1.5 h-1.5 rounded-full motion-safe:animate-pulse ${TONE_DOT[tone]}`}
        />
      ) : null}
      {icon ? <span aria-hidden>{icon}</span> : null}
      <span>{children}</span>
    </span>
  );
}
