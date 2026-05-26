/**
 * Bold stroke-2.2 icon set shared across the admin console. All
 * icons are 22×22 with `currentColor` strokes so the tile / button
 * that wraps them controls the tint.
 *
 * Naming convention: `Icon<Subject>`, Bhandara, Spot, Mention,
 * Volunteer, Organise, Discover, Clock, Calendar, Check, etc.
 *
 * Keep the set tight (only what the admin actually needs). Anything
 * one-off can stay inline in its page; this file is for icons used
 * in 2+ places (KPI tiles, sidebar, queue rows).
 */
type IconProps = { size?: number };

export function IconBhandara({ size = 22 }: IconProps = {}) {
  // Diya / flame on a leaf base, same vocabulary as the sidebar diya.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3 c1.6 1.5 2.5 3.2 0 5.5 c-2.5 -2.3 -1.6 -4 0 -5.5 z" fill="currentColor" />
      <path d="M4 13 q8 5 16 0 l-2 5 h-12 z" />
    </svg>
  );
}

export function IconSpot({ size = 22 }: IconProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="7" width="18" height="13" rx="2.5" />
      <path d="M9 7 l1.5 -3 h3 l1.5 3" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  );
}

export function IconMention({ size = 22 }: IconProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a8 8 0 1 1-3.5-6.6L21 4l-1.4 3.6A8 8 0 0 1 21 12z" />
      <circle cx="9" cy="12" r="1" fill="currentColor" />
      <circle cx="12.5" cy="12" r="1" fill="currentColor" />
      <circle cx="16" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

export function IconVolunteer({ size = 22 }: IconProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="9" r="3.5" />
      <path d="M2.5 20 c0 -4 3 -7 6.5 -7 s6.5 3 6.5 7" />
      <circle cx="17" cy="10" r="2.5" />
      <path d="M15 20 c0 -3 2 -5 4.5 -5 s2 1 2 5" />
    </svg>
  );
}

export function IconOrganise({ size = 22 }: IconProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4 v-1 h6 v1" />
      <line x1="9" y1="10" x2="15" y2="10" />
      <line x1="9" y1="14" x2="15" y2="14" />
      <line x1="9" y1="18" x2="13" y2="18" />
    </svg>
  );
}

export function IconDiscover({ size = 22 }: IconProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <polygon points="14.5,9.5 11,13 9.5,14.5 13,11" fill="currentColor" />
    </svg>
  );
}

export function IconClock({ size = 22 }: IconProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
    </svg>
  );
}

export function IconCheck({ size = 22 }: IconProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="4 12 10 18 20 6" />
    </svg>
  );
}

export function IconX({ size = 22 }: IconProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="6" y1="18" x2="18" y2="6" />
    </svg>
  );
}

export function IconPending({ size = 22 }: IconProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="8" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="16" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

export function IconBot({ size = 22 }: IconProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="7" width="16" height="13" rx="3" />
      <line x1="12" y1="3" x2="12" y2="7" />
      <circle cx="12" cy="3" r="1" fill="currentColor" />
      <circle cx="9" cy="13" r="1.2" fill="currentColor" />
      <circle cx="15" cy="13" r="1.2" fill="currentColor" />
      <path d="M9 17 h6" />
    </svg>
  );
}

export function IconImage({ size = 22 }: IconProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M21 16 l-5 -5 -7 7 -3 -3 -3 3" />
    </svg>
  );
}

export function IconFlame({ size = 22 }: IconProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3 c2 4 5 6 5 10 a5 5 0 0 1 -10 0 c0 -2 1 -4 2 -5 c0 2 1 3 2 3 c0 -3 -1 -5 1 -8 z" />
    </svg>
  );
}

export function IconUserPlus({ size = 22 }: IconProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="9" r="3.5" />
      <path d="M2.5 20 c0 -4 3 -7 6.5 -7 s6.5 3 6.5 7" />
      <line x1="19" y1="6" x2="19" y2="14" />
      <line x1="15" y1="10" x2="23" y2="10" />
    </svg>
  );
}

/** Envelope, drop-in replacement for the ✉ (U+2709) dingbat we used
 *  to inline in buttons and empty states. Most system fonts +
 *  Mukta lack U+2709 → it renders as the missing-glyph tofu box.
 *  This SVG version scales to its `size` prop and tracks
 *  currentColor so the wrapping button controls the tint. */
export function IconEnvelope({ size = 22 }: IconProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7 L12 13 L21 7" />
    </svg>
  );
}

/** Arrow-up-right, drop-in for the ↗ (U+2197) glyph we used as an
 *  "opens externally / launches mailto" hint. Same font-coverage
 *  problem as the envelope. */
export function IconArrowUpRight({ size = 22 }: IconProps = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="9 7 17 7 17 15" />
    </svg>
  );
}
