/**
 * The kit's line icons: one stroke weight (1.8), round caps, drawn on a
 * 24 grid, coloured by currentColor. Hand drawn to match the homepage
 * (no icon library, no emoji). Add new glyphs here, never inline a
 * one-off icon in a page.
 */
export type IconName =
  | "chevron"
  | "back"
  | "arrowUpRight"
  | "pin"
  | "clock"
  | "calendar"
  | "thali"
  | "user"
  | "landmark"
  | "phone"
  | "whatsapp"
  | "share"
  | "copy"
  | "check"
  | "camera"
  | "plus"
  | "map"
  | "search";

const PATHS: Record<Exclude<IconName, "whatsapp">, React.ReactNode> = {
  chevron: <path d="M9 6l6 6-6 6" />,
  back: <path d="M15 6l-6 6 6 6" />,
  arrowUpRight: <path d="M7 17L17 7M9 7h8v8" />,
  pin: (
    <>
      <path d="M12 21s-6.5-7-6.5-12a6.5 6.5 0 1 1 13 0c0 5-6.5 12-6.5 12z" />
      <circle cx="12" cy="9" r="2.25" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  thali: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  landmark: <path d="M12 3 4 8h16L12 3zM5 21h14M6 21V10M10 21V10M14 21V10M18 21V10" />,
  phone: (
    <path d="M5 4h3.5l1.6 4.2-2.2 1.5a11 11 0 0 0 6.4 6.4l1.5-2.2L20 15.5V19a1.6 1.6 0 0 1-1.7 1.6A16.5 16.5 0 0 1 3.4 5.7 1.6 1.6 0 0 1 5 4z" />
  ),
  share: (
    <>
      <circle cx="18" cy="5.5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="18.5" r="2.5" />
      <path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2.5" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  camera: (
    <>
      <path d="M3 8a1 1 0 0 1 1-1h3l2-2h6l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  map: <path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2zM9 3v16M15 5v16" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
};

export default function Icon({
  name,
  className = "",
  size,
}: {
  name: IconName;
  className?: string;
  size?: number;
}) {
  if (name === "whatsapp") {
    // The WhatsApp glyph is a filled mark, kept as WhatsApp draws it.
    return (
      <svg viewBox="0 0 32 32" className={`bmi-ic ${className}`} width={size} height={size} aria-hidden fill="currentColor" stroke="none">
        <path d="M16 3C8.82 3 3 8.82 3 16c0 2.29.6 4.43 1.65 6.3L3 29l6.86-1.62A12.95 12.95 0 0 0 16 29c7.18 0 13-5.82 13-13S23.18 3 16 3zm0 23.5c-1.93 0-3.74-.5-5.32-1.4l-.38-.22-4.07.96.97-3.96-.25-.4A10.5 10.5 0 1 1 16 26.5zm6.06-7.86c-.33-.17-1.96-.97-2.27-1.08-.3-.11-.52-.17-.74.17-.22.33-.85 1.07-1.04 1.29-.19.22-.38.25-.71.08-.33-.17-1.4-.52-2.66-1.65-.98-.88-1.65-1.96-1.84-2.29-.19-.33-.02-.51.15-.67.15-.15.33-.39.5-.58.16-.19.22-.33.33-.55.11-.22.06-.41-.03-.58-.08-.17-.74-1.79-1.01-2.45-.27-.66-.55-.57-.74-.58l-.63-.01a1.21 1.21 0 0 0-.88.41c-.3.33-1.15 1.13-1.15 2.75 0 1.62 1.18 3.19 1.34 3.41.16.22 2.32 3.55 5.62 4.97 2.61 1.13 3.14 1.06 3.71.99.57-.06 1.84-.75 2.1-1.48.26-.73.26-1.36.18-1.49-.08-.13-.3-.21-.63-.38z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={`bmi-ic ${className}`} width={size} height={size} aria-hidden>
      {PATHS[name]}
    </svg>
  );
}
