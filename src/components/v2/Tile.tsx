import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "./Icon";

/**
 * For the few places a grid is right (resources, temples, guides). On
 * phones tiles are hairline rows with a small square of art; from 760px
 * `grid` opens them into columns with the art on top. Never a card:
 * no box, no border, no shadow, and nothing nested inside.
 *
 *   <TileList grid cols={3}>
 *     <Tile href="/resources/chalisa?lang=en" title="Hanuman Chalisa"
 *           line="Forty verses" art={{ src: "/illustrations/...webp", alt: "" }} />
 *   </TileList>
 */
export function TileList({ children, grid, cols = 3 }: { children: ReactNode; grid?: boolean; cols?: 2 | 3 | 4 }) {
  return (
    <ul className={`bmi-tiles ${grid ? "grid" : ""}`.trim()} style={{ ["--cols" as string]: cols }} data-rv>
      {children}
    </ul>
  );
}

export default function Tile({
  href,
  title,
  line,
  art,
  lang,
  linkProps,
  titleAs,
  kicker,
}: {
  href: string;
  title: ReactNode;
  line?: ReactNode;
  art?: { src: string; alt: string };
  lang?: string;
  linkProps?: Record<string, string | undefined>;
  /** Render the title as a heading (h2 or h3) when it is one of the
   *  page's SEO headings. Default: a plain span. */
  titleAs?: "h2" | "h3";
  /** A small line above the title (a source and date, a place). */
  kicker?: ReactNode;
}) {
  const Body = titleAs ? "div" : "span";
  const TitleTag = titleAs ?? "span";
  return (
    <li>
      <Link href={href} className="bmi-tile" prefetch={false} {...linkProps}>
        {art ? (
          <span className="bmi-tile-art">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={art.src} alt={art.alt} loading="lazy" decoding="async" />
          </span>
        ) : null}
        <Body className="bmi-tile-body">
          {kicker ? <span className="bmi-row-kick">{kicker}</span> : null}
          <TitleTag className="bmi-tile-t" lang={lang}>
            {title}
          </TitleTag>
          {line ? <span className="bmi-tile-l">{line}</span> : null}
        </Body>
        <Icon name="chevron" />
      </Link>
    </li>
  );
}

/**
 * A row of plain text links split by gold hairlines (the homepage's
 * reading paths). For three or four sibling destinations.
 */
export function LinkRow({ items }: { items: { href: string; label: ReactNode; linkProps?: Record<string, string | undefined> }[] }) {
  return (
    <ul className="bmi-links" data-rv>
      {items.map((it) => (
        <li key={it.href}>
          <Link href={it.href} prefetch={false} {...it.linkProps}>
            <span>{it.label}</span>
            <Icon name="chevron" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
