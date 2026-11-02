import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import Icon, { type IconName } from "./Icon";

type Common = {
  /** primary = saffron pill (ONE per screen), secondary = cream with a
   *  gold ring, text = saffron text link with a chevron. Never red. */
  variant?: "primary" | "secondary" | "text";
  size?: "md" | "sm";
  icon?: IconName;
  /** Text links get a chevron by default; pass null for none. */
  iconEnd?: IconName | null;
  block?: boolean;
  children: ReactNode;
  className?: string;
};

type AsLink = Common & { href: string; external?: boolean } & Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    "href" | "className" | "children"
  >;
type AsButton = Common & { href?: undefined } & Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "className" | "children"
  >;

/**
 * The kit's one button. Same height (52, or 48 for `sm`), same pill,
 * same hover everywhere, matching the homepage. A link when `href` is
 * set (internal hrefs use next/link), a <button> otherwise.
 *
 *   <Button href={directions} external icon="pin">Get directions</Button>
 *   <Button variant="secondary" href={shareUrl} external icon="whatsapp">Share</Button>
 *   <Button variant="text" href="/area/aliganj?lang=en">All in Aliganj</Button>
 */
export default function Button(props: AsLink | AsButton) {
  const { variant = "primary", size = "md", icon, iconEnd, block, children, className = "", ...rest } = props;
  const end = iconEnd === undefined ? (variant === "text" ? "chevron" : null) : iconEnd;
  const cls =
    variant === "text"
      ? `bmi-tl ${className}`
      : `bmi-b ${variant === "primary" ? "bmi-b-p" : "bmi-b-s"} ${size === "sm" ? "sm" : ""} ${block ? "block" : ""} ${className}`;
  const inner = (
    <>
      {icon ? <Icon name={icon} /> : null}
      <span>{children}</span>
      {end ? <Icon name={end} className={end === "chevron" ? "go" : ""} /> : null}
    </>
  );
  if ("href" in rest && typeof rest.href === "string") {
    const { href, external, ...a } = rest as AsLink;
    if (external || /^(https?:|tel:|mailto:|upi:|whatsapp:)/.test(href)) {
      return (
        <a href={href} className={cls.trim()} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...a}>
          {inner}
        </a>
      );
    }
    return (
      <Link href={href} className={cls.trim()} prefetch={false} {...a}>
        {inner}
      </Link>
    );
  }
  const { type = "button", ...b } = rest as AsButton;
  return (
    <button type={type} className={cls.trim()} {...b}>
      {inner}
    </button>
  );
}

/** A row of actions with equal gaps. `split` makes the first two share
 *  the row in halves on phones. */
export function Actions({ children, split, className = "" }: { children: ReactNode; split?: boolean; className?: string }) {
  return (
    <div className={`bmi-actions ${split ? "split" : ""} ${className}`.trim()} data-rv>
      {children}
    </div>
  );
}
