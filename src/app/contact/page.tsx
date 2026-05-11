import type { Metadata } from "next";
import { cookies } from "next/headers";
import ContactForm from "@/components/ContactForm";
import { strings } from "@/content/strings";
import { LANG_COOKIE, resolveLocale } from "@/lib/i18n";
import { localised } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact BadaMangal, Lucknow's Bada Mangal directory",
  description:
    "Reach the BadaMangal team for listing corrections, sponsorship, partnership, or any question about Lucknow's Bada Mangal bhandaras.",
  alternates: localised("/contact"),
  openGraph: {
    title: "Contact BadaMangal",
    description:
      "Questions, corrections, or partnership ideas, reach the team.",
    type: "website",
    locale: "hi_IN",
    alternateLocale: "en_IN",
  },
};

type SearchParams = Promise<{ lang?: string }>;

export default async function ContactPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const c = await cookies();
  const locale = resolveLocale({
    urlLang: sp.lang,
    cookieLang: c.get(LANG_COOKIE)?.value,
  });
  const t = strings[locale];
  const isHi = locale === "hi";

  return (
    <main className="mx-auto max-w-2xl px-4 sm:px-6 py-10 sm:py-14">
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
            className="text-saffron-600 hover:underline"
          >
            {t.footer.contactEmail}
          </a>
        </p>
      </header>

      <div className="mt-8">
        <ContactForm locale={locale} />
      </div>
    </main>
  );
}
