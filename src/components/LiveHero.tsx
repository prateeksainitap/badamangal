"use client";

import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * /live page hero, extracted out of the server-rendered page so the
 * Live pill + heading + subheading swap to Hindi the moment the
 * LangToggle fires, without waiting on a server-tree refresh.
 *
 * Same client-context pattern as HomeHero / HomeHistoryTeaser.
 */
export default function LiveHero() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";

  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 pt-10 pb-6 sm:pt-14 sm:pb-8 text-center">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron-50 border border-saffron-500/40 px-3 py-1 text-[0.65rem] font-mukta uppercase tracking-[0.28em] text-saffron-600 font-semibold">
        <span className="block w-1.5 h-1.5 rounded-full bg-saffron-600 motion-safe:animate-pulse" />
        {isHi ? "लाइव" : "Live"}
      </span>
      <h1
        className={`mt-4 text-4xl sm:text-5xl ${
          isHi ? "font-tiro text-sindoor-700" : "font-fraunces font-semibold text-sindoor-700"
        }`}
      >
        {isHi ? "भंडारा से सीधा" : "Live from the bhandara"}
      </h1>
      <p className="mt-3 text-ink-600 max-w-2xl mx-auto leading-relaxed">
        {isHi
          ? "लखनऊ के पंडालों से तस्वीरें, संदेश, और सेवा की झलक, हर कुछ सेकंड में नई।"
          : "Photos, blessings, and live updates from Lucknow's pandals, refreshed every few seconds."}
      </p>
    </section>
  );
}
