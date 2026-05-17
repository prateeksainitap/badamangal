"use client";

import Link from "next/link";
import BhandaraCard from "@/components/BhandaraCard";
import { areaToSlug } from "@/lib/areaSlug";
import { AREAS } from "@/lib/lucknow";
import { strings } from "@/content/strings";
import type { Bhandara } from "@/types/bhandara";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * /area/[slug] body, extracted out of the server-rendered page so the
 * H1 ("Bada Mangal Bhandaras in <Area>"), breadcrumbs ("Home › Areas"),
 * "<N> bhandaras are serving" hero copy, "List your <area> bhandara"
 * CTA, "Bhandaras in nearby areas" + cross-link labels, and
 * "Devotional resources for Bada Mangal" cross-sell, all swap on the
 * Hindi toggle without a server-tree refresh.
 *
 * The server wrapper still owns the Prisma query (bhandaras for this
 * area), all JSON-LD blocks (Organization, breadcrumb, FAQ, ItemList,
 * which are locale-agnostic and read by crawlers, not visitors), and
 * the localised metadata.
 *
 * Same client-context pattern as HomeHero / HistoryView etc.
 */
type Props = {
  area: string;
  slug: string;
  bhandaras: Bhandara[];
  adjacent: string[];
};

export default function AreaPageView({
  area,
  slug,
  bhandaras,
  adjacent,
}: Props) {
  const locale = useLocaleFromContext();
  const t = strings[locale];
  const isHi = locale === "hi";
  const langSuffix = locale === "en" ? "?lang=en" : "";
  // Localised area display name; falls back to the canonical English
  // name when no Hindi translation exists in the strings dictionary.
  const areaLabel = t.areas[area as keyof typeof t.areas] ?? area;

  return (
    <article className="mx-auto max-w-6xl px-4 sm:px-6 pt-8 sm:pt-12 pb-24">
      {/* Breadcrumb trail, also human-readable, not just JSON-LD */}
      <nav
        aria-label="Breadcrumb"
        className="text-xs sm:text-sm text-ink-600 mb-4"
      >
        <Link href={`/${langSuffix}`} className="hover:text-saffron-600">
          {isHi ? "होम" : "Home"}
        </Link>
        <span aria-hidden className="mx-2 text-gold-500">›</span>
        <Link href={`/#map${langSuffix ? `${langSuffix}` : ""}`} className="hover:text-saffron-600">
          {isHi ? "क्षेत्र" : "Areas"}
        </Link>
        <span aria-hidden className="mx-2 text-gold-500">›</span>
        <span className="text-sindoor-700 font-medium">{areaLabel}</span>
      </nav>

      <header>
        <p className="font-mukta uppercase tracking-[0.28em] text-saffron-600 text-[0.65rem] sm:text-xs font-semibold">
          {isHi ? "2026 · बड़ा मंगल लखनऊ" : "2026 · Bada Mangal Lucknow"}
        </p>
        <h1
          className={`mt-2 font-bold text-3xl sm:text-[2.4rem] leading-tight text-sindoor-700 ${
            isHi ? "font-tiro" : "font-fraunces"
          }`}
        >
          {isHi
            ? `${areaLabel} में बड़े मंगल भंडारे, लखनऊ 2026`
            : `Bada Mangal Bhandaras in ${areaLabel}, Lucknow 2026`}
        </h1>
        <p className="mt-3 text-base sm:text-lg text-ink-600 leading-relaxed max-w-3xl">
          {bhandaras.length === 0 ? (
            isHi ? (
              <>
                इस वर्ष <strong>{areaLabel}</strong> में अभी कोई भी 2026 बड़ा
                मंगल भंडारा सूचीबद्ध नहीं है। यदि आप यहाँ भंडारा आयोजित कर
                रहे हैं, तो 30 सेकंड में मुफ़्त सूचीबद्ध करें, {areaLabel}{" "}
                <em>में भंडारा</em> ढूँढ़ रहे भक्तगण आपको तुरंत पाएँगे।
              </>
            ) : (
              <>
                No bhandaras are listed in <strong>{areaLabel}</strong> for the
                2026 Bada Mangal season yet. If you&apos;re hosting one, take
                30 seconds to list it free, devotees searching for{" "}
                <em>bhandara in {areaLabel}</em> will find you immediately.
              </>
            )
          ) : isHi ? (
            <>
              {areaLabel} में{" "}
              <strong>{bhandaras.length}</strong>{" "}
              {bhandaras.length === 1 ? "भंडारा" : "भंडारे"} 2026 बड़ा मंगल
              सत्र की सेवा कर रहे हैं। हर लिस्टिंग मुफ़्त सेवा है, सभी
              भक्तों के लिए खुली। नीचे स्थान, समय, प्रसाद मेन्यू और एक-क्लिक
              दिशा-निर्देश।
            </>
          ) : (
            <>
              <strong>{bhandaras.length}</strong>{" "}
              {bhandaras.length === 1 ? "bhandara is" : "bhandaras are"}{" "}
              serving the 2026 Bada Mangal season in {areaLabel}. Every
              listing is free seva, open to all devotees. Locations,
              timings, prasad menus, and one-tap directions below.
            </>
          )}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/list-bhandara${langSuffix}`}
            data-ga="area_list_bhandara"
            data-ga-area={slug}
            className="inline-flex items-center gap-2 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-semibold px-5 py-2.5 text-sm shadow-warm transition-transform hover:-translate-y-0.5"
          >
            {isHi
              ? `अपना ${areaLabel} भंडारा लिस्ट करें · मुफ़्त`
              : `List your ${areaLabel} bhandara · Free`}
          </Link>
          <Link
            href={`/${langSuffix}#map`}
            data-ga="area_view_full_map"
            data-ga-area={slug}
            className="inline-flex items-center gap-2 rounded-full border-2 border-saffron-600 text-saffron-600 hover:bg-saffron-50 font-semibold px-5 py-2.5 text-sm"
          >
            {isHi ? "नक़्शे पर सभी क्षेत्र देखें →" : "See all areas on map →"}
          </Link>
        </div>
      </header>

      {/* Bhandara grid */}
      {bhandaras.length > 0 ? (
        <section className="mt-10 sm:mt-12">
          <h2 className="sr-only">
            {isHi ? `${areaLabel} के भंडारे` : `${areaLabel} bhandaras`}
          </h2>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {bhandaras.map((b) => (
              <BhandaraCard key={b.id} bhandara={b} locale={locale} />
            ))}
          </ul>
        </section>
      ) : (
        <section className="mt-12 rounded-2xl border border-saffron-500/45 bg-gradient-to-br from-saffron-50 to-cream-50 px-6 py-10 text-center">
          <p className="text-ink-600 mb-4">
            {isHi
              ? `इस सत्र में ${areaLabel} का पहला भंडारा? इसे मुफ़्त सूचीबद्ध करें और इस क्षेत्र में खोज रहे भक्तों के लिए एकमात्र परिणाम बनें।`
              : `First bhandara in ${areaLabel} this season? List it free and be the only result for devotees searching this area.`}
          </p>
          <Link
            href={`/list-bhandara${langSuffix}`}
            className="inline-flex items-center gap-2 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-semibold px-6 py-3 shadow-warm"
          >
            {isHi
              ? `${areaLabel} में भंडारा लिस्ट करें →`
              : `List a ${areaLabel} bhandara →`}
          </Link>
        </section>
      )}

      {/* Adjacent areas, internal-link surface for PageRank flow */}
      {adjacent.length > 0 ? (
        <section className="mt-14 pt-10 border-t border-gold-500/30">
          <h2
            className={`font-semibold text-xl sm:text-2xl text-sindoor-700 ${
              isHi ? "font-tiro" : "font-fraunces"
            }`}
          >
            {isHi ? "पास के क्षेत्रों के भंडारे" : "Bhandaras in nearby areas"}
          </h2>
          <p className="mt-2 text-sm text-ink-600">
            {isHi
              ? `${areaLabel} के भक्तगण अक्सर पास के क्षेत्रों के भंडारे भी जाते हैं, क्षेत्र अनुसार निर्देशिका देखें।`
              : `Devotees in ${areaLabel} often visit bhandaras across the neighbouring areas, explore the directory by area.`}
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {adjacent.map((a) => {
              const aLabel = t.areas[a as keyof typeof t.areas] ?? a;
              return (
                <li key={a}>
                  <Link
                    href={`/area/${areaToSlug(a)}${langSuffix}`}
                    data-ga="area_cross_link"
                    data-ga-from={slug}
                    data-ga-to={areaToSlug(a)}
                    className="inline-flex items-center rounded-full border border-gold-500/55 bg-cream-50 hover:bg-saffron-50 text-sindoor-700 hover:text-saffron-600 px-4 py-2 text-sm font-medium transition-colors"
                  >
                    {isHi
                      ? `${aLabel} में बड़ा मंगल →`
                      : `Bada Mangal in ${aLabel} →`}
                  </Link>
                </li>
              );
            })}
            <li>
              <Link
                href={`/${langSuffix}#map`}
                data-ga="area_see_all_areas"
                className="inline-flex items-center rounded-full bg-saffron-600 text-cream-50 hover:bg-saffron-500 px-4 py-2 text-sm font-semibold"
              >
                {isHi ? "लखनऊ के सभी क्षेत्र →" : "All Lucknow areas →"}
              </Link>
            </li>
          </ul>
        </section>
      ) : null}

      {/* Resources cross-sell, the 4 devotional pages */}
      <section className="mt-14 pt-10 border-t border-gold-500/30">
        <h2
          className={`font-semibold text-xl sm:text-2xl text-sindoor-700 ${
            isHi ? "font-tiro" : "font-fraunces"
          }`}
        >
          {isHi ? "बड़ा मंगल के लिए भक्ति संसाधन" : "Devotional resources for Bada Mangal"}
        </h2>
        <p className="mt-2 text-sm text-ink-600">
          {isHi
            ? `हर ${areaLabel} भंडारे में बजने वाले गीत, चालीसा और रीति-रिवाज़।`
            : `The songs, chants, and rituals every ${areaLabel} bhandara plays.`}
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              href: `/resources/chalisa${langSuffix}`,
              labelEn: "Hanuman Chalisa",
              labelHi: "हनुमान चालीसा",
            },
            {
              href: `/resources/aarti${langSuffix}`,
              labelEn: "Hanuman Aarti",
              labelHi: "हनुमान आरती",
            },
            {
              href: `/resources/ashtak${langSuffix}`,
              labelEn: "Hanuman Ashtak",
              labelHi: "हनुमान अष्टक",
            },
            {
              href: `/resources/bajrang-baan${langSuffix}`,
              labelEn: "Bajrang Baan",
              labelHi: "बजरंग बाण",
            },
          ].map((r) => (
            <li key={r.href}>
              <Link
                href={r.href}
                className="block rounded-2xl border border-gold-500/40 bg-cream-50 hover:border-saffron-500 px-4 py-3 text-sm font-semibold text-sindoor-700 hover:text-saffron-600 transition-colors"
              >
                {isHi ? r.labelHi : r.labelEn} →
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
