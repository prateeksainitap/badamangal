"use client";

import Link from "next/link";
import { strings } from "@/content/strings";
import { TEMPLES, type Temple } from "@/content/temples";
import { useLocaleFromContext } from "@/lib/locale-context";
import {
  Band,
  Breadcrumb,
  Button,
  Actions,
  Heading,
  InnerShell,
  Kicker,
  KickSep,
  PageHero,
  Section,
} from "@/components/v2";

/**
 * /resources/temples directory body (v2 inner page kit). Client
 * component so every label swaps on the Hindi toggle; still server
 * rendered, so the h1, every temple's h2 and every link are in the
 * static HTML.
 *
 * Each temple is one editorial row: its painted plate in the
 * homepage's mandir arch, then area, name (h2), one line and the link.
 * Rows alternate sides on desktop so five temples never read as a
 * stack of identical cards.
 *
 * SEO: the h1, the five h2 names, the closing h2 and every href are
 * the same as before the redesign.
 */

/** The tall (2:3) painting for a temple. Content keeps the wide plate
 *  path; the tall plate sits beside it without the "-wide" suffix. */
export function templeTallArt(temple: Temple): string | null {
  if (!temple.imagePath) return null;
  return temple.imagePath.replace(/-wide\.webp$/, ".webp");
}

export default function TemplesView({ missingImages = [] }: { missingImages?: string[] }) {
  const locale = useLocaleFromContext();
  const t = strings[locale];
  const isHi = locale === "hi";
  const langSuffix = locale === "en" ? "?lang=en" : "";

  return (
    <InnerShell>
      <PageHero
        align="center"
        crumbs={
          <Breadcrumb
            items={[
              { label: isHi ? "होम" : "Home", href: `/${langSuffix}` },
              { label: isHi ? "संसाधन" : "Resources", href: `/resources${langSuffix}` },
              { label: isHi ? "मंदिर" : "Temples" },
            ]}
          />
        }
        kicker={<Kicker>{t.resources.temples.directoryKicker}</Kicker>}
        title={{ en: strings.en.resources.temples.directoryHeading, hi: strings.hi.resources.temples.directoryHeading }}
        lede={t.resources.temples.directoryBody}
      />

      <Section tight id="temples" className="bmi-temples-sec">
        <ol className="bmi-temples">
          {TEMPLES.map((temple, i) => {
            const href = `/resources/temples/${temple.slug}${langSuffix}`;
            const art = !missingImages.includes(temple.slug) ? templeTallArt(temple) : null;
            const name = isHi ? temple.name.hi : temple.name.en;
            const area = t.areas[temple.area as keyof typeof t.areas] ?? temple.area;
            return (
              <li key={temple.slug} className="bmi-temple">
                <Link href={href} prefetch={false} className="bmi-temple-art" tabIndex={-1} aria-hidden>
                  <span className="bmi-arch">
                    {art ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={art}
                        alt=""
                        width={1200}
                        height={1800}
                        loading={i < 2 ? "eager" : "lazy"}
                        decoding="async"
                      />
                    ) : (
                      <span className="bmi-arch-empty">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/brand/map-pin-gada.svg" alt="" width={56} height={56} />
                      </span>
                    )}
                  </span>
                </Link>
                <div className="bmi-temple-copy" data-rv>
                  <p className="bmi-temple-num" aria-hidden>
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <Kicker>
                    <span>{area}</span>
                    {!isHi && temple.altName ? (
                      <>
                        <KickSep />
                        <span>{temple.altName}</span>
                      </>
                    ) : null}
                  </Kicker>
                  <Heading as="h2" lang={isHi ? "hi" : "en"}>
                    <Link href={href} prefetch={false} aria-label={name}>
                      {name}
                    </Link>
                  </Heading>
                  <p className="bmi-lede">{isHi ? temple.badaMangal.hi : temple.badaMangal.en}</p>
                  <Actions>
                    <Button variant="text" href={href}>
                      {isHi ? "विवरण देखें" : "View details"}
                    </Button>
                  </Actions>
                </div>
              </li>
            );
          })}
        </ol>
      </Section>

      <Band
        id="more-temples"
        kicker={<Kicker>{isHi ? "अधिक मंदिर" : "More temples"}</Kicker>}
        title={{
          en: "Help us list your neighbourhood Hanuman temple.",
          hi: "अपने मोहल्ले का हनुमान मंदिर सूचीबद्ध कराएँ।",
        }}
        lede={
          isHi
            ? "हम धीरे-धीरे लखनऊ के सभी हनुमान मंदिरों की सूची बना रहे हैं। आप मदद कर सकते हैं।"
            : "We're slowly cataloguing every Hanuman temple in Lucknow. You can help."
        }
        actions={
          <Actions>
            <Button variant="secondary" href={`/list-bhandara${langSuffix}`} icon="plus">
              {isHi ? "सहयोग करें" : "Suggest a temple"}
            </Button>
          </Actions>
        }
      />
    </InnerShell>
  );
}
