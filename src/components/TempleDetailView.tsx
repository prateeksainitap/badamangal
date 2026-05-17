"use client";

import Link from "next/link";
import { strings } from "@/content/strings";
import { type Temple } from "@/content/temples";
import type { Bhandara } from "@/types/bhandara";
import {
  JaliCorner,
  MarigoldDivider,
  SunburstSpark,
  GadaBullet,
} from "@/components/ornaments";
import BhandaraCard from "@/components/BhandaraCard";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * /resources/temples/[slug] body, extracted out of the
 * server-rendered page so every label (back link, "Address /
 * Timings / Tuesday / Tuesday crowd" field labels, "Get directions"
 * + "Call" CTAs, history heading, nearby-bhandaras heading + empty
 * state) swaps on the Hindi toggle without a server-tree refresh.
 *
 * The server wrapper still owns the Prisma query for `nearby` and
 * serialises the rows through this prop, they're plain JSON, so
 * the client component re-renders correctly.
 */
type Props = {
  temple: Temple;
  nearby: Bhandara[];
};

export default function TempleDetailView({ temple, nearby }: Props) {
  const locale = useLocaleFromContext();
  const t = strings[locale];
  const isHi = locale === "hi";
  const langSuffix = locale === "en" ? "?lang=en" : "";

  const mapsLink = `https://www.google.com/maps/dir/?api=1&destination=${temple.lat},${temple.lng}`;

  return (
    <article className="pb-24">
      {/* HERO */}
      <header className="mx-auto max-w-5xl px-4 sm:px-6 pt-10 sm:pt-14">
        <Link
          href={`/resources/temples${langSuffix}`}
          className="inline-block text-sm text-ink-600 hover:text-saffron-600 transition-colors"
        >
          ← {isHi ? "सभी मंदिर" : "All temples"}
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-5 items-start">
          {/* Hero image (falls back to ornament placeholder when missing). */}
          <div className="lg:col-span-2">
            <div className="relative aspect-[4/5] sm:aspect-square lg:aspect-[3/4] rounded-3xl overflow-hidden bg-saffron-50 border-2 border-gold-500/50 shadow-warm">
              <JaliCorner position="tl" className="absolute top-3 left-3 w-12 h-12 text-gold-500/85 z-10" />
              <JaliCorner position="tr" className="absolute top-3 right-3 w-12 h-12 text-gold-500/85 z-10" />
              <JaliCorner position="bl" className="absolute bottom-3 left-3 w-12 h-12 text-gold-500/85 z-10" />
              <JaliCorner position="br" className="absolute bottom-3 right-3 w-12 h-12 text-gold-500/85 z-10" />
              <div className="absolute inset-0 flex items-center justify-center">
                <SunburstSpark size={140} className="text-saffron-600 opacity-50" />
              </div>
              {temple.imagePath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={temple.imagePath}
                  alt={isHi ? temple.name.hi : temple.name.en}
                  loading="eager"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <p className="absolute bottom-3 inset-x-0 text-center font-cormorant uppercase tracking-[0.32em] text-saffron-600/80 text-[0.6rem] z-10">
                  {isHi ? "तस्वीर शीघ्र" : "Photo coming soon"}
                </p>
              )}
            </div>
          </div>

          <div className="lg:col-span-3">
            <p className="font-mukta uppercase tracking-[0.32em] text-gold-500 text-xs">
              {t.areas[temple.area as keyof typeof t.areas] ?? temple.area} · Lucknow
            </p>
            <h1 className="mt-3 font-deva font-medium text-[2rem] sm:text-[2.5rem] leading-[1.18] text-sindoor-700">
              {temple.name.hi}
            </h1>
            <p className="mt-2 font-fraunces italic text-xl text-ink-900">
              {temple.name.en}
            </p>
            {temple.altName ? (
              <p className="mt-1 text-sm text-ink-600">{temple.altName}</p>
            ) : null}

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label={t.resources.temples.addressLabel}>
                {isHi ? temple.address.hi : temple.address.en}
              </Field>
              <Field label={t.resources.temples.timingsLabel}>
                {isHi ? temple.timings.hi : temple.timings.en}
              </Field>
              <Field label={t.resources.temples.tuesdayLabel}>
                {isHi ? temple.badaMangal.hi : temple.badaMangal.en}
              </Field>
              <Field label={isHi ? "मंगलवार भीड़" : "Tuesday crowd"}>
                {isHi ? temple.tuesdayCrowd.hi : temple.tuesdayCrowd.en}
              </Field>
            </dl>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-5 py-2.5 shadow-warm transition-colors"
              >
                {t.cta.getDirections} ↗
              </a>
              {temple.phone ? (
                <a
                  href={`tel:${temple.phone}`}
                  className="inline-flex items-center rounded-full border-2 border-sindoor-700 text-sindoor-700 hover:bg-sindoor-700 hover:text-cream-50 font-medium px-5 py-2.5 transition-colors"
                >
                  {isHi ? "कॉल करें" : "Call"}
                </a>
              ) : null}
            </div>

            {temple.notes ? (
              <p className="mt-5 rounded-2xl bg-saffron-50 border border-gold-500/40 px-4 py-3 text-sm text-ink-900/90 leading-relaxed">
                <GadaBullet className="inline-block text-gold-500 mr-2 -mt-0.5 align-middle" size={14} />
                {isHi ? temple.notes.hi : temple.notes.en}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      {/* HISTORY */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-14">
        <p className="font-mukta uppercase tracking-[0.32em] text-gold-500 text-xs">
          {t.resources.temples.historyLabel}
        </p>
        <h2
          className={`mt-3 ${
            isHi ? "font-tiro text-sindoor-700" : "font-fraunces text-sindoor-700"
          } text-2xl sm:text-[1.75rem]`}
        >
          {isHi ? "मंदिर का इतिहास" : "How this temple came to be"}
        </h2>
        <p className="mt-5 font-fraunces text-[1.1rem] leading-[1.75] text-ink-900">
          {isHi ? temple.history.hi : temple.history.en}
        </p>
      </section>

      {/* DIVIDER */}
      <div className="flex justify-center my-14">
        <MarigoldDivider size={300} className="text-gold-500" />
      </div>

      {/* NEARBY BHANDARAS */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="font-mukta uppercase tracking-[0.32em] text-gold-500 text-xs">
          {t.resources.temples.nearbyLabel}
        </p>
        <h2
          className={`mt-3 ${
            isHi ? "font-tiro text-sindoor-700" : "font-fraunces text-sindoor-700"
          } text-2xl sm:text-3xl`}
        >
          {isHi
            ? `${t.areas[temple.area as keyof typeof t.areas] ?? temple.area} के भंडारे`
            : `Bhandaras in ${temple.area}`}
        </h2>

        {nearby.length > 0 ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {nearby.map((b) => (
              <BhandaraCard key={b.id} bhandara={b} locale={locale} />
            ))}
          </div>
        ) : (
          <p className="mt-5 text-ink-600">
            {t.resources.temples.nearbyEmpty}
          </p>
        )}
      </section>
    </article>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="font-mukta uppercase tracking-[0.28em] text-gold-500 text-[0.62rem]">
        {label}
      </dt>
      <dd className="mt-1 text-ink-900/95 leading-relaxed">{children}</dd>
    </div>
  );
}
