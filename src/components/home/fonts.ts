import localFont from "next/font/local";

/**
 * Display faces for the v2 homepage, self-hosted (never next/font/google,
 * which broke a Vercel build on DharmKriya). The Google Fonts variable
 * file sliced to the 700 to 800 weight axis with fontTools. Hindi
 * headings use Mukta ExtraBold, the live site's Hindi heading face
 * (Founder, 2 Nov 2026), loaded once in app/layout.tsx.
 *
 * Declared in this module, imported only by the homepage tree, so the
 * preload links and @font-face rules ship on the homepage only.
 */
export const anekLatin = localFont({
  src: "../../fonts/AnekLatin-700-800.woff2",
  weight: "700 800",
  style: "normal",
  display: "swap",
  variable: "--font-anek-latin",
  preload: true,
  fallback: ["system-ui", "sans-serif"],
});
