"use client";

import { useLocaleFromContext } from "@/lib/locale-context";
import { strings } from "@/content/strings";

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
    <header className="text-center">
      <p className="font-mukta uppercase tracking-[0.32em] text-saffron-600 text-xs font-semibold">
        {isHi ? "संपर्क करें" : "Get in touch"}
      </p>
      <h1
        className={`mt-3 text-3xl sm:text-4xl ${
          isHi
            ? "font-deva font-medium text-sindoor-700"
            : "font-fraunces font-semibold text-sindoor-700"
        }`}
      >
        {isHi ? "हमें लिखें" : "Write to us"}
      </h1>
      <p className="mt-3 text-ink-600 leading-relaxed">
        {isHi
          ? "सुधार, सहयोग या कोई सवाल। एक संदेश छोड़ें, हम जल्द जवाब देंगे।"
          : "Corrections, partnerships, or questions. Leave a note and we'll write back."}
      </p>
      <p className="mt-2 text-xs text-ink-600">
        {isHi ? "या सीधे ईमेल करें: " : "Or email directly: "}
        <a
          href={`mailto:${t.footer.contactEmail}`}
          data-ga="cta_contact_email_mailto"
          data-ga-source="contact_hero"
          className="text-saffron-600 hover:underline"
        >
          {t.footer.contactEmail}
        </a>
      </p>
    </header>
  );
}
