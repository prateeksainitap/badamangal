"use client";

import DevotionalPlayer from "@/components/DevotionalPlayer";
import { useT } from "@/lib/useT";
import { useLocaleFromContext } from "@/lib/locale-context";
import type { DevotionalText, DevotionalVerse } from "@/content/devotional";
import { Prose } from "@/components/v2";

export type DevotionalReaderProps = {
  text: DevotionalText;
};

/**
 * The verse stack, set in the kit's verse style (v2 inner page kit):
 * Devanagari first and largest, centred, generous leading so matras
 * never clip, a comfortable reading width. Each line of a verse is its
 * own line; a long line breaks at its comma first, so a half line
 * never strands one word. An English meaning, where one exists, sits
 * under its verse in a quieter style on the English page only.
 *
 * The player only renders when a text has its own audio. The
 * label-owned recordings were taken down on 31 Oct 2026 (main
 * 4aa37f0), so today no text shows a player.
 */
export default function DevotionalReader({ text }: DevotionalReaderProps) {
  const { t } = useT();
  const isHi = useLocaleFromContext() === "hi";

  // Map the slug to the right strings block. Each devotional text has
  // its own copy block in `t.resources`, bajrang-baan uses a camelCase
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
    <div className="bmi-reader">
      {text.audioUrl || text.audioVideoId ? (
        <DevotionalPlayer
          audioUrl={text.audioUrl}
          videoId={text.audioVideoId}
          title={text.titleEn}
          titleHi={text.titleHi}
          sourceCaption={sourceCaption}
        />
      ) : null}

      {isVerifying ? (
        <VerifyingBlock />
      ) : (
        <Prose variant="verse" lang="hi" className="bmi-verses">
          {text.verses.map((v, i) => (
            <VerseRow key={i} verse={v} showMeaning={!isHi} />
          ))}
        </Prose>
      )}
    </div>
  );
}

function VerifyingBlock() {
  const { t } = useT();
  return (
    <div role="note" className="bmi-empty">
      <p className="bmi-kick">{t.resources.common.verifyingText}</p>
      <p className="bmi-lede">{t.resources.common.verifyingNote}</p>
    </div>
  );
}

/** One line of a verse. A line with a comma splits there into two
 *  halves that wrap as units on a narrow screen. */
function VerseLine({ line }: { line: string }) {
  const at = line.indexOf(", ");
  if (at < 0 || at > line.length - 6) return <span className="vl">{line}</span>;
  return (
    <span className="vl">
      <span className="vh">{line.slice(0, at + 1)}</span>{" "}
      <span className="vh">{line.slice(at + 2)}</span>
    </span>
  );
}

function VerseRow({ verse, showMeaning }: { verse: DevotionalVerse; showMeaning: boolean }) {
  const isDoha = /दोहा|सोरठा/.test(verse.num);
  return (
    <p className={isDoha ? "doha" : undefined}>
      <span className="num">{verse.num}</span>
      {verse.deva.split("\n").map((line, j) => (
        <VerseLine key={j} line={line} />
      ))}
      {showMeaning && verse.en ? (
        <span className="tr" lang="en">
          {verse.en}
        </span>
      ) : null}
    </p>
  );
}
