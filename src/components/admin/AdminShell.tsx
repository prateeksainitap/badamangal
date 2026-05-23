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
    href: "/admin",
    label: "Bhandaras",
    icon: <IconDiya />,
    match: { type: "bhandara" },
  },
  {
    href: "/admin?type=spot",
    label: "Spots",
    icon: <IconCamera />,
    match: { type: "spot" },
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
};

export default function AdminShell({
  children,
  pageTitle,
  pageSubtitle,
  botHeartbeat,
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
    <div className="min-h-dvh bg-ink-900 text-cream-50">
      {/* Ambient glow that ties the admin visually to the homepage's
          LiveChatterBoard panel — saffron radial in the top-right,
          subtle sindoor in the bottom-left. Non-interactive. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at 92% -10%, rgba(242,148,76,0.18) 0%, transparent 55%), radial-gradient(ellipse at -10% 110%, rgba(156,42,42,0.18) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 flex min-h-dvh">
        {/* ───── SIDEBAR ────────────────────────────────────────── */}
        <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-cream-50/10 bg-black/30 backdrop-blur-sm">
          {/* Brand */}
          <div className="px-5 pt-5 pb-4 flex items-center gap-2.5">
            <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-saffron-500 to-saffron-600 flex items-center justify-center shadow-[0_4px_14px_-4px_rgba(242,148,76,0.6)]">
              <span aria-hidden className="text-cream-50 text-lg font-bold leading-none">
                ◉
              </span>
            </div>
            <div className="leading-tight">
              <div className="font-fraunces text-base text-cream-50">
                Bada Mangal
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-cream-50/45">
                Admin Console
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-2 pt-2 pb-4 space-y-0.5 overflow-y-auto">
            {NAV.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  prefetch={false}
                  className={[
                    "group flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors",
                    active
                      ? "bg-gradient-to-r from-saffron-500/20 via-saffron-500/10 to-transparent text-cream-50 shadow-[inset_2px_0_0_0_var(--tw-shadow-color)] shadow-saffron-500"
                      : "text-cream-50/65 hover:text-cream-50 hover:bg-cream-50/[0.04]",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "shrink-0 w-5 h-5 inline-flex items-center justify-center",
                      active ? "text-saffron-500" : "text-cream-50/55 group-hover:text-cream-50/85",
                    ].join(" ")}
                    aria-hidden
                  >
                    {item.icon}
                  </span>
                  <span className="font-medium truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Sidebar footer */}
          <div className="px-3 pb-4 pt-2 border-t border-cream-50/10 mt-1">
            <Link
              href="/admin/gallery"
              prefetch={false}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-cream-50/65 hover:text-cream-50 hover:bg-cream-50/[0.04] transition-colors"
            >
              <span aria-hidden className="shrink-0 w-5 h-5 inline-flex items-center justify-center text-cream-50/55">
                <IconImage />
              </span>
              <span className="font-medium">Gallery</span>
            </Link>
            <Link
              href="/"
              prefetch={false}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-cream-50/65 hover:text-cream-50 hover:bg-cream-50/[0.04] transition-colors"
            >
              <span aria-hidden className="shrink-0 w-5 h-5 inline-flex items-center justify-center text-cream-50/55">
                <IconExternal />
              </span>
              <span className="font-medium">View public site</span>
            </Link>
          </div>
        </aside>

        {/* ───── MAIN AREA ──────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-20 h-14 border-b border-cream-50/10 bg-ink-900/85 backdrop-blur-md px-4 sm:px-6 flex items-center gap-3">
            <MobileNavToggle />

            {/* Page title (set per-route) */}
            <div className="flex-1 min-w-0">
              {pageTitle ? (
                <div className="leading-tight">
                  <div className="font-fraunces text-base text-cream-50 truncate">
                    {pageTitle}
                  </div>
                  {pageSubtitle ? (
                    <div className="text-[11px] text-cream-50/55 truncate">
                      {pageSubtitle}
                    </div>
                  ) : null}
                </div>
              ) : null}
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

            {/* Account menu (just sign-out for now) */}
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full border border-cream-50/15 hover:border-cream-50/30 hover:bg-cream-50/[0.05] px-3 py-1.5 text-xs text-cream-50/75 hover:text-cream-50 transition-colors"
                title="Sign out"
              >
                <IconSignOut />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </header>

          {/* Page content */}
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 overflow-x-hidden">
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
