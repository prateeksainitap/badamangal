"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import type { LocalityGroup } from "@/lib/home-map";
import { useLocaleFromContext } from "@/lib/locale-context";
import { withLangEn } from "./lang-href";

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_HI = ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];

function day(iso: string, hi: boolean) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${(hi ? MONTHS_HI : MONTHS_EN)[m - 1]}`;
}

/** "16 June", "4 Tuesdays from 12 May", "All 8 Tuesdays". */
function when(dates: string[], hi: boolean): string {
  if (!dates.length) return "";
  if (dates.length === 1) return day(dates[0], hi);
  if (dates.length >= 8) return hi ? "आठों मंगल" : "All 8 Tuesdays";
  return hi ? `${day(dates[0], hi)} से ${dates.length} मंगल` : `${dates.length} Tuesdays from ${day(dates[0], hi)}`;
}

/**
 * Every listed bhandara, browsed by locality: localities on the left
 * (a swipeable row on phones), that locality's bhandaras on the right,
 * one per line with their Tuesdays. Every group stays in the HTML so
 * search engines still reach every bhandara page.
 */
export default function LocalityExplorer({ groups }: { groups: LocalityGroup[] }) {
  const isHi = useLocaleFromContext() === "hi";
  const [sel, setSel] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const pick = (i: number, focus = false) => {
    setSel(i);
    const el = tabs.current[i];
    if (focus) el?.focus();
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = groups.length;
    const map: Record<string, number> = {
      ArrowDown: (sel + 1) % n,
      ArrowRight: (sel + 1) % n,
      ArrowUp: (sel - 1 + n) % n,
      ArrowLeft: (sel - 1 + n) % n,
      Home: 0,
      End: n - 1,
    };
    if (!(e.key in map)) return;
    e.preventDefault();
    pick(map[e.key], true);
  };

  return (
    <div className="lx">
      <div className="lx-areas" role="tablist" aria-orientation="vertical" aria-label={isHi ? "इलाक़े" : "Localities"} onKeyDown={onKey}>
        {groups.map((g, i) => (
          <button
            key={g.area}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`lx-t-${i}`}
            aria-selected={i === sel}
            aria-controls={`lx-p-${i}`}
            tabIndex={i === sel ? 0 : -1}
            className={i === sel ? "on" : ""}
            onClick={() => pick(i)}
          >
            <span>{g.more && isHi ? "और मोहल्ले" : g.area}</span>
            <small>{g.items.length}</small>
          </button>
        ))}
      </div>

      <div className="lx-panels">
        {groups.map((g, i) => (
          <div
            key={g.area}
            id={`lx-p-${i}`}
            role="tabpanel"
            aria-labelledby={`lx-t-${i}`}
            className="lx-p"
            hidden={i !== sel}
          >
            <div className="lx-head">
              <h3>{g.more && isHi ? "और मोहल्ले" : g.area}</h3>
              <span className="lx-n">
                {isHi ? `${g.items.length} भंडारे` : `${g.items.length} ${g.items.length === 1 ? "bhandara" : "bhandaras"}`}
              </span>
              {g.href ? (
                <a href={withLangEn(g.href)} className="tlink" data-ll="" data-ga="home_locality_area">
                  {isHi ? `${g.area} का पेज` : `Open the ${g.area} page`}
                  <svg viewBox="0 0 24 24" className="ic" aria-hidden>
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </a>
              ) : null}
            </div>
            <ul className="lx-list">
              {g.items.map((b) => (
                <li key={b.slug}>
                  <a href={`/bhandara/${b.slug}?lang=en`} data-ll="" data-ga="home_locality_bhandara">
                    <span className="lx-name">{isHi && b.nameHi ? b.nameHi : b.name}</span>
                    <span className="lx-when">{[b.place, when(b.dates, isHi)].filter(Boolean).join(", ")}</span>
                    <svg viewBox="0 0 24 24" className="ic" aria-hidden>
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
