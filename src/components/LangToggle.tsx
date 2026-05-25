"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { useLocaleFromContext } from "@/lib/locale-context";
import { trackEvent } from "@/lib/ga";
import { LANG_COOKIE, LANG_COOKIE_MAX_AGE } from "@/lib/i18n";
import type { Locale } from "@/content/strings";

export default function LangToggle() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  // React 18 startTransition lets router.refresh() run in the
  // background without blocking the click handler's other work.
  // The UI stays interactive even when the server route is doing
  // a cold-start Prisma fetch.
  const [, startTransition] = useTransition();

  // Locale comes from the LocaleProvider context, which is the single
  // source of truth the rest of the app reads from. The provider
  // already does the URL → cookie → SSR-default merge, so trusting
  // it here keeps the toggle's visible state in sync with the page
  // content it's labelling.
  //
  // Earlier this component did its own URL+cookie merge via
  // `params.get("lang")`. That looked symmetric with the provider but
  // introduced a race on every click: router.replace() updates the
  // browser URL synchronously via History API, while useSearchParams
  // (which is what `params` resolves to) hands out a snapshot that
  // doesn't refresh until React's next commit cycle. Result: cookie
  // = "hi", context = "hi", page content rendered in Hindi, but
  // params.get("lang") still returned the old "en" for one tick, and
  // the toggle stayed on "English" for 100–300ms after every swap.
  // Reading context only eliminates the snapshot read and the race.
  const lang: Locale = useLocaleFromContext();

  const setLang = useCallback(
    (next: "hi" | "en") => {
      if (next === lang || pending) return;
      trackEvent("lang_change", { from: lang, to: next });
      setPending(true);

      // ── Order matters: URL first, THEN cookie + event ───────────
      // LocaleProvider's bm:locale-change handler calls
      // readUrlLocale() (which reads window.location.href, NOT the
      // captured useSearchParams snapshot) before readCookieLocale().
      // If we set the cookie + dispatched the event BEFORE updating
      // the URL, the handler would read the OLD URL, find the old
      // ?lang= value, resolve to the OLD locale, and ignore the
      // freshly-written cookie. That was the "Hindi toggle doesn't
      // work on first click" bug: cookie + DOM cookie are correct
      // but LocaleProvider's React state stays stale until the next
      // focus/popstate cycle, so the visible swap only happened on
      // the second click.
      //
      // router.replace() updates window.location synchronously via
      // the History API, so by the time we fire bm:locale-change in
      // the next statement, both the URL AND the cookie reflect the
      // user's choice.
      const updated = new URLSearchParams(params.toString());
      if (next === "hi") updated.delete("lang");
      else updated.set("lang", "en");
      const qs = updated.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      router.replace(url, { scroll: false });

      // Now set the cookie and nudge LocaleProvider to re-resolve.
      // Modern browsers commit document.cookie synchronously, so the
      // event handler that fires immediately after sees the new value.
      // Background fetch to /api/lang is fire-and-forget belt+braces.
      try {
        const secure =
          window.location.protocol === "https:" ? "; secure" : "";
        document.cookie = `${LANG_COOKIE}=${next}; max-age=${LANG_COOKIE_MAX_AGE}; path=/; samesite=lax${secure}`;
        window.dispatchEvent(new Event("bm:locale-change"));
      } catch {
        /* private mode, server sync below covers it */
      }
      void fetch(`/api/lang?to=${next}`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      }).catch(() => {
        /* network blip, client-side cookie above is enough */
      });

      // Refresh the server tree so server-rendered text (page-level
      // headings, FeaturedBhandaras section, etc.) eventually swaps.
      // startTransition keeps the UI interactive while router.refresh
      // waits on the new server tree, otherwise a cold-start Prisma
      // query could block the click handler for 10-15s.
      startTransition(() => {
        router.refresh();
      });

      // Clear the pending flag on the next tick, the visual pill
      // animation finishes around the same time the refresh paints.
      window.setTimeout(() => setPending(false), 350);
    },
    [lang, pending, params, pathname, router, startTransition],
  );

  const base =
    "relative z-10 inline-flex items-center justify-center h-9 w-[88px] pt-[3px] text-[0.78rem] font-semibold leading-none tracking-wide transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-600 rounded-full";

  return (
    <div
      role="group"
      aria-label="Language"
      className="relative inline-grid grid-cols-2 items-center rounded-full border border-gold-500/50 bg-cream-50/80 backdrop-blur p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
    >
      {/* Sliding indicator pill, exactly half the grid width */}
      <span
        aria-hidden
        className="absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-gradient-to-b from-saffron-500 to-saffron-600 shadow-warm transition-transform duration-300 ease-out"
        style={{
          transform: lang === "en" ? "translateX(100%)" : "translateX(0%)",
        }}
      />
      <button
        type="button"
        onClick={() => setLang("hi")}
        aria-pressed={lang === "hi"}
        className={`${base} font-mukta ${
          lang === "hi" ? "text-cream-50" : "text-ink-900/70 hover:text-sindoor-700"
        }`}
      >
        हिन्दी
      </button>
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
        className={`${base} ${
          lang === "en" ? "text-cream-50" : "text-ink-900/70 hover:text-sindoor-700"
        }`}
      >
        English
      </button>
    </div>
  );
}
