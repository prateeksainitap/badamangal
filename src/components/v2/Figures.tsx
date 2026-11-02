import type { CSSProperties, ReactNode } from "react";

/**
 * Numbers on a page: a season recap, a growth story, a press week.
 * No tiles and no boxes: figures sit on gold hairlines, big and heavy,
 * with a quiet label under each (the homepage tally).
 *
 *   <BigFigure value="1M+" label="Instagram reel views" sub="780,000+ accounts reached" />
 *   <Figures cols={3} items={[{ value: "38,929", label: "Page views" }, ...]} />
 *   <Meters items={[{ label: "Delhi", value: 259 }, ...]} cols />
 *
 * Pass numbers already formatted (en-IN grouping). Latin digits on the
 * Hindi page too.
 */
export function BigFigure({
  value,
  label,
  sub,
  center,
}: {
  value: ReactNode;
  label: ReactNode;
  sub?: ReactNode;
  center?: boolean;
}) {
  return (
    <div className={`bmi-bigfig ${center ? "center" : ""}`.trim()} data-rv>
      <p className="n">{value}</p>
      <p className="l">{label}</p>
      {sub ? <p className="s">{sub}</p> : null}
    </div>
  );
}

export function Figures({
  items,
  cols = 3,
}: {
  items: { value: ReactNode; label: ReactNode; sub?: ReactNode }[];
  /** Columns from 900px; phones always show two. */
  cols?: 2 | 3 | 4;
}) {
  return (
    <ul className="bmi-figs" style={{ ["--cols" as string]: cols } as CSSProperties} data-rv>
      {items.map((f, i) => (
        <li key={i}>
          <span className="n">{f.value}</span>
          <span className="l">{f.label}</span>
          {f.sub ? <span className="s">{f.sub}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * Horizontal bars on hairline rows (cities, months). Solid fills, no
 * gradients; `hot` marks the one row that carries the story in saffron.
 */
export function Meters({
  items,
  cols,
  label,
}: {
  items: { label: ReactNode; value: number; display?: ReactNode; hot?: boolean }[];
  /** Two columns from 900px. */
  cols?: boolean;
  label?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className={`bmi-meters ${cols ? "cols" : ""}`.trim()} aria-label={label} data-rv>
      {items.map((m, i) => (
        <li key={i} className={m.hot ? "hot" : undefined} style={{ ["--v" as string]: Math.max(0.04, m.value / max), ["--i" as string]: i } as CSSProperties}>
          <span className="ml">{m.label}</span>
          <span className="mb" aria-hidden>
            <i />
          </span>
          <span className="mv">{m.display ?? m.value.toLocaleString("en-IN")}</span>
        </li>
      ))}
    </ul>
  );
}
