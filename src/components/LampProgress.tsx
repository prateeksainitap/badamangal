type Props = {
  total?: number;
  /** Number of dots filled (1-based: dots 1..current are filled). */
  current: number;
  className?: string;
};

/**
 * Stepper-dot timeline for the multi-step listing flow.
 * Dots 1..current are saffron-filled, the active dot has a soft pulsing
 * ring, and dots are connected by thin gold rules, a cleaner replacement
 * for the diya/lamp progress indicator.
 */
export default function LampProgress({ total = 8, current, className }: Props) {
  return (
    <ol
      role="list"
      aria-label="Submission progress"
      className={className ?? "flex items-center justify-center w-full max-w-sm mx-auto"}
    >
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        const filled = n <= current;
        return (
          <li
            key={i}
            aria-current={active ? "step" : undefined}
            title={`Step ${n} of ${total}`}
            className={`flex items-center ${i === 0 ? "" : "flex-1"}`}
          >
            {/* Connector rule (skip before the first dot) */}
            {i > 0 ? (
              <span
                aria-hidden
                className={`block h-0.5 w-full mx-1 rounded-full ${
                  done || active ? "bg-saffron-500" : "bg-gold-500/35"
                }`}
              />
            ) : null}
            {/* Dot */}
            <span aria-hidden className="relative inline-flex items-center justify-center shrink-0">
              {active ? (
                <span className="absolute inset-0 -m-1 rounded-full ring-2 ring-saffron-500/50 motion-safe:animate-ping" />
              ) : null}
              <span
                className={`relative block rounded-full transition-colors ${
                  active
                    ? "h-3 w-3 bg-saffron-600 ring-2 ring-cream-50 shadow-warm"
                    : filled
                      ? "h-2.5 w-2.5 bg-saffron-600"
                      : "h-2 w-2 bg-cream-50 border border-gold-500/55"
                }`}
              />
            </span>
            <span className="sr-only">{`Step ${n}${filled ? " complete" : ""}`}</span>
          </li>
        );
      })}
    </ol>
  );
}
