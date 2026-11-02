"use client";

import { strings } from "@/content/strings";
import { TEMPLES, type Temple } from "@/content/temples";
import type { BhandaraListItem } from "@/types/bhandara";
import { useLocaleFromContext } from "@/lib/locale-context";
import { templeTallArt } from "@/components/TemplesView";
import {
  Actions,
  BhandaraRow,
  Breadcrumb,
  Button,
  EmptyState,
  Heading,
  InfoList,
  InfoRow,
  InnerShell,
  Kicker,
  KickSep,
  ListRow,
  PageHero,
  Prose,
  RowList,
  Section,
} from "@/components/v2";

/**
 * /resources/temples/[slug] body (v2 inner page kit). Client component
 * so every label swaps on the Hindi toggle; still server rendered, so
 * the h1, the two h2s, the history and every link are in the static
 * HTML.
 *
 * The server wrapper owns the Prisma read for `nearby` (public list
 * shape, no phones), the PlaceOfWorship JSON-LD and the metadata.
 *
 * SEO: the h1 (the temple's Devanagari name, in both languages), the
 * h2s ("How this temple came to be", "Bhandaras in <area>") and every
 * href are the same as before the redesign.
 */
/** Display only: ranges read "5:00 AM to 12:00 PM". The content (and
 *  the JSON-LD built from it) keeps its strings. */
const noDash = (s: string) => s.replace(/\s*[\u2013\u2014]\s*/g, " to ");

type Props = {
  temple: Temple;
  nearby: BhandaraListItem[];
};

export default function TempleDetailView({ temple, nearby }: Props) {
  const locale = useLocaleFromContext();
  const t = strings[locale];
  const isHi = locale === "hi";
  const langSuffix = locale === "en" ? "?lang=en" : "";
  const area = t.areas[temple.area as keyof typeof t.areas] ?? temple.area;
  const art = templeTallArt(temple);

  const mapsLink = `https://www.google.com/maps/dir/?api=1&destination=${temple.lat},${temple.lng}`;
  const others = TEMPLES.filter((x) => x.slug !== temple.slug);

  return (
    <InnerShell as="article">
      <PageHero
        crumbs={
          <Breadcrumb
            items={[
              { label: isHi ? "होम" : "Home", href: `/${langSuffix}` },
              { label: isHi ? "सभी मंदिर" : "All temples", href: `/resources/temples${langSuffix}` },
              { label: isHi ? temple.name.hi : temple.name.en },
            ]}
          />
        }
        kicker={
          <Kicker>
            <span>{area}</span>
            <KickSep />
            <span>{isHi ? "लखनऊ" : "Lucknow"}</span>
          </Kicker>
        }
        heading={<Heading as="h1" en={temple.name.hi} hi={temple.name.hi} />}
        lede={
          isHi ? undefined : (
            <>
              <strong>{temple.name.en}</strong>
              {temple.altName ? <> · {temple.altName}</> : null}
            </>
          )
        }
        actions={
          <Actions split>
            <Button href={mapsLink} external icon="pin">
              {t.cta.getDirections}
            </Button>
            {temple.phone ? (
              <Button variant="secondary" href={`tel:${temple.phone}`} icon="phone">
                {isHi ? "कॉल करें" : "Call"}
              </Button>
            ) : null}
          </Actions>
        }
        art={
          art ? (
            <figure className="bmi-arch-fig" data-rv>
              <span className="bmi-arch big">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={art}
                  alt={isHi ? `${temple.name.hi} का चित्र` : `Painting of ${temple.name.en}, ${area}, Lucknow`}
                  width={1200}
                  height={1800}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
              </span>
            </figure>
          ) : undefined
        }
      />

      {/* The visit, as facts on hairlines. */}
      <Section tight id="visit">
        <InfoList>
          <InfoRow label={t.resources.temples.addressLabel} icon="pin">
            <span className="big">{isHi ? temple.address.hi : temple.address.en}</span>
          </InfoRow>
          <InfoRow label={t.resources.temples.timingsLabel} icon="clock">
            {noDash(isHi ? temple.timings.hi : temple.timings.en)}
          </InfoRow>
          <InfoRow label={t.resources.temples.tuesdayLabel} icon="calendar">
            {isHi ? temple.badaMangal.hi : temple.badaMangal.en}
          </InfoRow>
          <InfoRow label={isHi ? "मंगलवार भीड़" : "Tuesday crowd"} icon="user">
            {isHi ? temple.tuesdayCrowd.hi : temple.tuesdayCrowd.en}
          </InfoRow>
          {temple.notes ? (
            <InfoRow label={isHi ? "ध्यान दें" : "Good to know"} icon="landmark">
              {isHi ? temple.notes.hi : temple.notes.en}
            </InfoRow>
          ) : null}
        </InfoList>
      </Section>

      <Section
        id="history"
        kicker={<Kicker>{t.resources.temples.historyLabel}</Kicker>}
        title={{ en: "How this temple came to be", hi: "मंदिर का इतिहास" }}
      >
        <Prose lang={isHi ? "hi" : "en"} className="bmi-temple-history">
          <p>{isHi ? temple.history.hi : temple.history.en}</p>
        </Prose>
      </Section>

      <Section
        id="nearby"
        kicker={<Kicker>{t.resources.temples.nearbyLabel}</Kicker>}
        title={{ en: `Bhandaras in ${temple.area}`, hi: `${area} के भंडारे` }}
      >
        {nearby.length > 0 ? (
          <RowList cols>
            {nearby.map((b) => (
              <BhandaraRow key={b.id} b={b} />
            ))}
          </RowList>
        ) : (
          <EmptyState
            lede={t.resources.temples.nearbyEmpty}
            actions={
              <Actions>
                <Button variant="secondary" href={`/list-bhandara${langSuffix}`} icon="plus">
                  {isHi ? "भंडारा लिस्ट करें" : "List a bhandara"}
                </Button>
              </Actions>
            }
          />
        )}
      </Section>

      {/* The other temples, so a reader can walk the city. */}
      <Section id="more-temples" kicker={<Kicker>{isHi ? "और मंदिर" : "More temples"}</Kicker>}>
        <RowList cols>
          {others.map((o) => {
            const oArt = templeTallArt(o);
            return (
              <ListRow
                key={o.slug}
                href={`/resources/temples/${o.slug}${langSuffix}`}
                title={isHi ? o.name.hi : o.name.en}
                titleAs="p"
                meta={t.areas[o.area as keyof typeof t.areas] ?? o.area}
                thumb={oArt ? { src: oArt, alt: "" } : "gada"}
              />
            );
          })}
        </RowList>
      </Section>
    </InnerShell>
  );
}
