"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_CITY_SLUG,
  getCity,
  isCitySlug,
  type City,
  type CitySlug,
} from "@/lib/cities";

/**
 * Client-side city context.
 *
 * Deliberately mirrors LocaleProvider rather than inventing a second
 * pattern, and for the same hard-won reason documented there: reading
 * a cookie via Next's server-side `cookies()` API forces the whole app
 * to render dynamically and reintroduces the 3-4s click-to-paint lag
 * this site already fixed once. So the server always renders the
 * default city (Lucknow) and the real city resolves on mount.
 *
 * Resolution order, highest priority first:
 *   1. `?city=` in the URL     (shareable links, campaign landing)
 *   2. the persisted cookie    (returning visitor's own choice)
 *   3. Lucknow                 (the flagship, and the only city with
 *                               a full season of data)
 *
 * Geolocation is deliberately NOT consulted. It costs a permission
 * prompt on first paint, and being auto-switched to a city you did not
 * pick is more jarring than a one-tap switcher, especially for the
 * large out-of-town/diaspora audience the analytics already show
 * (Delhi, Bengaluru, Mumbai) who want Lucknow, not their own city.
 */

export const CITY_COOKIE = "bm_city_v1";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

type CityContextValue = {
  city: City;
  citySlug: CitySlug;
  setCity: (slug: CitySlug) => void;
};

const CityContext = createContext<CityContextValue>({
  city: getCity(DEFAULT_CITY_SLUG),
  citySlug: DEFAULT_CITY_SLUG,
  setCity: () => {},
});

function readCookieCity(): CitySlug | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CITY_COOKIE}=`));
  if (!match) return null;
  const value = decodeURIComponent(match.split("=")[1] ?? "");
  return isCitySlug(value) ? value : null;
}

function readUrlCity(): CitySlug | null {
  if (typeof window === "undefined") return null;
  const value = new URL(window.location.href).searchParams.get("city");
  return isCitySlug(value) ? value : null;
}

export function CityProvider({
  children,
  initial = DEFAULT_CITY_SLUG,
}: {
  children: React.ReactNode;
  initial?: CitySlug;
}) {
  const [slug, setSlug] = useState<CitySlug>(initial);

  useEffect(() => {
    const resolved = readUrlCity() ?? readCookieCity();
    if (resolved && resolved !== slug) setSlug(resolved);
    // Intentionally mount-only. Re-running on `slug` would fight the
    // setCity writes below (cookie updated -> effect reads it back ->
    // no-op, but it makes the data flow circular and hard to reason
    // about). Navigation-triggered re-resolution is handled by the
    // popstate listener instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Browser back/forward between ?city= links should track the URL.
  useEffect(() => {
    const onPop = () => {
      const fromUrl = readUrlCity();
      if (fromUrl) setSlug(fromUrl);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const setCity = useCallback((next: CitySlug) => {
    setSlug(next);
    try {
      document.cookie = `${CITY_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
    } catch {
      // Cookies blocked (private mode / strict settings). The choice
      // still applies for this page view, it just will not persist,
      // which is a better outcome than throwing on a UI interaction.
    }
  }, []);

  const value = useMemo<CityContextValue>(
    () => ({ city: getCity(slug), citySlug: slug, setCity }),
    [slug, setCity],
  );

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

/** Full City object for the active city. */
export function useCity(): City {
  return useContext(CityContext).city;
}

/** Active city slug plus the setter, for the switcher itself. */
export function useCityContext(): CityContextValue {
  return useContext(CityContext);
}
