/**
 * Compact KPI strip rendered at the top of every admin sub-page.
 *
 * Same visual vocabulary as the dashboard's main KpiTile row but
 * tighter (3-4 tiles, smaller numbers, less chrome) so it functions
 * as a "you are here" header rather than a hero. Operator should be
 * able to glance at the strip and know the queue's pulse before
 * looking at any rows.
 *
 * Items:
 *   • `label`, short uppercase eyebrow ("Pending", "Live now").
 *   • `value`, pre-formatted string (number or "TUESDAY") so the
 *     caller controls locale / commas.
 *   • `accent`, "cyan" | "violet" | "leaf" | "sindoor". Drives
 *     the icon tint, value colour, and border tint.
 *   • `icon`, 22×22 stroke icon shown in a 44×44 plate on the
 *     right of the tile.
 *   • `href`, optional. When set, the tile becomes a Link
 *     (deep-link into a pre-filtered queue tab).
 *
 * Server-rendered, no client JS.
 */
import Link from "next/link";

export type KpiStripItem = {
  label: string;
  value: string;
  accent: "cyan" | "violet" | "leaf" | "sindoor";
  icon: React.ReactNode;
  href?: string;
  /** Optional delta line under the value, same role as on KpiTile. */
  delta?: string;
};

const ACCENTS: Record<
  KpiStripItem["accent"],
  { number: string; iconWrap: string; border: string; bgTint: string }
> = {
  cyan: {
    number: "text-cyan-200",
    iconWrap: "text-cyan-300 bg-cyan-400/[0.10] border border-cyan-400/30",
    border: "border-cyan-400/15 hover:border-cyan-400/35",
    bgTint:
      "radial-gradient(circle at 100% 0%, rgba(34,211,238,0.08) 0%, transparent 60%)",
  },
  violet: {
    number: "text-violet-200",
    iconWrap: "text-violet-300 bg-violet-500/[0.14] border border-violet-500/35",
    border: "border-violet-400/20 hover:border-violet-400/45",
    bgTint:
      "radial-gradient(circle at 100% 0%, rgba(139,92,246,0.12) 0%, transparent 60%)",
  },
  leaf: {
    number: "text-leaf-400",
    iconWrap: "text-leaf-400 bg-leaf-400/[0.12] border border-leaf-400/35",
    border: "border-leaf-400/20 hover:border-leaf-400/45",
    bgTint:
      "radial-gradient(circle at 100% 0%, rgba(93,174,93,0.12) 0%, transparent 60%)",
  },
  sindoor: {
    number: "text-sindoor-300",
    iconWrap: "text-sindoor-300 bg-sindoor-700/[0.18] border border-sindoor-500/45",
    border: "border-sindoor-700/25 hover:border-sindoor-700/50",
    bgTint:
      "radial-gradient(circle at 100% 0%, rgba(156,42,42,0.14) 0%, transparent 60%)",
  },
};

export default function KpiStrip({ items }: { items: KpiStripItem[] }) {
  return (
    <div
      className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3"
      role="region"
      aria-label="Page summary"
    >
      {items.map((it, i) => (
        <KpiStripTile key={i} item={it} />
      ))}
    </div>
  );
}

function KpiStripTile({ item }: { item: KpiStripItem }) {
  const a = ACCENTS[item.accent];
  const inner = (
    <div
      className={[
        "relative rounded-2xl border bg-[#0B0E16]/85 backdrop-blur-sm p-4 transition-all duration-300 h-full overflow-hidden",
        a.border,
      ].join(" ")}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{ background: a.bgTint }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.18em] text-cream-50/55 font-mono">
            {item.label}
          </div>
          <div
            className={[
              "admin-value-snap font-mono tabular-nums font-semibold text-3xl leading-none tracking-tight mt-1.5",
              a.number,
            ].join(" ")}
          >
            {item.value}
          </div>
          {item.delta ? (
            <div className="mt-1.5 text-[11px] text-cream-50/55 font-mono truncate">
              {item.delta}
            </div>
          ) : null}
        </div>
        <div
          className={[
            "shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl",
            a.iconWrap,
          ].join(" ")}
          aria-hidden
        >
          {item.icon}
        </div>
      </div>
    </div>
  );
  return item.href ? (
    <Link href={item.href} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}
