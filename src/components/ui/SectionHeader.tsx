"use client";

import type { ReactNode } from "react";
import Kicker from "@/components/ui/Kicker";
import { MarigoldDivider } from "@/components/ornaments";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * The canonical "kicker → headline → body → divider" stack used to
 * open every major section of the site (homepage stats, archive,
 * resources hub, history teaser, live empty state).
 *
 * The headline's typeface flips automatically based on locale —
 * Tiro Devanagari Hindi for Hindi, Fraunces for English — so callers
 * never need to ternary on isHi just to pick a font.
 *
 *   <SectionHeader
 *     kicker="Past Bhandaras"
 *     headline="Bhandaras of past Tuesdays"
 *     body="Every Tuesday whose moment has passed, kept here on the record."
 *   />
 *
 * Pass `divider={false}` if the next thing in the layout is a tall
 * card or a hero image that already provides visual weight.
 */
type Props = {
  /** Small-caps eyebrow text. */
  kicker: string;
  /** Main heading. Renders as <h2> by default; set `as="h1"` for the
   *  page-level one. */
  headline: string;
  /** One-sentence supporting paragraph. Optional. */
  body?: ReactNode;
  /** Render as h1 (page hero) or h2 (section) — defaults to h2. */
  as?: "h1" | "h2";
  /** Default true; set false to omit the marigold divider beneath. */
  divider?: boolean;
  /** Default "center". Use "left" for asymmetric editorial layouts. */
  align?: "center" | "left";
  /** Override the kicker tone (saffron, sindoor, gold, ink). Defaults
   *  to "saffron". */
  kickerTone?: "saffron" | "sindoor" | "gold" | "ink";
  className?: string;
};

export default function SectionHeader({
  kicker,
  headline,
  body,
  as = "h2",
  divider = true,
  align = "center",
  kickerTone = "saffron",
  className = "",
}: Props) {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";

  const HeadingTag = as;
  const headingSize =
    as === "h1"
      ? "text-3xl sm:text-[2.6rem] leading-tight"
      : "text-2xl sm:text-3xl leading-snug";

  // Devotional script gets Tiro; Latin gets Fraunces. Both are display
  // serifs in their own writing system — they pair instead of compete.
  const headingFont = isHi
    ? "font-tiro text-sindoor-700"
    : "font-fraunces font-semibold text-sindoor-700";

  return (
    <header
      className={`${
        align === "center" ? "text-center max-w-2xl mx-auto" : "text-left max-w-3xl"
      } ${className}`}
    >
      <Kicker tone={kickerTone}>{kicker}</Kicker>
      <HeadingTag
        className={`mt-3 ${headingSize} ${headingFont} [text-wrap:balance]`}
      >
        {headline}
      </HeadingTag>
      {body ? (
        <p
          className={`mt-3 text-ink-600 leading-relaxed [text-wrap:pretty] ${
            align === "center" ? "max-w-2xl mx-auto" : ""
          }`}
        >
          {body}
        </p>
      ) : null}
      {divider ? (
        <div
          className={`mt-6 ${align === "center" ? "flex justify-center" : ""}`}
        >
          <MarigoldDivider size={220} className="text-gold-500" />
        </div>
      ) : null}
    </header>
  );
}
