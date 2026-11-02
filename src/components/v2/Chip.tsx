import Link from "next/link";
import type { ReactNode } from "react";
import Icon, { type IconName } from "./Icon";

/**
 * A small fact in a pill: a date, a menu item, an area. Not a button
 * (a CTA must never look like a tag). As a link it grows to a 44px tap
 * target. Tones: default (white on a gold hairline), saffron (upcoming,
 * today), gold (a quiet highlight), leaf (verified, open now), muted
 * (past, no ring).
 */
export default function Chip({
  children,
  tone = "default",
  icon,
  href,
  lang,
}: {
  children: ReactNode;
  tone?: "default" | "saffron" | "gold" | "leaf" | "muted";
  icon?: IconName;
  href?: string;
  lang?: string;
}) {
  const cls = `bmi-chip ${tone === "default" ? "" : tone}`.trim();
  const inner = (
    <>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </>
  );
  return href ? (
    <Link href={href} className={cls} prefetch={false} lang={lang}>
      {inner}
    </Link>
  ) : (
    <span className={cls} lang={lang}>
      {inner}
    </span>
  );
}

/** A wrapping row of chips (a <ul>, one <li> per chip). */
export function ChipList({ children, label }: { children: ReactNode[]; label?: string }) {
  return (
    <ul className="bmi-chips" aria-label={label}>
      {children.map((c, i) => (
        <li key={i}>{c}</li>
      ))}
    </ul>
  );
}
