import Link from "next/link";

/**
 * KPI tile for the admin dashboard. Five of these sit at the top of
 * /admin/home and answer "what's happening right now". Each tile is
 * clickable when `href` is set — clicking drops the operator into
 * the relevant queue / map already filtered. Designed to be dense
 * and scannable, not pretty-card-with-lots-of-whitespace.
 *
 * Variants:
 *   - "default"  cream-text, saffron number, neutral background
 *   - "attention" sindoor border + saffron number when there's a
 *                  pending pile that needs action (Pending review,
 *                  Expiring spots, etc.)
 *   - "success"  leaf border + leaf number for healthy states
 *                  (Bot online, Verified count, etc.)
 *
 * The component itself does no data fetching — the parent server
 * component computes counts and passes them down. Keeps tiles dumb
 * and the dashboard's data layer in one place.
 */

type Variant = "default" | "attention" | "success";

type Props = {
  /** Short label above the value, e.g. "Pending review". */
  label: string;
  /** Big number. Pass a string so callers can pre-format with
   *  `.toLocaleString("en-IN")` for thousands separators. */
  value: string;
  /** Optional sublabel under the number, e.g. "↑ 3 today" or "→ 2 expiring". */
  delta?: string;
  /** When set, the whole tile becomes a Link. Use an existing admin
   *  route — Dashboard tiles deep-link into pre-filtered queues. */
  href?: string;
  /** Visual treatment. Defaults to "default". */
  variant?: Variant;
  /** Optional 18×18 icon rendered in the upper-right. */
  icon?: React.ReactNode;
};

const VARIANT_STYLES: Record<Variant, { border: string; number: string; iconWrap: string }> = {
  default: {
    border: "border-cream-50/12 hover:border-cream-50/22",
    number: "text-cream-50",
    iconWrap: "text-cream-50/55 bg-cream-50/[0.05]",
  },
  attention: {
    border: "border-saffron-500/35 hover:border-saffron-500/55",
    number: "text-saffron-500",
    iconWrap: "text-saffron-500 bg-saffron-500/[0.10]",
  },
  success: {
    border: "border-leaf-400/35 hover:border-leaf-400/55",
    number: "text-leaf-400",
    iconWrap: "text-leaf-400 bg-leaf-400/[0.10]",
  },
};

export default function KpiTile({
  label,
  value,
  delta,
  href,
  variant = "default",
  icon,
}: Props) {
  const styles = VARIANT_STYLES[variant];

  const inner = (
    <div
      className={[
        "group relative rounded-2xl border bg-cream-50/[0.03] backdrop-blur-sm p-4 transition-colors h-full",
        styles.border,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.16em] text-cream-50/55 font-medium">
          {label}
        </div>
        {icon ? (
          <div
            className={[
              "shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg",
              styles.iconWrap,
            ].join(" ")}
            aria-hidden
          >
            {icon}
          </div>
        ) : null}
      </div>
      <div
        className={[
          "mt-2 font-numerals tabular-nums text-3xl font-bold leading-none",
          styles.number,
        ].join(" ")}
      >
        {value}
      </div>
      {delta ? (
        <div className="mt-1.5 text-xs text-cream-50/55">{delta}</div>
      ) : null}
      {href ? (
        <div
          aria-hidden
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-cream-50/55"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17 L17 7" />
            <path d="M9 7 H17 V15" />
          </svg>
        </div>
      ) : null}
    </div>
  );

  return href ? (
    <Link href={href} prefetch={false} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}
