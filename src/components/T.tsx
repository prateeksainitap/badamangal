"use client";

import type { ReactNode } from "react";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * Inline locale switcher for server-rendered text.
 *
 * The public pages are now statically prerendered (no cookies() on the
 * server), which means server-component text is always in the default
 * locale — visible to a Hindi-cookie visitor as English copy on a page
 * whose language toggle says Hindi. Wrapping the swap in this tiny
 * client component lets the HTML carry both strings; the client
 * picks the right one from the cookie-aware LocaleProvider on mount.
 *
 * Both strings ship in the HTML payload, which means search engines
 * also see both languages — a small SEO bonus on top of the speed win
 * from staying statically cached.
 *
 *   <T en="Hanuman Chalisa" hi="हनुमान चालीसा" />
 *   <T en="Read all forty verses" hi="चालीसा पढ़ें" />
 *
 * For an element-level swap (e.g. different `className` per locale)
 * keep using the existing `useLocaleFromContext` hook in a client
 * component — this helper is just for text-content cases.
 */
export function T({ en, hi }: { en: ReactNode; hi: ReactNode }) {
  const locale = useLocaleFromContext();
  return <>{locale === "hi" ? hi : en}</>;
}
