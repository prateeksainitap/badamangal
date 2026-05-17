"use client";

import { useEffect, useRef, useState } from "react";
import PinDropMap from "@/components/PinDropMap";
import {
  olaAutocomplete,
  olaReverseGeocode,
  type AutocompleteHit,
} from "@/lib/geocode";

export type PinValue = {
  lat: number;
  lng: number;
  address: string;
  geoNeighborhood?: string;
  geoDistrict?: string;
  geoState?: string;
};

type Props = {
  value: PinValue | null;
  onChange: (next: PinValue) => void;
};

type PermState = "idle" | "asking" | "granted" | "denied" | "unsupported";

export default function PinDropStep({ value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AutocompleteHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [perm, setPerm] = useState<PermState>("idle");
  const [permError, setPermError] = useState<string | null>(null);
  const onChangeRef = useRef(onChange);
  /** Set to true by `pickSuggestion` so the upcoming `query` change
   *  (caused by stamping the picked label into the input) doesn't
   *  re-trigger the autocomplete fetch, otherwise the dropdown would
   *  reopen 300 ms after the user selects an item. */
  const skipNextFetch = useRef(false);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Debounced search against Ola Autocomplete. AbortController cancels
  // any in-flight request when the user types again, so we don't waste
  // quota on stale queries.
  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const id = window.setTimeout(async () => {
      setSearching(true);
      try {
        const hits = await olaAutocomplete(q, { signal: controller.signal });
        setSuggestions(hits);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(id);
    };
  }, [query]);

  const reverseAndEmit = async (lat: number, lng: number) => {
    const r = await olaReverseGeocode(lat, lng);
    onChangeRef.current({
      lat,
      lng,
      address: r?.formatted ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      geoNeighborhood: r?.geoNeighborhood,
      geoDistrict: r?.geoDistrict,
      geoState: r?.geoState,
    });
  };

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPerm("unsupported");
      return;
    }
    setPerm("asking");
    setPermError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setPerm("granted");
        await reverseAndEmit(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setPerm("denied");
        setPermError(err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60_000 },
    );
  };

  const onPinChange = async ({ lat, lng }: { lat: number; lng: number }) => {
    await reverseAndEmit(lat, lng);
  };

  const pickSuggestion = async (s: AutocompleteHit) => {
    // Suppress the search effect's next run so stamping the picked
    // label into the input doesn't re-open the dropdown.
    skipNextFetch.current = true;
    setQuery(s.label);
    setSuggestions([]);
    await reverseAndEmit(s.lat, s.lng);
  };

  const outOfBounds =
    value &&
    (value.lat < 26.6 ||
      value.lat > 27.0 ||
      value.lng < 80.7 ||
      value.lng > 81.2);

  return (
    <div className="grid gap-4">
      {/* Permission ask */}
      <div className="rounded-2xl border border-gold-500/40 bg-cream-50 p-4">
        <p className="text-sm text-ink-900">
          <span className="font-tiro text-base text-sindoor-700 mr-1">
            हम आपकी लोकेशन सिर्फ़ pin लगाने के लिए इस्तेमाल करते हैं।
          </span>
          <span className="text-ink-600">
            We&apos;ll use your location only to drop the pin. Nothing is tracked.
          </span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={perm === "asking"}
            className="inline-flex items-center rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-4 py-2 text-sm shadow-warm transition-colors disabled:opacity-60"
          >
            {perm === "asking"
              ? "Locating…"
              : perm === "granted"
                ? "Location used ✓"
                : "Use my current location"}
          </button>
          {perm === "denied" || perm === "unsupported" ? (
            <span className="text-xs text-ink-600">
              No problem, search for the address below.
            </span>
          ) : null}
          {permError && perm === "denied" ? (
            <span className="text-[10px] text-ink-600/80">({permError})</span>
          ) : null}
        </div>
      </div>

      {/* Search */}
      <div className="relative z-[700]">
        <label className="block">
          <span className="text-sm font-medium text-ink-900">
            <span className="font-tiro text-base text-sindoor-700 mr-1">
              पता या निशानी खोजें
            </span>
            <span>/ Search address or landmark</span>
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type address..."
            className="mt-1.5 w-full rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 placeholder:text-ink-600/60 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
            autoComplete="off"
          />
        </label>
        {searching ? (
          <p className="absolute right-3 top-9 text-[11px] text-ink-600">searching…</p>
        ) : null}
        {suggestions.length > 0 ? (
          <ul
            role="listbox"
            className="absolute z-[800] mt-1 w-full rounded-xl border border-gold-500/40 bg-white shadow-warm overflow-hidden"
          >
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => pickSuggestion(s)}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-saffron-50"
                >
                  <span className="text-ink-900 line-clamp-1">{s.label}</span>
                  {s.secondary ? (
                    <span className="block text-[11px] text-ink-600 mt-0.5 line-clamp-1">
                      {s.secondary}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Map */}
      <PinDropMap
        lat={value?.lat ?? null}
        lng={value?.lng ?? null}
        onChange={onPinChange}
        className="h-[55vh] sm:h-[460px] w-full rounded-2xl overflow-hidden border border-gold-500/40 bg-saffron-50"
      />

      {/* Confirmed location */}
      {value ? (
        <div
          className={[
            "rounded-2xl border px-4 py-3 text-sm",
            outOfBounds
              ? "border-alert-500/60 bg-alert-500/10"
              : "border-gold-500/40 bg-saffron-50",
          ].join(" ")}
        >
          <p className="text-[10px] uppercase tracking-[0.2em] text-ink-600">
            Pin dropped at
          </p>
          <p className="mt-0.5 text-ink-900 font-medium">{value.address || "(no address)"}</p>
          <p className="mt-1 text-xs text-ink-600 tabular-nums">
            {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            {value.geoNeighborhood ? ` · ${value.geoNeighborhood}` : ""}
            {value.geoDistrict ? ` · ${value.geoDistrict}` : ""}
          </p>
          {outOfBounds ? (
            <p className="mt-2 text-xs text-alert-500">
              This looks like it&apos;s outside Lucknow. Move the pin if that&apos;s wrong.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-gold-500/50 bg-cream-50 px-4 py-3 text-sm text-ink-600">
          Tap the map (or search above) to drop a pin where your bhandara will run.
        </p>
      )}
    </div>
  );
}
