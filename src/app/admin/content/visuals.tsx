/**
 * Visual tokens for the Content Hub — kind/audience/channel icons +
 * tone classes. Centralised so the card, editor, and filter chips
 * all use the same colour + glyph language.
 *
 * Each AUDIENCE gets a distinct accent so the operator can scan a
 * mixed list (Pitches view shows all audiences mixed) by colour
 * stripe rather than reading every badge:
 *   sponsor    → saffron      (warm, money/funding)
 *   influencer → violet       (creator/social)
 *   press      → sindoor      (newsroom/urgent)
 *   organiser  → cyan         (community ops)
 *   volunteer  → leaf         (active helper)
 *   donor      → leaf         (giving — leaf with a heart icon
 *                              differentiates from volunteer)
 *   community  → violet       (group/audience)
 *   internal   → ink/neutral  (no stripe — quiet)
 *   other      → ink/neutral
 *
 * Each KIND gets its own glyph (pitch/template/strategy/other) for
 * quick visual classification independent of audience colour.
 */

import type {
  ContentKind,
  ContentAudience,
  ContentChannel,
} from "./types";

export type AudienceTone = {
  /** Tailwind class for the 4px-wide left stripe on each card. */
  stripe: string;
  /** Tailwind class for the kind-icon disc background. */
  iconBg: string;
  /** Tailwind class for the kind icon foreground colour. */
  iconText: string;
  /** Tailwind class for the audience pill (border + text + bg). */
  pill: string;
  /** Hover ring colour for the whole card. */
  hover: string;
};

const TONE_INK: AudienceTone = {
  stripe: "bg-cream-50/12",
  iconBg: "bg-cream-50/[0.08] border-cream-50/15",
  iconText: "text-cream-50/70",
  pill: "bg-cream-50/[0.06] border-cream-50/15 text-cream-50/70",
  hover: "hover:border-cream-50/25",
};

export const AUDIENCE_TONE: Record<string, AudienceTone> = {
  SPONSOR: {
    stripe: "bg-gradient-to-b from-saffron-400 to-saffron-600",
    iconBg: "bg-saffron-500/[0.14] border-saffron-500/35",
    iconText: "text-saffron-300",
    pill: "bg-saffron-500/[0.12] border-saffron-500/35 text-saffron-300",
    hover: "hover:border-saffron-500/45",
  },
  INFLUENCER: {
    stripe: "bg-gradient-to-b from-violet-400 to-violet-600",
    iconBg: "bg-violet-500/[0.16] border-violet-500/40",
    iconText: "text-violet-200",
    pill: "bg-violet-500/[0.14] border-violet-500/40 text-violet-200",
    hover: "hover:border-violet-500/50",
  },
  PRESS: {
    stripe: "bg-gradient-to-b from-sindoor-700 to-sindoor-700/70",
    iconBg: "bg-sindoor-700/[0.18] border-sindoor-700/45",
    iconText: "text-sindoor-700",
    pill: "bg-sindoor-700/[0.18] border-sindoor-700/45 text-sindoor-700",
    hover: "hover:border-sindoor-700/55",
  },
  ORGANISER: {
    stripe: "bg-gradient-to-b from-cyan-400 to-cyan-600",
    iconBg: "bg-cyan-400/[0.14] border-cyan-400/40",
    iconText: "text-cyan-200",
    pill: "bg-cyan-400/[0.14] border-cyan-400/40 text-cyan-200",
    hover: "hover:border-cyan-400/55",
  },
  VOLUNTEER: {
    stripe: "bg-gradient-to-b from-leaf-400 to-leaf-600",
    iconBg: "bg-leaf-500/[0.14] border-leaf-400/40",
    iconText: "text-leaf-300",
    pill: "bg-leaf-500/[0.14] border-leaf-400/40 text-leaf-300",
    hover: "hover:border-leaf-400/55",
  },
  DONOR: {
    stripe: "bg-gradient-to-b from-leaf-400 to-leaf-600",
    iconBg: "bg-leaf-500/[0.14] border-leaf-400/40",
    iconText: "text-leaf-300",
    pill: "bg-leaf-500/[0.14] border-leaf-400/40 text-leaf-300",
    hover: "hover:border-leaf-400/55",
  },
  COMMUNITY: {
    stripe: "bg-gradient-to-b from-violet-300 to-violet-500",
    iconBg: "bg-violet-400/[0.14] border-violet-400/40",
    iconText: "text-violet-200",
    pill: "bg-violet-400/[0.14] border-violet-400/40 text-violet-200",
    hover: "hover:border-violet-400/50",
  },
  INTERNAL: TONE_INK,
  OTHER: TONE_INK,
};

export function audienceTone(a: ContentAudience | string): AudienceTone {
  return AUDIENCE_TONE[a] ?? TONE_INK;
}

/** Inline SVGs — kept small (16×16) so they sit comfortably in a
 *  10×10 (~40px) icon disc. All use stroke="currentColor" so the
 *  iconText tone above colourises them. */
export function KindIcon({ kind }: { kind: ContentKind | string }) {
  switch (kind) {
    case "PITCH":
      // arrow-up-right inside a small frame — "outbound message"
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7 17 L17 7" />
          <path d="M9 7 H17 V15" />
        </svg>
      );
    case "TEMPLATE":
      // message-square — copy-pasteable comm
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 15 a2 2 0 0 1 -2 2 H7 l-4 4 V5 a2 2 0 0 1 2 -2 h14 a2 2 0 0 1 2 2 z" />
        </svg>
      );
    case "STRATEGY":
      // compass — long-form planning
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <polygon points="14.5,9.5 11,13 9.5,14.5 13,11" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      // file
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M14 2 H6 a2 2 0 0 0 -2 2 v16 a2 2 0 0 0 2 2 h12 a2 2 0 0 0 2 -2 V8 z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
  }
}

/** Audience glyphs — used in filter chips so a row of pill-buttons
 *  reads at a glance ("📰 Press" not just "Press"). Sized 14×14 to
 *  fit inline with chip text. */
export function AudienceIcon({ audience }: { audience: ContentAudience | string }) {
  const props = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor" as const,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (audience) {
    case "SPONSOR":
      // briefcase — corporate / paying
      return (
        <svg {...props}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7 V5 a2 2 0 0 1 2 -2 h4 a2 2 0 0 1 2 2 v2" />
        </svg>
      );
    case "INFLUENCER":
      // camera — creator
      return (
        <svg {...props}>
          <path d="M23 19 a2 2 0 0 1 -2 2 H3 a2 2 0 0 1 -2 -2 V8 a2 2 0 0 1 2 -2 h4 l2 -3 h6 l2 3 h4 a2 2 0 0 1 2 2 z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      );
    case "PRESS":
      // newspaper
      return (
        <svg {...props}>
          <path d="M4 22 h16 a2 2 0 0 0 2 -2 V4 a2 2 0 0 0 -2 -2 H8 a2 2 0 0 0 -2 2 v16 a2 2 0 0 1 -2 2 zm0 0 a2 2 0 0 1 -2 -2 V9 a2 2 0 0 1 2 -2 h2" />
          <path d="M18 14 H12" />
          <path d="M15 18 H12" />
          <path d="M10 6 H18 V10 H10 z" />
        </svg>
      );
    case "ORGANISER":
      // clipboard
      return (
        <svg {...props}>
          <rect x="6" y="4" width="12" height="17" rx="2" />
          <path d="M9 4 v-1 h6 v1" />
          <line x1="9" y1="10" x2="15" y2="10" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
      );
    case "VOLUNTEER":
      // users
      return (
        <svg {...props}>
          <circle cx="9" cy="9" r="3.5" />
          <path d="M2.5 20 c0 -4 3 -7 6.5 -7 s6.5 3 6.5 7" />
          <circle cx="17" cy="10" r="2.5" />
        </svg>
      );
    case "DONOR":
      // heart
      return (
        <svg {...props}>
          <path d="M20.84 4.61 a5.5 5.5 0 0 0 -7.78 0 L12 5.67 l-1.06 -1.06 a5.5 5.5 0 0 0 -7.78 7.78 l1.06 1.06 L12 21.23 l7.78 -7.78 1.06 -1.06 a5.5 5.5 0 0 0 0 -7.78 z" />
        </svg>
      );
    case "COMMUNITY":
      // globe
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <path d="M12 3 a14 14 0 0 1 0 18 a14 14 0 0 1 0 -18 z" />
        </svg>
      );
    default:
      // dot
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="4" />
        </svg>
      );
  }
}

/** Channel glyph mini-icons — used as a small adjacent badge on the
 *  card meta row when the content is targeted at a specific channel. */
export function ChannelIcon({ channel }: { channel: ContentChannel | string }) {
  const props = {
    width: 12,
    height: 12,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor" as const,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (channel) {
    case "EMAIL":
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7 L12 13 L21 7" />
        </svg>
      );
    case "WHATSAPP":
      return (
        <svg {...props}>
          <path d="M21 11.5 a8.38 8.38 0 0 1 -8.5 8.5 a8.5 8.5 0 0 1 -4 -1 L3 21 l1.5 -5.5 a8.5 8.5 0 1 1 16.5 -4" />
        </svg>
      );
    case "INSTAGRAM":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="0.7" fill="currentColor" />
        </svg>
      );
    case "REDDIT":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="9" cy="12" r="1.4" fill="currentColor" />
          <circle cx="15" cy="12" r="1.4" fill="currentColor" />
          <path d="M8 15 q4 3 8 0" />
        </svg>
      );
    case "PRESS":
      return (
        <svg {...props}>
          <rect x="4" y="6" width="16" height="14" rx="1.5" />
          <line x1="7" y1="10" x2="17" y2="10" />
          <line x1="7" y1="14" x2="14" y2="14" />
        </svg>
      );
    default:
      return null;
  }
}

export function channelLabel(c: ContentChannel | string): string {
  const map: Record<string, string> = {
    EMAIL: "Email",
    WHATSAPP: "WhatsApp",
    INSTAGRAM: "Instagram",
    REDDIT: "Reddit",
    PRESS: "Press",
    INTERNAL: "Internal",
    OTHER: "Other",
  };
  return map[c] ?? c;
}

export function audienceLabel(a: ContentAudience | string): string {
  const map: Record<string, string> = {
    SPONSOR: "Sponsor",
    INFLUENCER: "Influencer",
    PRESS: "Press",
    ORGANISER: "Organiser",
    VOLUNTEER: "Volunteer",
    DONOR: "Donor",
    COMMUNITY: "Community",
    INTERNAL: "Internal",
    OTHER: "Other",
  };
  return map[a] ?? a;
}
