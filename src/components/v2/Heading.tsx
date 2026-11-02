"use client";

import type { ReactNode } from "react";
import { useLocaleFromContext } from "@/lib/locale-context";
import Words from "@/components/home/Words";
import { hasDevanagari } from "./lang";

/**
 * A heading in ONE language: Hindi for Hindi readers, English otherwise
 * (never a Hindi line with its English under it). Words rise in one by
 * one, like the homepage. Devanagari text, in either locale, gets the
 * Devanagari face and line-height 1.3 so matras never clip.
 *
 *   <Heading as="h1" size="display" en="Hanuman Chalisa" hi="हनुमान चालीसा" />
 *   <Heading as="h2" lang="en">Other bhandaras in <Link ...>Aliganj</Link></Heading>
 *
 * Keep SEO heading text exactly as it was: pass the old strings.
 */
export default function Heading({
  as: Tag = "h2",
  size,
  en,
  hi,
  children,
  lang,
  id,
  className = "",
  words = true,
  long,
}: {
  as?: "h1" | "h2" | "h3" | "p";
  /** display = page h1, section = section h2, sub = small heading. */
  size?: "display" | "section" | "sub";
  en?: string;
  hi?: string;
  /** Custom content (a heading with a link inside). Pass `lang`. */
  children?: ReactNode;
  lang?: "en" | "hi";
  id?: string;
  className?: string;
  /** Word by word reveal (strings only). */
  words?: boolean;
  /** Smaller display size for long titles; auto above 44 characters. */
  long?: boolean;
}) {
  const isHi = useLocaleFromContext() === "hi";
  const text = children == null ? (isHi ? (hi ?? en) : (en ?? hi)) ?? "" : null;
  const deva = text != null ? hasDevanagari(text) : (lang ?? (isHi ? "hi" : "en")) === "hi";
  const s = size ?? (Tag === "h1" ? "display" : Tag === "h3" ? "sub" : "section");
  const base = s === "display" ? "bmi-h1" : s === "sub" ? "bmi-h3" : "bmi-h2";
  const isLong = long ?? (s === "display" && (text?.length ?? 0) > 44);
  const cls = [
    base,
    deva ? "" : "lat",
    isLong ? "long" : "",
    text != null && words ? "words" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag className={cls} id={id} lang={deva ? "hi" : "en"}>
      {text != null ? words ? <Words text={text} /> : text : children}
    </Tag>
  );
}
