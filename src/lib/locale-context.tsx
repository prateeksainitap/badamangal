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
 * read forced the entire app to render dynamically, every navigation
 * cold-started a Netlify Function, producing the 3-4 s click-to-paint
 * lag people noticed.
 *
 * Locale now resolves entirely on the client. On mount, this provider
 * reads `document.cookie` (and an explicit `?lang=` URL override),
 * keeps the value in React state, and reflects it onto `<html lang>`
 * for accessibility. The server-rendered HTML is always English (the
 * site default for new visitors), so Hindi-cookie visitors briefly see
 * English copy before the swap, acceptable trade for full edge-cached
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

    // Event handler, branches on event type:
    //
    //   bm:locale-change → dispatched by <LangToggle /> immediately
    //     after it rewrites the cookie. At this moment the COOKIE is
    //     authoritative: the router.replace() that accompanied the
    //     cookie write updates the browser URL bar, but the update
    //     is not always reflected in window.location.href by the
    //     time this synchronous handler runs (browser + React
    //     scheduling timing). Reading the URL here used to return
    //     the PREVIOUS lang param, so a toggle sequence like
    //     EN -> HI -> EN -> HI failed on the second HI click: the
    //     handler saw the stale "?lang=en" URL, resolved to "en",
    //     and the visible swap didn't happen until the user clicked
    //     a second time. Prefer cookie here to bypass that race.
    //
    //   focus / popstate → real navigation events. window.location
    //     is definitely fresh by now, URL wins (the normal
    //     resolution order: URL override → cookie → SSR default).
    const onChange = (event?: Event) => {
      if (event?.type === "bm:locale-change") {
        apply(readCookieLocale() ?? readUrlLocale() ?? "en");
      } else {
        apply(resolve());
      }
    };
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
