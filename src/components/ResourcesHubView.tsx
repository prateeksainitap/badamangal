"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { strings } from "@/content/strings";
import { FAQ_ITEMS } from "@/content/faq";
import { NEWS, type NewsEntry } from "@/content/news";
import { TEMPLES } from "@/content/temples";
import { HOME_ART } from "@/content/home-art";
import { useLocaleFromContext } from "@/lib/locale-context";
import { templeTallArt } from "@/components/TemplesView";
import {
  Actions,
  Breadcrumb,
  Button,
  FaqList,
  InnerShell,
  Kicker,
  ListRow,
  PageHero,
  Plate,
  Prose,
  RowList,
  Section,
} from "@/components/v2";

/**
 * /resources hub body (v2 inner page kit). Client component so every
 * label swaps on the Hindi toggle; still server rendered, so the h1,
 * the h2s and every link are in the static HTML. The CollectionPage
 * JSON-LD stays in the server wrapper.
 *
 * The texts are hairline rows (their titles stay the page's h2s), the
 * news keeps its featured story and three more, the FAQ teaser is the
 * kit's disclosure list, and the temples show in the homepage's arches.
 *
 * No audio: the label-owned recordings came down on 31 Oct 2026, so no
 * row says "listen" any more.
 */
export default function ResourcesHubView() {
  const locale = useLocaleFromContext();
  const t = strings[locale];
  const isHi = locale === "hi";
  const langSuffix = locale === "en" ? "?lang=en" : "";

  const texts: Array<{
    href: string;
    title: string;
    kicker: string;
    body: string;
  }> = [
    { href: `/resources/chalisa${langSuffix}`, title: t.resources.cards.chalisa.title, kicker: t.resources.chalisa.kicker, body: t.resources.cards.chalisa.body },
    { href: `/resources/aarti${langSuffix}`, title: t.resources.cards.aarti.title, kicker: t.resources.aarti.kicker, body: t.resources.cards.aarti.body },
    { href: `/resources/ashtak${langSuffix}`, title: t.resources.cards.ashtak.title, kicker: t.resources.ashtak.kicker, body: t.resources.cards.ashtak.body },
    { href: `/resources/bajrang-baan${langSuffix}`, title: t.resources.cards.bajrangBaan.title, kicker: t.resources.bajrangBaan.kicker, body: t.resources.cards.bajrangBaan.body },
    { href: `/resources/ram-stuti${langSuffix}`, title: t.resources.cards.ramStuti.title, kicker: t.resources.ramStuti.kicker, body: t.resources.cards.ramStuti.body },
    // News stays out of the texts list; it has its own band below.
    { href: `/resources/rituals${langSuffix}`, title: t.resources.cards.rituals.title, kicker: t.resources.rituals.kicker, body: t.resources.cards.rituals.body },
  ];

  // Top 3 FAQ items as a teaser that links out to the full /faq page.
  const teaserFaqs = FAQ_ITEMS.slice(0, 3);

  // The featured story (or the most recent) plus the next three.
  const sortedNews = [...NEWS].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const featuredNews: NewsEntry | undefined = sortedNews.find((n) => n.featured) ?? sortedNews[0];
  const secondaryNews = sortedNews.filter((n) => n.id !== featuredNews?.id).slice(0, 3);

  return (
    <InnerShell>
      <PageHero
        crumbs={
          <Breadcrumb
            items={[
              { label: isHi ? "होम" : "Home", href: `/${langSuffix}` },
              { label: isHi ? "संसाधन" : "Resources" },
            ]}
          />
        }
        kicker={<Kicker>{t.resources.hubKicker}</Kicker>}
        title={{ en: strings.en.resources.hubHeading, hi: strings.hi.resources.hubHeading }}
        lede={t.resources.hubBody}
        actions={
          <Actions>
            <Button href={`/resources/chalisa${langSuffix}`} iconEnd="chevron">
              {t.resources.cards.chalisa.cta}
            </Button>
          </Actions>
        }
        art={
          <div className="bmi-res-hero-art">
            <Plate {...HOME_ART.hanumanSitting} alt="" fade="none" priority />
          </div>
        }
      />

      {/* The texts. Each title stays an h2 (SEO), set as a row. */}
      <Section tight id="texts" kicker={<Kicker>{isHi ? "पाठ और विधि" : "Texts and guides"}</Kicker>}>
        <RowList cols>
          {texts.map((x) => (
            <ListRow
              key={x.href}
              href={x.href}
              title={x.title}
              titleAs="h2"
              kicker={x.kicker}
              meta={x.body}
              linkProps={{ "data-ga": "resource_card_open", "data-ga-href": x.href, "data-ga-title": x.title }}
            />
          ))}
        </RowList>
      </Section>

      {/* This week in Lucknow: the featured story and three more. */}
      {featuredNews ? (
        <Section
          id="news"
          kicker={<Kicker>{isHi ? "संपादक चयन" : "Editor's pick"}</Kicker>}
          title={{ en: strings.en.resources.cards.news.title, hi: strings.hi.resources.cards.news.title }}
          action={
            <Button variant="text" href={`/resources/news${langSuffix}`} data-ga="resource_news_view_all">
              {isHi ? "सभी ख़बरें देखें" : "View all news"}
            </Button>
          }
        >
          <div className="bmi-split bmi-res-news">
            <a
              href={featuredNews.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bmi-res-feat"
              data-ga="resource_news_open"
              data-ga-id={featuredNews.id}
              data-ga-source={featuredNews.source}
              data-ga-featured="1"
              data-rv
            >
              <NewsImage src={featuredNews.image} source={featuredNews.source} width={1200} />
              <span className="bmi-row-kick">
                {isHi ? "प्रमुख ख़बर" : "Featured"} · {featuredNews.source}
              </span>
              <h3 className="bmi-res-feat-t" lang={isHi && featuredNews.headlineHi ? "hi" : undefined}>
                {isHi ? (featuredNews.headlineHi ?? featuredNews.headline) : featuredNews.headline}
              </h3>
              <p className="bmi-res-feat-x">
                {isHi ? (featuredNews.excerptHi ?? featuredNews.excerpt) : featuredNews.excerpt}
              </p>
              <span className="bmi-tl inline">
                {isHi ? "स्रोत पर पढ़ें" : "Read on source"}
              </span>
            </a>
            <RowList>
              {secondaryNews.map((n) => (
                <ListRow
                  key={n.id}
                  href={n.url}
                  external
                  kicker={n.source}
                  title={isHi ? (n.headlineHi ?? n.headline) : n.headline}
                  thumb={n.image ? { src: proxiedNewsImage(n.image, 240), alt: "" } : "gada"}
                  linkProps={{ "data-ga": "resource_news_open", "data-ga-id": n.id, "data-ga-source": n.source }}
                />
              ))}
            </RowList>
          </div>
        </Section>
      ) : null}

      {/* FAQ teaser: three questions, the rest on /faq. */}
      <Section
        id="faq"
        className="bmi-res-faq-sec"
        kicker={<Kicker>{isHi ? "पूछे जाने वाले प्रश्न" : "Frequently asked"}</Kicker>}
        title={{ en: "Common questions about Bada Mangal", hi: "बड़े मंगल के बारे में आम सवाल" }}
        action={
          <Button variant="text" href={langSuffix === "" ? "/faq" : `/faq${langSuffix}`}>
            {isHi ? "सभी FAQ देखें" : "View all FAQs"}
          </Button>
        }
      >
        <div className="bmi-res-faq">
        <FaqList
          lang={isHi ? "hi" : "en"}
          items={teaserFaqs.map((f) => ({ id: f.id, q: isHi ? f.questionHi : f.questionEn, a: isHi ? f.answerHi : f.answerEn }))}
        />
        </div>
      </Section>

      {/* The temples, in the homepage's arches. */}
      <Section
        id="temples"
        kicker={<Kicker>{isHi ? "मंदिर निर्देशिका" : "Temples directory"}</Kicker>}
        title={{ en: strings.en.resources.cards.temples.title, hi: strings.hi.resources.cards.temples.title }}
        lede={t.resources.cards.temples.body}
        action={
          <Button variant="text" href={`/resources/temples${langSuffix}`}>
            {t.resources.cards.temples.cta}
          </Button>
        }
      >
        <ul className="bmi-arches" data-rv>
          {TEMPLES.map((temple) => {
            const art = templeTallArt(temple);
            const area = t.areas[temple.area as keyof typeof t.areas] ?? temple.area;
            return (
              <li key={temple.slug}>
                <Link href={`/resources/temples/${temple.slug}${langSuffix}`} prefetch={false} className="bmi-arches-a">
                  <span className="bmi-arch">
                    {art ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={art} alt="" width={1200} height={1800} loading="lazy" decoding="async" />
                    ) : null}
                  </span>
                  <b lang={isHi ? "hi" : undefined}>{isHi ? temple.name.hi : temple.name.en}</b>
                  <small>{area}</small>
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* Why this hub exists. */}
      <Section
        id="about"
        narrow
        center
        kicker={
          <Kicker>
            <span>{isHi ? "इस संग्रह के बारे में" : "About this hub"}</span>
          </Kicker>
        }
        title={{ en: "Reverent text. Verified sources.", hi: "श्रद्धेय पाठ; सत्यापित स्रोत।" }}
      >
        <Prose lang={isHi ? "hi" : "en"} className="bmi-res-about">
          <p>
            {isHi
              ? "जो जानकारी अभी सत्यापन में है, उसे हम स्पष्ट रूप से ‘सत्यापन प्रतीक्षाधीन’ कहकर दिखाते हैं।"
              : "Anything still being verified is clearly marked “Text being verified”. We won't paraphrase devotional text."}
          </p>
        </Prose>
      </Section>
    </InnerShell>
  );
}

/**
 * Route news thumbnails through the weserv.nl image proxy: it strips
 * the Referer (publisher hot-link blocks) and re-encodes to webp.
 */
function proxiedNewsImage(src: string, width: number): string {
  if (!src) return "";
  const target = src.replace(/^https?:\/\//, "");
  return `https://images.weserv.nl/?url=${encodeURIComponent(target)}&w=${width}&we&output=webp`;
}

/** The featured story's photo. If the publisher's image is gone (it
 *  happens), a painted old Lucknow street stands in, never a broken
 *  box. The check also runs after hydration, because an image that
 *  failed before React attached would never fire onError. */
function NewsImage({ src, width }: { src: string; source: string; width: number }) {
  const [failed, setFailed] = useState(!src);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  return (
    <span className="bmi-res-feat-img">
      {failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={HOME_ART.oldLucknowBand.src} alt="" loading="lazy" decoding="async" className="fallback" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={ref}
          src={proxiedNewsImage(src, width)}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
