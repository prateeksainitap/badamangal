"use client";

import { useEffect, useState } from "react";

type Tag = "h1" | "h2" | "h3" | "p";

export type AnimatedHeadingProps = {
  text: string;
  /** Render as which element (default h1). */
  as?: Tag;
  className?: string;
  /** ms between each letter. Default 60. */
  staggerMs?: number;
  /** Delay (ms) before the first letter starts. Default 0. */
  startDelayMs?: number;
  /** BCP-47 language tag, e.g. "hi" or "en". Helps Intl.Segmenter. */
  lang?: string;
};

/**
 * Letter-by-letter fade-in heading. Devanagari-safe: we segment by Unicode
 * grapheme clusters via Intl.Segmenter, so a vowel mark + consonant pair
 * animates as one visual character.
 *
 * Words (whitespace-separated tokens) are wrapped in their own span with
 * `white-space: nowrap` so the browser cannot split a word like "थाली" into
 * "था" + "ली" across a line break, without this, every grapheme becomes a
 * legal break point because each is `inline-block`.
 *
 * Falls back to a static heading when prefers-reduced-motion is reduce.
 */
export default function AnimatedHeading({
  text,
  as = "h1",
  className,
  staggerMs = 60,
  startDelayMs = 0,
  lang,
}: AnimatedHeadingProps) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(m.matches);
    update();
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);

  const Tag = as;

  if (reduced) {
    return (
      <Tag className={className} lang={lang}>
        {text}
      </Tag>
    );
  }

  // Split into [whitespace, word, whitespace, word, …] preserving runs of
  // whitespace so spacing is exact.
  const tokens = text.split(/(\s+)/);
  let graphemeIndex = 0;

  return (
    <Tag
      className={`reveal-letters ${className ?? ""}`}
      aria-label={text}
      lang={lang}
    >
      {tokens.map((tok, ti) => {
        if (/^\s+$/.test(tok)) {
          // preserve the original whitespace between words; not animated.
          return (
            <span key={`ws-${ti}`} aria-hidden>
              {tok}
            </span>
          );
        }
        if (tok === "") return null;
        const graphemes = segmentGraphemes(tok, lang);
        return (
          <span
            key={`w-${ti}`}
            className="word"
            aria-hidden
            // word-level white-space: nowrap prevents Devanagari breaking
            // mid-word at grapheme boundaries.
            style={{ whiteSpace: "nowrap", display: "inline-block" }}
          >
            {graphemes.map((g, gi) => {
              const i = graphemeIndex++;
              return (
                <span
                  key={`g-${ti}-${gi}`}
                  className="letter"
                  style={{
                    ["--i" as never]: String(i),
                    animationDelay: `${startDelayMs + i * staggerMs}ms`,
                  }}
                >
                  {g}
                </span>
              );
            })}
          </span>
        );
      })}
    </Tag>
  );
}

function segmentGraphemes(input: string, lang?: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter(lang, { granularity: "grapheme" });
    return [...seg.segment(input)].map((s) => s.segment);
  }
  return Array.from(input);
}
