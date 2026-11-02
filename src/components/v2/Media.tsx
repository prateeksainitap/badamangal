import Link from "next/link";
import type { ReactNode } from "react";

export type Photo = {
  src: string;
  alt: string;
  href?: string;
  /** Short bold line under the photo (an area, a date). */
  title?: ReactNode;
  /** One or two quiet lines (a caption). Never a person's name. */
  caption?: ReactNode;
  /** A small label laid on the photo's top left corner ("Live"). */
  badge?: ReactNode;
};

/**
 * Square photo grid: the gallery, spots at a bhandara, a season recap.
 * 2 columns on phones, 3 from 640px, 4 from 1024px. `lead` makes the
 * first photo span two by two on desktop. Never show a spotter's or a
 * sender's name in a caption.
 *
 * `onOpen(i)` (client parents only) turns each photo into a button that
 * opens a lightbox (the /gallery page). `dense` = 3 columns on phones,
 * 4 from 640px, 6 from 1024px, for long archives of photos.
 */
export function PhotoGrid({
  items,
  lead,
  label,
  onOpen,
  dense,
}: {
  items: Photo[];
  lead?: boolean;
  label?: string;
  onOpen?: (index: number) => void;
  dense?: boolean;
}) {
  return (
    <ul className={`bmi-photos ${lead ? "lead" : ""} ${dense ? "dense" : ""}`.replace(/\s+/g, " ").trim()} aria-label={label} data-rv>
      {items.map((p, i) => (
        <li key={`${p.src}-${i}`}>
          <figure className="bmi-photo">
            {p.badge ? <span className="bmi-photo-badge">{p.badge}</span> : null}
            {onOpen ? (
              <button type="button" className="bmi-photo-img" onClick={() => onOpen(i)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt={p.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
              </button>
            ) : p.href ? (
              /^https?:/.test(p.href) ? (
                <a className="bmi-photo-img" href={p.href} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt={p.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                </a>
              ) : (
                <Link className="bmi-photo-img" href={p.href} prefetch={false}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt={p.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                </Link>
              )
            ) : (
              <span className="bmi-photo-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt={p.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
              </span>
            )}
            {p.title || p.caption ? (
              <figcaption>
                {p.title ? <b>{p.title}</b> : null}
                {p.caption ? <span>{p.caption}</span> : null}
              </figcaption>
            ) : null}
          </figure>
        </li>
      ))}
    </ul>
  );
}

/**
 * The live feed: one entry per spot or message, on hairlines. The gada
 * pin is the default marker. Meta is "area · time ago" with neutral
 * labels only ("A neighbour", never a name).
 *
 *   <FeedList>
 *     <FeedRow meta={<><b>Aliganj</b> · 12 min ago</>} text="Puri and halwa"
 *              photo={{ src, alt }} />
 *   </FeedList>
 */
export function FeedList({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul className="bmi-feed" aria-label={label}>
      {children}
    </ul>
  );
}

export function FeedRow({
  meta,
  text,
  photo,
  marker,
  id,
  children,
}: {
  meta: ReactNode;
  text?: ReactNode;
  photo?: { src: string; alt: string; href?: string };
  marker?: ReactNode;
  id?: string;
  children?: ReactNode;
}) {
  return (
    <li id={id}>
      <span className="bmi-feed-dot" aria-hidden>
        {marker ?? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/brand/map-pin-gada.svg" alt="" />
        )}
      </span>
      <div>
        <div className="bmi-feed-meta">{meta}</div>
        {text ? <p className="bmi-feed-text">{text}</p> : null}
        {photo ? (
          photo.href ? (
            <a className="bmi-feed-pic" href={photo.href} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            </a>
          ) : (
            <span className="bmi-feed-pic">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            </span>
          )
        ) : null}
        {children}
      </div>
    </li>
  );
}
