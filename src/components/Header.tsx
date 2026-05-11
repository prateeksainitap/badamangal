"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import LangToggle from "@/components/LangToggle";
import { JaliCorner } from "@/components/ornaments";
import { useT } from "@/lib/useT";

function HeaderInner() {
  const { t, locale } = useT();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  // Close drawer on route change is handled implicitly by Next's full reload
  // of the layout; we just lock body scroll while the drawer is open.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // Desktop nav: nouns only. "Spot" is dropped from the top-bar (it
  // lives on the floating CTA + mobile drawer + /live). "Find a
  // bhandara" is renamed "Map" so it reads as a destination, not an
  // action. Home links explicitly so users on internal pages have a
  // visible way back without relying on the brand mark.
  const navLinks: { href: string; label: string }[] = [
    { href: "/", label: locale === "hi" ? "होम" : "Home" },
    { href: "/#map", label: locale === "hi" ? "भंडारा नक़्शा" : "Bhandara Map" },
    { href: "/live", label: locale === "hi" ? "लाइव" : "Live" },
    { href: "/history", label: locale === "hi" ? "इतिहास" : "History" },
    { href: "/resources", label: t.nav.resources },
  ];

  // Mobile-drawer nav: same routes as desktop, but each gets an icon and a
  // small caption so the menu feels like a proper navigation poster, not
  // a stripped text list.
  const mobileNav: {
    href: string;
    label: string;
    caption: string;
    icon: React.ReactNode;
    accent: "saffron" | "sindoor" | "leaf" | "gold";
    live?: boolean;
  }[] = [
    {
      href: "/#map",
      label: locale === "hi" ? "भंडारा नक़्शा" : "Bhandara Map",
      caption: locale === "hi" ? "लखनऊ का पूरा नक़्शा" : "Every bhandara on the city map",
      icon: <NavIconMap />,
      accent: "saffron",
    },
    {
      href: "/spot",
      label: locale === "hi" ? "स्पॉट करें" : "Spot a bhandara",
      caption:
        locale === "hi"
          ? "एक फ़ोटो लें, लाइव फ़ीड में जोड़ें"
          : "Snap a photo, drop a pin",
      icon: <NavIconCamera />,
      accent: "sindoor",
    },
    {
      href: "/live",
      label: locale === "hi" ? "लाइव फ़ीड" : "Live feed",
      caption:
        locale === "hi"
          ? "अभी हो रहे भंडारों की तस्वीरें"
          : "Photos & updates from today",
      icon: <NavIconBroadcast />,
      accent: "saffron",
      live: true,
    },
    {
      href: "/history",
      label: locale === "hi" ? "इतिहास" : "History",
      caption:
        locale === "hi"
          ? "400 साल पुरानी परंपरा"
          : "A 400-year-old tradition",
      icon: <NavIconScroll />,
      accent: "gold",
    },
    {
      href: "/resources",
      label: locale === "hi" ? "संसाधन" : "Resources",
      caption:
        locale === "hi"
          ? "चालीसा, आरती, मंदिर"
          : "Chalisa, aarti, temples",
      icon: <NavIconBook />,
      accent: "leaf",
    },
    {
      href: "/contact",
      label: locale === "hi" ? "संपर्क" : "Contact",
      caption:
        locale === "hi"
          ? "सुधार, सहयोग या कोई सवाल"
          : "Corrections, partnerships, or questions",
      icon: <NavIconMail />,
      accent: "gold",
    },
  ];

  const accentClasses = {
    saffron: "bg-saffron-50 text-saffron-600 border-saffron-500/40",
    sindoor: "bg-sindoor-700/8 text-sindoor-700 border-sindoor-700/30",
    leaf: "bg-leaf-600/8 text-leaf-600 border-leaf-600/30",
    gold: "bg-gold-500/10 text-gold-500 border-gold-500/45",
  };

  return (
    <>
    <header
      className={[
        "sticky top-0 z-[1000] bg-cream-50/92 backdrop-blur-md transition-all duration-300",
        "border-b",
        scrolled
          ? "border-gold-500/40 shadow-[0_1px_0_rgba(201,162,74,0.20)]"
          : "border-transparent",
      ].join(" ")}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        {/* Brand — the new logo SVG already bakes the wordmark
            (बड़ा मंगल + BADAMANGAL.COM) inside the artwork, so the
            side-text lockup that used to live here was redundant.
            We render the SVG at a tall fixed height with `w-auto`
            so it scales proportionally without distortion. */}
        <Link
          href="/"
          aria-label="BadaMangal home"
          data-ga="nav_brand"
          data-ga-source="header"
          className="inline-flex items-center group shrink-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-mark.svg"
            alt="BadaMangal"
            className="h-9 sm:h-11 w-auto shrink-0"
          />
          <span className="sr-only">Bada Mangal · BadaMangal.com</span>
        </Link>

        {/* Desktop nav */}
        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-1 lg:gap-2"
        >
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              data-ga="nav_link"
              data-ga-href={l.href}
              data-ga-label={l.label}
              className="inline-flex items-center min-h-[40px] text-sm text-ink-900 hover:text-saffron-600 font-medium px-3 py-2 transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:block">
            <LangToggle />
          </div>
          <Link
            href="/list-bhandara"
            className="hidden sm:inline-flex btn btn-primary btn-sm"
            data-ga="cta_header_list_bhandara"
          >
            {t.cta.listBhandara}
          </Link>

          {/* Mobile menu trigger */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={t.nav.menu}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            data-ga="nav_menu_open"
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-full border border-gold-500/60 bg-cream-50 text-ink-900 hover:text-saffron-600"
          >
            <IconMenu />
          </button>
        </div>
      </div>
    </header>

      {/* Mobile drawer.
          Hidden via opacity/pointer-events on the wrapper so the off-screen
          sheet is fully unreachable when closed. The sheet uses `inset-y-0`
          (top:0 + bottom:0) instead of `h-full` so it always reaches the
          true viewport bottom on mobile, even with iOS Safari's chrome
          bouncing, that was the source of the page bleeding through. */}
      <div
        id="mobile-menu"
        className={[
          "md:hidden fixed inset-0 z-[1100]",
          menuOpen ? "pointer-events-auto" : "pointer-events-none",
        ].join(" ")}
        aria-hidden={!menuOpen}
      >
        {/* Full-screen sheet, slides down from the top of the viewport. */}
        <aside
          role="dialog"
          aria-label={t.nav.menu}
          aria-modal="true"
          className={[
            "absolute inset-0 bg-cream-50 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            menuOpen ? "translate-y-0" : "-translate-y-full",
          ].join(" ")}
        >
          {/* Brand strip, saffron radial wash + jali corners + close button */}
          <div className="relative shrink-0 overflow-hidden border-b border-gold-500/30">
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(400px 220px at 25% 30%, rgba(242,148,76,0.22), transparent 65%), radial-gradient(400px 220px at 90% 90%, rgba(156,42,42,0.10), transparent 65%), #FBF7F0",
              }}
            />
            <JaliCorner position="tl" className="absolute top-2 left-2 w-7 h-7 text-gold-500/70" />
            <JaliCorner position="tr" className="absolute top-2 right-2 w-7 h-7 text-gold-500/70" />

            <div className="relative px-5 pt-5 pb-4 flex items-start justify-between gap-3">
              <Link
                href="/"
                onClick={() => setMenuOpen(false)}
                className="inline-flex items-center group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/logo-mark.svg"
                  alt="BadaMangal"
                  className="h-14 w-auto"
                />
                <span className="sr-only">Bada Mangal · BadaMangal.com · 2026</span>
              </Link>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label={t.nav.closeMenu}
                className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full bg-cream-50/80 backdrop-blur border border-gold-500/40 text-ink-900 hover:text-sindoor-700 hover:bg-saffron-50"
              >
                <IconX />
              </button>
            </div>
          </div>

          {/* Scrollable nav */}
          <nav
            aria-label="Mobile"
            className="flex-1 min-h-0 overflow-y-auto px-5 py-5 bg-cream-50 max-w-md w-full mx-auto"
          >
            {/* Featured item: Spot a bhandara, visible above the regular
                list because it's the most useful action on bhandara day. */}
            <Link
              href="/spot"
              onClick={() => setMenuOpen(false)}
              data-ga="cta_drawer_spot"
              className="relative block overflow-hidden rounded-2xl border border-saffron-500/40 bg-gradient-to-br from-saffron-50 to-cream-50 p-4 shadow-warm group"
            >
              <div className="flex items-start gap-3">
                <span className="shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-saffron-600 text-cream-50 shadow-warm">
                  <NavIconCameraSolid />
                </span>
                <div className="min-w-0">
                  <p className="font-mukta uppercase tracking-[0.22em] text-[0.6rem] text-saffron-600 font-semibold inline-flex items-center gap-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inset-0 rounded-full bg-saffron-600 opacity-50 motion-safe:animate-ping" />
                      <span className="relative h-1.5 w-1.5 rounded-full bg-saffron-600" />
                    </span>
                    {locale === "hi" ? "अभी" : "Right now"}
                  </p>
                  <p className="mt-1 font-fraunces font-semibold text-base text-sindoor-700 leading-tight">
                    {locale === "hi"
                      ? "क्या आपने भंडारा देखा है?"
                      : "Spotted a bhandara?"}
                  </p>
                  <p className="mt-1 text-xs text-ink-600 leading-snug">
                    {locale === "hi"
                      ? "एक फ़ोटो लें, 30 सेकंड में पूरे शहर को बताएँ।"
                      : "One photo, 30 seconds, on the city map."}
                  </p>
                </div>
              </div>
            </Link>

            {/* Section divider */}
            <div className="flex items-center gap-2 mt-6 mb-2 px-1">
              <span className="h-px flex-1 bg-gold-500/30" />
              <span className="font-mukta uppercase tracking-[0.28em] text-[0.6rem] text-gold-500 font-semibold">
                {locale === "hi" ? "मेन्यू" : "Explore"}
              </span>
              <span className="h-px flex-1 bg-gold-500/30" />
            </div>

            <ul className="grid gap-1.5">
              {mobileNav.map((item) => {
                const c = accentClasses[item.accent];
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      data-ga="drawer_nav_click"
                      data-ga-href={item.href}
                      className="group flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-saffron-50 transition-colors"
                    >
                      <span
                        className={`shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-xl border ${c}`}
                      >
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-base font-semibold text-ink-900 leading-tight">
                            {item.label}
                          </span>
                          {item.live ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-saffron-600 text-cream-50 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.2em] font-bold">
                              <span className="block w-1 h-1 rounded-full bg-cream-50 motion-safe:animate-pulse" />
                              Live
                            </span>
                          ) : null}
                        </span>
                        <span className="block text-xs text-ink-600 leading-snug mt-0.5">
                          {item.caption}
                        </span>
                      </span>
                      <span
                        aria-hidden
                        className="shrink-0 text-ink-600/50 group-hover:text-saffron-600 group-hover:translate-x-0.5 transition-all"
                      >
                        →
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Quiet contact line */}
            <p className="mt-6 px-3 text-[11px] text-ink-600 leading-relaxed">
              {locale === "hi"
                ? "सहायता / प्रश्न: "
                : "Help or questions: "}
              <a
                href="mailto:namaste@badamangal.com"
                className="text-saffron-600 hover:underline"
              >
                namaste@badamangal.com
              </a>
            </p>
          </nav>

          {/* Sticky footer cluster — language toggle only. The "Add a
              bhandara" CTA was dropped from this strip because the same
              action is already promoted via the featured Spot card up
              top, the header button on desktop, and the map toolbar. */}
          <div className="shrink-0 px-5 py-4 border-t border-gold-500/30 bg-cream-50 flex flex-col items-center gap-3 max-w-md w-full mx-auto [padding-bottom:max(env(safe-area-inset-bottom),1rem)]">
            <LangToggle />
          </div>
        </aside>
      </div>
    </>
  );
}

/* ── Mobile drawer nav icons ──────────────────────────────────────── */

function NavIconMap() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2z" />
      <path d="M9 3v16M15 5v16" />
    </svg>
  );
}
function NavIconCamera() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7h3l2-2h8l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
function NavIconCameraSolid() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M9 3 7 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3l-2-2H9zm3 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
    </svg>
  );
}
function NavIconBroadcast() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12a7 7 0 0 1 14 0" />
      <path d="M3 12a9 9 0 0 1 18 0" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}
function NavIconScroll() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 4h11a3 3 0 0 1 3 3v9a3 3 0 0 0 3 3H8a3 3 0 0 1-3-3V4z" />
      <path d="M5 4a3 3 0 0 0-3 3v0a2 2 0 0 0 2 2h1" />
      <path d="M9 9h7M9 13h7" />
    </svg>
  );
}
function NavIconMail() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 7 9-7" />
    </svg>
  );
}
function NavIconBook() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 4h7a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4z" />
      <path d="M20 4h-7a3 3 0 0 0-3 3v13h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3z" />
      <path d="M7 9h4M13 9h4M7 13h4M13 13h4" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}
function IconX() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M5 5l14 14" />
      <path d="M19 5L5 19" />
    </svg>
  );
}

export default function Header() {
  return (
    <Suspense
      fallback={
        <header className="sticky top-0 z-[1000] bg-cream-50/95 border-b border-transparent">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 h-[60px]" />
        </header>
      }
    >
      <HeaderInner />
    </Suspense>
  );
}
