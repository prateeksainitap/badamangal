"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { BM_LOGO, DK_WORDMARK_LIGHT } from "@/content/home-art";
import { LANG_COOKIE } from "@/lib/i18n";

/**
 * Pre-paint decision script, inlined at the very top of the homepage
 * HTML. It runs before React, so the cover can be on screen before the
 * first paint, and crawlers never get any splash markup at all.
 *
 * Shows ONLY when this browser session LANDS on the homepage:
 *   - never for bots, crawlers, link-preview fetchers or headless tools
 *   - never for back / forward navigation
 *   - never when the visitor came from another page on this site
 *     (same-origin referrer), so landing elsewhere first means no splash
 *   - never for deep links (a #hash such as #map, or a ?q= search)
 *   - once per session (sessionStorage)
 * Any tap, key, wheel or touch drag skips it. A CSS safety timer fades
 * the cover by itself at 2.4 s even if the JS bundle never arrives.
 * `?splash=force` replays it for review.
 */
export const SPLASH_BOOT = `(function(){try{
var d=document.currentScript&&document.currentScript.parentElement;if(!d)return;
var q=location.search,force=/(^|[?&])splash=force/.test(q);
var ua=navigator.userAgent||'';
if(!force){
if(/bot|crawl|spider|slurp|lighthouse|headless|bingpreview|facebookexternalhit|whatsapp|telegram|embedly|preview|pagespeed|gtmetrix|semrush|ahrefs|yandex|baidu/i.test(ua))return;
if(navigator.webdriver)return;
if(location.hash||/(^|[?&])q=/.test(q))return;
var nav=performance.getEntriesByType&&performance.getEntriesByType('navigation')[0];
if(nav&&nav.type==='back_forward')return;
if(document.referrer){try{if(new URL(document.referrer).origin===location.origin)return;}catch(e){}}
if(sessionStorage.getItem('bm_splash'))return;
}
sessionStorage.setItem('bm_splash','1');
try{sessionStorage.setItem('bm_greeted','1');}catch(e){}
d.setAttribute('data-splash','1');
window.__bmLogo=fetch('${BM_LOGO}').then(function(r){return r.text();});
var skip=function(){window.__bmSplashSkip=1;window.dispatchEvent(new Event('bm:splash-skip'));};
['pointerdown','keydown','wheel','touchmove'].forEach(function(t){window.addEventListener(t,skip,{once:true,passive:true});});
setTimeout(function(){if(d.getAttribute('data-splash')==='1'&&!window.__bmSplashLive){d.setAttribute('data-splash','out');setTimeout(function(){d.removeAttribute('data-splash');},500);}},2600);
}catch(e){}})();`;

declare global {
  interface Window {
    __bmLogo?: Promise<string>;
    __bmSplashSkip?: number;
    __bmSplashLive?: number;
  }
}

/** The sun disc centre of the real logo-mark.svg, in its own units.
 *  Everything pivots on it and it sits at the exact screen centre. */
const SUN = { x: 207, y: 226.2 };

/** Pulls the flames, the sun disc and the gada out of the real logo
 *  (paths 30 to 54 and 55 to 101) without changing a single path, fill
 *  or gradient, so each part can be animated on its own. The Hindi and
 *  English wordmark paths are left out: this splash is the mark alone. */
function markOnly(svgText: string): string | null {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) return null;
  const shapes = Array.from(svg.children).filter((el) => el.tagName.toLowerCase() === "path");
  if (shapes.length < 102) return null;
  const defs = svg.querySelector("defs");
  const ns = "http://www.w3.org/2000/svg";
  const out = doc.createElementNS(ns, "svg");
  out.setAttribute("viewBox", svg.getAttribute("viewBox") ?? "0 0 1595 479");
  out.setAttribute("aria-hidden", "true");
  out.setAttribute("class", "sp-logo");
  if (defs) out.appendChild(defs);
  const rays = doc.createElementNS(ns, "g");
  rays.setAttribute("class", "p-rays");
  // Flames bloom clockwise from the top, ordered by their own angle.
  const flames = shapes.slice(30, 55).map((p, j) => {
    const m = (p.getAttribute("d") ?? "").match(/-?\d+\.?\d*/g) ?? ["0", "0"];
    const a = Math.atan2(Number(m[1]) - SUN.y, Number(m[0]) - SUN.x);
    return { p, j, a: (a + Math.PI * 2.5) % (Math.PI * 2) };
  });
  const order = flames.filter((f) => f.j !== 4).sort((x, y) => x.a - y.a);
  for (const f of flames) {
    const g = doc.createElementNS(ns, "g");
    if (f.j === 4) {
      // Path 34 is the sun disc, not a flame.
      g.setAttribute("class", "disc");
    } else {
      g.setAttribute("class", "ray");
      g.setAttribute("style", `--i:${order.indexOf(f)}`);
    }
    g.appendChild(f.p);
    rays.appendChild(g);
  }
  out.appendChild(rays);
  const gada = doc.createElementNS(ns, "g");
  gada.setAttribute("class", "p-gada");
  shapes.slice(55, 102).forEach((p) => gada.appendChild(p));
  out.appendChild(gada);
  return new XMLSerializer().serializeToString(out);
}

/** A ring of typeset राम on two arcs so every word reads upright. */
function ramRing(r: number, fs: number, n: number): string {
  const rb = r + fs * 0.74;
  const lt = (Math.PI * r * 0.86).toFixed(1);
  const lb = (Math.PI * rb * 0.86).toFixed(1);
  const words = Array(n).fill("राम").join(" ");
  const t = (id: string, len: string) =>
    `<text font-weight="700" font-size="${fs}" fill="#9c2a2a" text-anchor="middle" style="font-family:var(--f-hi)"><textPath href="#${id}" startOffset="50%" textLength="${len}" lengthAdjust="spacing">${words}</textPath></text>`;
  const dot = (x: number) => `<circle cx="${x.toFixed(1)}" cy="0" r="${(fs * 0.16).toFixed(1)}" fill="#c9a24a"/>`;
  return (
    `<defs><path id="bmsp-t" d="M${-r},0 A${r},${r} 0 0,1 ${r},0"/><path id="bmsp-b" d="M${-rb},0 A${rb},${rb} 0 0,0 ${rb},0"/></defs>` +
    t("bmsp-t", lt) +
    t("bmsp-b", lb) +
    dot(-(r + rb) / 2 + fs * 0.12) +
    dot((r + rb) / 2 - fs * 0.12)
  );
}
const RING = ramRing(250, 26, 12);

function initialHindi(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q) return q === "hi";
    const c = document.cookie.split("; ").find((r) => r.startsWith(`${LANG_COOKIE}=`));
    return c?.split("=")[1] === "hi";
  } catch {
    return false;
  }
}

type Phase = "off" | "run" | "out";

/**
 * The splash, option 1 "Ram naam halo" (founder, 29 Oct 2026): the
 * real BadaMangal mark alone at the exact centre of the screen. The sun
 * disc grows, the gada rises, the flames bloom clockwise, and a ring of
 * राम draws itself around it. The DharmKriya family line sits at the
 * bottom, apart from the mark, so it never pulls the mark off centre.
 * About 1.8 s, then the cover lifts.
 */
export default function HomeSplash() {
  const [phase, setPhase] = useState<Phase>("off");
  const [svg, setSvg] = useState<string | null>(null);
  const [hindi, setHindi] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const html = document.querySelector<HTMLElement>(".bmh");
    if (!html || html.getAttribute("data-splash") !== "1") return;
    window.__bmSplashLive = 1;
    setHindi(initialHindi());
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const finish = (fast: boolean) => {
      timers.current.forEach((t) => window.clearTimeout(t));
      setPhase("out");
      html.setAttribute("data-splash", "out");
      timers.current = [
        window.setTimeout(() => {
          html.removeAttribute("data-splash");
          setPhase("off");
        }, fast ? 260 : 420),
      ];
    };
    const onSkip = () => finish(true);
    window.addEventListener("bm:splash-skip", onSkip);
    if (window.__bmSplashSkip) {
      finish(true);
      return () => window.removeEventListener("bm:splash-skip", onSkip);
    }

    const go = (text: string | null) => {
      if (html.getAttribute("data-splash") !== "1") return;
      setSvg(text ? markOnly(text) : null);
      setPhase("run");
      timers.current.push(window.setTimeout(() => finish(false), reduce ? 1450 : 1800));
    };
    const logo = window.__bmLogo ?? fetch(BM_LOGO).then((r) => r.text());
    // Never wait long for the logo file: fall back to the plain mark.
    const timeout = new Promise<null>((res) => window.setTimeout(() => res(null), 450));
    Promise.race([logo.catch(() => null), timeout]).then((t) => go(typeof t === "string" ? t : null));

    return () => {
      window.removeEventListener("bm:splash-skip", onSkip);
      timers.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  if (phase === "off") return null;
  return (
    <div className={`bmh-splash is-${phase}`} role="presentation" aria-hidden>
      <div className="sp-halo">
        <svg className="sp-ring" viewBox="-300 -300 600 600" aria-hidden>
          <defs>
            <mask id="bmsp-m" maskUnits="userSpaceOnUse" x="-300" y="-300" width="600" height="600">
              <circle className="sp-sweep" r="272" fill="none" stroke="#fff" strokeWidth="64" pathLength={1} transform="rotate(-90)" />
            </mask>
          </defs>
          <circle className="sp-hair" r="294" fill="none" stroke="#c9a24a" strokeOpacity=".75" strokeWidth="1.6" pathLength={1} transform="rotate(-90)" />
          <g mask="url(#bmsp-m)" opacity=".7" dangerouslySetInnerHTML={{ __html: RING }} />
        </svg>
        {svg ? (
          <span className="sp-mark" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="sp-mark sp-img" src={BM_LOGO} alt="" width={1595} height={479} />
        )}
      </div>
      <div className="sp-credit">
        <span className="sp-line">{hindi ? "धर्मक्रिया परिवार का हिस्सा" : "A part of the DharmKriya family"}</span>
        <Image
          className="sp-dk"
          src={DK_WORDMARK_LIGHT.src}
          alt="DharmKriya"
          width={DK_WORDMARK_LIGHT.width}
          height={DK_WORDMARK_LIGHT.height}
          sizes="150px"
          priority
        />
      </div>
    </div>
  );
}
