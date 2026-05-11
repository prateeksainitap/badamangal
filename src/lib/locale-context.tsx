"use client";

import { createContext, useContext } from "react";
import type { Locale } from "@/content/strings";

/**
 * Initial locale resolved server-side from the `bm_lang` cookie. URL `?lang=`
 * overrides this in `useT()` and `<LangToggle />`. Provider lives in the root
 * layout so SSR and client first-render see the same value (no hydration
 * mismatch on cookie-set English users).
 */
const LocaleContext = createContext<Locale>("hi");

export function LocaleProvider({
  value,
  children,
}: {
  value: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocaleFromContext(): Locale {
  return useContext(LocaleContext);
}
