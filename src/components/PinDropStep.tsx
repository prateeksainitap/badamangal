"use client";

import { useEffect, useRef, useState } from "react";
import PinDropMap from "@/components/PinDropMap";
import { useLocaleFromContext } from "@/lib/locale-context";
import { Icon } from "@/components/v2";
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
  const isHi = useLocaleFromContext() === "hi";
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AutocompleteHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [perm, setPerm] = useState<PermState>("idle");
  const [, setPermError] = useState<string | null>(null);
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
    <div className="grid gap-5">
      {/* Permission ask: one quiet line and a secondary button (the
          step's one saffron action is Continue). */}
      <div className="grid gap-3">
        <p className="bmi-fnote">
          <span className="ic" aria-hidden>
            <Icon name="pin" />
          </span>
          <span>
            {isHi
              ? "हम आपकी लोकेशन सिर्फ़ पिन लगाने के लिए इस्तेमाल करते हैं।"
              : "We'll use your location only to drop the pin. Nothing is tracked."}
          </span>
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={perm === "asking"}
            className="bmi-b bmi-b-s sm"
          >
            <Icon name={perm === "granted" ? "check" : "map"} />
            <span>
              {perm === "asking"
                ? isHi
                  ? "लोकेशन ले रहे हैं…"
                  : "Locating…"
                : perm === "granted"
                  ? isHi
                    ? "लोकेशन ले ली"
                    : "Location used"
                  : isHi
                    ? "मेरी मौजूदा लोकेशन"
                    : "Use my current location"}
            </span>
          </button>
          {perm === "denied" || perm === "unsupported" ? (
            <span className="bmi-field-hint">
              {isHi ? "कोई बात नहीं, नीचे पता खोजें।" : "No problem, search for the address below."}
            </span>
          ) : null}
        </div>
      </div>

      {/* Search */}
      <div className="relative z-[700]">
        <label className="bmi-field">
          <span className="bmi-field-label" lang={isHi ? "hi" : "en"}>
            {isHi ? "पता या निशानी खोजें" : "Search address or landmark"}
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isHi ? "पता लिखें…" : "Type address..."}
            className="w-full"
            autoComplete="off"
          />
        </label>
        {searching ? (
          <p className="absolute right-4 bottom-4 text-[13px] text-ink-600">
            {isHi ? "खोज रहे हैं…" : "searching…"}
          </p>
        ) : null}
        {suggestions.length > 0 ? (
          <ul
            role="listbox"
            className="absolute z-[800] mt-2 w-full rounded-2xl bg-white overflow-hidden"
            style={{ boxShadow: "inset 0 0 0 1px rgba(201,162,74,0.45), 0 18px 36px -18px rgba(60,40,10,0.45)" }}
          >
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => pickSuggestion(s)}
                  className="block w-full text-left px-4 py-3 text-[15px] hover:bg-[#f5eac9]/60"
                >
                  <span className="text-ink-900 line-clamp-1">{s.label}</span>
                  {s.secondary ? (
                    <span className="block text-[13px] text-ink-600 mt-0.5 line-clamp-1">
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
        className="h-[55vh] sm:h-[460px] w-full rounded-[20px] overflow-hidden bg-[#f5efe3]"
      />

      {/* Confirmed location */}
      {value ? (
        <div className={outOfBounds ? "bmi-alert" : "bmi-fnote"} role={outOfBounds ? "alert" : undefined}>
          {outOfBounds ? null : (
            <span className="ic" aria-hidden>
              <Icon name="check" />
            </span>
          )}
          <span>
            <b>{value.address || (isHi ? "(पता नहीं मिला)" : "(no address)")}</b>
            <span className="block text-[13px] tabular-nums mt-0.5">
              {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
              {value.geoNeighborhood ? `, ${value.geoNeighborhood}` : ""}
              {value.geoDistrict ? `, ${value.geoDistrict}` : ""}
            </span>
            {outOfBounds ? (
              <span className="block mt-1">
                {isHi
                  ? "यह जगह लखनऊ के बाहर लगती है। ग़लत हो तो पिन खिसकाएँ।"
                  : "This looks like it's outside Lucknow. Move the pin if that's wrong."}
              </span>
            ) : null}
          </span>
        </div>
      ) : (
        <p className="bmi-field-hint">
          {isHi
            ? "नक़्शे पर टैप करें (या ऊपर खोजें) ताकि भंडारे की जगह पर पिन लग जाए।"
            : "Tap the map (or search above) to drop a pin where your bhandara will run."}
        </p>
      )}
    </div>
  );
}
