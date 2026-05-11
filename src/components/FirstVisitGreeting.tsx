"use client";

import { useEffect, useState } from "react";

const SESSION_KEY = "bm_greeted";

/**
 * Once per browser session, fade in "जय श्री राम" top-right for 1.2s.
 * The only allowed sessionStorage usage on the site.
 */
export default function FirstVisitGreeting() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.sessionStorage.getItem(SESSION_KEY)) return;
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // session storage unavailable, silently skip greeting
      return;
    }
    setShow(true);
    const id = window.setTimeout(() => setShow(false), 1300);
    return () => window.clearTimeout(id);
  }, []);

  if (!show) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed top-3 right-4 z-[60] animate-fade-greeting"
    >
      <span className="font-tiro text-2xl text-sindoor-700 drop-shadow-[0_1px_0_rgba(255,246,238,0.6)]">
        जय श्री राम
      </span>
    </div>
  );
}
