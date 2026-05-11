import { strings, type Locale } from "@/content/strings";

export const LANG_COOKIE = "bm_lang";
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function getLocaleFromParam(lang: string | string[] | undefined): Locale {
  const value = Array.isArray(lang) ? lang[0] : lang;
  return value === "en" ? "en" : "hi";
}

export function resolveLocale(opts: {
  urlLang?: string | string[];
  cookieLang?: string;
}): Locale {
  const url = Array.isArray(opts.urlLang) ? opts.urlLang[0] : opts.urlLang;
  if (url === "en") return "en";
  if (url === "hi") return "hi";
  if (opts.cookieLang === "en") return "en";
  return "hi";
}

export function tFor(locale: Locale) {
  return strings[locale];
}
