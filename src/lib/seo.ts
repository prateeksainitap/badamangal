import type { Metadata } from "next";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://badamangal.com";

/**
 * Build a `Metadata.alternates` block with canonical + bilingual
 * hreflang + x-default. Pass the path with no query string and no
 * leading site URL, e.g. `localised("/spot")` produces:
 *   canonical: https://badamangal.com/spot
 *   languages.en-IN: https://badamangal.com/spot?lang=en
 *   languages.hi-IN: https://badamangal.com/spot
 *   languages.x-default: https://badamangal.com/spot
 */
export function localised(path: string): Metadata["alternates"] {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return {
    canonical: `${SITE_URL}${clean}`,
    languages: {
      "hi-IN": `${SITE_URL}${clean}`,
      "en-IN": `${SITE_URL}${clean}${clean.includes("?") ? "&" : "?"}lang=en`,
      "x-default": `${SITE_URL}${clean}`,
    },
  };
}

/* ────────────────────────────────────────────────────────────────────────
   Reusable JSON-LD structured-data builders. Each returns a plain object
   that you embed in a `<script type="application/ld+json">`. Helps search
   engines render rich-result enhancements (event carousel, breadcrumbs,
   sitelinks search box, etc.).
   ────────────────────────────────────────────────────────────────────── */

/**
 * WebSite + sitelinks SearchAction so Google can wire its in-result
 * search box (the small site-scoped search input that appears below
 * branded results, e.g. "BadaMangal" + a search field inside the
 * Google SERP card itself).
 *
 * The SearchAction `urlTemplate` points at `/?q={search_term_string}`.
 * The homepage's search input lives inside `BhandaraCardsSection`,
 * it currently filters client-side only, but reading a `q` query
 * param at mount and pre-filling the input is a small follow-up that
 * lets Google's site-search box land users directly on a filtered
 * view. Until that wire-up lands, the SearchAction is still a valid
 * search-box hint (no penalty for landing on the unfiltered
 * homepage).
 */
export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: "BadaMangal",
    alternateName: "Bada Mangal · Lucknow",
    inLanguage: ["hi-IN", "en-IN"],
    description:
      "The directory of every Bada Mangal Bhandara in Lucknow during the 2026 season, find, list, sponsor, spot.",
    publisher: { "@id": `${SITE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/** Organization, anchors the brand, used as `publisher` on every Article. */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "BadaMangal",
    url: SITE_URL,
    logo: `${SITE_URL}/brand/logo-mark.svg`,
    sameAs: [],
    foundingLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Lucknow",
        addressRegion: "Uttar Pradesh",
        addressCountry: "IN",
      },
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        email: "namaste@badamangal.com",
        contactType: "customer support",
        areaServed: "IN",
        availableLanguage: ["en", "hi"],
      },
    ],
  };
}

/**
 * Event schema for a single Bada Mangal Tuesday. Returned as an array
 * when bundled (one per date) via `eventSchemaBatch`; emit each one
 * individually for richest SERP rendering.
 */
export function eventSchemaForTuesday(opts: {
  isoDate: string; // YYYY-MM-DD
  ordinal: number; // 1..8
}) {
  const { isoDate, ordinal } = opts;
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": `${SITE_URL}/#bada-mangal-${isoDate}`,
    name: `Bada Mangal #${ordinal}, Lucknow`,
    description:
      "The Tuesday Bada Mangal community meal across Lucknow's temples and neighbourhoods. Free public bhandaras open from morning to evening.",
    startDate: `${isoDate}T05:30:00+05:30`,
    endDate: `${isoDate}T20:00:00+05:30`,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: "Lucknow",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Lucknow",
        addressRegion: "Uttar Pradesh",
        addressCountry: "IN",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: 26.85,
        longitude: 80.95,
      },
    },
    isAccessibleForFree: true,
    organizer: { "@id": `${SITE_URL}/#organization` },
    image: `${SITE_URL}/illustrations/hanuman-sitting.webp`,
  };
}

/** Convenience wrapper to bundle a list of Tuesday-date Events. */
export function eventSchemaBatch(isoDates: readonly string[]) {
  return isoDates.map((iso, i) => eventSchemaForTuesday({ isoDate: iso, ordinal: i + 1 }));
}

/**
 * BreadcrumbList for any nested page. Pass an ordered array of
 * `{ name, path }` pairs starting from the homepage.
 */
export function breadcrumbSchema(
  trail: Array<{ name: string; path: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: step.name,
      item: `${SITE_URL}${step.path.startsWith("/") ? step.path : `/${step.path}`}`,
    })),
  };
}

/**
 * FoodEvent / Event schema for an individual listed Bhandara. Each
 * organiser-listed bhandara is a recurring free food-distribution
 * event tied to the 8 Tuesdays it serves on. We emit one Event per
 * (bhandara × Tuesday) so each appears in calendar/event search.
 */
export function bhandaraEventSchema(opts: {
  slug: string;
  name: string;
  description?: string | null;
  address: string;
  area: string;
  lat: number;
  lng: number;
  tuesdayDates: string[];
  timeStart: string; // "HH:MM"
  timeEnd: string; // "HH:MM"
  organizerName: string;
  photoUrl?: string | null;
}) {
  const url = `${SITE_URL}/bhandara/${opts.slug}`;
  return opts.tuesdayDates.map((iso) => ({
    "@context": "https://schema.org",
    "@type": "FoodEvent",
    "@id": `${url}#${iso}`,
    name: `${opts.name}, Bada Mangal Bhandara`,
    description:
      opts.description ??
      `Free Bada Mangal community meal at ${opts.address}, Lucknow. Hosted by ${opts.organizerName}.`,
    startDate: `${iso}T${opts.timeStart}:00+05:30`,
    endDate: `${iso}T${opts.timeEnd || opts.timeStart}:00+05:30`,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: opts.area,
      address: {
        "@type": "PostalAddress",
        streetAddress: opts.address,
        addressLocality: "Lucknow",
        addressRegion: "Uttar Pradesh",
        postalCode: "226001",
        addressCountry: "IN",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: opts.lat,
        longitude: opts.lng,
      },
    },
    isAccessibleForFree: true,
    organizer: {
      "@type": "Organization",
      name: opts.organizerName,
    },
    url,
    image: opts.photoUrl ?? `${SITE_URL}/illustrations/hanuman-sitting.webp`,
  }));
}

/**
 * LocalBusiness schema for an individual bhandara venue.
 *
 * Complements the per-Tuesday Event schemas above, Google treats
 * `LocalBusiness` as the canonical "what is this place" entity for
 * Knowledge Panel + Local Pack ranking, whereas `Event` is best for
 * "what's happening here on date X". Both together is the rich-
 * results sweet spot for a recurring free meal at a fixed venue.
 *
 * Notes:
 *   • priceRange "Free", schema.org accepts strings; "Free" reads
 *     correctly in test tools.
 *   • openingHoursSpecification limited to Tuesday, the venue
 *     isn't a daily business; misrepresenting hours hurts trust.
 *     If a bhandara also serves on Shani Jayanti Saturday, the
 *     EventSchedule list above carries those dates explicitly.
 *   • The `@id` is anchored to the bhandara detail URL with a
 *     `#business` fragment so it doesn't collide with the Event
 *     `@id`s for the same venue.
 */
export function bhandaraLocalBusinessSchema(opts: {
  slug: string;
  name: string;
  description?: string | null;
  address: string;
  area: string;
  lat: number;
  lng: number;
  timeStart: string;
  timeEnd: string;
  organizerName: string;
  organizerPhone?: string | null;
  photoUrl?: string | null;
}) {
  const url = `${SITE_URL}/bhandara/${opts.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${url}#business`,
    name: `${opts.name}, Bada Mangal Bhandara`,
    description:
      opts.description ??
      `Free Bada Mangal community meal at ${opts.address}, Lucknow.`,
    url,
    image: opts.photoUrl ?? `${SITE_URL}/illustrations/hanuman-sitting.webp`,
    address: {
      "@type": "PostalAddress",
      streetAddress: opts.address,
      addressLocality: opts.area,
      addressRegion: "Uttar Pradesh",
      postalCode: "226001",
      addressCountry: "IN",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: opts.lat,
      longitude: opts.lng,
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "https://schema.org/Tuesday",
      opens: opts.timeStart,
      closes: opts.timeEnd || "20:00",
    },
    priceRange: "Free",
    isAccessibleForFree: true,
    publicAccess: true,
    ...(opts.organizerPhone
      ? { telephone: opts.organizerPhone }
      : {}),
    founder: {
      "@type": "Person",
      name: opts.organizerName,
    },
    areaServed: {
      "@type": "City",
      name: "Lucknow",
    },
    parentOrganization: { "@id": `${SITE_URL}/#organization` },
  };
}

/**
 * Generic FAQPage schema. Pass a list of `{ q, a }` pairs, emits the
 * shape Google wants for FAQ rich-result eligibility.
 *
 * Use sparingly: Google sometimes downgrades FAQ rich results when
 * the same FAQ appears on multiple pages or feels promotional rather
 * than genuinely useful. One FAQPage per page max, only when the
 * questions actually help readers.
 */
export function faqPageSchema(items: ReadonlyArray<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: {
        "@type": "Answer",
        text: a,
      },
    })),
  };
}

/**
 * FAQPage JSON-LD targeting the highest-intent questions for Bada
 * Mangal queries. When present, Google often surfaces these as
 * expandable "People also ask" boxes directly on the SERP, pure
 * top-of-search real estate that no amount of meta-keywords work
 * can buy.
 *
 * Keep answers concise (under 300 chars each); Google truncates
 * longer ones. The text should be substantively the same as what's
 * on the page so the SERP excerpt matches the on-site content.
 */
export function faqSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${SITE_URL}/#faq`,
    mainEntity: [
      {
        "@type": "Question",
        name: "What is Bada Mangal?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Bada Mangal is the Tuesday community-meal tradition of Lucknow, observed every Tuesday of the Hindu month of Jyeshtha (May to June). Free bhandaras open across the city to feed everyone who comes through Hanuman Ji's blessing. The tradition is around 400 years old, dating to Nawab Saadat Ali Khan's vow.",
        },
      },
      {
        "@type": "Question",
        name: "Why are there 8 Bada Mangals in 2026?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Adhik Maas, the leap month that occurs roughly once every 19 years, adds an extra Tuesday to Jyeshtha in 2026. So instead of the usual 4 to 5 Tuesdays, Lucknow gets 8 Bada Mangals. The last time this happened was 2007; the next will be 2045.",
        },
      },
      {
        "@type": "Question",
        name: "When is the next Bada Mangal in Lucknow?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The 2026 Bada Mangal Tuesdays are 5 May, 12 May, 19 May, 26 May, 2 June, 9 June, 16 June, and 23 June. The countdown on BadaMangal.com always shows the next upcoming one in real time.",
        },
      },
      {
        "@type": "Question",
        name: "How do I find a Bada Mangal bhandara near me?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Open the city map on BadaMangal.com, every listed bhandara appears as a pin with the menu, time window, and organizer details. Use the 'Bhandaras near me' button to filter to a 3 km radius around you, or tap any pin to get directions.",
        },
      },
      {
        "@type": "Question",
        name: "What food is served at a Bada Mangal bhandara?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Typical bhandara prasad includes puri, sabzi (often kala chana or aloo), halwa, kheer or rice-kheer, sometimes pulao, and water or sharbat. Each organizer's menu is listed on their bhandara card on the site, so visitors can plan what to expect.",
        },
      },
      {
        "@type": "Question",
        name: "Is participating in a Bada Mangal bhandara free?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, every bhandara is free, open to anyone, and serves as long as the prasad lasts. The tradition is rooted in seva (selfless service); organizers cover all costs from their own resources or community donations.",
        },
      },
      {
        "@type": "Question",
        name: "Can I list my own bhandara on BadaMangal.com?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Click 'List a bhandara' on the homepage and fill in the location, time, menu, and your contact details. The listing goes live on the city map within seconds; the team calls within 24 hours to phone-verify and add the green Verified badge.",
        },
      },
    ],
  };
}
