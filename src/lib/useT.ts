"use client";

import { strings, type Locale } from "@/content/strings";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * Hook for client components to grab the current locale and its
 * matching string bundle. Reads from the LocaleProvider context, which
 * already handles URL `?lang=` override → cookie → English default.
 *
 * Previously this hook called `useSearchParams()` directly so callers
 * didn't need a provider, but that broke the build once the public
 * pages went static — `useSearchParams()` requires a Suspense boundary
 * during prerender, and Footer/LiveActivityTicker mount in the layout
 * tree without one. Reading from context avoids the issue entirely
 * and keeps the same observable behaviour (LocaleProvider mirrors the
 * URL param at mount).
 */
export function useT(): { locale: Locale; t: (typeof strings)[Locale] } {
  const locale = useLocaleFromContext();
  return { locale, t: strings[locale] };
}
