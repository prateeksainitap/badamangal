"use client";

/**
 * Admin shell, sidebar + top bar that wraps every authenticated
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
import { useEffect, useState } from "react";
import { logoutAction } from "@/app/admin/actions";

/** localStorage key for the desktop "collapse sidebar to icon rail"
 *  preference. Persists across page navigation + reloads so the
 *  operator's preference sticks. "1" = collapsed, "0" / unset = expanded. */
const COLLAPSE_KEY = "bm-admin-sidebar-collapsed";

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
    // status of the claim. Intent-tracking only, see
    // /admin/donations page header for the full disclaimer about
    // UPI direct-to-organiser flows lacking server-side confirmation.
    href: "/admin/donations",
    label: "Donations",
    icon: <IconRupee />,
  },
  {
    // Bot-ingest audit. Surfaces every /api/bot/ingest outcome
    // (success / duplicate / ignored / failed) so the operator can
    // answer "I forwarded that poster, what did the bot do with
    // it?" from the sidebar without hunting URLs. Added 2026-05-25
    // after a debug session where the user couldn't tell that the
    // bot was actually working (3 dedupes had landed but no new
    // rows were created, leaving an "is it broken?" question with
    // no obvious path to the audit log).
    href: "/admin/bot-log",
    label: "Bot log",
    icon: <IconClipboard />,
  },
];

type Props = {
  children: React.ReactNode;
  /** Optional banner shown above the page title, used by Bhandaras
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

  // Sidebar collapse state.
  //   - desktopCollapsed: shrinks the sidebar to a 56 px icon rail
  //     (nav still accessible, labels + badges + footer hidden).
  //     Persisted to localStorage under COLLAPSE_KEY so the
  //     operator's preference survives navigation + reloads.
  //   - mobileOpen: full-screen drawer overlay below md. Lives on
  //     state here (rather than the previous self-contained
  //     MobileNavToggle) so the drawer can render the same
  //     NavItem map (with badges + active highlights) the desktop
  //     sidebar uses, and so a Sidebar-toggle button in the header
  //     can target the right state for the current viewport.
  //
  // We initialise to "expanded" / "closed" on first render to
  // match SSR'd markup, then hydrate the collapsed preference in
  // the effect — this avoids a flash of the wrong sidebar width.
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(COLLAPSE_KEY) === "1") {
        setDesktopCollapsed(true);
      }
    } catch {
      /* localStorage may be disabled (private browsing, etc.), no-op */
    }
  }, []);

  // Lock body scroll while the mobile drawer is open so the page
  // behind the overlay doesn't scroll under the user's finger.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  function toggleDesktopCollapsed() {
    setDesktopCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* localStorage may be disabled, no-op */
      }
      return next;
    });
  }

  function isActive(item: NavItem): boolean {
    // Dashboard is `/admin/home`, exact match.
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
      // descendant, the sticky element's scrolling ancestor became
      // this div (which doesn't itself scroll; the WINDOW scrolls),
      // so sticking never engaged. `overflow-clip` is the modern
      // equivalent (Chrome 90+, FF 81+, Safari 16+) that prevents
      // both axes from leaking without turning the element into a
      // scroll container.
      className="admin-shell admin-data-grid min-h-dvh text-cream-50 relative overflow-clip"
      style={{
        // Deep near-black with a subtle blue undertone, operator
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
      {/* Mesh-gradient backdrop, multi-stop radials in cyan + violet
          + a single warm saffron to keep the brand thread visible. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 92% -5%, rgba(34, 211, 238, 0.14) 0%, transparent 55%), radial-gradient(ellipse 60% 50% at -5% 105%, rgba(139, 92, 246, 0.16) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 50% 50%, rgba(242,148,76,0.05) 0%, transparent 70%)",
        }}
      />
      {/* Scanline removed by request, the slow top→bottom drift
          read as fidgety rather than ambient. The .admin-scanline
          CSS rule still lives in globals.css in case we want to
          bring it back behind a feature flag later. */}
      {/* Fine noise overlay, 1.5% opacity, lifts the flat dark
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
        <aside
          className={[
            // Sidebar width is the only thing that changes with the
            // collapse toggle. We animate `width` with a fast 180 ms
            // transition so the layout shift reads as deliberate
            // rather than abrupt. Width contains the rest of the
            // sidebar (logo + nav + footer) which switches its inner
            // rendering based on `desktopCollapsed`.
            "hidden md:flex md:flex-col md:sticky md:top-0 md:h-dvh shrink-0",
            "border-r border-cyan-400/10 bg-black/45 backdrop-blur-md",
            "transition-[width] duration-200 ease-out",
            desktopCollapsed ? "w-14" : "w-60",
          ].join(" ")}
        >
          {/* Brand mark + collapse toggle.

              Layout invariant: the toggle button is always the
              FIRST child of this row, sitting at a fixed offset
              from the sidebar's left edge. Because shrinking the
              sidebar collapses its RIGHT edge (the left edge
              doesn't move), the toggle's absolute screen position
              stays identical across expand / collapse. The brand
              lockup sits to the right of the toggle when expanded
              and is hidden entirely when collapsed — no monogram
              substitute, because the 56 px icon rail reads cleaner
              with just the toggle on top.

              Icon: a "sidebar panel" glyph (rectangle with a
              vertical bar at the left), the de-facto standard
              used by Notion / Linear / VS Code / macOS Finder for
              "toggle sidebar". Not a chevron — chevrons read as
              "navigate" rather than "show / hide a panel". */}
          <div className="flex items-center gap-2 px-2 pt-3 pb-3 min-h-[3.25rem]">
            <button
              type="button"
              onClick={toggleDesktopCollapsed}
              title={
                desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"
              }
              aria-label={
                desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"
              }
              aria-expanded={!desktopCollapsed}
              className={[
                "shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg",
                "text-cream-50/65 hover:text-cream-50 hover:bg-cream-50/[0.06]",
                "border border-transparent hover:border-cyan-400/20 transition-colors",
              ].join(" ")}
            >
              <IconSidebarToggle collapsed={desktopCollapsed} />
            </button>
            {!desktopCollapsed ? (
              <Link
                href="/admin/home"
                prefetch={false}
                aria-label="Bada Mangal · admin dashboard"
                className="block group flex-1 min-w-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/Final-Logo-BM-white.svg"
                  alt="Bada Mangal"
                  width="1660"
                  height="479"
                  // h-9 (36px) — pairs with the 36 px toggle
                  // button so brand + toggle baseline-align in
                  // the expanded header.
                  className="block w-auto h-9 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)] group-hover:opacity-90 transition-opacity"
                />
                <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-cyan-300/65 font-mono">
                  ops.console<span className="admin-cursor" />
                </div>
              </Link>
            ) : null}
          </div>

          {/* Nav */}
          <nav
            className={[
              "flex-1 pt-2 pb-4 space-y-0.5 overflow-y-auto",
              desktopCollapsed ? "px-1.5" : "px-2",
            ].join(" ")}
          >
            {NAV.map((item) => {
              const active = isActive(item);
              const count = navCounts?.[item.href] ?? 0;
              const isLiveTone = item.href === "/admin/spots";
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  // Native title attribute provides a tooltip with the
                  // item label when the sidebar is collapsed to icon
                  // rail mode. No-op when expanded (the label is
                  // already visible).
                  title={desktopCollapsed ? item.label : undefined}
                  // Prefetch on hover/viewport, the admin pages are
                  // all `force-dynamic`, so without prefetch every
                  // sidebar click was a cold 1-2s SSR round-trip.
                  // With prefetch, by the time the operator clicks
                  // the RSC payload is already streaming. This is
                  // the single biggest perceived-perf win in the
                  // shell. The `auto` default keeps client-router
                  // cache + hover prefetch enabled.
                  className={[
                    "group relative flex items-center rounded-xl text-[15px] transition-colors",
                    desktopCollapsed
                      ? "justify-center px-0 py-2.5"
                      : "gap-3 px-3 py-2.5",
                    active
                      ? "text-cream-50 bg-gradient-to-r from-cyan-400/[0.16] via-cyan-400/[0.06] to-transparent"
                      : "text-cream-50/70 hover:text-cream-50 hover:bg-cream-50/[0.04]",
                  ].join(" ")}
                >
                  {/* Active indicator, cyan accent bar inset just
                      inside the rounded gradient so it reads as part
                      of the highlighted row, not a stray line hanging
                      off the menu item's outer edge. Vertical centring
                      uses `inset-y-0 my-auto` (NOT `top-1/2
                      -translate-y-1/2`) because the .admin-nav-slide-in
                      keyframe animates `transform`, and CSS animations
                      beat utility transforms on the same property —
                      that conflict was leaving the bar hanging below
                      row centre. Auto-margins on a known height (h-5)
                      centre cleanly without touching transform. */}
                  {active && !desktopCollapsed ? (
                    <span
                      aria-hidden
                      className="admin-nav-slide-in absolute left-1.5 inset-y-0 my-auto h-5 w-[3px] rounded-full bg-cyan-400 shadow-[0_0_6px_0_rgba(34,211,238,0.7)]"
                    />
                  ) : null}
                  <span
                    className={[
                      "shrink-0 w-5 h-5 inline-flex items-center justify-center relative",
                      active
                        ? "text-cyan-300"
                        : "text-cream-50/60 group-hover:text-cream-50/90",
                    ].join(" ")}
                    aria-hidden
                  >
                    {item.icon}
                    {/* Collapsed-mode badge: a small dot in the
                        top-right corner of the icon. We can't fit
                        a number pill in a 56px rail, but a single
                        coloured dot is enough to signal "this nav
                        item has new items waiting", which is the
                        whole point of the badge. */}
                    {desktopCollapsed && count > 0 ? (
                      <span
                        aria-label={`${count} ${isLiveTone ? "live" : "new"}`}
                        className={[
                          "absolute -top-0.5 -right-0.5 inline-block w-2 h-2 rounded-full border border-[#0B0E16]",
                          isLiveTone ? "bg-cyan-400" : "bg-saffron-500",
                        ].join(" ")}
                      />
                    ) : null}
                  </span>
                  {!desktopCollapsed ? (
                    <>
                      <span
                        className={[
                          "truncate flex-1 tracking-tight",
                          active ? "font-bold" : "font-semibold",
                        ].join(" ")}
                      >
                        {item.label}
                      </span>
                      {/* Counter badge, only renders when the parent
                          page passed a count > 0. Tone follows urgency:
                          pending things get saffron for "needs
                          attention"; spots get cyan for "live now". */}
                      {count > 0 ? (
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
                      ) : null}
                    </>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          {/* Sidebar footer. Hidden entirely when the sidebar is
              collapsed to its 56 px icon rail — the gallery /
              public-site shortcuts and the build chip aren't
              critical enough to deserve real estate when the
              operator has explicitly asked for more horizontal
              breathing room. */}
          {!desktopCollapsed ? (
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
              {/* Build-state chip, small AI/ops detail at the very
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
          ) : null}
        </aside>

        {/* ───── MAIN AREA ──────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-20 h-14 border-b border-cyan-400/[0.08] bg-[#080A10]/85 backdrop-blur-md px-4 sm:px-6 flex items-center gap-3">
            {/* Mobile menu trigger, opens the full-NAV drawer
                overlay defined at the bottom of this component.
                Styled bigger + with a thin border so it reads as
                a real button on small screens (the previous
                ghost-style 3-line icon was easy to miss against
                the dark backdrop on a phone). */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              className="md:hidden inline-flex items-center gap-1.5 rounded-lg px-2.5 h-9 text-cream-50/85 bg-cream-50/[0.04] border border-cream-50/15 hover:bg-cream-50/[0.10] hover:border-cyan-400/35 hover:text-cream-50 transition-colors"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </svg>
              <span className="text-[12px] font-semibold tracking-tight">
                Menu
              </span>
            </button>

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

            {/* AI status pill, animated cyan→violet shimmer on the
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

            {/* Bot heartbeat, surface here at all times so the
                operator never has to dig for it. The existing
                server-component pill is passed in via the layout
                because AdminShell itself is client-side. */}
            {botHeartbeat ? (
              <div className="hidden sm:flex items-center text-xs text-cream-50/65">
                {botHeartbeat}
              </div>
            ) : null}

            {/* Notification bell, server-rendered NotificationBell
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
            // doesn't actually scroll, the window does, so sticking
            // never engages). overflow-x-clip clips horizontal overflow
            // without establishing a scrolling context, letting the
            // window remain the scrolling parent for sticky descendants.
            className="flex-1 px-4 sm:px-6 lg:px-8 py-6 overflow-x-clip focus:outline-none"
          >
            {children}
          </main>
        </div>
      </div>

      {/* ───── MOBILE NAV DRAWER ────────────────────────────────
          Slides in from the left when the header's "Menu" button
          is tapped. Renders the same NavItem array the desktop
          sidebar uses, with badges + active highlights, so the
          mobile experience reaches feature-parity with desktop
          (the previous drawer rendered only icon + label, no
          badge counts — operators couldn't see "5 pending
          spots" without leaving the screen they were on).
          z-50 to beat every other admin overlay (header is z-20,
          row-popovers are z-30); body scroll is locked while the
          drawer is open via the useEffect higher up. */}
      {mobileOpen ? (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-72 max-w-[82vw] bg-[#080A10] border-r border-cyan-400/15 overflow-y-auto flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header: brand on the left, close button on
                the right. Mirrors the desktop sidebar's brand row
                so the operator's spatial memory transfers. */}
            <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3 border-b border-cyan-400/[0.08]">
              <Link
                href="/admin/home"
                prefetch={false}
                onClick={() => setMobileOpen(false)}
                aria-label="Bada Mangal · admin dashboard"
                className="block group flex-1 min-w-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/Final-Logo-BM-white.svg"
                  alt="Bada Mangal"
                  width="1660"
                  height="479"
                  className="block w-auto h-9 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                />
                <div className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-cyan-300/65 font-mono">
                  ops.console
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg text-cream-50/75 hover:text-cream-50 hover:bg-cream-50/[0.05] border border-transparent hover:border-cyan-400/25 transition-colors"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="6" y1="18" x2="18" y2="6" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 px-2 pt-3 pb-4 space-y-0.5 overflow-y-auto">
              {NAV.map((item) => {
                const active = isActive(item);
                const count = navCounts?.[item.href] ?? 0;
                const isLiveTone = item.href === "/admin/spots";
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    prefetch={false}
                    onClick={() => setMobileOpen(false)}
                    className={[
                      "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] transition-colors",
                      active
                        ? "text-cream-50 bg-gradient-to-r from-cyan-400/[0.16] via-cyan-400/[0.06] to-transparent"
                        : "text-cream-50/80 hover:text-cream-50 hover:bg-cream-50/[0.04]",
                    ].join(" ")}
                  >
                    {active ? (
                      <span
                        aria-hidden
                        className="absolute left-1.5 inset-y-0 my-auto h-5 w-[3px] rounded-full bg-cyan-400 shadow-[0_0_6px_0_rgba(34,211,238,0.7)]"
                      />
                    ) : null}
                    <span
                      className={[
                        "shrink-0 w-5 h-5 inline-flex items-center justify-center",
                        active
                          ? "text-cyan-300"
                          : "text-cream-50/65 group-hover:text-cream-50/90",
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
                    {count > 0 ? (
                      <span
                        aria-label={`${count} ${isLiveTone ? "live" : "new"}`}
                        className={[
                          "shrink-0 inline-flex items-center justify-center min-w-[1.25rem] h-[18px] px-1.5 rounded-full text-[10px] font-bold font-mono tabular-nums leading-none",
                          isLiveTone
                            ? "bg-cyan-400/[0.18] border border-cyan-400/40 text-cyan-200"
                            : active
                              ? "bg-saffron-500/30 border border-saffron-500/55 text-saffron-200"
                              : "bg-saffron-500/[0.18] border border-saffron-500/40 text-saffron-300",
                        ].join(" ")}
                      >
                        {count > 99 ? "99+" : count}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            {/* Drawer footer: same shortcuts as desktop (gallery +
                public site). Build chip omitted on purpose — the
                screen real estate on phones is more valuable for
                the nav itself. */}
            <div className="px-3 pb-4 pt-2 border-t border-cyan-400/[0.08]">
              <Link
                href="/admin/gallery"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] text-cream-50/75 hover:text-cream-50 hover:bg-cream-50/[0.04] transition-colors"
              >
                <span aria-hidden className="shrink-0 w-5 h-5 inline-flex items-center justify-center text-cream-50/65">
                  <IconImage />
                </span>
                <span className="font-semibold tracking-tight">Gallery</span>
              </Link>
              <Link
                href="/"
                prefetch={false}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] text-cream-50/75 hover:text-cream-50 hover:bg-cream-50/[0.04] transition-colors"
              >
                <span aria-hidden className="shrink-0 w-5 h-5 inline-flex items-center justify-center text-cream-50/65">
                  <IconExternal />
                </span>
                <span className="font-semibold tracking-tight">
                  View public site
                </span>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Sidebar-panel toggle icon — a rectangle with a vertical bar
 *  inside, the de-facto "toggle sidebar" glyph used by Notion,
 *  Linear, VS Code, and macOS Finder. The bar's tint flips based
 *  on collapsed state so the icon also reads as a state indicator
 *  (filled bar = "sidebar is currently shown", outlined bar =
 *  "sidebar is currently hidden") on top of being a button. */
function IconSidebarToggle({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <line x1="9" y1="5" x2="9" y2="19" />
      {/* When the sidebar is currently EXPANDED, fill the left
          bar so the icon visually conveys "the sidebar is on".
          When collapsed, the bar stays as outline-only. */}
      {!collapsed ? (
        <rect
          x="3"
          y="5"
          width="6"
          height="14"
          rx="2"
          fill="currentColor"
          opacity="0.25"
          stroke="none"
        />
      ) : null}
    </svg>
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
/** Envelope, used for the Emails nav item. Plain stylised letter
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
/** Rupee glyph, used by the Donations sidebar item. Drawn rather
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
/** Sparkle, used for the Content Hub nav item. Reads as "AI /
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
