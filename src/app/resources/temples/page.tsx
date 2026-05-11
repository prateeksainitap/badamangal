import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LANG_COOKIE, resolveLocale } from "@/lib/i18n";
import { strings } from "@/content/strings";
import { TEMPLES } from "@/content/temples";
import { JaliCorner, MarigoldDivider, SunburstSpark } from "@/components/ornaments";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://badamangal.com";

export const metadata: Metadata = {
  title: "Hanuman temples of Lucknow · BadaMangal",
  description:
    "Aliganj Naya, Aliganj Purana, Hanuman Setu, Sankat Mochan, and Bada Hanuman, the temples that anchor Lucknow's Bada Mangal.",
  alternates: {
    canonical: "/resources/temples",
    languages: {
      "hi-IN": "/resources/temples",
      "en-IN": "/resources/temples?lang=en",
    },
  },
  openGraph: {
    title: "Hanuman temples of Lucknow · BadaMangal",
    description:
      "The five Hanuman temples that define Bada Mangal in Lucknow.",
    url: `${SITE_URL}/resources/temples`,
    type: "website",
    siteName: "BadaMangal",
  },
};

type SearchParams = Promise<{ lang?: string }>;

export default async function TemplesDirectoryPage({
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
  const langSuffix = locale === "en" ? "?lang=en" : "";

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Hanuman temples of Lucknow",
    itemListElement: TEMPLES.map((temple, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/resources/temples/${temple.slug}`,
      name: temple.name.en,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />

      <article className="pb-24">
        {/* HEADER */}
        <header className="mx-auto max-w-3xl px-4 sm:px-6 pt-12 sm:pt-16 pb-10 text-center">
          <Link
            href={`/resources${langSuffix}`}
            className="inline-block text-sm text-ink-600 hover:text-saffron-600 transition-colors"
          >
            {t.resources.common.backToResources}
          </Link>
          <p className="mt-4 font-mukta uppercase tracking-[0.32em] text-gold-500 text-xs">
            {t.resources.temples.directoryKicker}
          </p>
          <h1
            className={`mt-3 ${
              isHi ? "font-deva text-sindoor-700" : "font-fraunces text-sindoor-700"
            } font-medium text-[2rem] sm:text-[2.6rem] leading-[1.2]`}
          >
            {t.resources.temples.directoryHeading}
          </h1>
          <p className="mt-5 max-w-2xl mx-auto text-ink-900/85 leading-relaxed">
            {t.resources.temples.directoryBody}
          </p>
          <div className="mt-7 flex justify-center">
            <SunburstSpark size={44} className="text-gold-500" />
          </div>
        </header>

        {/* TEMPLE CARDS */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLES.map((temple) => (
            <Link
              key={temple.slug}
              href={`/resources/temples/${temple.slug}${langSuffix}`}
              className="group relative block rounded-3xl overflow-hidden bg-white border border-gold-500/40 shadow-warm hover:border-saffron-500 transition-colors"
            >
              {/* Hero image (gracefully falls back to ornament placeholder
                  when imagePath is missing). */}
              <div className="relative aspect-[4/3] bg-saffron-50 border-b border-gold-500/40 overflow-hidden">
                <JaliCorner
                  position="tl"
                  className="absolute top-3 left-3 w-10 h-10 text-gold-500/70 z-10"
                />
                <JaliCorner
                  position="tr"
                  className="absolute top-3 right-3 w-10 h-10 text-gold-500/70 z-10"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <SunburstSpark
                    size={96}
                    className="text-saffron-600 opacity-50"
                  />
                </div>
                {temple.imagePath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={temple.imagePath}
                    alt={isHi ? temple.name.hi : temple.name.en}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                ) : (
                  <p className="absolute bottom-3 inset-x-0 text-center font-cormorant uppercase tracking-[0.32em] text-saffron-600/80 text-[0.62rem]">
                    {isHi ? "तस्वीर शीघ्र" : "Photo coming soon"}
                  </p>
                )}
              </div>

              <div className="px-5 py-5">
                <p className="font-mukta uppercase tracking-[0.28em] text-gold-500 text-[0.62rem]">
                  {t.areas[temple.area as keyof typeof t.areas] ?? temple.area}
                </p>
                <h2 className="mt-2 font-fraunces font-semibold text-lg text-sindoor-700 leading-tight">
                  {isHi ? temple.name.hi : temple.name.en}
                </h2>
                {temple.altName ? (
                  <p className="mt-1 text-xs text-ink-600 italic">
                    {temple.altName}
                  </p>
                ) : null}
                <p className="mt-3 text-sm text-ink-600 line-clamp-2">
                  {isHi ? temple.badaMangal.hi : temple.badaMangal.en}
                </p>
                <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-saffron-600 font-medium">
                  {isHi ? "विवरण देखें" : "View details"} <span aria-hidden>→</span>
                </p>
              </div>
            </Link>
          ))}
        </section>

        <div className="flex justify-center my-14">
          <MarigoldDivider size={280} className="text-gold-500" />
        </div>

        <section className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <p className="font-mukta uppercase tracking-[0.32em] text-gold-500 text-xs">
            {isHi ? "अधिक मंदिर" : "More temples"}
          </p>
          <h2
            className={`mt-3 ${
              isHi ? "font-tiro text-sindoor-700" : "font-fraunces text-sindoor-700"
            } text-2xl`}
          >
            {isHi
              ? "अपने मोहल्ले का हनुमान मंदिर सूचीबद्ध कराएँ।"
              : "Help us list your neighbourhood Hanuman temple."}
          </h2>
          <p className="mt-3 text-ink-600 max-w-xl mx-auto">
            {isHi
              ? "हम धीरे-धीरे लखनऊ के सभी हनुमान मंदिरों की सूची बना रहे हैं। आप मदद कर सकते हैं।"
              : "We're slowly cataloguing every Hanuman temple in Lucknow. You can help."}
          </p>
          <Link
            href={`/list-bhandara${langSuffix}`}
            className="mt-5 inline-flex items-center rounded-full border-2 border-saffron-600 text-saffron-600 hover:bg-saffron-600 hover:text-cream-50 font-medium px-5 py-2 transition-colors"
          >
            {isHi ? "सहयोग करें" : "Suggest a temple"} →
          </Link>
        </section>
      </article>
    </>
  );
}
