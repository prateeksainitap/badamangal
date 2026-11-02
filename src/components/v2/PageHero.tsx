import type { ReactNode } from "react";
import Heading from "./Heading";

/**
 * The top of every inner page: breadcrumb, kicker, the h1 in the
 * visitor's language, at most ONE line under it, then the actions.
 * Optional art on the right on desktop (below the text on phones): a
 * painted plate (<Plate>), a real photo (<Print>) or a <PlateMap>.
 *
 *   <PageHero
 *     crumbs={<Breadcrumb items={...} />}
 *     kicker={<Kicker>Bada Mangal 2026</Kicker>}
 *     title={{ en: "Hanuman Chalisa", hi: "हनुमान चालीसा" }}
 *     lede={<T en="Forty verses..." hi="..." />}
 *     actions={<Actions><Button href="#read">Read</Button></Actions>}
 *     art={<Plate src=... />}
 *   />
 *
 * `heading` replaces `title` when the h1 needs custom markup (pass a
 * <Heading as="h1">). Keep the page's existing h1 text exactly (SEO).
 */
export default function PageHero({
  crumbs,
  kicker,
  title,
  heading,
  lede,
  meta,
  actions,
  art,
  align = "left",
  id,
}: {
  crumbs?: ReactNode;
  kicker?: ReactNode;
  title?: { en: string; hi: string };
  heading?: ReactNode;
  lede?: ReactNode;
  /** A row under the lede: chips or one fact line. */
  meta?: ReactNode;
  actions?: ReactNode;
  art?: ReactNode;
  align?: "left" | "center";
  id?: string;
}) {
  return (
    <header className={`bmi-hero ${align === "center" ? "center" : ""}`.trim()} id={id}>
      <div className="bmi-wrap">
        {crumbs}
        <div className={`bmi-hero-grid ${art ? "has-art" : ""}`.trim()}>
          <div className="bmi-hero-copy">
            {kicker}
            {heading ?? (title ? <Heading as="h1" en={title.en} hi={title.hi} /> : null)}
            {lede ? (
              <p className="bmi-lede" data-rv>
                {lede}
              </p>
            ) : null}
            {meta ? (
              <div className="bmi-hero-meta" data-rv>
                {meta}
              </div>
            ) : null}
            {actions}
          </div>
          {art ? <div className="bmi-hero-art">{art}</div> : null}
        </div>
      </div>
    </header>
  );
}
