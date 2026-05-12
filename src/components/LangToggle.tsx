"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useLocaleFromContext } from "@/lib/locale-context";
import { trackEvent } from "@/lib/ga";
import { LANG_COOKIE, LANG_COOKIE_MAX_AGE } from "@/lib/i18n";
import type { Locale } from "@/content/strings";

export default function LangToggle() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = useState(false);

  // Cookie-derived locale comes from server context (no document.cookie read
  // on the client → no hydration mismatch). URL still overrides.
  const ctxLocale = useLocaleFromContext();
  const urlLang = params.get("lang");
  const lang: Locale =
    urlLang === "en" ? "en" : urlLang === "hi" ? "hi" : ctxLocale;

  const setLang = useCallback(
    (next: "hi" | "en") => {
      if (next === lang || pending) return;
      trackEvent("lang_change", { from: lang, to: next });
      setPending(true);

      // ── Optimistic, client-first cookie write ────────────────────
      // Previously we `await`-ed a server round-trip to `/api/lang`
      // before updating the URL — that added ~200-500ms of latency
      // (Netlify Function cold start) on every toggle, making the
      // language switch feel laggy. Modern browsers commit
      // `document.cookie` synchronously, so we can write client-side
      // first (instant) and fire-and-forget the server sync in the
      // background as a belt-and-suspenders backup. The next render
      // sees the cookie immediately because it's the same document.
      try {
        const secure =
          window.location.protocol === "https:" ? "; secure" : "";
        document.cookie = `${LANG_COOKIE}=${next}; max-age=${LANG_COOKIE_MAX_AGE}; path=/; samesite=lax${secure}`;
        // Tell <LocaleProvider /> to re-resolve immediately; otherwise
        // the UI would only swap on the next focus / popstate event.
        window.dispatchEvent(new Event("bm:locale-change"));
      } catch {
        /* private mode — server sync below covers it */
      }
      // Background sync; we don't wait for it.
      void fetch(`/api/lang?to=${next}`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      }).catch(() => {
        /* network blip — client-side cookie above is enough */
      });

      // Update the URL (soft — no scroll, no full reload), then
      // refresh the server tree so layout + page re-render in the
      // newly-set locale. With `?lang=en` or `?lang=hi` in the URL,
      // `resolveLocale` picks up the new locale immediately on the
      // next server render even if the cookie hasn't synced yet.
      const updated = new URLSearchParams(params.toString());
      if (next === "hi") updated.delete("lang");
      else updated.set("lang", "en");
      const qs = updated.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      router.replace(url, { scroll: false });
      router.refresh();

      // Clear the pending flag on the next tick — the visual pill
      // animation finishes around the same time the refresh paints.
      window.setTimeout(() => setPending(false), 350);
    },
    [lang, pending, params, pathname, router],
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
