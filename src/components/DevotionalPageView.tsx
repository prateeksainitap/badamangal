"use client";

import { strings } from "@/content/strings";
import type { DevotionalSlug, DevotionalText } from "@/content/devotional";
import { HOME_ART, type ArtPlate } from "@/content/home-art";
import DevotionalReader from "@/components/DevotionalReader";
import { useLocaleFromContext } from "@/lib/locale-context";
import {
  Actions,
  Breadcrumb,
  Button,
  Heading,
  InnerShell,
  Kicker,
  LinkRow,
  PageHero,
  Plate,
  Prose,
  Section,
} from "@/components/v2";

/**
 * Shared page body for the five canonical-text resource pages
 * (Chalisa, Aarti, Ashtak, Bajrang Baan, Ram Stuti), on the v2 inner
 * page kit. Client component so every label swaps on the Hindi toggle;
 * still server rendered, so the h1, every verse and every link are in
 * the static HTML. The five page.tsx files stay thin server wrappers
 * (metadata and JSON-LD only).
 *
 * The text is the hero: a short head (kicker, the Devanagari title as
 * the h1 in both languages, one line), a painted darshan beside it,
 * then the verses in the kit's verse style.
 *
 * SEO: the h1 is the Devanagari title, exactly as before.
 */
type Kicker =
  | "chalisa"
  | "aarti"
  | "ashtak"
  | "bajrangBaan"
  | "ramStuti";

type Props = {
  text: DevotionalText;
  /** Which `strings.resources.<key>` entry powers the kicker + body
   *  copy at the top of the page. */
  kickerKey: Kicker;
  /** Locale-aware author/era footer line ("By Tulsidas · era",
   *  "Traditional · era"). */
  footer: { en: string; hi: string };
};

/** The painted darshan beside each text (existing set only). */
const ART: Record<DevotionalSlug, ArtPlate> = {
  chalisa: HOME_ART.hanumanSitting,
  aarti: HOME_ART.hanumanStanding,
  ashtak: HOME_ART.hanumanSitting,
  "bajrang-baan": HOME_ART.hanumanStanding,
  "ram-stuti": HOME_ART.hanumanSitting,
};

const SIBLINGS: { slug: DevotionalSlug | "rituals"; key: "chalisa" | "aarti" | "ashtak" | "bajrangBaan" | "ramStuti" | "rituals" }[] = [
  { slug: "chalisa", key: "chalisa" },
  { slug: "aarti", key: "aarti" },
  { slug: "ashtak", key: "ashtak" },
  { slug: "bajrang-baan", key: "bajrangBaan" },
  { slug: "ram-stuti", key: "ramStuti" },
  { slug: "rituals", key: "rituals" },
];

export default function DevotionalPageView({ text, kickerKey, footer }: Props) {
  const locale = useLocaleFromContext();
  const t = strings[locale];
  const isHi = locale === "hi";
  const langSuffix = locale === "en" ? "?lang=en" : "";
  const kicker = t.resources[kickerKey];
  const art = ART[text.slug];
  const siblings = SIBLINGS.filter((s) => s.slug !== text.slug).slice(0, 4);

  return (
    <InnerShell as="article">
      <PageHero
        crumbs={
          <Breadcrumb
            items={[
              { label: isHi ? "होम" : "Home", href: `/${langSuffix}` },
              { label: isHi ? "संसाधन" : "Resources", href: `/resources${langSuffix}` },
              { label: isHi ? text.titleHi : text.titleEn },
            ]}
          />
        }
        kicker={<Kicker>{kicker.kicker}</Kicker>}
        heading={<Heading as="h1" en={text.titleHi} hi={text.titleHi} />}
        lede={kicker.body}
        actions={
          <Actions>
            <Button href="#path" iconEnd="chevron">
              {isHi ? "पाठ शुरू करें" : "Start reading"}
            </Button>
          </Actions>
        }
        art={
          <div className="bmi-dev-art">
            <Plate {...art} alt="" fade="none" priority />
          </div>
        }
      />

      {/* The text. Anchor `path` so "Start reading" lands on verse one. */}
      <Section tight id="path" className="bmi-dev-text">
        <DevotionalReader text={text} />
      </Section>

      <Section narrow center id="note" kicker={<Kicker>{isHi ? "संपादक की टिप्पणी" : "Editor's note"}</Kicker>}>
        <Prose lang="en" className="bmi-dev-note">
          <p>{text.editorialNotes}</p>
        </Prose>
        <p className="bmi-fine bmi-dev-by">{isHi ? footer.hi : footer.en}</p>
      </Section>

      <Section id="more" kicker={<Kicker>{isHi ? "और पढ़ें" : "Read next"}</Kicker>}>
        <LinkRow
          items={siblings.map((s) => ({
            href: `/resources/${s.slug}${langSuffix}`,
            label: t.resources.cards[s.key].title,
          }))}
        />
      </Section>
    </InnerShell>
  );
}
