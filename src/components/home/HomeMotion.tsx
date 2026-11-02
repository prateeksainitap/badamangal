"use client";

import { useEffect, useLayoutEffect } from "react";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * One motion conductor for the whole homepage, hand written, no library.
 *
 *  - Reveals: browsers with CSS scroll-driven animations need nothing
 *    from here. Others get an IntersectionObserver that adds `.in`, with
 *    an in-view pass on load so nothing above the fold ever starts hidden.
 *  - Gada beads light one by one as the swag scrolls in, and the kalava
 *    thread fills behind them.
 *  - Map pins drop in sequence when the painted map arrives.
 *  - Chat bubbles arrive one by one, the last after a typing indicator.
 *  - Counters tick up (only ones that start off screen; a number that is
 *    already visible is never reset).
 *  - Parallax fallback for painted bands.
 *  - The phone map window starts scrolled to the city centre.
 */
export default function HomeMotion() {
  // Before the first paint after hydration: mark everything already on
  // screen as revealed, THEN switch the hidden-until-revealed styles on,
  // so nothing in view ever blinks out.
  useIsoLayoutEffect(() => {
    const root = document.querySelector<HTMLElement>(".bmh");
    if (!root) return;
    const sda = typeof CSS !== "undefined" && CSS.supports?.("animation-timeline: view()");
    if (!sda) {
      root.querySelectorAll<HTMLElement>("[data-rv], .words").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add("in");
      });
    }
    root.setAttribute("data-js", "");
  }, []);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".bmh");
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sdaSupported =
      typeof CSS !== "undefined" && CSS.supports?.("animation-timeline: view()");
    const vh = () => window.innerHeight;
    const inView = (el: Element, frac = 1) => {
      const r = el.getBoundingClientRect();
      return r.top < vh() * frac && r.bottom > 0;
    };
    const cleanups: (() => void)[] = [];

    function once(el: Element, fn: () => void, threshold = 0.25) {
      if (!("IntersectionObserver" in window)) return fn();
      const io = new IntersectionObserver(
        (es) => {
          if (es.some((e) => e.isIntersecting)) {
            io.disconnect();
            fn();
          }
        },
        { threshold },
      );
      io.observe(el);
      cleanups.push(() => io.disconnect());
    }

    // 1. Reveal fallback
    if (!sdaSupported || reduce) {
      const els = root.querySelectorAll<HTMLElement>("[data-rv], .words");
      els.forEach((el) => {
        if (reduce || inView(el)) el.classList.add("in");
        else once(el, () => el.classList.add("in"), 0.08);
      });
    }

    // 2. Gada beads
    root.querySelectorAll<HTMLElement>("[data-mala]").forEach((mala) => {
      const strands = Array.from(mala.querySelectorAll<HTMLElement>("[data-strand]"));
      const light = () => {
        mala.classList.add("go");
        const beads = Array.from(mala.querySelectorAll<HTMLElement>("[data-bead]")).filter(
          (b) => b.dataset.bead !== "future",
        );
        const update = () =>
          strands.forEach((st) => {
            const all = st.querySelectorAll("[data-bead]");
            const lit = st.querySelectorAll(".bead.on").length;
            const frac = lit === 0 ? 0 : lit === all.length ? 1 : (lit - 0.5) / all.length;
            st.querySelector<SVGPathElement>(".lit")?.style.setProperty("--lit", String(1 - frac));
          });
        beads.forEach((b, i) => {
          const t = window.setTimeout(() => {
            b.classList.add("on");
            update();
          }, reduce ? 0 : 120 + i * 130);
          cleanups.push(() => window.clearTimeout(t));
        });
        update();
      };
      once(mala, light, 0.35);
    });

    // 3. Map pins + river
    root.querySelectorAll<HTMLElement>("[data-map]").forEach((map) => once(map, () => map.classList.add("go"), 0.2));

    // 4. Chat thread
    root.querySelectorAll<HTMLElement>("[data-thread]").forEach((tl) => {
      const msgs = Array.from(tl.querySelectorAll<HTMLElement>(".msg"));
      const run = () => {
        if (reduce) return msgs.forEach((m) => m.classList.add("on"));
        const early = msgs.filter((m) => !m.classList.contains("late"));
        const late = msgs.find((m) => m.classList.contains("late"));
        early.forEach((m, i) => {
          const t = window.setTimeout(() => m.classList.add("on"), 120 + i * 260);
          cleanups.push(() => window.clearTimeout(t));
        });
        if (late) {
          const at = 120 + early.length * 260;
          const t1 = window.setTimeout(() => tl.classList.add("typing-on"), at);
          const t2 = window.setTimeout(() => {
            tl.classList.remove("typing-on");
            late.classList.add("on");
          }, at + 900);
          cleanups.push(() => {
            window.clearTimeout(t1);
            window.clearTimeout(t2);
          });
        }
      };
      once(tl, run, 0.15);
    });

    // 5. Counters
    if (!reduce) {
      root.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => {
        const to = Number(el.dataset.count);
        if (!to || inView(el)) return;
        const finalText = el.textContent;
        el.textContent = "0";
        once(
          el,
          () => {
            const t0 = performance.now();
            const dur = 1500;
            const tick = (t: number) => {
              const p = Math.min(1, (t - t0) / dur);
              const e = 1 - Math.pow(1 - p, 3);
              el.textContent = Math.round(to * e).toLocaleString("en-IN");
              if (p < 1) requestAnimationFrame(tick);
              else el.textContent = finalText;
            };
            requestAnimationFrame(tick);
          },
          0.6,
        );
      });
    }

    // 6. Parallax fallback
    if (!sdaSupported && !reduce) {
      const bands = Array.from(root.querySelectorAll<HTMLElement>("[data-par]"));
      let ticking = false;
      const para = () => {
        ticking = false;
        bands.forEach((b) => {
          const r = b.parentElement?.getBoundingClientRect();
          if (!r || r.bottom < -100 || r.top > vh() + 100) return;
          const c = (r.top + r.height / 2 - vh() / 2) / vh();
          b.style.transform = `translate3d(0, ${(-c * 6).toFixed(2)}%, 0)`;
        });
      };
      const onScroll = () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(para);
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      para();
      cleanups.push(() => window.removeEventListener("scroll", onScroll));
    }

    // Map and list links are server rendered with ?lang=en (what the
    // English page has always linked, and what crawlers see). A Hindi
    // reader follows the bare URL instead, so their language holds.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[data-ll]");
      if (!a || !document.documentElement.lang.toLowerCase().startsWith("hi")) return;
      const url = new URL(a.href);
      if (url.searchParams.get("lang") !== "en") return;
      url.searchParams.delete("lang");
      e.preventDefault();
      window.location.assign(url.toString());
    };
    root.addEventListener("click", onClick);
    cleanups.push(() => root.removeEventListener("click", onClick));

    // 8. Floating buttons (global Spot pill + back-to-top): off while the
    // hero is on screen, and off whenever a CTA scrolls into their corner,
    // so they never cover a button. CSS in home-v2.css reads data-fab.
    const hero = root.querySelector<HTMLElement>(".hero");
    const ctas = Array.from(root.querySelectorAll<HTMLElement>(".b, .tlink, .map-search"));
    let legalEl: HTMLElement | null | undefined;
    const legalRow = () => {
      if (legalEl === undefined) {
        legalEl =
          Array.from(document.querySelectorAll<HTMLElement>("footer p")).find((p) =>
            p.textContent?.includes("CIN"),
          ) ?? null;
      }
      return legalEl;
    };
    let fabTick = false;
    const fab = () => {
      fabTick = false;
      const h = vh();
      const w = window.innerWidth;
      const pastHero = !hero || hero.getBoundingClientRect().bottom < 0;
      const zoneTop = h - (w < 1024 ? 140 : 96);
      const zoneLeft = w - 240;
      const covered = ctas.some((c) => {
        const r = c.getBoundingClientRect();
        return r.bottom > zoneTop && r.top < h && r.right > zoneLeft && r.width > 0;
      });
      // Off once the footer's legal row (CIN line) is on screen.
      const legal = legalRow();
      const atLegal = !!legal && legal.getBoundingClientRect().top < h;
      const on = pastHero && !covered && !atLegal;
      if ((root.getAttribute("data-fab") === "on") !== on) root.setAttribute("data-fab", on ? "on" : "off");
    };
    const onFabScroll = () => {
      if (!fabTick) {
        fabTick = true;
        requestAnimationFrame(fab);
      }
    };
    window.addEventListener("scroll", onFabScroll, { passive: true });
    window.addEventListener("resize", onFabScroll);
    fab();
    cleanups.push(() => {
      window.removeEventListener("scroll", onFabScroll);
      window.removeEventListener("resize", onFabScroll);
    });

    // 7. Phone map window: start at the city centre.
    root.querySelectorAll<HTMLElement>(".map-scroll").forEach((w) => {
      if (w.scrollWidth <= w.clientWidth + 2) return;
      const focus = Number(w.dataset.focus || 50) / 100;
      w.scrollLeft = Math.max(0, focus * w.scrollWidth - w.clientWidth / 2);
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
