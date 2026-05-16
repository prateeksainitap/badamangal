"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useT } from "@/lib/useT";
import { MarigoldDivider } from "@/components/ornaments";

function FooterInner() {
  const { t, locale } = useT();
  const year = new Date().getFullYear();
  const isHi = locale === "hi";

  const cols: { heading: string; links: { href: string; label: string }[] }[] = [
    {
      // Merged "Discover" + "Get involved" column. All four primary
      // user actions live here — finding, seeing live, listing, spotting
      // — under a single umbrella heading so the footer reads tighter
      // without orphaning the two-item Get-involved column next door.
      heading: t.footer.discoverHeading,
      links: [
        { href: "/#map", label: t.footer.discoverMap },
        { href: "/live", label: isHi ? "लाइव फ़ीड" : "Live feed" },
        // Deep-link with ?role=organizer so AddBhandaraSwitcher
        // skips the "are you an organizer or spotter?" chooser and
        // drops the visitor straight on the listing form.
        { href: "/list-bhandara?role=organizer", label: t.footer.getInvolvedAdd },
        // Pamphlet generator — surfaces the printable-invite tool
        // for organisers who haven't yet considered listing online
        // (the QR on the generated pamphlet pulls them in regardless).
        {
          href: "/pamphlet",
          label: isHi ? "मुफ़्त पैम्फलेट बनाएँ" : "Free pamphlet maker",
        },
        { href: "/spot", label: isHi ? "भंडारा स्पॉट करें" : "Spot a bhandara" },
        // Past-bhandaras archive — listed venues whose Tuesdays are
        // over + spotted sightings whose 8-hour window expired.
        // Sits inside Discover (next to /live + /spot) so the
        // present/past pair reads naturally as one trip through the
        // record.
        { href: "/archive", label: isHi ? "बीते भंडारे" : "Past Bhandaras" },
      ],
    },
    {
      heading: t.footer.resourcesHeading,
      links: [
        { href: "/resources/chalisa", label: t.resources.cards.chalisa.title },
        { href: "/resources/aarti", label: t.resources.cards.aarti.title },
        { href: "/resources/ashtak", label: t.resources.cards.ashtak.title },
        { href: "/resources/bajrang-baan", label: t.resources.cards.bajrangBaan.title },
        { href: "/resources/ram-stuti", label: t.resources.cards.ramStuti.title },
        { href: "/resources/rituals", label: t.resources.cards.rituals.title },
        { href: "/resources/temples", label: t.resources.cards.temples.title },
        { href: "/resources/news", label: t.resources.cards.news.title },
      ],
    },
    {
      heading: t.footer.aboutHeading,
      links: [
        { href: "/history", label: isHi ? "कहानी" : "The tradition" },
        // Legal links live in About so they're discoverable without
        // forcing readers all the way to the bottom of the footer.
        { href: "/terms", label: isHi ? "नियम और शर्तें" : "Terms & Conditions" },
        { href: "/privacy", label: isHi ? "गोपनीयता नीति" : "Privacy Policy" },
        { href: "/disclaimers", label: isHi ? "अस्वीकरण" : "Disclaimers" },
      ],
    },
    {
      // Dedicated Contact column — single link to the /contact form.
      // Email mailto continues to live in the copyright strip below.
      heading: isHi ? "संपर्क" : "Contact",
      links: [
        { href: "/contact", label: isHi ? "हमें लिखें" : "Write to us" },
      ],
    },
  ];

  return (
    <footer className="mt-20 border-t-2 border-gold-500/70 bg-cream-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-14">
        <div className="grid gap-10 md:grid-cols-[1.2fr_3fr] md:gap-14">
          {/* Brand block */}
          <div className="space-y-4">
            {/* Logo SVG already includes the wordmark, so the side
                text lockup that used to live here was redundant.
                Tall fixed height + w-auto preserves aspect ratio. */}
            <Link
              href={`/${isHi ? "" : "?lang=en"}`}
              aria-label="BadaMangal home"
              data-ga="nav_brand"
              data-ga-source="footer"
              className="inline-flex items-center group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/logo-mark.svg"
                alt="BadaMangal"
                className="h-16 w-auto"
              />
              <span className="sr-only">Bada Mangal · BadaMangal.com</span>
            </Link>
            <p className="text-sm text-ink-600 leading-relaxed max-w-xs">
              {isHi
                ? "लखनऊ की 400 साल पुरानी बड़ा मंगल परंपरा को जीवित रखते हुए, हर भंडारा, कथा, और आरती, एक ही जगह।"
                : "Keeping Lucknow's 400-year-old Bada Mangal tradition alive, every bhandara, story, and prayer in one place."}
            </p>
          </div>

          {/* Link columns. Resources gets a 2-cell allocation (because
              it has 8 items and reads better as two short lists than
              one tall one); the rest stay at 1 cell each. The grid is
              5 columns on md+ — Discover · Resources (×2) · About ·
              Contact — totalling 5 cells. */}
          <nav
            aria-label="Footer"
            className="grid gap-8 sm:grid-cols-2 md:grid-cols-5"
          >
            {cols.map((col) => {
              const isResources = col.heading === t.footer.resourcesHeading;
              return (
              <div
                key={col.heading}
                className={isResources ? "md:col-span-2" : undefined}
              >
                <p className="font-mukta uppercase tracking-[0.22em] text-[0.7rem] text-gold-500 font-semibold">
                  {col.heading}
                </p>
                <ul
                  className={[
                    "mt-3 text-sm text-ink-900",
                    // Resources flows its links into two CSS columns
                    // (instead of a grid) so a wrapping item like
                    // "Sankat Mochan Hanuman Ashtak" only steals
                    // vertical space inside its own column — the
                    // adjacent column doesn't inherit a phantom gap.
                    // `break-inside-avoid` keeps each list item on
                    // a single column even if it has to spill the
                    // column shorter.
                    isResources
                      ? "columns-2 gap-x-4 [&>li]:break-inside-avoid [&>li]:mb-2"
                      : "space-y-2",
                  ].join(" ")}
                >
                  {col.links.map((l) => (
                    <li key={`${col.heading}-${l.href}-${l.label}`}>
                      <Link
                        href={l.href}
                        data-ga="footer_link"
                        data-ga-href={l.href}
                        data-ga-label={l.label}
                        className="hover:text-saffron-600 transition-colors"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              );
            })}

          </nav>
        </div>

        {/* Marigold divider */}
        <div className="mt-12 flex justify-center">
          <MarigoldDivider size={260} className="text-gold-500" />
        </div>

        {/* Closing benediction (Jai Shri Ram…), with the seva line
            tucked directly underneath as a single quiet block. */}
        <div className="mt-6 text-center">
          <p className="font-tiro text-lg sm:text-xl text-sindoor-700">
            {t.footer.closing}
          </p>
          <p className="mt-1.5 italic text-xs text-ink-600">
            {t.footer.seva}
          </p>
        </div>

        {/* Copyright strip — legal links live in the About column
            above. The contact email sits inline here too (between the
            copyright and the "Made with seva" tagline) so a reader
            scanning the foot of the page can grab it without scrolling
            back up to the columns. */}
        <div className="mt-8 pt-5 border-t border-gold-500/25 text-center text-xs text-ink-600">
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <span>© {year} BadaMangal.com</span>
            <span aria-hidden className="text-gold-500/50">·</span>
            <a
              href={`mailto:${t.footer.contactEmail}`}
              className="text-saffron-600 hover:text-sindoor-700 transition-colors"
              data-ga="footer_email_mailto"
            >
              {t.footer.contactEmail}
            </a>
            <span aria-hidden className="text-gold-500/50">·</span>
            <span>{t.footer.rights}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function Footer() {
  return (
    <Suspense
      fallback={
        <footer className="mt-20 border-t-2 border-gold-500/70 bg-cream-50">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 h-[280px]" />
        </footer>
      }
    >
      <FooterInner />
    </Suspense>
  );
}
