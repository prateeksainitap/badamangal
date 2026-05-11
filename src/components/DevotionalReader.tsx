"use client";

import DevotionalPlayer from "@/components/DevotionalPlayer";
import { useT } from "@/lib/useT";
import type { DevotionalText, DevotionalVerse } from "@/content/devotional";

export type DevotionalReaderProps = {
  text: DevotionalText;
};

/**
 * Renders the player surface plus the verse stack. The Roman + English
 * language toggle has been removed — verses always render in Devanagari,
 * which keeps the page focused on the original text and matches the
 * audio recordings.
 */
export default function DevotionalReader({ text }: DevotionalReaderProps) {
  const { t } = useT();

  // Map the slug to the right strings block. Each devotional text has
  // its own copy block in `t.resources` — bajrang-baan uses a camelCase
  // key (`bajrangBaan`) since slugs aren't valid object-property syntax.
  const sourceCaption = (() => {
    switch (text.slug) {
      case "chalisa":
        return t.resources.chalisa.sourceCaption;
      case "aarti":
        return t.resources.aarti.sourceCaption;
      case "ashtak":
        return t.resources.ashtak.sourceCaption;
      case "bajrang-baan":
        return t.resources.bajrangBaan.sourceCaption;
      case "ram-stuti":
        return t.resources.ramStuti.sourceCaption;
    }
  })();

  // While the canonical text is being verified, every verse renders as a
  // single placeholder block on the page (we don't repeat 40 empty boxes).
  // A verse counts as "empty" if its deva field is missing, the legacy
  // `","` placeholder, or an empty string.
  const isVerifying = text.verses.every(
    (v) => !v.deva || v.deva === "," || v.deva.trim() === "",
  );

  return (
    <div className="space-y-10">
      <DevotionalPlayer
        audioUrl={text.audioUrl}
        videoId={text.audioVideoId}
        title={text.titleEn}
        titleHi={text.titleHi}
        sourceCaption={sourceCaption}
      />

      {isVerifying ? (
        <VerifyingBlock />
      ) : (
        <ol className="space-y-3">
          {text.verses.map((v, i) => (
            <VerseRow key={i} verse={v} />
          ))}
        </ol>
      )}
    </div>
  );
}

function VerifyingBlock() {
  const { t } = useT();
  return (
    <section
      role="note"
      className="rounded-3xl border-2 border-dashed border-gold-500/60 bg-saffron-50 px-6 py-8 sm:px-10 sm:py-10"
    >
      <p className="font-mukta uppercase tracking-[0.32em] text-saffron-600 text-[0.65rem]">
        {t.resources.common.verifyingText}
      </p>
      <p className="mt-3 font-fraunces italic text-ink-900/85 leading-relaxed text-lg max-w-3xl">
        {t.resources.common.verifyingNote}
      </p>
    </section>
  );
}

function VerseRow({ verse }: { verse: DevotionalVerse }) {
  return (
    <li className="grid gap-4 sm:grid-cols-[auto_1fr] items-start rounded-2xl border border-gold-500/30 bg-white px-5 py-4">
      {/* Verse number — uses font-deva because verse numbers are now in
          Devanagari numerals (१, २, ३ …). `font-numerals` is for Latin
          digits in countdown / stats UIs. */}
      <p className="font-deva font-bold text-saffron-600 text-lg sm:w-20 leading-snug">
        {verse.num}
      </p>
      {/* `whitespace-pre-line` preserves \n line breaks in the verse
          string so chaupais render as two lines, dohas as two lines,
          ashtakas as four lines, etc., without us having to split on
          \n in JSX. `lang="hi"` triggers the right font fallback for
          Devanagari conjuncts. */}
      <p
        lang="hi"
        className="font-deva text-lg leading-relaxed text-ink-900 whitespace-pre-line"
      >
        {verse.deva}
      </p>
    </li>
  );
}
