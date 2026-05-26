import Link from "next/link";
import { LinkPendingOverlay } from "@/components/admin/LinkPending";

/**
 * KPI tile for the admin AI/ops dashboard. Five of these sit at
 * the top of /admin/home and answer "what's the system doing".
 *
 * Visual language:
 *   • Mono-font numerals (JetBrains Mono via the existing `font-mono`
 *     utility) so the value reads as live system data, not editorial
 *     copy.
 *   • Cyan / violet / leaf accents instead of warm saffron, keeps
 *     the dashboard in the operator-console aesthetic. Saffron stays
 *     reserved for the BadaMangal brand mark in the sidebar.
 *   • Attention tiles (a pending pile that needs action) breathe a
 *     soft cyan→violet card-glow so the operator's eye lands on
 *     them in peripheral vision.
 *   • Tiny "live" indicator dot in the top-right corner pulses
 *     once per beat, reads as "this value was just measured".
 *   • Sparkline-style underline at the bottom drifts left→right,
 *     mimicking a signal trace.
 *
 * Variants:
 *   default   , neutral cyan
 *   attention , violet glow, breathing border; for pending piles
 *   success   , leaf (kept; healthy states still benefit from green)
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
   *  route, Dashboard tiles deep-link into pre-filtered queues. */
  href?: string;
  /** Visual treatment. Defaults to "default". */
  variant?: Variant;
  /** Optional icon rendered in the upper-right corner of the tile. */
  icon?: React.ReactNode;
};

const VARIANT_STYLES: Record<
  Variant,
  {
    border: string;
    numberColor: string;
    iconWrap: string;
    bgTint: string;
    sparkColor: string;
  }
> = {
  default: {
    border:
      "border-cyan-400/15 hover:border-cyan-400/35 hover:shadow-[0_8px_30px_-12px_rgba(34,211,238,0.45)]",
    numberColor: "text-cyan-200",
    iconWrap:
      "text-cyan-300 bg-cyan-400/[0.08] border border-cyan-400/25",
    bgTint:
      "radial-gradient(circle at 100% 0%, rgba(34,211,238,0.10) 0%, transparent 60%)",
    sparkColor: "rgba(34, 211, 238, 0.5)",
  },
  attention: {
    border:
      "border-violet-400/30 admin-card-glow hover:shadow-[0_10px_40px_-10px_rgba(139,92,246,0.55)]",
    numberColor: "text-violet-200",
    iconWrap:
      "text-violet-300 bg-violet-500/[0.12] border border-violet-500/30",
    bgTint:
      "radial-gradient(circle at 100% 0%, rgba(139,92,246,0.16) 0%, transparent 60%)",
    sparkColor: "rgba(139, 92, 246, 0.6)",
  },
  success: {
    border:
      "border-leaf-400/30 hover:border-leaf-400/55 hover:shadow-[0_10px_40px_-10px_rgba(93,174,93,0.45)]",
    numberColor: "text-leaf-400",
    iconWrap: "text-leaf-400 bg-leaf-400/[0.10] border border-leaf-400/30",
    bgTint:
      "radial-gradient(circle at 100% 0%, rgba(93,174,93,0.16) 0%, transparent 60%)",
    sparkColor: "rgba(93, 174, 93, 0.55)",
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
        "group relative rounded-2xl border bg-[#0B0E16]/85 backdrop-blur-sm p-5 transition-all duration-300 h-full overflow-hidden",
        styles.border,
      ].join(" ")}
    >
      {/* Decorative corner gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{ background: styles.bgTint }}
      />
      {/* Subtle grid texture inside the tile, same admin-data-grid
          pattern but at much lower opacity so it reads as a faint
          measurement scaffold. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.5] admin-data-grid"
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="leading-tight min-w-0">
            <div className="flex items-center gap-1.5">
              <div className="text-[10px] uppercase tracking-[0.18em] text-cream-50/55 font-mono">
                {label}
              </div>
              {/* Live dot, single saffron pulse on the corner of
                  the label, signals "this metric is current". */}
              <span aria-hidden className="relative inline-flex h-1 w-1 ml-0.5">
                <span className="absolute inset-0 rounded-full bg-cyan-400/70 motion-safe:animate-ping" />
                <span className="relative inline-flex h-1 w-1 rounded-full bg-cyan-400" />
              </span>
            </div>
          </div>
          {icon ? (
            <div
              className={[
                "shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-xl",
                styles.iconWrap,
              ].join(" ")}
              aria-hidden
            >
              {icon}
            </div>
          ) : null}
        </div>

        {/* The hero number, mono font, big, snap-in animation,
            held in the variant's accent colour. */}
        <div
          className={[
            "admin-value-snap font-mono tabular-nums font-semibold text-[2.5rem] leading-none tracking-tight",
            styles.numberColor,
          ].join(" ")}
        >
          {value}
        </div>

        {delta ? (
          <div className="mt-2 text-xs text-cream-50/55 flex items-center gap-1.5 font-mono">
            {variant === "attention" ? (
              <span
                aria-hidden
                className="relative inline-flex h-1.5 w-1.5"
              >
                <span className="absolute inset-0 rounded-full bg-violet-400/60 motion-safe:animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-400" />
              </span>
            ) : null}
            <span className="truncate">{delta}</span>
          </div>
        ) : null}

        {/* Signal-trace underline. Inline SVG, decorative; reads
            as a real-time measurement line. Uses the variant
            colour, fades out into the right side so it doesn't
            terminate hard. */}
        <svg
          aria-hidden
          className="absolute bottom-3 left-5 right-5 h-3 opacity-60 pointer-events-none"
          viewBox="0 0 200 12"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient
              id={`spark-${variant}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor={styles.sparkColor} stopOpacity="0" />
              <stop
                offset="40%"
                stopColor={styles.sparkColor}
                stopOpacity="1"
              />
              <stop
                offset="100%"
                stopColor={styles.sparkColor}
                stopOpacity="0"
              />
            </linearGradient>
          </defs>
          <path
            d="M0 6 L18 4 L30 8 L46 3 L62 7 L78 5 L92 6 L110 2 L126 9 L142 4 L158 7 L174 5 L190 6 L200 6"
            fill="none"
            stroke={`url(#spark-${variant})`}
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {href ? (
          <div
            aria-hidden
            className="absolute top-0 right-0 -translate-y-1 translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-cyan-300"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 17 L17 7" />
              <path d="M9 7 H17 V15" />
            </svg>
          </div>
        ) : null}
      </div>
    </div>
  );

  return href ? (
    // `relative` so LinkPendingOverlay's absolute-inset positioning
    // anchors to this Link wrapper, not the page root.
    <Link href={href} className="relative block h-full">
      {inner}
      <LinkPendingOverlay />
    </Link>
  ) : (
    inner
  );
}
