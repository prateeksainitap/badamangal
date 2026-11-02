"use client";

import { FAQ_ITEMS } from "@/content/faq";
import { HOME_ART } from "@/content/home-art";
import { useLocaleFromContext } from "@/lib/locale-context";
import {
  Actions,
  Band,
  Breadcrumb,
  Button,
  FaqList,
  InnerShell,
  Kicker,
  KickSep,
  PageHero,
  Plate,
  Section,
} from "@/components/v2";

/**
 * /faq body (v2 inner page kit). Client so every label swaps on the
 * Hindi toggle; still server rendered, so the h1, every question (h3)
 * and every answer are in the static HTML for crawlers.
 *
 * The questions and answers come from src/content/faq.ts unchanged;
 * the FAQPage JSON-LD in src/lib/seo.ts mirrors that text, so never
 * reword an answer here.
 */
export default function FaqPageView() {
  const isHi = useLocaleFromContext() === "hi";
  const q = isHi ? "" : "?lang=en";

  return (
    <InnerShell>
      <PageHero
        crumbs={
          <Breadcrumb
            items={[
              { label: isHi ? "होम" : "Home", href: "/" },
              { label: isHi ? "प्रश्न और उत्तर" : "FAQ" },
            ]}
          />
        }
        kicker={
          <Kicker>
            <span>FAQ</span>
            <KickSep />
            <span>{isHi ? "बड़ा मंगल लखनऊ" : "Bada Mangal Lucknow"}</span>
          </Kicker>
        }
        title={{
          en: "Common questions about Bada Mangal",
          hi: "बड़े मंगल के बारे में आम सवाल",
        }}
        lede={
          isHi
            ? "परंपरा, तिथियाँ, भंडारे और साइट, सब एक जगह, हिंदी और अंग्रेज़ी में।"
            : "The tradition, the dates, the bhandaras, and the site, all in one place, in English and Hindi."
        }
        art={<Plate {...HOME_ART.oldLucknowBand} alt="" fade="edges" priority />}
      />

      <Section tight id="questions">
        <div className="bmi-faq-col">
        <FaqList
          lang={isHi ? "hi" : "en"}
          items={FAQ_ITEMS.map((item) => ({
            id: item.id,
            q: isHi ? item.questionHi : item.questionEn,
            a: isHi ? item.answerHi : item.answerEn,
            links: (item.relatedLinks ?? []).map((l) => ({
              href: l.href,
              label: isHi ? l.labelHi : l.labelEn,
            })),
          }))}
        />
        </div>
      </Section>

      <Band
        art={<Plate {...HOME_ART.pattal} alt="" fade="none" />}
        lede={
          isHi
            ? "आपका सवाल यहाँ नहीं है? हमें लिखें, हम जवाब देंगे।"
            : "Your question is not here? Write to us and we will answer."
        }
        actions={
          <Actions>
            <Button href={`/contact${q}`}>
              {isHi ? "हमें लिखें" : "Write to us"}
            </Button>
          </Actions>
        }
      />
    </InnerShell>
  );
}
