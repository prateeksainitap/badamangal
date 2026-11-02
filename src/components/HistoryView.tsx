"use client";

import {
  HISTORY,
  type Block,
  type SectionBlock,
  type OpeningBlock,
  type ClosingBlock,
  type PullQuoteBlock,
  type BannerBlock,
  type TimelineBlock,
  pickText,
  pickParas,
} from "@/content/history";
import { strings, type Locale } from "@/content/strings";
import { HOME_ART } from "@/content/home-art";
import { useLocaleFromContext } from "@/lib/locale-context";
import {
  Breadcrumb,
  Heading,
  InnerShell,
  Kicker,
  PageHero,
  Plate,
  Tile,
  TileList,
} from "@/components/v2";

/**
 * /history body (v2 inner page kit): a long-form editorial in eight
 * chapters. Client component so the whole article swaps to Hindi on
 * the toggle; still server rendered, so the h1, the eight chapter h2s
 * (with their anchor ids) and every paragraph are in the static HTML.
 * The Article JSON-LD stays in the server wrapper.
 *
 * Reading column at a comfortable measure; chapter markers with a big
 * numeral; painted plates that break wider than the text and melt into
 * the ground; one pull quote; the timeline on gada pins; a benediction.
 *
 * SEO: every word, the h1, every h2 and its id, and every href are the
 * same as before the redesign.
 */

/** Display only: ranges read "1798 to 1814", arrows go (the row has
 *  its own chevron). The content file keeps its strings. */
/** Display only: a joined pair (Ganga and Jamuni written as one word) takes a hyphen. */
const joinDash = (s: string) => s.replace(/(\S)[\u2013\u2014](\S)/g, "$1-$2");
const tidy = (s: string) => s.replace(/\s*[\u2013\u2014]\s*/g, " to ").replace(/\s*→\s*$/, "");

export default function HistoryView() {
  const locale = useLocaleFromContext();
  const t = strings[locale];
  const isHi = locale === "hi";

  return (
    <InnerShell as="article">
      <PageHero
        align="center"
        crumbs={
          <Breadcrumb
            items={[
              { label: isHi ? "होम" : "Home", href: isHi ? "/" : "/?lang=en" },
              { label: isHi ? "इतिहास" : "History" },
            ]}
          />
        }
        kicker={<Kicker>{pickText(HISTORY.hero.kicker, locale)}</Kicker>}
        heading={<Heading as="h1" en={HISTORY.hero.hindiHeadline} hi={HISTORY.hero.hindiHeadline} long />}
        lede={<span lang={isHi ? "hi" : "en"}>{pickText(HISTORY.hero.englishSubline, locale)}</span>}
      />

      {/* The old Lucknow lane, the page's opening plate. */}
      <div className="bmi-hist-open">
        <div className="bmi-wrap">
          <Plate {...HOME_ART.oldLucknowBand} alt="" fade="bottom" priority />
        </div>
      </div>

      <div className="bmi-hist" lang={isHi ? "hi" : "en"}>
        {HISTORY.blocks.map((block, idx) => (
          <div key={idx} className={`bmi-hist-b ${block.kind}`}>
            {renderBlock(block, locale)}
          </div>
        ))}
      </div>

      {/* Two ways in, after the story. Same hrefs as before. */}
      <section className="bmi-sec bmi-hist-next" aria-label={isHi ? "आगे" : "Next"}>
        <div className="bmi-wrap narrow">
          <TileList grid cols={2}>
            <Tile
              href={isHi ? "/#map" : "/?lang=en#map"}
              title={t.cta.findBhandara}
              line={tidy(pickText(HISTORY.outroCard.findBody, locale))}
            />
            <Tile
              href={isHi ? "/list-bhandara" : "/list-bhandara?lang=en"}
              title={t.cta.listBhandara}
              line={tidy(pickText(HISTORY.outroCard.listBody, locale))}
            />
          </TileList>
        </div>
      </section>
    </InnerShell>
  );
}

// ── Renderers ────────────────────────────────────────────────────────────

function renderBlock(block: Block, locale: Locale): React.ReactNode {
  switch (block.kind) {
    case "opening":
      return <Opening block={block} locale={locale} />;
    case "section":
      return <Chapter block={block} locale={locale} />;
    case "pull-quote":
      return <PullQuote block={block} locale={locale} />;
    case "banner":
      return <Banner block={block} locale={locale} />;
    case "timeline":
      return <Timeline block={block} locale={locale} />;
    case "closing":
      return <Closing block={block} locale={locale} />;
  }
}

function Opening({ block, locale }: { block: OpeningBlock; locale: Locale }) {
  return (
    <div className="bmi-wrap narrow">
      <div className={`bmi-prose bmi-hist-prose bmi-hist-lead ${locale === "en" ? "drop" : ""}`.trim()}>
        {pickParas(block.paragraphs, locale).map((p, i) => (
          <p key={i}>{joinDash(p)}</p>
        ))}
      </div>
    </div>
  );
}

function Chapter({ block, locale }: { block: SectionBlock; locale: Locale }) {
  return (
    <section id={block.id} className="bmi-hist-ch" aria-labelledby={`${block.id}-h`}>
      <div className="bmi-wrap narrow">
        <header className="bmi-hist-mark" data-rv>
          <span className="bmi-hist-n" aria-hidden>
            {String(block.number).padStart(2, "0")}
          </span>
          <span className="bmi-kick">{pickText(HISTORY.chapterLabel, locale)}</span>
        </header>
        <Heading as="h2" id={`${block.id}-h`} en={block.heading.en} hi={block.heading.hi} />
        <div className="bmi-prose bmi-hist-prose">
          {pickParas(block.paragraphs, locale).map((p, i) => (
            <p key={i}>{joinDash(p)}</p>
          ))}
        </div>
      </div>
    </section>
  );
}

function PullQuote({ block, locale }: { block: PullQuoteBlock; locale: Locale }) {
  return (
    <figure className="bmi-hist-quote" data-rv>
      <div className="bmi-wrap">
        <span className="bmi-hist-q-rule" aria-hidden />
        <blockquote lang={locale}>
          <p>{pickText(block.text, locale)}</p>
        </blockquote>
      </div>
    </figure>
  );
}

function Banner({ block, locale }: { block: BannerBlock; locale: Locale }) {
  const mandala = block.src.includes("eight-mandala");
  return (
    <figure className={`bmi-hist-plate ${mandala ? "mandala" : ""}`.trim()}>
      <div className="bmi-wrap">
        <Plate src={block.src} width={1600} height={901} alt={pickText(block.alt, locale)} fade="edges" />
        {block.caption ? <figcaption>{pickText(block.caption, locale)}</figcaption> : null}
      </div>
    </figure>
  );
}

function Timeline({ block, locale }: { block: TimelineBlock; locale: Locale }) {
  return (
    <section className="bmi-hist-tl" aria-label={pickText(block.kicker, locale)}>
      <div className="bmi-wrap">
        <p className="bmi-kick" data-rv>
          {pickText(block.kicker, locale)}
        </p>
        <ol data-rv>
          {block.markers.map((m) => (
            <li key={m.year} className={m.highlight ? "hl" : undefined}>
              <span className="pin" aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/map-pin-gada.svg" alt="" width={28} height={28} />
              </span>
              <b>{tidy(m.year)}</b>
              <span>{pickText(m.body, locale)}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Closing({ block, locale }: { block: ClosingBlock; locale: Locale }) {
  return (
    <div className="bmi-wrap narrow">
      <div className="bmi-prose bmi-hist-prose">
        {pickParas(block.paragraphs, locale).map((p, i) => (
          <p key={i}>{joinDash(p)}</p>
        ))}
      </div>
      <p className="bmi-hist-bless" lang="hi" data-rv>
        {block.benediction}
      </p>
    </div>
  );
}
