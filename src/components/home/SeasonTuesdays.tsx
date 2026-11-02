"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type TouchEvent,
} from "react";
import GalleryLightbox, { type GalleryItem } from "@/components/GalleryLightbox";
import { HOME_ART } from "@/content/home-art";
import type { SeasonDay } from "@/lib/home-season";
import { useLocaleFromContext } from "@/lib/locale-context";

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_HI = ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];
const ORD_EN = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];
const ORD_HI = ["पहला", "दूसरा", "तीसरा", "चौथा", "पाँचवाँ", "छठा", "सातवाँ", "आठवाँ"];
/** BadaMangal.com went live on the second Tuesday of 2026. */
const LAUNCH_ISO = "2026-05-12";
/** How long each Tuesday stays on screen while the season plays. */
const STEP_MS = 3600;

const fmt = (n: number) => n.toLocaleString("en-IN");

type Tile = SeasonDay["photos"][number] | (Omit<SeasonDay["photos"][number], "source"> & { source: "painting" });

/** Paintings of the tradition, for the Tuesday before the site was live. */
const PAINTINGS = [
  { key: "oldLucknowBand", en: "Painting: a bhandara street in old Lucknow", hi: "पेंटिंग: पुराने लखनऊ की भंडारा गली" },
  { key: "bhandaraLine", en: "Painting: the pattal line on a Tuesday", hi: "पेंटिंग: मंगलवार की पत्तल पंगत" },
  { key: "aliganjDusk", en: "Painting: Aliganj at dusk", hi: "पेंटिंग: शाम का अलीगंज" },
  { key: "sevaHands", en: "Painting: hands serving prasad", hi: "पेंटिंग: प्रसाद परोसते हाथ" },
  { key: "gomtiDusk", en: "Painting: the Gomti at dusk", hi: "पेंटिंग: शाम की गोमती" },
].map((p) => ({
  id: `painting:${p.key}`,
  url: HOME_ART[p.key as keyof typeof HOME_ART].src,
  caption: null as string | null,
  area: null,
  firstName: null,
  bhandaraSlug: null,
  source: "painting" as const,
  en: p.en,
  hi: p.hi,
}));

/** Eases a number from its last value to the next, so a day switch reads. */
function useTicker(target: number) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = from.current;
    if (reduce || start === target) {
      from.current = target;
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 520);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(start + (target - start) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    // Land on the real number even where frames are paused (hidden tabs).
    const done = window.setTimeout(() => {
      cancelAnimationFrame(raf);
      from.current = target;
      setV(target);
    }, 700);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(done);
      from.current = target;
    };
  }, [target]);
  return v;
}

function Chevron({ dir }: { dir: "l" | "r" }) {
  return (
    <svg viewBox="0 0 24 24" className="ic" aria-hidden>
      <path d={dir === "l" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

/**
 * The season, Tuesday by Tuesday. It plays itself once when it scrolls
 * into view (story style: one Tuesday every few seconds, 5 May to 23
 * June), and any tap, swipe or key takes over. Without JS it shows the
 * busiest Tuesday.
 */
export default function SeasonTuesdays({ days }: { days: SeasonDay[] }) {
  const isHi = useLocaleFromContext() === "hi";
  const totals = days.map((d) => d.listed + d.spotted);
  const max = Math.max(1, ...totals);
  const busiest = totals.indexOf(Math.max(...totals));
  const last = days.length - 1;
  const [sel, setSel] = useState(busiest);
  const [playing, setPlaying] = useState(false);
  const [box, setBox] = useState<number | null>(null);
  /** The season played through to 23 June: the button offers a replay. */
  const [ended, setEnded] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  /** Set once a person has picked a day, so autoplay never overrides them. */
  const touched = useRef(false);
  /** Paused part way through: Play continues from here. */
  const midway = useRef(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const day = days[sel];
  const total = useTicker(totals[sel]);
  const [y, m, d] = day.iso.split("-").map(Number);
  const dateLabel = isHi ? `${d} ${MONTHS_HI[m - 1]}` : `${d} ${MONTHS_EN[m - 1]}`;
  const beforeLaunch = day.iso < LAUNCH_ISO;

  const badge =
    sel === busiest
      ? isHi ? "सबसे बड़ा दिन" : "Busiest Tuesday"
      : day.iso === LAUNCH_ISO
        ? isHi ? "BadaMangal.com शुरू हुआ" : "BadaMangal.com went live"
        : sel === last
          ? isHi ? "आख़िरी बड़ा मंगल" : "The last one"
          : null;

  // Play: one Tuesday every few seconds, through to the last one.
  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => {
      if (sel >= last) {
        midway.current = false;
        setPlaying(false);
        setEnded(true);
      } else setSel(sel + 1);
    }, STEP_MS);
    return () => window.clearTimeout(id);
  }, [playing, sel, last]);

  // Autoplay once, the first time most of the card is on screen.
  // Pause while it is scrolled away; carry on when it comes back.
  useEffect(() => {
    const el = root.current;
    if (!el || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let started = false;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.4) {
          if (!started && !touched.current) {
            started = true;
            setSel(0);
            setPlaying(true);
          } else if (midway.current && !touched.current) {
            midway.current = false;
            setPlaying(true);
          }
        } else if (!e.isIntersecting || e.intersectionRatio < 0.15) {
          setPlaying((p) => {
            if (p) midway.current = true;
            return false;
          });
        }
      },
      { threshold: [0, 0.15, 0.4] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const choose = useCallback((i: number, focus = false) => {
    touched.current = true;
    midway.current = false;
    setPlaying(false);
    setEnded(false);
    setSel(i);
    if (focus) tabs.current[i]?.focus();
  }, []);

  const step = (by: number) => {
    const next = Math.min(last, Math.max(0, sel + by));
    if (next !== sel) choose(next);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = e.key;
    if (k !== "ArrowRight" && k !== "ArrowLeft" && k !== "Home" && k !== "End") return;
    e.preventDefault();
    const n = days.length;
    const next =
      k === "Home" ? 0 : k === "End" ? n - 1 : k === "ArrowRight" ? (sel + 1) % n : (sel - 1 + n) % n;
    choose(next, true);
  };

  const togglePlay = () => {
    touched.current = true;
    if (playing) {
      midway.current = sel < last;
      setPlaying(false);
      return;
    }
    // Carry on from a pause; otherwise tell the whole season from 5 May.
    if (!midway.current || sel >= last) setSel(0);
    midway.current = false;
    setEnded(false);
    setPlaying(true);
  };

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    swipe.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.4) step(dx < 0 ? 1 : -1);
  };

  // Before the site went live (5 May) the community had not started
  // sharing photos: show the organisers' own photos of that day, then
  // paintings of the tradition, captioned as paintings.
  const tilesAll: Tile[] = useMemo(
    () =>
      beforeLaunch
        ? [...day.photos, ...PAINTINGS.map((pt) => ({ ...pt, caption: isHi ? pt.hi : pt.en }))]
        : day.photos,
    [day, beforeLaunch, isHi],
  );

  const items: GalleryItem[] = useMemo(
    () =>
      tilesAll.map((p) => ({
        id: p.id,
        url: p.url,
        source: p.source === "listing" || p.source === "painting" ? ("admin" as const) : ("spot" as const),
        caption: [p.area, p.caption].filter(Boolean).join(" · ") || undefined,
        credit: p.firstName ?? undefined,
      })),
    [tilesAll],
  );

  const open = (i: number) => {
    touched.current = true;
    if (playing) midway.current = sel < last;
    setPlaying(false);
    setBox(i);
  };

  const shown = tilesAll.slice(0, 5);
  const extraPhone = tilesAll.length - 4;
  const extraDesk = tilesAll.length - 5;
  const lead = tilesAll[0];

  const playLabel = playing
    ? isHi ? "रोकें" : "Pause"
    : ended
      ? isHi ? "फिर से चलाएँ" : "Play again"
      : isHi ? "पूरा सीज़न चलाएँ" : "Play the season";

  return (
    <div className="s26x" data-rv ref={root}>
      <div className="s26x-top">
        <div>
          <p className="s26x-t">{isHi ? "हर मंगल की कहानी" : "Tuesday by Tuesday"}</p>
          <p className="s26x-h">{isHi ? "किसी भी दिन पर टैप करें" : "Tap any day to see it"}</p>
        </div>
        <button
          type="button"
          className={`s26-play ${playing ? "on" : ""}`}
          onClick={togglePlay}
          aria-pressed={playing}
          data-ga="season_play"
        >
          <svg viewBox="0 0 24 24" className="ic" aria-hidden>
            {playing ? <path d="M9 6v12M15 6v12" /> : <path d="M8 5.5v13l11-6.5z" />}
          </svg>
          {playLabel}
        </button>
      </div>

      <div
        className="bars"
        role="tablist"
        aria-label={isHi ? "2026 के आठ बड़े मंगल" : "The eight Tuesdays of 2026"}
        onKeyDown={onKey}
      >
        {days.map((dd, i) => {
          const t = totals[i];
          const [, mm, ddn] = dd.iso.split("-").map(Number);
          return (
            <button
              key={dd.iso}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`s26-tab-${i}`}
              aria-selected={i === sel}
              aria-controls="s26-panel"
              tabIndex={i === sel ? 0 : -1}
              className={`tbar ${i === sel ? "on" : ""} ${i < sel ? "past" : ""}`}
              style={{
                ["--h" as string]: Math.max(t / max, 0.02),
                ["--s" as string]: t ? dd.spotted / t : 0,
                ["--bi" as string]: i,
              }}
              onClick={() => choose(i)}
            >
              <span className="bv">{fmt(t)}</span>
              <span className="rod" aria-hidden>
                <i className="sp" />
                <i className="li" />
              </span>
              <span className="bd">{ddn}</span>
              <span className="bm">{isHi ? MONTHS_HI[mm - 1] : MONTHS_EN[mm - 1]}</span>
              <span className="sr">
                {isHi ? `, ${fmt(t)} भंडारे` : `, ${fmt(t)} ${t === 1 ? "bhandara" : "bhandaras"}`}
              </span>
            </button>
          );
        })}
      </div>
      <p className="bars-leg" aria-hidden>
        <span>
          <i className="dot dl" />
          {isHi ? "आयोजकों ने जोड़े" : "Listed by organisers"}
        </span>
        <span>
          <i className="dot ds" />
          {isHi ? "पड़ोसियों ने खोजे" : "Spotted by neighbours"}
        </span>
      </p>

      <div
        className="panel"
        id="s26-panel"
        role="tabpanel"
        aria-labelledby={`s26-tab-${sel}`}
        aria-live="polite"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className={`segs ${playing ? "run" : ""}`} aria-hidden>
          {days.map((dd, i) => (
            <i
              key={dd.iso}
              className={i < sel ? "done" : i === sel ? "now" : ""}
            >
              {/* A fresh key restarts the fill on every new day. */}
              <b key={i === sel ? `${sel}-${playing ? 1 : 0}` : "x"} />
            </i>
          ))}
        </div>

        <div className="pinfo" key={`i${sel}`}>
          <div className="phead">
            <p className="pdate">
              {dateLabel} <span className="py">{y}</span>
            </p>
            <div className="pnav">
              <button
                type="button"
                onClick={() => step(-1)}
                disabled={sel === 0}
                aria-label={isHi ? "पिछला मंगल" : "Previous Tuesday"}
              >
                <Chevron dir="l" />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                disabled={sel === last}
                aria-label={isHi ? "अगला मंगल" : "Next Tuesday"}
              >
                <Chevron dir="r" />
              </button>
            </div>
          </div>
          <p className="pord">
            {isHi ? `${ORD_HI[day.ordinal - 1]} बड़ा मंगल` : `${ORD_EN[day.ordinal - 1]} Bada Mangal`}
            {badge ? <span className="pbadge">{badge}</span> : null}
          </p>
          {beforeLaunch ? (
            <p className="pbefore">
              {isHi
                ? "शहर ने हमेशा की तरह भंडारे किए। BadaMangal.com एक हफ़्ते बाद, 12 मई को शुरू हुआ।"
                : "The city cooked, as it always has. BadaMangal.com went live a week later, on 12 May."}
            </p>
          ) : (
            <>
              <p className="ptotal">
                <b>{fmt(total)}</b>
                <span>{isHi ? "भंडारे उस दिन" : "bhandaras that Tuesday"}</span>
              </p>
              <ul className="psplit">
                <li>
                  <i className="dot dl" aria-hidden />
                  <b>{fmt(day.listed)}</b> {isHi ? "आयोजकों ने जोड़े" : "listed"}
                </li>
                <li>
                  <i className="dot ds" aria-hidden />
                  <b>{fmt(day.spotted)}</b> {isHi ? "पड़ोसियों ने खोजे" : "spotted"}
                </li>
                <li>
                  <svg viewBox="0 0 24 24" className="ic cam" aria-hidden>
                    <path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
                    <circle cx="12" cy="13" r="3.6" />
                  </svg>
                  <b>{fmt(day.photoCount)}</b> {isHi ? "तस्वीरें" : "photos"}
                </li>
              </ul>
            </>
          )}
        </div>

        {!shown.length ? (
          <div className="mosaic empty" key={`m${sel}`}>
            <figure className="tile t0">
              <Image
                src={HOME_ART.oldLucknowBand.src}
                alt={isHi ? "पुराने लखनऊ में भंडारे की पेंटिंग" : "A painting of a bhandara street in old Lucknow"}
                fill
                sizes="(min-width: 900px) 58vw, 92vw"
              />
            </figure>
          </div>
        ) : (
          <div className="mosaic" key={`m${sel}`} data-n={shown.length}>
            {shown.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={`tile t${i}`}
                style={{ ["--i" as string]: i }}
                onClick={() => open(i)}
                aria-label={
                  (isHi ? "तस्वीर खोलें: " : "Open photo: ") + ([p.area, p.caption].filter(Boolean).join(", ") || dateLabel)
                }
              >
                <Image
                  src={p.url}
                  alt={[p.caption, p.area].filter(Boolean).join(", ") || (isHi ? `बड़ा मंगल, ${dateLabel}` : `Bada Mangal bhandara, ${dateLabel}`)}
                  fill
                  sizes={i === 0 ? "(min-width: 900px) 34vw, 92vw" : "(min-width: 900px) 17vw, 30vw"}
                />
                {i === 0 && lead && (lead.area || lead.firstName) ? (
                  <span className="lead-cap">
                    {lead.area ? <b>{lead.area}</b> : null}
                    {lead.caption ? <span className="lc-t">{lead.caption}</span> : null}
                    {lead.firstName ? (
                      <span className="lc-by">{isHi ? `${lead.firstName} ने भेजी` : `Shared by ${lead.firstName}`}</span>
                    ) : lead.source === "listing" ? (
                      <span className="lc-by">{isHi ? "आयोजक की ओर से" : "From the organiser"}</span>
                    ) : null}
                  </span>
                ) : null}
                {i === 0 ? (
                  <span className="zoom" aria-hidden>
                    <svg viewBox="0 0 24 24" className="ic">
                      <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
                    </svg>
                  </span>
                ) : null}
                {i === 3 && extraPhone > 0 ? <span className="more m-ph">+{extraPhone}</span> : null}
                {i === 4 && extraDesk > 0 ? <span className="more m-dt">+{extraDesk}</span> : null}
              </button>
            ))}
          </div>
        )}
        <p className="swipe-tip" aria-hidden>
          {isHi ? "अगले मंगल के लिए स्वाइप करें" : "Swipe for the next Tuesday"}
        </p>
      </div>

      {box !== null ? (
        <GalleryLightbox
          items={items}
          index={box}
          onClose={() => setBox(null)}
          onNavigate={(n) => setBox(n)}
          isHi={isHi}
        />
      ) : null}
    </div>
  );
}
