"use client";

import { useEffect, useState } from "react";
import Icon, { type IconName } from "./Icon";

export type StickyAction = {
  href: string;
  label: string;
  icon: IconName;
  /** At most one. Gets the saffron fill. */
  primary?: boolean;
  external?: boolean;
  lang?: string;
  dataGa?: string;
};

/**
 * Phones only (under 640px): a bar of two to four equal actions that
 * slides up once the hero's own buttons have scrolled away, so the
 * main action is always one thumb away. The floating Spot button steps
 * aside while it shows. Render it inside <InnerShell>.
 *
 *   <StickyActions items={[
 *     { href: directions, label: "Directions", icon: "pin", primary: true, external: true },
 *     { href: share, label: "Share", icon: "whatsapp", external: true },
 *   ]} />
 */
export default function StickyActions({
  items,
  showAfter = 360,
  label = "Quick actions",
}: {
  items: StickyAction[];
  showAfter?: number;
  label?: string;
}) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const f = () => setOn(window.scrollY > showAfter);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, [showAfter]);
  if (!items.length) return null;
  return (
    <nav className={`bmi-sticky ${on ? "on" : ""}`} aria-label={label} aria-hidden={!on} inert={!on ? true : undefined}>
      {items.map((it) => (
        <a
          key={it.label}
          href={it.href}
          className={it.primary ? "p" : undefined}
          lang={it.lang}
          data-ga={it.dataGa}
          {...(it.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          <Icon name={it.icon} />
          {it.label}
        </a>
      ))}
    </nav>
  );
}
