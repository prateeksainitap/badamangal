"use client";
import { useLocaleFromContext } from "@/lib/locale-context";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { T } from "@/components/T";
import { trackEvent } from "@/lib/ga";
import type { BhandaraListItem } from "@/types/bhandara";

// The real interactive map (Ola Maps). Its JS only downloads when the
// visitor asks for it, so the painted map costs nothing extra.
const MapBoard = dynamic(() => import("@/components/MapBoard"), {
  ssr: false,
  loading: () => <div className="bmh-live-skeleton" aria-hidden />,
});

export type LiveSpot = {
  id: string;
  lat: number;
  lng: number;
  area: string | null;
  caption: string | null;
  photoUrl: string | null;
  createdAt: string;
  bhandaraSlug: string | null;
  bhandaraName: string | null;
  bhandaraNameHi: string | null;
};

type LiveMapPayload = { listings: BhandaraListItem[]; liveSpots: LiveSpot[] };

const NO_LISTINGS: BhandaraListItem[] = [];
const NO_SPOTS: LiveSpot[] = [];

/** One shared request per page view, started on the first sign of
 *  intent (hover, focus or touch on "Open the live map") and reused
 *  when the map opens. A failed request is forgotten so retry works. */
let pending: Promise<LiveMapPayload> | null = null;
function loadLiveMap(): Promise<LiveMapPayload> {
  if (!pending) {
    pending = fetch("/api/home/map", { credentials: "omit" })
      .then((r) => {
        if (!r.ok) throw new Error(`live map ${r.status}`);
        return r.json() as Promise<LiveMapPayload>;
      })
      .catch((e) => {
        pending = null;
        throw e;
      });
  }
  return pending;
}
const warmLiveMap = () => {
  loadLiveMap().catch(() => {});
};

/**
 * Owns the painted / live switch for the #map section.
 *
 * The painted map (children) is server rendered with every pin as a real
 * link. "Open the live map" swaps in the existing MapBoard in place.
 * The live map's data (every listing and spot, a few hundred KB) is
 * NOT in the page payload: it comes from the cached GET /api/home/map
 * the first time the visitor reaches for the live map. The counts on
 * the chips come from the season totals passed in, so they are right
 * while it loads.
 * The live map also opens by itself when:
 *   - the URL carries ?q= (Google's sitelinks search box sends people to
 *     /?q=term), with the term prefilled in the map search, or
 *   - the visitor arrives at /#map from another page (header "Bhandaras
 *     on Map", breadcrumb JSON-LD, WhatsApp shares), which is where the
 *     live map has always been.
 */
export default function MapStage({
  children,
  communityMembers,
  totalListed,
  totalSpotted,
  isPastSeason,
}: {
  children: ReactNode;
  communityMembers: number;
  totalListed: number;
  totalSpotted: number;
  isPastSeason: boolean;
}) {
  const isHi = useLocaleFromContext() === "hi";
  const [live, setLive] = useState(false);
  const [query, setQuery] = useState("");
  const [mapData, setMapData] = useState<LiveMapPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const tipRef = useRef<HTMLSpanElement | null>(null);
  const paintedRef = useRef<HTMLDivElement | null>(null);

  const open = useCallback((source: string) => {
    setLive(true);
    trackEvent("home_live_map_open", { source });
    window.requestAnimationFrame(() =>
      document.getElementById("map")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const q = url.searchParams.get("q")?.trim().slice(0, 80);
    if (q) {
      setQuery(q);
      trackEvent("home_search_query_inbound", { len: q.length });
      open("query");
      return;
    }
    // Landed straight on /#map from another page or a shared link.
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const sameOrigin = document.referrer && new URL(document.referrer).origin === window.location.origin;
    if (url.hash === "#map" && nav?.type !== "back_forward" && !sameOrigin) {
      open("hash");
    }
  }, [open]);

  // Fetch the live map's data once the live map is open.
  useEffect(() => {
    if (!live || mapData) return;
    let alive = true;
    setFailed(false);
    loadLiveMap()
      .then((d) => {
        if (alive) setMapData(d);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [live, mapData, attempt]);

  // Gada hover tooltip on the painted map (desktop pointers only).
  useEffect(() => {
    const root = paintedRef.current;
    const tip = tipRef.current;
    if (!root || !tip || !window.matchMedia("(hover: hover)").matches) return;
    const over = (e: PointerEvent) => {
      const pin = (e.target as HTMLElement).closest<HTMLAnchorElement>("a.pin");
      if (!pin) return;
      const canvas = pin.parentElement?.parentElement;
      if (!canvas) return;
      const c = canvas.getBoundingClientRect();
      const r = pin.getBoundingClientRect();
      const photo = pin.dataset.photo;
      tip.replaceChildren();
      if (photo) {
        const img = document.createElement("img");
        img.alt = "";
        img.decoding = "async";
        img.src = `/_next/image?url=${encodeURIComponent(photo)}&w=384&q=70`;
        tip.appendChild(img);
      }
      const text = document.createElement("span");
      text.textContent = pin.getAttribute("aria-label") ?? "";
      tip.appendChild(text);
      tip.classList.toggle("ph", !!photo);
      // Near the top of the painting, open the card below the gada.
      const top = r.top - c.top;
      tip.classList.toggle("below", top < (photo ? 230 : 70));
      tip.style.left = `${Math.min(Math.max(r.left - c.left + r.width / 2, 130), c.width - 130)}px`;
      tip.style.top = `${tip.classList.contains("below") ? top + r.height : top}px`;
      canvas.appendChild(tip);
      tip.classList.add("on");
    };
    const out = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("a.pin")) tip.classList.remove("on");
    };
    root.addEventListener("pointerover", over);
    root.addEventListener("pointerout", out);
    return () => {
      root.removeEventListener("pointerover", over);
      root.removeEventListener("pointerout", out);
    };
  }, []);

  return (
    <>
      <div ref={paintedRef} hidden={live} data-painted>
        {children}
        <span ref={tipRef} className="pin-tip" aria-hidden />
      </div>
      <div className="map-actions" hidden={live}>
        <button
          type="button"
          className="b b-p"
          onClick={() => open("cta")}
          onPointerEnter={warmLiveMap}
          onFocus={warmLiveMap}
          onTouchStart={warmLiveMap}
          data-ga="home_open_live_map"
        >
          <svg viewBox="0 0 24 24" className="ic" aria-hidden>
            <path d="M12 21s-6.5-5.6-6.5-10.4a6.5 6.5 0 1 1 13 0C18.5 15.4 12 21 12 21z" />
            <circle cx="12" cy="10.5" r="2.4" />
          </svg>
          <T en="Open the live map" hi="लाइव नक़्शा खोलें" />
        </button>
        <form className="map-search" method="get" role="search">
          <label className="sr" htmlFor="bmh-q">
            <T en="Search a bhandara or area" hi="भंडारा या इलाक़ा खोजें" />
          </label>
          <svg viewBox="0 0 24 24" className="ic" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.6-3.6" />
          </svg>
          <input id="bmh-q" name="q" type="search" placeholder={isHi ? "अलीगंज, हनुमान सेतु, पूड़ी..." : "Aliganj, Hanuman Setu, puri..."} autoComplete="off" onFocus={warmLiveMap} />
        </form>
      </div>
      {live ? (
        <div className="live-wrap">
          <button type="button" className="tlink live-back" onClick={() => setLive(false)}>
            <svg viewBox="0 0 24 24" className="ic" aria-hidden style={{ transform: "rotate(180deg)" }}>
              <path d="M9 6l6 6-6 6" />
            </svg>
            <T en="Back to the painted map" hi="चित्रित नक़्शे पर लौटें" />
          </button>
          <MapBoard
            listings={mapData?.listings ?? NO_LISTINGS}
            liveSpots={mapData?.liveSpots ?? NO_SPOTS}
            loading={!mapData && !failed}
            loadFailed={!mapData && failed}
            onRetry={() => setAttempt((n) => n + 1)}
            communityMembers={communityMembers}
            totalListed={totalListed}
            totalSpotted={totalSpotted}
            isPastSeason={isPastSeason}
            sectionId="map-live"
            embedded
            initialQuery={query}
          />
        </div>
      ) : null}
    </>
  );
}
