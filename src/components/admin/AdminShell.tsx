"use client";

/**
 * Admin shell — sidebar + top bar that wraps every authenticated
 * admin page. Owns the dark ember-brown theme that matches the
 * homepage LiveChatterBoard panel (ink-900 base, saffron accents,
 * cream text) so the admin reads as the "operator's view" of the
 * same product, not a generic SaaS console.
 *
 * Why a client component:
 *   The sidebar shows active-state highlighting from `usePathname()`.
 *   The rest of the shell (logo, top bar, bot heartbeat) is otherwise
 *   pure markup and could in principle be a server component, but the
 *   active-state matching needs to be reactive to client-side
 *   navigation (which app-router does without a full page reload),
 *   so the whole thing stays client.
 *
 * Auth posture:
 *   The shell ASSUMES the user is authenticated. The layout
 *   (src/app/admin/layout.tsx) gates auth before rendering us. An
 *   unauthenticated visitor sees the centred login form via the
 *   layout's else branch, NOT this shell. We keep the Sign-out
 *   button at the top right because every authenticated page needs
 *   to expose the escape hatch.
 */
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/app/admin/actions";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Optional query-string suffix the parent route uses for sub-tab
   *  routing (e.g. /admin?type=spot). When set, the active-state
   *  matcher requires it to match too. */
  match?: { type?: string };
};

const NAV: NavItem[] = [
  {
    href: "/admin/home",
    label: "Dashboard",
    icon: <IconDashboard />,
  },
  {
    href: "/admin/bhandaras",
    label: "Bhandaras",
    icon: <IconDiya />,
  },
  {
    href: "/admin/spots",
    label: "Spots",
    icon: <IconCamera />,
  },
  {
    href: "/admin/mentions",
    label: "Mentions",
    icon: <IconChat />,
  },
  {
    href: "/admin/discover",
    label: "Discover",
    icon: <IconCompass />,
  },
  {
    href: "/admin/organise",
    label: "Organise",
    icon: <IconClipboard />,
  },
  {
    href: "/admin/volunteers",
    label: "Volunteers",
    icon: <IconUsers />,
  },
  {
    href: "/admin/content",
    label: "Content",
    icon: <IconSparkle />,
  },
  {
    href: "/admin/emails",
    label: "Emails",
    icon: <IconEnvelope />,
  },
  {
    // Donation-intent audit. Every Sponsor-button tap on a public
    // bhandara page lands here as a row recording who tapped (ip
    // hash), the bhandara, suggested amount, recipient UPI, and the
    // status of the claim. Intent-tracking only — see
    // /admin/donations page header for the full disclaimer about
    // UPI direct-to-organiser flows lacking server-side confirmation.
    href: "/admin/donations",
    label: "Donations",
    icon: <IconRupee />,
  },
];

type Props = {
  children: React.ReactNode;
  /** Optional banner shown above the page title — used by Bhandaras
   *  / Spots pages to surface "5 pending" type counters. */
  pageTitle?: string;
  /** Optional subtitle shown under the title. */
  pageSubtitle?: string;
  /** Server-rendered BotHeartbeat element, passed in via the layout
   *  so the shell can stay a client component (needed for the
   *  pathname-aware active sidebar) while still embedding a server
   *  component that reads Prisma directly. The canonical Next.js
   *  pattern for server-in-client composition. */
  botHeartbeat?: React.ReactNode;
  /** Server-rendered NotificationBell, same composition pattern as
   *  botHeartbeat. The bell is a server component (computes alerts
   *  from Prisma counts) embedded into this client shell so the
   *  header can show a live alert count + popover without us having
   *  to migrate the whole shell off `usePathname()`. Only pages that
   *  fetch the alert source data pass it in; pages that omit it just
   *  don't show a bell. */
  notifications?: React.ReactNode;
  /** Optional map of nav-item href → count badge. Renders a small
   *  pill next to the matching nav item when count > 0. Used to
   *  surface "X pending" / "X new" at-a-glance in the sidebar so
   *  the operator doesn't have to click into each page to find out
   *  what needs attention. Pages that omit this just render plain
   *  nav items. Keys must match NAV item hrefs exactly. */
  navCounts?: Partial<Record<string, number>>;
};

export default function AdminShell({
  children,
  pageTitle,
  pageSubtitle,
  botHeartbeat,
  notifications,
  navCounts,
}: Props) {
  const pathname = usePathname() ?? "";
  const search = useSearchParams();
  const currentType = search?.get("type") ?? "";

  function isActive(item: NavItem): boolean {
    // Dashboard is `/admin/home` — exact match.
    if (item.href.startsWith("/admin/home"))
      return pathname.startsWith("/admin/home");
    // Items that share `/admin` but differentiate by ?type=
    if (item.href === "/admin" && pathname === "/admin") {
      return !currentType || currentType === "bhandara";
    }
    if (item.href.startsWith("/admin?")) {
      const typeMatch = item.match?.type;
      return pathname === "/admin" && currentType === typeMatch;
    }
    // Sub-routes: prefix match (so /admin/volunteers/123 highlights
    // the Volunteers item).
    const base = item.href.split("?")[0];
    return pathname === base || pathname.startsWith(base + "/");
  }

  return (
    <div
      // overflow-clip (not overflow-hidden): clips visual overflow
      // WITHOUT establishing a new scrolling context. The old
      // overflow-hidden silently broke `position: sticky` for every
      // descendant — the sticky element's scrolling ancestor became
      // this div (which doesn't itself scroll; the WINDOW scrolls),
      // so sticking never engaged. `overflow-clip` is the modern
      // equivalent (Chrome 90+, FF 81+, Safari 16+) that prevents
      // both axes from leaking without turning the element into a
      // scroll container.
      className="admin-shell admin-data-grid min-h-dvh text-cream-50 relative overflow-clip"
      style={{
        // Deep near-black with a subtle blue undertone — operator
        // console feel without going fully clinical. Saffron stays
        // on the brand mark + a few accent CTAs so the surface
        // doesn't lose its BadaMangal identity entirely.
        backgroundColor: "#080A10",
      }}
    >
      {/* Skip-to-content link, keyboard-first accessibility. Hidden
          until Tab focuses it; visible as a floating cyan/violet
          pill near the top-left when active. */}
      <a href="#admin-main" className="admin-skip-link">
        Skip to content
      </a>
      {/* Mesh-gradient backdrop — multi-stop radials in cyan + violet
          + a single warm saffron to keep the brand thread visible. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 92% -5%, rgba(34, 211, 238, 0.14) 0%, transparent 55%), radial-gradient(ellipse 60% 50% at -5% 105%, rgba(139, 92, 246, 0.16) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 50% 50%, rgba(242,148,76,0.05) 0%, transparent 70%)",
        }}
      />
      {/* Scanline removed by request — the slow top→bottom drift
          read as fidgety rather than ambient. The .admin-scanline
          CSS rule still lives in globals.css in case we want to
          bring it back behind a feature flag later. */}
      {/* Fine noise overlay — 1.5% opacity, lifts the flat dark
          fill out of plastic territory into a textured operator
          surface. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='0.85' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="relative z-10 flex min-h-dvh items-start">
        {/* ───── SIDEBAR ──────────────────────────────────────────
            `md:sticky md:top-0` pins the sidebar to the viewport so
            it stays visible while the main content scrolls. `h-dvh`
            (dynamic viewport height) gives it the full vertical
            space available on the device, with the nav itself set
            to `overflow-y-auto` so a long nav list scrolls inside
            the sidebar without breaking the stick. `items-start` on
            the parent flex row prevents the flex algorithm from
            stretching the sidebar to match the main content's
            height (which would break sticky). The earlier
            overflow-clip fix on .admin-shell + main is what allows
            sticky to actually engage here. */}
        <aside className="hidden md:flex md:flex-col md:sticky md:top-0 md:h-dvh w-60 shrink-0 border-r border-cyan-400/10 bg-black/45 backdrop-blur-md">
          {/* Brand mark — the real Final-Logo-BM-white.svg is a
              1660×479 horizontal lockup that ALREADY contains both
              the gada-on-disc mark and the "Bada Mangal" wordmark.
              We were previously squashing it into a 28×28 saffron-
              disc square (which clipped to just the mark, with the
              wordmark vanishing off-frame) and then printing the
              text "Bada Mangal" + "ops.console" beside it as a
              hand-rolled duplicate. Now we render the lockup at its
              natural aspect ratio inside the sidebar's brand row.
              The ops.console tagline lives below as the only
              hand-written text — keeps the AI/ops console identity
              without competing with the wordmark. */}
          <Link
            href="/admin/home"
            prefetch={false}
            aria-label="Bada Mangal · admin dashboard"
            className="block px-5 pt-5 pb-4 group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/Final-Logo-BM-white.svg"
              alt="Bada Mangal"
              width="1660"
              height="479"
              // h-10 (40px) — bumped from h-7 (28px). The lockup
              // SVG is 1660×479 (~3.46:1) so h-10 keeps the wordmark
              // legible without overflowing the 240px sidebar width
              // (40px × 3.46 ≈ 138px wide, well within the column).
              className="block w-auto h-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)] group-hover:opacity-90 transition-opacity"
            />
            <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-cyan-300/65 font-mono">
              ops.console<span className="admin-cursor" />
            </div>
          </Link>

          {/* Nav */}
          <nav className="flex-1 px-2 pt-2 pb-4 space-y-0.5 overflow-y-auto">
            {NAV.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  // Prefetch on hover/viewport — the admin pages are
                  // all `force-dynamic`, so without prefetch every
                  // sidebar click was a cold 1-2s SSR round-trip.
                  // With prefetch, by the time the operator clicks
                  // the RSC payload is already streaming. This is
                  // the single biggest perceived-perf win in the
                  // shell. The `auto` default keeps client-router
                  // cache + hover prefetch enabled.
                  className={[
                    "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] transition-colors",
                    active
                      ? "text-cream-50 bg-gradient-to-r from-cyan-400/[0.16] via-cyan-400/[0.06] to-transparent"
                      : "text-cream-50/70 hover:text-cream-50 hover:bg-cream-50/[0.04]",
                  ].join(" ")}
                >
                  {/* Active indicator — cyan accent bar inset just
                      inside the rounded gradient so it reads as part
                      of the highlighted row, not a stray line hanging
                      off the menu item's outer edge. Inset by left-1.5
                      (6px) to clear the rounded-xl corner curve.
                      Vertical centring uses `inset-y-0 my-auto` (NOT
                      `top-1/2 -translate-y-1/2`) because the
                      .admin-nav-slide-in keyframe animates the
                      `transform` property (`scaleY` from 0.4 → 1) and
                      CSS animations win against utility transforms on
                      the same property — that conflict was leaving the
                      bar hanging below the row centre. Auto-margins
                      on a known height (`h-5`) centre cleanly without
                      touching transform. */}
                  {active ? (
                    <span
                      aria-hidden
                      className="admin-nav-slide-in absolute left-1.5 inset-y-0 my-auto h-5 w-[3px] rounded-full bg-cyan-400 shadow-[0_0_6px_0_rgba(34,211,238,0.7)]"
                    />
                  ) : null}
                  <span
                    className={[
                      "shrink-0 w-5 h-5 inline-flex items-center justify-center",
                      active
                        ? "text-cyan-300"
                        : "text-cream-50/60 group-hover:text-cream-50/90",
                    ].join(" ")}
                    aria-hidden
                  >
                    {item.icon}
                  </span>
                  <span
                    className={[
                      "truncate flex-1 tracking-tight",
                      active ? "font-bold" : "font-semibold",
                    ].join(" ")}
                  >
                    {item.label}
                  </span>
                  {/* Counter badge — only renders when the parent
                      page passed a count for this href and it's > 0.
                      Tone follows urgency: pending things (bhandaras,
                      mentions, volunteers, organise, emails) get
                      saffron for "needs attention"; spots get cyan
                      for "live now". */}
                  {(() => {
                    const count = navCounts?.[item.href];
                    if (!count || count <= 0) return null;
                    const isLiveTone = item.href === "/admin/spots";
                    return (
                      <span
                        aria-label={`${count} ${isLiveTone ? "live" : "new"}`}
                        className={[
                          "shrink-0 inline-flex items-center justify-center min-w-[1.25rem] h-[18px] px-1.5 rounded-full text-[10px] font-bold font-mono tabular-nums leading-none",
                          isLiveTone
                            ? "bg-cyan-400/[0.18] border border-cyan-400/40 text-cyan-200"
                            : active
                              ? "bg-saffron-500/30 border border-saffron-500/55 text-saffron-200"
                              : "bg-saffron-500/[0.18] border border-saffron-500/40 text-saffron-300 group-hover:bg-saffron-500/25 group-hover:text-saffron-200",
                        ].join(" ")}
                      >
                        {count > 99 ? "99+" : count}
                      </span>
                    );
                  })()}
                </Link>
              );
            })}
          </nav>

          {/* Sidebar footer */}
          <div className="px-3 pb-4 pt-2 border-t border-cyan-400/[0.08] mt-1">
            <Link
              href="/admin/gallery"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] text-cream-50/70 hover:text-cream-50 hover:bg-cream-50/[0.04] transition-colors"
            >
              <span aria-hidden className="shrink-0 w-5 h-5 inline-flex items-center justify-center text-cream-50/60">
                <IconImage />
              </span>
              <span className="font-semibold tracking-tight">Gallery</span>
            </Link>
            <Link
              href="/"
              prefetch={false}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] text-cream-50/70 hover:text-cream-50 hover:bg-cream-50/[0.04] transition-colors"
            >
              <span aria-hidden className="shrink-0 w-5 h-5 inline-flex items-center justify-center text-cream-50/60">
                <IconExternal />
              </span>
              <span className="font-semibold tracking-tight">View public site</span>
            </Link>
            {/* Build-state chip — small AI/ops detail at the very
                bottom that reads as "this is a system being
                operated", not a cms login. */}
            <div className="mt-3 mx-3 rounded-lg border border-cyan-400/15 bg-cyan-400/[0.03] px-2 py-1.5 font-mono text-[10px] leading-tight">
              <div className="flex items-center justify-between text-cream-50/45">
                <span>build</span>
                <span className="text-cyan-300/85">v2.1.0</span>
              </div>
              <div className="flex items-center justify-between text-cream-50/45">
                <span>region</span>
                <span className="text-cream-50/75">iad1</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ───── MAIN AREA ──────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-20 h-14 border-b border-cyan-400/[0.08] bg-[#080A10]/85 backdrop-blur-md px-4 sm:px-6 flex items-center gap-3">
            <MobileNavToggle />

            {/* Page title (set per-route) */}
            <div className="flex-1 min-w-0">
              {pageTitle ? (
                <div className="leading-tight">
                  <div className="font-fraunces text-base text-cream-50 truncate">
                    {pageTitle}
                  </div>
                  {pageSubtitle ? (
                    <div className="text-[11px] text-cream-50/55 truncate font-mono">
                      {pageSubtitle}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* AI status pill — animated cyan→violet shimmer on the
                text so the operator always sees "the AI is here +
                processing". Pure decoration; reflects the existence
                of Gemini + bot pipelines without showing real-time
                throughput (that's the dashboard's job). */}
            <div className="hidden lg:inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/[0.05] px-3 py-1 text-[10px] font-mono uppercase tracking-[0.16em]">
              <span aria-hidden className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-cyan-400/70 motion-safe:animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
              </span>
              <span className="admin-ai-shimmer">AI · online</span>
            </div>

            {/* Bot heartbeat — surface here at all times so the
                operator never has to dig for it. The existing
                server-component pill is passed in via the layout
                because AdminShell itself is client-side. */}
            {botHeartbeat ? (
              <div className="hidden sm:flex items-center text-xs text-cream-50/65">
                {botHeartbeat}
              </div>
            ) : null}

            {/* Notification bell — server-rendered NotificationBell
                with the popover panel hidden inside a <details>.
                Only pages that fetch alert source data pass this in
                (the dashboard does); other pages don't render a bell.
                The bell sits IMMEDIATELY before the sign-out button
                because that's where users instinctively look for
                account / notification actions in admin tools. */}
            {notifications ? notifications : null}

            {/* Account menu (just sign-out for now) */}
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-3 py-1.5 text-xs transition-colors font-medium"
                title="Sign out"
              >
                <IconSignOut />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </header>

          {/* Page content */}
          <main
            id="admin-main"
            tabIndex={-1}
            // overflow-x-clip (not overflow-x-hidden): same fix as on
            // .admin-shell outer. overflow-x-hidden implicitly forces
            // overflow-y: auto per CSS spec, which makes <main> a
            // scrolling container and breaks position:sticky inside
            // any child (the sticky element pins to <main>, but main
            // doesn't actually scroll — the window does — so sticking
            // never engages). overflow-x-clip clips horizontal overflow
            // without establishing a scrolling context, letting the
            // window remain the scrolling parent for sticky descendants.
            className="flex-1 px-4 sm:px-6 lg:px-8 py-6 overflow-x-clip focus:outline-none"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

/** Mobile-only hamburger — sidebar collapses to a drawer below md. */
function MobileNavToggle() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-cream-50/65 hover:text-cream-50 hover:bg-cream-50/[0.05] transition-colors"
        aria-label="Open menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>
      {open ? (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-64 bg-ink-900 border-r border-cream-50/10 p-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto block w-9 h-9 rounded-lg text-cream-50/65 hover:text-cream-50 hover:bg-cream-50/[0.05]"
              aria-label="Close menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="6" y1="18" x2="18" y2="6" />
              </svg>
            </button>
            <nav className="mt-3 space-y-1">
              {NAV.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  prefetch={false}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-cream-50/85 hover:text-cream-50 hover:bg-cream-50/[0.05]"
                >
                  <span className="shrink-0 w-5 h-5 inline-flex items-center justify-center text-cream-50/65">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ──────────────────────── Icons ──────────────────────────────── */
function IconDashboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="8" height="9" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="14" width="8" height="7" rx="1.5" />
    </svg>
  );
}
function IconDiya() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 4 c1.6 1.5 2.5 3.2 0 5.5 c-2.5 -2.3 -1.6 -4 0 -5.5 z" fill="currentColor" />
      <path d="M4 14 q8 5 16 0 l-2 4 h-12 z" />
    </svg>
  );
}
function IconCamera() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="7" width="18" height="13" rx="2.5" />
      <path d="M9 7 l1.5 -3 h3 l1.5 3" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a8 8 0 1 1-3.5-6.6L21 4l-1.4 3.6A8 8 0 0 1 21 12z" />
    </svg>
  );
}
function IconCompass() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <polygon points="14.5,9.5 11,13 9.5,14.5 13,11" fill="currentColor" />
    </svg>
  );
}
function IconClipboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4 v-1 h6 v1" />
      <line x1="9" y1="10" x2="15" y2="10" />
      <line x1="9" y1="14" x2="15" y2="14" />
      <line x1="9" y1="18" x2="13" y2="18" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="9" r="3.5" />
      <path d="M2.5 20 c0 -4 3 -7 6.5 -7 s6.5 3 6.5 7" />
      <circle cx="17" cy="10" r="2.5" />
      <path d="M15 20 c0 -3 2 -5 4.5 -5 s2 1 2 5" />
    </svg>
  );
}
function IconImage() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M21 16 l-5 -5 -7 7 -3 -3 -3 3" />
    </svg>
  );
}
/** Envelope — used for the Emails nav item. Plain stylised letter
 *  shape; the inner triangle hints at an open flap so the icon
 *  reads as "inbox" rather than just "mail". */
function IconEnvelope() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7 L12 13 L21 7" />
    </svg>
  );
}
/** Rupee glyph — used by the Donations sidebar item. Drawn rather
 *  than relying on the literal "₹" character so weight + stroke line
 *  up with the other line-art icons in the rail. */
function IconRupee() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 4 H17" />
      <path d="M7 8 H17" />
      <path d="M7 12 H11 a4 4 0 0 0 0 -8" />
      <path d="M7 12 L15 20" />
    </svg>
  );
}
/** Sparkle — used for the Content Hub nav item. Reads as "AI /
 *  generated content / library of templates" without committing to
 *  any one of pitches / images / prompts. */
function IconSparkle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3 L13.8 9.2 L20 11 L13.8 12.8 L12 19 L10.2 12.8 L4 11 L10.2 9.2 Z" />
      <path d="M19 4 L19.6 5.8 L21.5 6.5 L19.6 7.2 L19 9 L18.4 7.2 L16.5 6.5 L18.4 5.8 Z" opacity="0.8" />
      <path d="M5.5 16 L6 17.2 L7.2 17.7 L6 18.2 L5.5 19.5 L5 18.2 L3.8 17.7 L5 17.2 Z" opacity="0.6" />
    </svg>
  );
}
function IconExternal() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 4 h6 v6" />
      <path d="M10 14 L20 4" />
      <path d="M19 13 v6 a1.5 1.5 0 0 1 -1.5 1.5 H5 a1.5 1.5 0 0 1 -1.5 -1.5 V6.5 A1.5 1.5 0 0 1 5 5 h6" />
    </svg>
  );
}
function IconSignOut() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 21 H5 a2 2 0 0 1 -2 -2 V5 a2 2 0 0 1 2 -2 h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
