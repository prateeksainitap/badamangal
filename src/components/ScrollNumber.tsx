"use client";

/**
 * Odometer-style scrolling number. Each digit slot is a 1em-tall window
 * with a vertical strip of 0..9 inside; we translate the strip so the
 * active digit sits in view, with a soft cubic-bezier transition. When the
 * value changes (e.g. on visitor counter increment, or a countdown tick),
 * each digit smoothly rolls to its new position.
 *
 * - Locale-aware grouping ("1,234" / "1,234" same here, but Indian numbering
 *   uses 1,23,456, we let the host pass a pre-formatted string via `value`,
 *   or pass a number and let us format it.
 */
type Props = {
  value: number | string;
  /** Tailwind classes applied to the wrapper. Use it for size/color. */
  className?: string;
  /** Locale used when value is a number. Default `en-IN`. */
  locale?: string;
};

export default function ScrollNumber({
  value,
  className,
  locale = "en-IN",
}: Props) {
  const text =
    typeof value === "number" ? value.toLocaleString(locale) : String(value);
  const chars = Array.from(text);
  return (
    <span
      className={`inline-flex items-baseline tabular-nums ${className ?? ""}`}
      aria-label={text}
    >
      {chars.map((c, i) =>
        /^\d$/.test(c) ? (
          <ScrollDigit key={`d-${i}-${c}`} char={c} />
        ) : (
          <span key={`s-${i}`} aria-hidden>
            {c}
          </span>
        ),
      )}
    </span>
  );
}

function ScrollDigit({ char }: { char: string }) {
  const n = Number(char);
  return (
    <span
      className="inline-block overflow-hidden align-baseline"
      style={{ height: "1em", lineHeight: 1 }}
      aria-hidden
    >
      <span
        className="block will-change-transform"
        style={{
          transform: `translateY(-${n * 10}%)`,
          transition: "transform 700ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className="block"
            style={{ height: "1em", lineHeight: 1 }}
          >
            {i}
          </span>
        ))}
      </span>
    </span>
  );
}
