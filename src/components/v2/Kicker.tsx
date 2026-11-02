import type { ReactNode } from "react";

/**
 * The small tracked line above a heading (homepage .kick). One per
 * heading, short: a place, a date, a category. Never three tags.
 * `live` adds the green pulse dot (only when something is truly live).
 */
export default function Kicker({
  children,
  live,
  className = "",
}: {
  children: ReactNode;
  live?: boolean;
  className?: string;
}) {
  return (
    <p className={`bmi-kick ${className}`.trim()} data-rv>
      {live ? <span className="live" aria-hidden /> : null}
      {children}
    </p>
  );
}

/** A small gold dot between two parts of a kicker. */
export function KickSep() {
  return <span className="sep" aria-hidden />;
}
