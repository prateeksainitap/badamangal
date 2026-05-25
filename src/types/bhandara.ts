import type { Area } from "@/lib/lucknow";

export type Bhandara = {
  id: string;
  slug: string;
  name: string;
  nameHi: string;
  description?: string;
  descriptionHi?: string;
  area: Area;
  address: string;
  addressHi?: string;
  landmark?: string;
  lat: number;
  lng: number;
  tuesdayDates: string[];   // ISO date strings, e.g. "2026-05-12"
  timeStart: string;        // "HH:MM" 24-hour
  timeEnd: string;          // "HH:MM" 24-hour
  menu: string[];           // English keys
  menuHi: string[];         // Devanagari labels
  organizerName: string;
  organizerPhone: string;
  organizerWhatsapp?: string;
  upiId?: string;
  /** Uploaded UPI QR-code image URL (R2 / Supabase). Optional companion
   *  to upiId — used by SponsorBhandara to render the organiser's
   *  custom QR instead of a client-generated one from the VPA text. */
  upiQrUrl?: string;
  photoUrl?: string;
  isSponsored?: boolean;
  isVerified?: boolean;
  /** Admin-flipped "feature this on the homepage" flag. When true,
   *  pickFeatured() pushes it to the very top of the homepage's
   *  4-card featured row regardless of date / photo / verification. */
  isFeatured?: boolean;
  // geocoder-derived
  geoNeighborhood?: string;
  geoDistrict?: string;
  geoState?: string;
  googlePlaceId?: string;
  googleMapsUrl?: string;
};
