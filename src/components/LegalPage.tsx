"use client";

import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { useLocaleFromContext } from "@/lib/locale-context";
import { Breadcrumb, Chip, ChipList, InnerShell, Kicker, PageHero, ProseDoc } from "@/components/v2";

type Bi<T> = { en: T; hi: T };

type Props = {
  /** Tracked line above the title. */
  kicker: Bi<string>;
  /** The h1. */
  title: Bi<string>;
  /** One-sentence intro that sits under the title. */
  intro: Bi<string>;
  /** Date string. Format-agnostic, passed through unchanged because
   *  the same "10 May 2026" reads cleanly in both locales. */
  lastUpdated: string;
  /** English-language prose body. */
  en: ReactNode;
  /** Hindi-language prose body. Renders when the LocaleProvider
   *  context says `hi`. Keeping both bodies inline (instead of trying
   *  to translate per-paragraph at runtime) means the bilingual swap
   *  stays accurate and lawyers can audit both versions independently. */
  hi: ReactNode;
};

type El = ReactElement<{ children?: ReactNode; id?: string }>;

/** Plain text of a heading, for the contents list. */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node as El).props.children);
  return "";
}

/**
 * Gives every top level <h2> in a legal body a stable anchor id
 * ("section-1", "section-2", ...) and returns the contents list. The
 * ids follow the section order, so the English and Hindi bodies share
 * them and a link to #section-4 works in either language. The words
 * of the legal text are never touched.
 */
function withAnchors(body: ReactNode): { body: ReactNode; toc: { id: string; label: string }[] } {
  const toc: { id: string; label: string }[] = [];
  const nodes = isValidElement(body) && (body as El).props.children !== undefined && typeof body.type !== "string"
    ? (body as El).props.children
    : body;
  const out = Children.map(nodes, (child) => {
    if (isValidElement(child) && child.type === "h2") {
      const id = `section-${toc.length + 1}`;
      toc.push({ id, label: textOf((child as El).props.children) });
      return cloneElement(child as El, { id });
    }
    return child;
  });
  return { body: out, toc };
}

/**
 * Shared layout for /terms, /privacy, /disclaimers, on the v2 inner
 * page kit: the hero (crumb back home, kicker, h1, the one line intro,
 * the last updated date) and the text with a contents list (sticky on
 * desktop, folded on phones).
 *
 * Client component so the Hindi toggle swaps the whole body; still
 * server rendered, so every word, h1 and h2 is in the static HTML.
 * The legal wording lives in each page file and is rendered as is.
 */
export default function LegalPage({ kicker, title, intro, lastUpdated, en, hi }: Props) {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const q = isHi ? "" : "?lang=en";
  const { body, toc } = withAnchors(isHi ? hi : en);
  const k = isHi ? kicker.hi : kicker.en;
  const t = isHi ? title.hi : title.en;

  return (
    <InnerShell as="article">
      <PageHero
        crumbs={
          <Breadcrumb
            items={[
              {
                label: isHi ? "होम" : "Home",
                node: (
                  <a href={`/${q}`} data-ga="cta_legal_back_home" data-ga-source="legal_page">
                    {isHi ? "होम" : "Home"}
                  </a>
                ),
              },
              { label: t },
            ]}
          />
        }
        kicker={<Kicker>{k === t ? (isHi ? "नियम और नीतियाँ" : "Legal") : k}</Kicker>}
        title={title}
        lede={isHi ? intro.hi : intro.en}
        meta={
          <ChipList>
            {[
              <Chip key="u" tone="gold" icon="calendar">
                {isHi ? "अंतिम अपडेट: " : "Last updated: "}
                {lastUpdated}
              </Chip>,
            ]}
          </ChipList>
        }
      />
      <section className="bmi-sec tight bmi-legal" aria-label={t}>
        <div className="bmi-wrap">
          <ProseDoc toc={toc} tocTitle={isHi ? "इस पेज पर" : "On this page"} lang={isHi ? "hi" : "en"}>
            {body}
          </ProseDoc>
        </div>
      </section>
    </InnerShell>
  );
}
