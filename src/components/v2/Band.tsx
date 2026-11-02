import type { ReactNode } from "react";
import Heading from "./Heading";

/**
 * A closing invitation at the foot of a page ("List your bhandara",
 * "Volunteer"): a warm saffron wash that fades to the ground on every
 * side (no box, no border), optional painted art, a heading, one line
 * and the action. One per page.
 */
export default function Band({
  id,
  kicker,
  title,
  heading,
  lede,
  actions,
  art,
}: {
  id?: string;
  kicker?: ReactNode;
  title?: { en: string; hi: string };
  heading?: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  art?: ReactNode;
}) {
  return (
    <section className="bmi-band" id={id} aria-labelledby={id ? `${id}-h` : undefined}>
      <div className="bmi-wrap">
        <div className={`bmi-band-grid ${art ? "has-art" : ""}`.trim()}>
          {art ? <div className="bmi-band-art">{art}</div> : null}
          <div>
            {kicker}
            {heading ?? (title ? <Heading as="h2" id={id ? `${id}-h` : undefined} en={title.en} hi={title.hi} /> : null)}
            {lede ? (
              <p className="bmi-lede" data-rv>
                {lede}
              </p>
            ) : null}
            {actions}
          </div>
        </div>
      </div>
    </section>
  );
}
