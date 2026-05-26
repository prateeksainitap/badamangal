/**
 * Plain TS constants for the Content Hub.
 *
 * Lives in its own file because `actions.ts` is "use server", which
 * Next.js limits to async function exports only. Pulling these
 * arrays out keeps both the server actions and the UI components
 * sharing a single source of truth for the allowed enum values
 * without falling foul of that constraint.
 */

export const CONTENT_KINDS = ["PITCH", "TEMPLATE", "STRATEGY", "OTHER"] as const;
export const CONTENT_AUDIENCES = [
  "SPONSOR",
  "INFLUENCER",
  "PRESS",
  "ORGANISER",
  "VOLUNTEER",
  "DONOR",
  "COMMUNITY",
  "INTERNAL",
  "OTHER",
] as const;
export const CONTENT_CHANNELS = [
  "INSTAGRAM",
  "WHATSAPP",
  "EMAIL",
  "REDDIT",
  "PRESS",
  "INTERNAL",
  "OTHER",
] as const;
export const CONTENT_LANGUAGES = ["en", "hi", "bilingual"] as const;

export type ContentKind = (typeof CONTENT_KINDS)[number];
export type ContentAudience = (typeof CONTENT_AUDIENCES)[number];
export type ContentChannel = (typeof CONTENT_CHANNELS)[number];
export type ContentLanguage = (typeof CONTENT_LANGUAGES)[number];
