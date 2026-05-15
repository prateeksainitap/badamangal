import type { ReactNode } from "react";
import { JaliCorner } from "@/components/ornaments";

/**
 * Wrap any positioned child (a card, an empty state, a hero panel)
 * with the four Awadhi-jali corner ornaments. Saves the four explicit
 * `<JaliCorner position="…" />` calls — and more importantly, keeps the
 * sizing + opacity in lock-step. Every page that uses jali corners is
 * doing the exact same dance with the exact same numbers; this hides
 * them.
 *
 *   <JaliFrame>
 *     <Card>…</Card>
 *   </JaliFrame>
 *
 * The wrapper is `relative` so the corners can position themselves;
 * the parent should already provide the rounded outer card surface.
 * If you need different sizes per corner (e.g. larger top, lighter
 * bottom — the empty-state pattern), pass `size` / `subtle` props.
 */
type Props = {
  children: ReactNode;
  /** Px width/height of each corner. Default 56. */
  size?: number;
  /** When true, bottom corners render at half opacity — matches the
   *  hero / empty-state pattern where weight should sit at the top. */
  subtle?: boolean;
  className?: string;
};

export default function JaliFrame({
  children,
  size = 56,
  subtle = false,
  className = "",
}: Props) {
  const topClass = "text-gold-500/55";
  const bottomClass = subtle ? "text-gold-500/30" : "text-gold-500/55";

  return (
    <div className={`relative ${className}`}>
      <JaliCorner
        position="tl"
        size={size}
        className={`absolute top-0 left-0 ${topClass}`}
      />
      <JaliCorner
        position="tr"
        size={size}
        className={`absolute top-0 right-0 ${topClass}`}
      />
      <JaliCorner
        position="bl"
        size={size}
        className={`absolute bottom-0 left-0 ${bottomClass}`}
      />
      <JaliCorner
        position="br"
        size={size}
        className={`absolute bottom-0 right-0 ${bottomClass}`}
      />
      {children}
    </div>
  );
}
