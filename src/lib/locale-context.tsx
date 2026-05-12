"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Locale } from "@/content/strings";
import { LANG_COOKIE } from "@/lib/i18n";

/**
 * Client-side locale context.
 *
 * Previously the root layout read the `bm_lang` cookie via Next's
 * server-side `cookies()` API and threaded the resolved locale into a
 * static <LocaleProvider value={...}>. That worked but the cookies()
 * read forced the entire app to render dynamically — every navigation
 * cold-started a Netlify Function, producing the 3-4 s click-to-paint
 * lag people noticed.
 *
 * Locale now resolves entirely on the client. On mount, this provider
 * reads `document.cookie` (and an explicit `?lang=` URL override),
 * keeps the value in React state, and reflects it onto `<html lang>`
 * for accessibility. The server-rendered HTML is always English (the
 * site default for new visitors), so Hindi-cookie visitors briefly see
 * English copy before the swap — acceptable trade for full edge-cached
 * navigation across the rest of the site.
 */
const LocaleContext = createContext<Locale>("en");

function readCookieLocale(): Locale | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${LANG_COOKIE}=`));
  if (!match) return null;
  const value = decodeURIComponent(match.split("=")[1] ?? "");
  return value === "hi" ? "hi" : value === "en" ? "en" : null;
}

function readUrlLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const lang = url.searchParams.get("lang");
  return lang === "hi" ? "hi" : lang === "en" ? "en" : null;
}

export function LocaleProvider({
  value,
  children,
}: {
  /** Server-rendered initial locale. Always "en" for static rendering;
   *  kept as a prop so existing call-sites compile unchanged. */
  value?: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocale] = useState<Locale>(value ?? "en");

  // Resolve actual locale on mount: URL param wins, then cookie, then
  // the SSR default. Listen on focus + popstate to catch swaps made by
  // <LangToggle /> (which writes the cookie directly via document.cookie
  // and then calls router.refresh()).
  useEffect(() => {
    const resolve = (): Locale =>
      readUrlLocale() ?? readCookieLocale() ?? "en";

    const apply = (next: Locale) => {
      setLocale((prev) => (prev === next ? prev : next));
      if (typeof document !== "undefined") {
        document.documentElement.lang = next === "hi" ? "hi-IN" : "en-IN";
      }
    };

    apply(resolve());
    const onChange = () => apply(resolve());
    // Listen for a custom event the <LangToggle /> dispatches the
    // moment it writes the cookie — keeps the UI in lock-step with
    // the toggle without waiting for a window blur/focus cycle.
    window.addEventListener("bm:locale-change", onChange as EventListener);
    window.addEventListener("focus", onChange);
    window.addEventListener("popstate", onChange);
    return () => {
      window.removeEventListener("bm:locale-change", onChange as EventListener);
      window.removeEventListener("focus", onChange);
      window.removeEventListener("popstate", onChange);
    };
  }, []);

  const ctx = useMemo(() => locale, [locale]);
  return <LocaleContext.Provider value={ctx}>{children}</LocaleContext.Provider>;
}

export function useLocaleFromContext(): Locale {
  return useContext(LocaleContext);
}
