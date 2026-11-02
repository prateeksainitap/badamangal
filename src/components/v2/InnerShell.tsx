import "./tokens.css";
import "./inner-v2.css";
import type { ReactNode } from "react";
import InnerMotion from "./InnerMotion";

/**
 * The wrapper every redesigned inner page renders inside. It scopes the
 * kit's CSS (.bmi), sets the ground and runs the reveal motion. The
 * global Header and Footer stay outside it (app/layout.tsx), exactly
 * as on the homepage.
 *
 *   <InnerShell>
 *     <PageHero ... />
 *     <Section ...>...</Section>
 *   </InnerShell>
 *
 * `as="article"` for a single thing (a bhandara, a temple), "div"
 * otherwise. `ground="paper"` for the warmer paper colour.
 */
export default function InnerShell({
  children,
  as: Tag = "div",
  ground = "cream",
  className = "",
  id,
}: {
  children: ReactNode;
  as?: "div" | "article";
  ground?: "cream" | "paper";
  className?: string;
  id?: string;
}) {
  return (
    <Tag
      id={id}
      className={`bmi ${className}`.trim()}
      data-ground={ground === "paper" ? "paper" : undefined}
      suppressHydrationWarning
    >
      <InnerMotion />
      {children}
    </Tag>
  );
}
