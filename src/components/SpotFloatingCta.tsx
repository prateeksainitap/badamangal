"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * Floating "Spot a bhandara" CTA, mobile-first, sits bottom-right on every
 * page except the spot form itself. Designed for Bada Mangal day: a single
 * tap takes a passer-by from "I'm walking past a pandal" to a photo-uploaded
 * pin on the city map in under 30 seconds.
 */
export default function SpotFloatingCta() {
  const pathname = usePathname();
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";

  // Hide on the spot form, on the listing form (already a long flow), and on
  // admin routes.
  if (
    pathname?.startsWith("/spot") ||
    pathname?.startsWith("/list-bhandara") ||
    pathname?.startsWith("/admin")
  ) {
    return null;
  }

  return (
    <Link
      href={`/spot${isHi ? "" : "?lang=en"}`}
      data-ga="cta_floating_spot"
      data-ga-pathname={pathname ?? ""}
      aria-label={isHi ? "भंडारा स्पॉट करें" : "Spot a bhandara"}
      className="fixed z-[900] bottom-5 right-5 sm:bottom-6 sm:right-6 inline-flex items-center gap-2 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 shadow-warm pl-3 pr-4 py-2.5 sm:py-3 font-semibold text-sm transition-transform hover:-translate-y-0.5"
    >
      <span
        aria-hidden
        className="relative inline-flex items-center justify-center w-8 h-8 rounded-full bg-cream-50 text-saffron-600"
      >
        <span className="absolute inset-0 rounded-full bg-cream-50 opacity-50 motion-safe:animate-ping" />
        <CameraIcon />
      </span>
      <span className="leading-none">
        {isHi ? "स्पॉट करें" : "Spot a bhandara"}
      </span>
    </Link>
  );
}

function CameraIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="relative"
    >
      <path d="M3 7h3l2-2h8l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
