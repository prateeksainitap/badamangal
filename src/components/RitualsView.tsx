"use client";

import { strings } from "@/content/strings";
import { RITUALS } from "@/content/rituals";
import { useLocaleFromContext } from "@/lib/locale-context";
import {
  Breadcrumb,
  InnerShell,
  Kicker,
  LinkRow,
  PageHero,
  Plate,
  ProseDoc,
  Section,
} from "@/components/v2";

/**
 * /resources/rituals body (v2 inner page kit). Client component so
 * every label swaps on the Hindi toggle; still server rendered, so the
 * h1, the five section h2s and every line are in the static HTML (the
 * FAQ JSON-LD in the server wrapper reads the same content).
 *
 * A guide with a contents column on desktop (folded list on phones),
 * gada pins as bullets, the painted eight-fold mandala as the hero art.
 *
 * SEO: the h1, the five h2s and every href are the same as before.
 */

/** Stable anchor for a ritual section, from its English heading. */
const anchor = (en: string) =>
  en
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Display only: "200 to 500 plates". The FAQ JSON-LD keeps the
 *  content's own strings. */
const noDash = (s: string) => s.replace(/\s*[\u2013\u2014]\s*/g, " to ");

export default function RitualsView() {
  const locale = useLocaleFromContext();
  const t = strings[locale];
  const isHi = locale === "hi";
  const langSuffix = locale === "en" ? "?lang=en" : "";

  return (
    <InnerShell>
      <PageHero
        crumbs={
          <Breadcrumb
            items={[
              { label: isHi ? "होम" : "Home", href: `/${langSuffix}` },
              { label: isHi ? "संसाधन" : "Resources", href: `/resources${langSuffix}` },
              { label: t.resources.rituals.heading },
            ]}
          />
        }
        kicker={<Kicker>{t.resources.rituals.kicker}</Kicker>}
        title={{ en: strings.en.resources.rituals.heading, hi: strings.hi.resources.rituals.heading }}
        lede={t.resources.rituals.intro}
        art={
          <div className="bmi-rit-art">
            <Plate src="/illustrations/eight-mandala.webp" width={1600} height={901} alt="" fade="edges" priority />
          </div>
        }
      />

      <Section tight id="guide">
        <ProseDoc
          lang={isHi ? "hi" : "en"}
          tocTitle={isHi ? "इस पन्ने पर" : "On this page"}
          toc={RITUALS.map((s) => ({ id: anchor(s.heading.en), label: isHi ? s.heading.hi : s.heading.en }))}
        >
          {RITUALS.map((section, idx) => (
            <section key={idx} className="bmi-rit-sec" aria-labelledby={anchor(section.heading.en)}>
              <p className="bmi-rit-num" aria-hidden>
                {String(idx + 1).padStart(2, "0")}
              </p>
              <h2 id={anchor(section.heading.en)}>{isHi ? section.heading.hi : section.heading.en}</h2>
              <ul className="bmi-gada-list">
                {(isHi ? section.body.hi : section.body.en).map((line, i) => (
                  <li key={i}>{noDash(line)}</li>
                ))}
              </ul>
            </section>
          ))}
        </ProseDoc>
      </Section>

      <Section id="next" kicker={<Kicker>{isHi ? "आगे" : "Next"}</Kicker>}>
        <LinkRow
          items={[
            { href: `/${langSuffix}#map`, label: t.cta.findBhandara },
            { href: `/list-bhandara${langSuffix}`, label: t.cta.listBhandara },
          ]}
        />
      </Section>
    </InnerShell>
  );
}
