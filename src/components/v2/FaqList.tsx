"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import Icon from "./Icon";

export type FaqItem = {
  id: string;
  q: ReactNode;
  a: ReactNode;
  links?: { href: string; label: ReactNode }[];
};

/**
 * Accessible disclosure list (the homepage FAQ): a real <button> with
 * aria-expanded and aria-controls per question, the answer in a
 * labelled region. Every answer stays in the HTML (only visually
 * folded), so crawlers and FAQ JSON-LD see the same text. Keep item
 * ids stable (other pages link to #<id>).
 *
 *   <FaqList items={FAQ_ITEMS.map((f) => ({ id: f.id, q: isHi ? f.questionHi : f.questionEn, a: ... }))} />
 *
 * `headingAs="h2"` when the questions are the page's h2s (the /faq page).
 * `open` = the id open at first (default: the first; null for none).
 * `multiple` lets several stay open.
 */
export default function FaqList({
  items,
  headingAs: H = "h3",
  open,
  multiple,
  lang,
}: {
  items: FaqItem[];
  headingAs?: "h2" | "h3";
  open?: string | null;
  multiple?: boolean;
  lang?: string;
}) {
  const first = open === undefined ? (items[0]?.id ?? null) : open;
  const [openIds, setOpenIds] = useState<string[]>(first ? [first] : []);
  const toggle = (id: string) =>
    setOpenIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : multiple ? [...cur, id] : [id]));
  return (
    <ul className="bmi-faq" lang={lang} data-rv>
      {items.map((item) => {
        const isOpen = openIds.includes(item.id);
        return (
          <li key={item.id} id={item.id}>
            <H>
              <button
                type="button"
                id={`faq-q-${item.id}`}
                className="bmi-faq-q"
                aria-expanded={isOpen}
                aria-controls={`faq-a-${item.id}`}
                onClick={() => toggle(item.id)}
              >
                <span>{item.q}</span>
                <span className="pm" aria-hidden>
                  <Icon name="plus" />
                </span>
              </button>
            </H>
            <div
              id={`faq-a-${item.id}`}
              role="region"
              aria-labelledby={`faq-q-${item.id}`}
              className={`bmi-faq-a${isOpen ? " open" : ""}`}
            >
              <div>
                <div className="in">
                  {item.a}
                  {item.links?.length ? (
                    <span className="rel">
                      {item.links.map((l) => (
                        <Link key={l.href} href={l.href} className="bmi-tl" tabIndex={isOpen ? 0 : -1} prefetch={false}>
                          {l.label}
                          <Icon name="chevron" className="go" />
                        </Link>
                      ))}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
