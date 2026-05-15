import type { ReactNode } from "react";

/**
 * The small-caps eyebrow that sits above almost every section heading
 * on the site. Codified here so the spacing, tracking, weight, and
 * colour stay in lock-step across every surface.
 *
 * Variants change the *colour* of the kicker; the typography itself is
 * always Mukta uppercase at 0.32em letter-spacing, semibold.
 *
 *   <Kicker>Bhandaras of past Tuesdays</Kicker>
 *   <Kicker tone="gold">A 400-year-old tradition</Kicker>
 *   <Kicker dot>Live</Kicker>
 *
 * If you find yourself writing the className `font-mukta uppercase
 * tracking-[0.32em] text-saffron-600 text-xs font-semibold` anywhere,
 * use this instead.
 */
type Tone = "saffron" | "sindoor" | "gold" | "ink";

type Props = {
  children: ReactNode;
  /** Default "saffron". Sindoor for devotional sections, gold for
   *  editorial pages, ink for muted secondary kickers. */
  tone?: Tone;
  /** Show a small pulsing dot before the text. Used on Live / urgency
   *  surfaces. */
  dot?: boolean;
  className?: string;
};

const TONE_TEXT: Record<Tone, string> = {
  saffron: "text-saffron-600",
  sindoor: "text-sindoor-700",
  gold: "text-gold-500",
  ink: "text-ink-600",
};

const TONE_DOT: Record<Tone, string> = {
  saffron: "bg-saffron-600",
  sindoor: "bg-sindoor-700",
  gold: "bg-gold-500",
  ink: "bg-ink-600",
};

export default function Kicker({
  children,
  tone = "saffron",
  dot = false,
  className = "",
}: Props) {
  return (
    <p
      className={`font-mukta uppercase tracking-[0.32em] text-xs font-semibold inline-flex items-center gap-1.5 ${TONE_TEXT[tone]} ${className}`}
    >
      {dot ? (
        <span
          aria-hidden
          className={`block w-1.5 h-1.5 rounded-full motion-safe:animate-pulse ${TONE_DOT[tone]}`}
        />
      ) : null}
      <span>{children}</span>
    </p>
  );
}
