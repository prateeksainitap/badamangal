import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "./Icon";
import { hasDevanagari } from "./lang";

/**
 * One listed thing on a hairline: a bhandara, a temple, a past season
 * entry. The whole row is the link (48px plus tap target). Not a card:
 * no box, no shadow. Optional square thumbnail (a real photo, or the
 * gada pin on gold when there is none).
 *
 *   <RowList cols>
 *     <ListRow href="/bhandara/x?lang=en" kicker="19 May · 9 AM to 2 PM"
 *              title="Vishal Bhandara" meta="Aliganj · Sector B"
 *              thumb={{ src: photoUrl, alt: "..." }} />
 *   </RowList>
 *
 * Never put an organiser's phone in a row. For bhandaras use
 * <BhandaraRow>, which builds these props from a BhandaraListItem.
 */
export function RowList({ children, cols, label }: { children: ReactNode; cols?: boolean; label?: string }) {
  return (
    <ul className={`bmi-list ${cols ? "cols" : ""}`.trim()} aria-label={label} data-rv>
      {children}
    </ul>
  );
}

export type RowThumb = { src: string; alt: string } | "gada" | null | undefined;

export default function ListRow({
  href,
  external,
  title,
  titleAs: TitleTag = "h3",
  kicker,
  meta,
  thumb,
  muted,
  end,
  linkProps,
}: {
  href: string;
  external?: boolean;
  title: ReactNode;
  titleAs?: "h2" | "h3" | "p";
  kicker?: ReactNode;
  meta?: ReactNode;
  thumb?: RowThumb;
  /** Past or finished: quieter kicker, slightly desaturated photo. */
  muted?: boolean;
  /** Replaces the chevron (a small chip, a count). */
  end?: ReactNode;
  linkProps?: Record<string, string | undefined>;
}) {
  const cls = `bmi-row ${thumb ? "has-thumb" : ""} ${muted ? "muted" : ""}`.replace(/\s+/g, " ").trim();
  const inner = (
    <>
      {thumb ? (
        thumb === "gada" ? (
          <span className="bmi-row-thumb gada" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/map-pin-gada.svg" alt="" width={30} height={30} />
          </span>
        ) : (
          <span className="bmi-row-thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb.src} alt={thumb.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
          </span>
        )
      ) : null}
      <div className="bmi-row-main">
        {kicker ? <span className="bmi-row-kick">{kicker}</span> : null}
        <TitleTag className="bmi-row-title" lang={hasDevanagari(title) ? "hi" : undefined}>
          {title}
        </TitleTag>
        {meta ? <span className="bmi-row-meta">{meta}</span> : null}
      </div>
      <span className="bmi-row-end">{end ?? <Icon name={external ? "arrowUpRight" : "chevron"} />}</span>
    </>
  );
  return (
    <li>
      {external ? (
        <a href={href} className={cls} target="_blank" rel="noopener noreferrer" {...linkProps}>
          {inner}
        </a>
      ) : (
        <Link href={href} className={cls} prefetch={false} {...linkProps}>
          {inner}
        </Link>
      )}
    </li>
  );
}
