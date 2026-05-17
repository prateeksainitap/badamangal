import type { ReactNode } from "react";
import Link from "next/link";

/**
 * The base content card: white surface, gold hairline border, warm
 * shadow, gentle hover lift. Same chrome as `.bm-card` in globals.css
 * but expressed as a React primitive so we get TypeScript-checked
 * variants and the option to render as an interactive `<Link>`.
 *
 *   <Card>…contents…</Card>
 *   <Card href="/bhandara/foo">…</Card>           // becomes a Link
 *   <Card variant="cream">…</Card>                // saffron-tinted background
 *   <Card padding="hero">…</Card>                 // px-6 py-7
 *
 * For cards with photo banners on top, drop the photo block as the
 * first child, it'll inherit the rounded clip from `overflow-hidden`.
 *
 * For cards that need jali-corner ornaments, wrap with `<JaliFrame>`.
 */
type Variant = "white" | "cream" | "saffron-tint";
type Padding = "none" | "tight" | "default" | "hero";

type Props = {
  children: ReactNode;
  /** When set, the card becomes an interactive Next <Link>. */
  href?: string;
  variant?: Variant;
  padding?: Padding;
  /** Disable the hover lift (e.g. for non-interactive info cards). */
  flat?: boolean;
  className?: string;
} & React.AriaAttributes & {
    "data-ga"?: string;
  };

const VARIANT: Record<Variant, string> = {
  white: "bg-white border-gold-500/40",
  cream: "bg-cream-50 border-gold-500/45",
  "saffron-tint":
    "bg-gradient-to-br from-saffron-50 via-cream-50 to-cream-50 border-gold-500/45",
};

const PADDING: Record<Padding, string> = {
  none: "",
  tight: "px-4 py-4",
  default: "px-5 py-6",
  hero: "px-6 py-7 sm:px-8 sm:py-10",
};

const HOVER =
  "transition-transform duration-200 hover:-translate-y-0.5 hover:border-saffron-500";

export default function Card({
  children,
  href,
  variant = "white",
  padding = "default",
  flat = false,
  className = "",
  ...rest
}: Props) {
  const cls = `relative block rounded-3xl border shadow-warm overflow-hidden ${VARIANT[variant]} ${PADDING[padding]} ${flat ? "" : HOVER} ${className}`;

  if (href) {
    return (
      <Link href={href} className={`group ${cls}`} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
