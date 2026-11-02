/**
 * Splits a heading into words (never characters: splitting Devanagari
 * by character breaks conjuncts and matras) so each word can rise in
 * on its own beat. The text stays one readable string for crawlers and
 * screen readers; the spans are presentational.
 */
export default function Words({ text }: { text: string }) {
  const parts = text.split(/(\s+)/);
  let i = 0;
  return (
    <>
      {parts.map((p, k) =>
        /^\s+$/.test(p) ? (
          p
        ) : (
          <span key={k} className="w" style={{ ["--wi" as string]: i++ }}>
            {p}
          </span>
        ),
      )}
    </>
  );
}
