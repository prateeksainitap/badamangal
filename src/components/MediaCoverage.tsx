"use client";

import Image from "next/image";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * MediaCoverage
 *
 * Press-wall section that sits IMMEDIATELY after the hero. Designed
 * to be the first social-proof beat a new visitor sees, so:
 *
 *   • Coloured-by-default logos (each masthead lives in its own
 *     elevated white card) so the strip reads as a confident
 *     "press wall" rather than a subdued footer-style strip.
 *   • White cards on a warm cream-saffron backdrop give each logo
 *     a clean canvas to keep its native brand colours legible, even
 *     when those colours (TOI red, NBT orange, etc.) would otherwise
 *     fight the cream paper.
 *   • Pulsing live dot in the eyebrow + bilingual confident headline
 *     + a one-line story below carry the "exciting" register the
 *     post-hero slot demands.
 *   • Uniform card height (h-24 / h-28) tames the wildly different
 *     logo aspect ratios (Amar Ujala is ~6:1, Dainik Jagran ~1.8:1)
 *     so the row reads as one tight unit, not a jagged scatter.
 *   • Hover: card lifts -translate-y-1, shadow expands, soft saffron
 *     ring appears. Premium magazine-card treatment, restrained but
 *     delightful.
 *
 * Labels are intentionally bold ("Featured in") because the section
 * lives in the post-hero slot where trust signals need to land hard.
 * Swap the entry's optional `href` once each outlet publishes their
 * story, and the logo automatically becomes a link.
 */
type Outlet = {
  /** Display name, also used as alt text + hover title. */
  name: string;
  /** Path under /public, served as a static asset. */
  src: string;
  /** Natural width, preserves aspect ratio when scaled by max-height. */
  width: number;
  /** Natural height. */
  height: number;
  /** Optional article URL once coverage lands. Logo becomes a link. */
  href?: string;
};

// Amar Ujala parked for now (file kept under /public/media/press/ for
// quick re-add). Re-introduce by uncommenting the entry below and
// flipping the grid back to `md:grid-cols-4`.
const OUTLETS: ReadonlyArray<Outlet> = [
  {
    name: "The Times of India",
    src: "/media/press/times-of-india.svg",
    width: 360,
    height: 90,
  },
  {
    name: "Navbharat Times",
    src: "/media/press/navbharat-times.webp",
    width: 817,
    height: 308,
  },
  {
    name: "Dainik Jagran",
    src: "/media/press/dainik-jagran.png",
    width: 300,
    height: 163,
  },
  // {
  //   name: "Amar Ujala",
  //   src: "/media/press/amar-ujala.png",
  //   width: 500,
  //   height: 83,
  // },
];

export default function MediaCoverage() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";

  return (
    <section
      aria-label={isHi ? "मीडिया कवरेज" : "Press coverage"}
      className="relative isolate overflow-hidden"
    >
      {/* Twin saffron + gold radial washes layered over a cream paper
          gradient. Designed to lift the band off the hero above so
          it reads as its own confident "press wall" surface, while
          staying warm enough to feel native to the homepage palette. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 320px at 20% 35%, rgba(242,148,76,0.13), transparent 70%), radial-gradient(820px 280px at 85% 65%, rgba(196,150,55,0.11), transparent 70%), linear-gradient(180deg, rgba(255,247,235,0.55) 0%, rgba(255,247,235,1) 45%)",
        }}
      />
      {/* Hairline gold rules anchor the band top + bottom */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent"
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
        {/* Eyebrow + headline + supporting line. Eyebrow uses the
            same pulsing-dot motif as the "Happening Now" header
            below the fold so the homepage carries one consistent
            "live energy" visual language top to bottom. */}
        <div className="text-center">
          <p className="font-mukta uppercase tracking-[0.32em] text-saffron-600 text-xs font-semibold inline-flex items-center gap-2 justify-center">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-saffron-600 opacity-50 motion-safe:animate-ping" />
              <span className="relative h-2 w-2 rounded-full bg-saffron-600" />
            </span>
            {isHi ? "मीडिया में" : "Featured in"}
          </p>
          <h2
            className={`mt-3 text-2xl sm:text-4xl ${
              isHi
                ? "font-tiro text-sindoor-700"
                : "font-fraunces font-bold text-sindoor-700"
            } [text-wrap:balance]`}
          >
            {isHi
              ? "भारत के प्रमुख समाचार-पत्र"
              : "India's leading dailies"}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-ink-600 max-w-2xl mx-auto leading-relaxed">
            {isHi
              ? "लखनऊ की पहली live Bada Mangal directory, और देश के सबसे विश्वसनीय अख़बार इसे पहचान रहे हैं।"
              : "Lucknow's first live Bada Mangal directory, and India's most-trusted papers are taking notice."}
          </p>
        </div>

        {/* Coloured logo cards. Each masthead sits inside its own
            white card so the native brand colours stay clean and
            don't fight the cream paper. Uniform card height tames
            the wildly different logo aspect ratios. 3-col at every
            width since we currently feature three outlets, a
            three-up row reads as one tight unit at all viewports
            (cards are still ~110 px wide on the smallest phone,
            comfortable for these simple wordmarks). */}
        <ul
          role="list"
          className="mt-8 sm:mt-10 grid grid-cols-3 gap-3 sm:gap-4"
        >
          {OUTLETS.map((outlet) => {
            const inner = (
              <div className="relative h-24 sm:h-28 w-full flex items-center justify-center px-4 sm:px-5 rounded-2xl bg-white border border-gold-500/30 shadow-warm transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-xl group-hover:border-saffron-500/60 group-hover:ring-4 group-hover:ring-saffron-600/15">
                <Image
                  src={outlet.src}
                  alt={outlet.name}
                  width={outlet.width}
                  height={outlet.height}
                  className="max-h-10 sm:max-h-12 w-auto object-contain"
                  unoptimized
                />
              </div>
            );
            return (
              <li
                key={outlet.name}
                className="group"
                title={outlet.name}
              >
                {outlet.href ? (
                  <a
                    href={outlet.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Read ${outlet.name} coverage`}
                    className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-600/60 rounded-2xl"
                  >
                    {inner}
                  </a>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
