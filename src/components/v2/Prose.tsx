import type { ReactNode } from "react";
import TocSpy from "./TocSpy";

/**
 * Long-form text: history, guides, FAQ answers, terms, devotional
 * texts. Reading width, Mukta at 18px, Devanagari at line-height 1.85
 * so matras never touch. h2 and h3 inside are styled (and get
 * scroll-margin for anchor links); lists get gold dots; blockquote a
 * gold rule; wrap a wide <table> in <div className="tw">.
 *
 *   <Prose>{paragraphs}</Prose>
 *   <Prose variant="verse" lang="hi">{verses}</Prose>   // chalisa, aarti
 *
 * In `verse`, each <p> is a verse: optional <span className="num">
 * (verse number) and <span className="tr"> (one quiet translation line,
 * only on the English page).
 */
export default function Prose({
  children,
  variant,
  lang,
  className = "",
  id,
}: {
  children: ReactNode;
  variant?: "verse";
  lang?: string;
  className?: string;
  id?: string;
}) {
  return (
    <div id={id} className={`bmi-prose ${variant ?? ""} ${className}`.replace(/\s+/g, " ").trim()} lang={lang}>
      {children}
    </div>
  );
}

/**
 * Prose with a table of contents (legal pages, long guides). Desktop:
 * a sticky contents column that marks the section in view. Phones: a
 * folded "On this page" list above the text. The ids must match the
 * h2 ids inside `children`.
 */
export function ProseDoc({
  toc,
  tocTitle = "On this page",
  children,
  lang,
}: {
  toc: { id: string; label: ReactNode }[];
  tocTitle?: ReactNode;
  children: ReactNode;
  lang?: string;
}) {
  const list = (
    <ol>
      {toc.map((t) => (
        <li key={t.id}>
          <a href={`#${t.id}`} data-toc={t.id}>
            {t.label}
          </a>
        </li>
      ))}
    </ol>
  );
  return (
    <div className="bmi-doc">
      <nav className="bmi-toc" aria-label="Contents">
        <details>
          <summary>{tocTitle}</summary>
          {list}
        </details>
        <div className="bmi-toc-d">
          <p>{tocTitle}</p>
          {list}
        </div>
        <TocSpy ids={toc.map((t) => t.id)} />
      </nav>
      <Prose lang={lang}>{children}</Prose>
    </div>
  );
}
