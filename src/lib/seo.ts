import type { Metadata } from "next";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://badamangal.com";

/**
 * Build a `Metadata.alternates` block with canonical + bilingual
 * hreflang + x-default. Pass the path with no query string and no
 * leading site URL — e.g. `localised("/spot")` produces:
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

/** WebSite + sitelinks SearchAction so Google can wire its in-result search box. */
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
  };
}

/** Organization — anchors the brand, used as `publisher` on every Article. */
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
