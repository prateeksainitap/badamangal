import { loadGoogleFont } from "@/lib/og-fonts";
import { OG_HINDI_WORDMARKS } from "@/lib/og-hindi-wordmarks.generated";

/**
 * Hindi in share images (opengraph-image.tsx routes).
 *
 * next/og (Satori) cannot shape Devanagari: it prints "मंदरि" for
 * "मंदिर", shows a visible halant inside conjuncts and breaks reph. So
 * share images never draw Hindi as text. Fixed Hindi strings are
 * pre-shaped into PNG wordmarks by scripts/build-og-hindi-wordmarks.ts
 * and composited as an <img>. A string without a wordmark returns null
 * and the caller shows English only.
 */
export type OgHindiWordmark = { src: string; width: number; height: number };

export function ogHindiWordmark(text: string | null | undefined): OgHindiWordmark | null {
  if (!text) return null;
  return OG_HINDI_WORDMARKS[text] ?? null;
}

const DEVANAGARI = /[ऀ-ॿ꣠-ꣿ]/;

/** True when the string contains any Devanagari, which Satori would misdraw. */
export function hasDevanagari(text: string | null | undefined): boolean {
  return !!text && DEVANAGARI.test(text);
}

/** Share image fonts: Anek Latin for headings, Mukta for body. Both sans. */
export const OG_HEADING_FONT = "Anek Latin";
export const OG_BODY_FONT = "Mukta";

type OgFont = { name: string; data: ArrayBuffer; weight: 500 | 600 | 700; style: "normal" };

/** Loads the share image fonts. Missing fonts are skipped (Satori then uses its default sans). */
export async function loadOgFonts(): Promise<OgFont[] | undefined> {
  const [anek700, anek600, mukta500] = await Promise.all([
    loadGoogleFont(OG_HEADING_FONT, 700),
    loadGoogleFont(OG_HEADING_FONT, 600),
    loadGoogleFont(OG_BODY_FONT, 500),
  ]);
  const fonts: OgFont[] = [];
  if (anek700) fonts.push({ name: OG_HEADING_FONT, data: anek700, weight: 700, style: "normal" });
  if (anek600) fonts.push({ name: OG_HEADING_FONT, data: anek600, weight: 600, style: "normal" });
  if (mukta500) fonts.push({ name: OG_BODY_FONT, data: mukta500, weight: 500, style: "normal" });
  return fonts.length ? fonts : undefined;
}
