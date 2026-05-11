// Lightweight Google Fonts fetcher for next/og ImageResponse. Returns the
// raw font bytes or null on any error. Cached across calls within a single
// runtime invocation.
const cache: Record<string, ArrayBuffer | null> = {};

export async function loadGoogleFont(
  family: string,
  weight = 400,
): Promise<ArrayBuffer | null> {
  const key = `${family}:${weight}`;
  if (key in cache) return cache[key];
  try {
    const familyParam = family.replace(/ /g, "+");
    const cssUrl = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@${weight}&display=swap`;
    // Pre-WOFF2 user-agent so Google Fonts returns TTF; Satori (used by
    // next/og) cannot parse WOFF2 and throws "Unsupported OpenType signature".
    const cssRes = await fetch(cssUrl, {
      headers: {
        "user-agent":
          "Mozilla/4.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)",
      },
      cache: "force-cache",
    });
    if (!cssRes.ok) {
      cache[key] = null;
      return null;
    }
    const css = await cssRes.text();
    // Prefer TTF; fall back to whatever URL is in the CSS.
    const ttfMatch = css.match(/url\((https:\/\/[^)]+\.ttf)\)/i);
    const anyMatch = css.match(/url\((https:\/\/[^)]+)\)/);
    const match = ttfMatch ?? anyMatch;
    if (!match) {
      cache[key] = null;
      return null;
    }
    const fontRes = await fetch(match[1], { cache: "force-cache" });
    if (!fontRes.ok) {
      cache[key] = null;
      return null;
    }
    const data = await fontRes.arrayBuffer();
    cache[key] = data;
    return data;
  } catch {
    cache[key] = null;
    return null;
  }
}
