"use client";

import { useSearchParams } from "next/navigation";
import { strings, type Locale } from "@/content/strings";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * Resolve the active locale on the client without causing hydration
 * mismatches. The cookie-derived locale comes from React context (set by the
 * root layout server-side), so SSR and the first client render agree. URL
 * `?lang=` overrides the cookie.
 */
export function useT() {
  const params = useSearchParams();
  const url = params.get("lang") ?? undefined;
  const ctxLocale = useLocaleFromContext();
  const locale: Locale = url === "en" ? "en" : url === "hi" ? "hi" : ctxLocale;
  return { locale, t: strings[locale] };
}
