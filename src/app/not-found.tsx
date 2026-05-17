"use client";

import Link from "next/link";
import { strings } from "@/content/strings";
import { MarigoldDivider } from "@/components/ornaments";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * 404 not-found page. Converted from a server component (which had
 * hardcoded `locale = "en"`) to a client component reading from
 * LocaleProvider context so the Hindi toggle flips every label here
 * too. Next.js doesn't require this file to be server-rendered, and
 * the page is rarely the LCP for any user journey, making it client
 * is fine.
 */
export default function NotFound() {
  const locale = useLocaleFromContext();
  const t = strings[locale];
  const isHi = locale === "hi";
  const langSuffix = locale === "en" ? "?lang=en" : "";

  return (
    <article className="mx-auto max-w-3xl px-4 sm:px-6 py-16 sm:py-24 text-center">
      <p className="font-mukta uppercase tracking-[0.32em] text-gold-500 text-xs">
        404
      </p>
      <h1
        className={`mt-3 ${
          isHi ? "font-deva text-sindoor-700" : "font-fraunces text-sindoor-700"
        } font-medium text-[2rem] sm:text-[2.6rem] leading-[1.2]`}
      >
        {isHi ? "रास्ता नहीं मिला" : "We've lost the trail."}
      </h1>
      <p className="mt-4 max-w-lg mx-auto text-ink-600 leading-relaxed">
        {isHi
          ? "जिस पते की तलाश में थे वह यहाँ मौजूद नहीं है। नीचे से किसी रास्ते पर लौट आइए।"
          : "The page you're looking for is no longer here. Pick a way back below."}
      </p>

      <figure className="mx-auto my-10 w-full max-w-md aspect-square rounded-3xl overflow-hidden border border-gold-500/40 bg-cream-50 shadow-warm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/illustrations/404-diya-smoke.png"
          alt={
            isHi
              ? "एक उलटी हुई मिट्टी की दिया, धुँए की लकीर और गेंदा।"
              : "A tipped-over clay diya with a curl of smoke and a marigold."
          }
          loading="eager"
          decoding="async"
          className="w-full h-full object-cover"
        />
      </figure>

      <div className="flex justify-center">
        <MarigoldDivider size={260} className="text-gold-500" />
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 max-w-xl mx-auto">
        <Link
          href={`/${langSuffix}#map`}
          className="rounded-2xl border border-gold-500/40 bg-white shadow-warm px-6 py-5 hover:border-saffron-500 transition-colors block text-left"
        >
          <p className="font-fraunces text-lg text-sindoor-700">
            {t.cta.findBhandara}
          </p>
          <p className="text-sm text-ink-600 mt-1">
            {isHi ? "नक़्शे पर भंडारा देखें →" : "See bhandaras on the map →"}
          </p>
        </Link>
        <Link
          href={`/resources${langSuffix}`}
          className="rounded-2xl border border-gold-500/40 bg-white shadow-warm px-6 py-5 hover:border-saffron-500 transition-colors block text-left"
        >
          <p className="font-fraunces text-lg text-sindoor-700">
            {t.resources.hubHeading}
          </p>
          <p className="text-sm text-ink-600 mt-1">
            {isHi ? "चालीसा, आरती, इतिहास →" : "Chalisa, aarti, history →"}
          </p>
        </Link>
      </div>
    </article>
  );
}
