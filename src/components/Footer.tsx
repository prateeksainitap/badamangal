"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useT } from "@/lib/useT";
import { MarigoldDivider } from "@/components/ornaments";

/** WhatsApp communities surfaced in the footer. Mirrors the source-of-
 *  truth list in LiveChatterBoard.tsx (homepage chatter section). Same
 *  href + kind contract; the footer renders them as a compact tile
 *  strip in the brand block rather than full cards.
 *
 *  Order is "biggest first" so a footer scanner who only reads the
 *  first tile lands on the most active circle. `kind` controls the
 *  hover label ("Community" / "Group" / "Channel") + the verb on the
 *  CTA (Join vs Follow). When the list changes, update
 *  LiveChatterBoard's WHATSAPP_CTAS too so the homepage and footer
 *  don't drift. */
const FOOTER_WHATSAPP_LINKS: ReadonlyArray<{
  label: string;
  labelHi: string;
  href: string;
  kind: "community" | "group" | "channel";
}> = [
  {
    label: "Bada Mangal Community",
    labelHi: "बड़ा मंगल कम्युनिटी",
    href: "https://chat.whatsapp.com/H3HqNV4rOPi6xWU5O93fFv",
    kind: "community",
  },
  {
    label: "Balaji ka Bhandara",
    labelHi: "बालाजी का भंडारा",
    href: "https://chat.whatsapp.com/GACGY3qEiIHA5tCxV3FQzB",
    kind: "community",
  },
  {
    label: "Bhandara Group",
    labelHi: "भंडारा ग्रुप",
    href: "https://chat.whatsapp.com/FNtgNhFUmqaI6MMUt1M673",
    kind: "group",
  },
  {
    label: "Bada Mangal Channel",
    labelHi: "बड़ा मंगल चैनल",
    href: "https://whatsapp.com/channel/0029Vb7wV4g9sBI6xxYsDw0C",
    kind: "channel",
  },
];

function FooterInner() {
  const { t, locale } = useT();
  const year = new Date().getFullYear();
  const isHi = locale === "hi";

  const cols: { heading: string; links: { href: string; label: string }[] }[] = [
    {
      // Merged "Discover" + "Get involved" column. All four primary
      // user actions live here, finding, seeing live, listing, spotting
      //, under a single umbrella heading so the footer reads tighter
      // without orphaning the two-item Get-involved column next door.
      heading: t.footer.discoverHeading,
      links: [
        { href: "/#map", label: t.footer.discoverMap },
        { href: "/live", label: isHi ? "लाइव फ़ीड" : "Live feed" },
        // Deep-link with ?role=organizer so AddBhandaraSwitcher
        // skips the "how would you like to add a bhandara?" chooser
        // and drops the visitor straight on the listing form.
        { href: "/list-bhandara?role=organizer", label: t.footer.getInvolvedAdd },
        // AI-pamphlet path, mirrors the third chooser card on
        // /list-bhandara. Deep-link with ?role=scanner so visitors
        // who want this flow specifically (e.g. clicked from a
        // shared link in a WhatsApp group) skip the chooser and
        // see the upload UI immediately. AddBhandaraSwitcher honours
        // this role in its mount-time URL handler.
        {
          href: "/list-bhandara?role=scanner",
          label: isHi
            ? "AI से पैम्फलेट स्कैन करें"
            : "Scan a pamphlet (AI)",
        },
        // Pamphlet generator link intentionally hidden during the
        // soft-launch phase. The /pamphlet route still works for
        // direct URL access; we just don't promote it from the
        // footer, homepage, or BhandaraForm. Restore by uncommenting:
        // {
        //   href: "/pamphlet",
        //   label: isHi ? "मुफ़्त पैम्फलेट बनाएँ" : "Free pamphlet maker",
        // },
        { href: "/spot", label: isHi ? "भंडारा स्पॉट करें" : "Spot a bhandara" },
        // Full-service organising entry. Lead-capture flow at
        // /organise-bhandara, distinct from "List my bhandara" (which
        // is for organisers who DIY logistics and just want to be on
        // the map). ?from=footer for source attribution on the
        // intake email.
        {
          href: "/organise-bhandara?from=footer",
          label: isHi
            ? "हमसे भंडारा का आयोजन करवाएँ"
            : "Organise a bhandara (full service)",
        },
        // Volunteer programme entry, supply-side recruitment for
        // documenting more bhandaras. Distinct from "Organise"
        // (which is service-sales for hosts). Sits next to the
        // organise link so both "get involved" CTAs cluster. Copy
        // intentionally devotional vs gig-economy: the small
        // honorarium is acknowledged on /volunteer itself, not in
        // the footer label.
        {
          href: "/volunteer",
          label: isHi
            ? "स्वयंसेवक बनें"
            : "Volunteer with us",
        },
        // Past-bhandaras archive, listed venues whose Tuesdays are
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
        { href: "/faq", label: isHi ? "पूछे जाने वाले प्रश्न" : "FAQ" },
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
      // Dedicated Contact column, single link to the /contact form.
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
        {/* Top row: brand + nav columns. Brand is tighter now (just
            logo + tagline + Follow); the WhatsApp tile row lives in
            its own full-width band below so the two halves of the
            footer don't have an uneven-height side-by-side problem. */}
        <div className="grid gap-10 md:grid-cols-[1.1fr_3fr] md:gap-14">
          {/* Brand block */}
          <div className="space-y-5">
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

            {/* Social links. Single Instagram tile for now; the row is
                a `flex gap-2` so adding YouTube / FB / X tomorrow is
                just another <a> with the same shape. URL is the bare
                handle, the QR tracking params (`igsh`, `utm_source`)
                from the original share link are intentionally stripped
                so a footer click doesn't masquerade as a QR scan in
                Instagram's analytics. */}
            <div>
              <p className="font-mukta uppercase tracking-[0.22em] text-[0.65rem] text-gold-500 font-semibold mb-2">
                {isHi ? "जुड़ें" : "Follow"}
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href="https://www.instagram.com/bada.mangal"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="BadaMangal on Instagram"
                  data-ga="footer_social"
                  data-ga-network="instagram"
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-gold-500/45 bg-cream-50 text-sindoor-700 hover:bg-saffron-50 hover:border-saffron-500 hover:text-saffron-600 transition-colors"
                  title="@bada.mangal on Instagram"
                >
                  <IconInstagram />
                </a>
              </div>
            </div>

            {/* WhatsApp communities. Simple text-link list, same visual
                weight as the Discover/Resources columns. Small green
                tile keeps the brand cue without making the rows feel
                like prominent cards. */}
            <div>
              <p className="font-mukta uppercase tracking-[0.22em] text-[0.65rem] text-gold-500 font-semibold mb-2">
                {isHi ? "व्हाट्सऐप पर जुड़ें" : "Join the chat on WhatsApp"}
              </p>
              <ul className="grid gap-1.5">
                {FOOTER_WHATSAPP_LINKS.map((link) => {
                  const label = isHi ? link.labelHi : link.label;
                  const kindLabel =
                    link.kind === "community"
                      ? isHi ? "कम्युनिटी" : "Community"
                      : link.kind === "group"
                        ? isHi ? "ग्रुप" : "Group"
                        : isHi ? "चैनल" : "Channel";
                  return (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-ga="footer_whatsapp"
                        data-ga-kind={link.kind}
                        data-ga-href={link.href}
                        aria-label={`${label} on WhatsApp`}
                        className="group inline-flex items-center gap-2 text-sm text-ink-900 hover:text-saffron-600 transition-colors"
                        title={label}
                      >
                        <FooterKindTile kind={link.kind} />
                        <span className="truncate">{label}</span>
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-600/70">
                          {kindLabel}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* Link columns. Resources gets a 2-cell allocation (because
              it has 9 items and reads better as two short lists than
              one tall one); the rest stay at 1 cell each. The grid is
              5 columns on md+, Discover · Resources (×2) · About ·
              Contact, totalling 5 cells. */}
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
                    // vertical space inside its own column, the
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

        {/* Copyright strip, legal links live in the About column
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

/** Instagram glyph (square + circular lens + corner dot). 1.7 stroke
 *  weight matches the rest of the site's outlined-icon language so it
 *  reads as part of the family when YouTube / FB / X tiles join the
 *  row later. */
function IconInstagram() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** WhatsApp brand glyph. Canonical Simple Icons path (24×24 viewBox)
 *  for clean rendering at small sizes. Size prop defaults to 13px to
 *  fit the footer's 28px tile snugly, scale up via the prop. */
function IconWhatsApp({ size = 13 }: { size?: number } = {}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.825 9.825 0 0 1 6.988 2.898 9.831 9.831 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0 0 20.465 3.488" />
    </svg>
  );
}

/** People silhouette for the "group" kind tile. Same shape language
 *  as the homepage's PeopleGroupGlyph so the two surfaces read as one
 *  icon family. */
function IconPeopleGroup({ size = 14 }: { size?: number } = {}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
    >
      <path d="M12 12.75a3.375 3.375 0 1 0 0-6.75 3.375 3.375 0 0 0 0 6.75ZM5.25 9.75a2.625 2.625 0 1 0 0-5.25 2.625 2.625 0 0 0 0 5.25Zm13.5 0a2.625 2.625 0 1 0 0-5.25 2.625 2.625 0 0 0 0 5.25ZM4.5 11.25c-1.74 0-3.25.86-4.18 2.18A1 1 0 0 0 1.14 15h3.42c.13-1.18.68-2.27 1.52-3.13A4.86 4.86 0 0 0 4.5 11.25Zm15 0c-.6 0-1.16.11-1.68.3.84.86 1.39 1.95 1.52 3.13h3.42a1 1 0 0 0 .82-1.57A4.96 4.96 0 0 0 19.5 11.25Zm-7.5 2.25c-2.92 0-5.47 1.55-6.74 3.83a1 1 0 0 0 .87 1.42h11.74a1 1 0 0 0 .87-1.42C17.47 15.05 14.92 13.5 12 13.5Z" />
    </svg>
  );
}

/** Megaphone for the "channel" kind tile. Broadcast horn — matches
 *  the homepage MegaphoneGlyph. */
function IconMegaphone({ size = 14 }: { size?: number } = {}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
    >
      <path d="M20.25 4.533a.75.75 0 0 1 1.16-.628c.36.227.59.6.59 1.015v14.16a1.2 1.2 0 0 1-.59 1.015.75.75 0 0 1-1.16-.628V18.5a17.9 17.9 0 0 0-8.25-2.13v2.13a3.75 3.75 0 1 1-7.5 0v-2.43a3.75 3.75 0 0 1-1.5-3v-2.14a3.75 3.75 0 0 1 3.75-3.75H12a17.9 17.9 0 0 0 8.25-2.13V4.533ZM6.75 16.5v2a2.25 2.25 0 0 0 4.5 0v-1.94c-1.5-.04-3-.07-4.5-.06Z" />
    </svg>
  );
}

/** Footer kind tile — same composite scheme as the homepage:
 *    - community → WA glyph in the green disc
 *    - group     → people glyph + small WA badge bottom-right
 *    - channel   → megaphone glyph + small WA badge bottom-right
 *  Tile is a 28px circle on the cream footer background; the WA
 *  badge is ringed in cream-50 so it floats over the tile cleanly. */
function FooterKindTile({ kind }: { kind: "community" | "group" | "channel" }) {
  return (
    <span className="relative inline-flex items-center justify-center w-7 h-7 rounded-full bg-leaf-600 text-cream-50 shadow-[0_2px_6px_-2px_rgba(63,122,63,0.5)] ring-1 ring-leaf-600/25 group-hover:scale-105 transition-transform shrink-0">
      {kind === "community" ? (
        <IconWhatsApp size={13} />
      ) : kind === "group" ? (
        <IconPeopleGroup size={14} />
      ) : (
        <IconMegaphone size={14} />
      )}
      {kind !== "community" ? (
        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-cream-50 text-leaf-600 ring-2 ring-cream-50 shadow-[0_1px_3px_-1px_rgba(0,0,0,0.3)]"
        >
          <IconWhatsApp size={8} />
        </span>
      ) : null}
    </span>
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
