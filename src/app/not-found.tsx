"use client";

import { strings } from "@/content/strings";
import { useLocaleFromContext } from "@/lib/locale-context";
import { Actions, Button, Heading, InnerShell, Kicker, LinkRow } from "@/components/v2";

/**
 * 404 not-found page, on the v2 inner page kit. Client component so
 * the Hindi toggle flips every label; the page is rarely the LCP for
 * any journey. The painted diya (tipped over, a curl of smoke, one
 * marigold) carries the mood; the words stay short and the ways back
 * are the point: the map, home, list a bhandara, temples, resources.
 */
export default function NotFound() {
  const locale = useLocaleFromContext();
  const t = strings[locale];
  const isHi = locale === "hi";
  const langSuffix = locale === "en" ? "?lang=en" : "";

  return (
    <InnerShell as="article">
      <section className="bmi-sec bmi-lost">
        <div className="bmi-wrap narrow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="bmi-lost-art"
            src="/illustrations/error-diya.webp"
            alt={
              isHi
                ? "एक उलटी हुई मिट्टी की दिया, धुँए की लकीर और गेंदा।"
                : "A tipped-over clay diya with a curl of smoke and a marigold."
            }
            width={1200}
            height={1200}
            loading="eager"
            decoding="async"
            data-rv
          />
          <Kicker>404</Kicker>
          <Heading as="h1" en="We've lost the trail." hi="रास्ता नहीं मिला" />
          <p className="bmi-lede" data-rv>
            {isHi
              ? "जिस पते की तलाश में थे वह यहाँ मौजूद नहीं है। नीचे से किसी रास्ते पर लौट आइए।"
              : "The page you're looking for is no longer here. Pick a way back below."}
          </p>
          <Actions split>
            <Button href={`/${langSuffix}#map`} icon="map" data-ga="notfound_map">
              {t.cta.findBhandara}
            </Button>
            <Button variant="secondary" href={`/${langSuffix}`} data-ga="notfound_home">
              {isHi ? "होम पर लौटें" : "Back to home"}
            </Button>
          </Actions>
        </div>
        <div className="bmi-wrap bmi-lost-links">
          <LinkRow
            items={[
              { href: `/list-bhandara${langSuffix}`, label: isHi ? "भंडारा लिस्ट करें" : "List a bhandara" },
              { href: `/resources/temples${langSuffix}`, label: isHi ? "लखनऊ के हनुमान मंदिर" : "Hanuman temples" },
              { href: `/resources${langSuffix}`, label: t.resources.hubHeading },
            ]}
          />
        </div>
      </section>
    </InnerShell>
  );
}
