"use client";

import Link from "next/link";
import { strings } from "@/content/strings";
import { useLocaleFromContext } from "@/lib/locale-context";
import CtaPendingDot from "@/components/CtaPendingDot";

/**
 * Whole-section empty state shown on the homepage when there are zero
 * approved upcoming bhandaras. Mirrors the empty state inside
 * BhandaraCardsSection but lives as its own component so the
 * server-rendered page.tsx can swap it in without leaking server-side
 * locale ternaries.
 */
export default function HomeCardsEmpty() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const t = strings[locale];

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
      <h2
        className={`text-2xl sm:text-3xl ${
          isHi ? "font-tiro text-sindoor-700" : "font-fraunces text-sindoor-700"
        }`}
      >
        {t.cards.sectionHeading}
      </h2>
      <div className="mt-8 rounded-3xl border border-gold-500/40 bg-saffron-50 px-6 py-10 sm:py-14 grid gap-6 sm:grid-cols-[200px_1fr] items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/illustrations/empty-state-plate.webp"
          alt=""
          loading="lazy"
          decoding="async"
          className="mx-auto w-40 sm:w-48 aspect-square object-contain"
        />
        <div>
          <p className="font-mukta uppercase tracking-[0.32em] text-saffron-600 text-xs font-semibold">
            {isHi ? "अभी कोई भंडारा नहीं" : "No bhandaras yet"}
          </p>
          <h3
            className={`mt-2 ${
              isHi ? "font-tiro text-sindoor-700" : "font-fraunces text-sindoor-700"
            } text-2xl`}
          >
            {isHi
              ? "थाली तैयार है, बस सेवक की प्रतीक्षा है।"
              : "The plate is set. We're waiting for the first sevak."}
          </h3>
          <p className="mt-2 text-ink-600 max-w-xl">
            {isHi
              ? "अपना भंडारा सबसे पहले सूचीबद्ध करें, यह रसोई आप ही से शुरू होगी।"
              : "List your bhandara first, this kitchen begins with you."}
          </p>
          <Link
            href={`/list-bhandara${isHi ? "" : "?lang=en"}`}
            prefetch
            data-ga="cta_empty_list_bhandara"
            data-ga-source="cards_empty"
            className="btn btn-primary btn-sm mt-5 inline-flex items-center gap-2"
          >
            {t.cta.listBhandara}
            {/* Pending spinner renders the moment the user clicks,
                before /list-bhandara starts rendering. When idle the
                component returns null and the arrow shows; when
                pending the arrow is hidden by the data attribute below
                so the visitor sees one indicator at a time. */}
            <CtaPendingDot className="inline-block h-3 w-3 rounded-full border-2 border-current/40 border-t-current motion-safe:animate-spin" />
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
