"use client";

import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * Drop-in bilingual text. Reads the locale from the LocaleProvider
 * context (cookie + URL `?lang=` aware) and renders the matching
 * variant. Server renders the English version because the context
 * defaults to "en"; after hydration the client swaps to Hindi if the
 * `bm_lang` cookie says so.
 *
 * Use this inside server pages where a handful of strings need to
 * swap on the Hindi toggle, but the surrounding tree is otherwise
 * fine staying static. For pages with lots of locale-dependent JSX,
 * prefer extracting the whole view into a per-page client component
 * (see HomeHero / HomeHistoryTeaser etc.).
 */
type Props = {
  en: React.ReactNode;
  hi: React.ReactNode;
};

export default function L({ en, hi }: Props) {
  const locale = useLocaleFromContext();
  return <>{locale === "hi" ? hi : en}</>;
}
