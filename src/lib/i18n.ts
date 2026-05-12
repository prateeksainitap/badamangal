import { strings, type Locale } from "@/content/strings";

// Cookie name bumped (was `bm_lang`) to invalidate the pool of dev /
// preview-era cookies that defaulted everyone to Hindi. With the new
// name, every existing visitor falls through to the new default ("en")
// the next time they land — and re-sets the cookie via the toggle if
// they pick Hindi.
export const LANG_COOKIE = "bm_lang_v2";
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function getLocaleFromParam(lang: string | string[] | undefined): Locale {
  const value = Array.isArray(lang) ? lang[0] : lang;
  return value === "hi" ? "hi" : "en";
}

/**
 * Resolve the visitor's preferred locale.
 *
 * Priority:
 *   1. Explicit `?lang=` URL param (deep links / shared URLs win)
 *   2. `bm_lang` cookie (visitor toggled language at some point)
 *   3. Default → English
 *
 * Defaulting to English was a launch-day call: the homepage's heavier
 * lifts (map UI, admin tooling, devotional players) all read naturally
 * in English, and most first-time inbound traffic comes from search
 * + share previews that are themselves English-indexed. Hindi remains
 * a first-class locale via the toggle in the header (and `?lang=hi`).
 */
export function resolveLocale(opts: {
  urlLang?: string | string[];
  cookieLang?: string;
}): Locale {
  const url = Array.isArray(opts.urlLang) ? opts.urlLang[0] : opts.urlLang;
  if (url === "hi") return "hi";
  if (url === "en") return "en";
  if (opts.cookieLang === "hi") return "hi";
  return "en";
}

export function tFor(locale: Locale) {
  return strings[locale];
}
