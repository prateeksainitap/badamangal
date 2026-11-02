"use client";

import { useLocaleFromContext } from "@/lib/locale-context";
import { strings } from "@/content/strings";
import { PageHero, Kicker } from "@/components/v2";

/**
 * Top-of-page hero for /contact. Pulled out of the server-rendered page
 * so it can localize via LocaleProvider, page is now statically
 * prerendered (always English server-side) and this client component
 * swaps to Hindi on hydration when the visitor's bm_lang cookie says so.
 */
export default function ContactHero() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const t = strings[locale];

  return (
    <PageHero
      kicker={<Kicker>{isHi ? "संपर्क करें" : "Get in touch"}</Kicker>}
      title={{ en: "Write to us", hi: "हमें लिखें" }}
      lede={
        isHi
          ? "सुधार, सहयोग या कोई सवाल। एक संदेश छोड़ें, हम जल्द जवाब देंगे।"
          : "Corrections, partnerships, or questions. Leave a note and we'll write back."
      }
      meta={
        <p className="bmi-fine">
          {isHi ? "या सीधे ईमेल करें: " : "Or email directly: "}
          <a
            href={`mailto:${t.footer.contactEmail}`}
            data-ga="cta_contact_email_mailto"
            data-ga-source="contact_hero"
            className="bmi-tl inline"
          >
            {t.footer.contactEmail}
          </a>
        </p>
      }
    />
  );
}
