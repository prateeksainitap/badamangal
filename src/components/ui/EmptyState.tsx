"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Kicker from "@/components/ui/Kicker";
import JaliFrame from "@/components/ui/JaliFrame";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * Canonical empty-state surface — the visual pattern shared by:
 *   • homepage "no bhandaras yet"
 *   • /live "the pandals are quiet right now"
 *   • /archive "no bhandaras have wrapped up yet"
 *
 * Two-column on desktop (illustration + content), stacked on mobile.
 * Always wrapped in <JaliFrame> for the brand-native feel; gradient
 * background ties to the saffron / cream palette without competing
 * with whatever sits above the empty state.
 *
 * The headline + body switch typeface based on locale so callers don't
 * have to ternary on isHi.
 *
 *   <EmptyState
 *     illustration="/illustrations/empty-state-plate.webp"
 *     kicker="Waiting for the first spot"
 *     headlineEn="The pandals are quiet right now."
 *     headlineHi="अभी पंडाल शांत हैं।"
 *     bodyEn="Be the first to share a bhandara from your street."
 *     bodyHi="अपनी गली से पहला भंडारा साझा करें।"
 *     primaryCta={{ href: "/spot", label: "Spot a bhandara now" }}
 *     secondaryCta={{ href: "/", label: "Browse listed bhandaras" }}
 *   />
 */
type Cta = {
  href: string;
  label: string;
  /** Optional GA event name. */
  ga?: string;
};

type Props = {
  /** Path to the illustration — typically a webp under /illustrations. */
  illustration: string;
  illustrationAlt?: string;
  kicker: string;
  /** If only `headline` is provided, it shows in both locales. Provide
   *  `headlineHi` to localize. */
  headlineEn: string;
  headlineHi?: string;
  bodyEn?: ReactNode;
  bodyHi?: ReactNode;
  primaryCta?: Cta;
  secondaryCta?: Cta;
  /** Tertiary footer line under the CTAs (e.g. "Refreshing every 8s"). */
  footnote?: { en: string; hi?: string; icon?: ReactNode };
  /** Inline GA-friendly source label baked into both CTA data attrs. */
  source?: string;
  className?: string;
};

export default function EmptyState({
  illustration,
  illustrationAlt = "",
  kicker,
  headlineEn,
  headlineHi,
  bodyEn,
  bodyHi,
  primaryCta,
  secondaryCta,
  footnote,
  source,
  className = "",
}: Props) {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";

  const headline = isHi ? (headlineHi ?? headlineEn) : headlineEn;
  const body = isHi ? (bodyHi ?? bodyEn) : bodyEn;
  const footText = footnote
    ? isHi
      ? (footnote.hi ?? footnote.en)
      : footnote.en
    : null;

  return (
    <JaliFrame
      className={`overflow-hidden rounded-3xl border border-gold-500/45 bg-gradient-to-br from-saffron-50 via-cream-50 to-cream-50 px-5 sm:px-8 py-10 sm:py-12 shadow-warm ${className}`}
      subtle
    >
      <div className="relative grid gap-7 sm:grid-cols-[160px_1fr] items-center">
        <div className="relative mx-auto sm:mx-0 w-36 sm:w-40 aspect-square">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-saffron-500/15 blur-2xl"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={illustration}
            alt={illustrationAlt}
            loading="lazy"
            decoding="async"
            className="relative w-full h-full object-contain"
          />
        </div>

        <div className="text-center sm:text-left">
          <Kicker dot tone="saffron">
            {kicker}
          </Kicker>
          <h2
            className={`mt-2 ${
              isHi
                ? "font-tiro text-sindoor-700"
                : "font-fraunces font-semibold text-sindoor-700"
            } text-2xl sm:text-[1.65rem] leading-snug [text-wrap:balance]`}
          >
            {headline}
          </h2>
          {body ? (
            <p className="mt-2 text-sm sm:text-[0.95rem] text-ink-600 leading-relaxed [text-wrap:pretty]">
              {body}
            </p>
          ) : null}

          {(primaryCta || secondaryCta) && (
            <div className="mt-5 flex flex-wrap gap-3 justify-center sm:justify-start">
              {primaryCta ? (
                <Link
                  href={primaryCta.href}
                  data-ga={primaryCta.ga}
                  data-ga-source={source}
                  className="btn btn-primary btn-sm"
                >
                  {primaryCta.label}
                </Link>
              ) : null}
              {secondaryCta ? (
                <Link
                  href={secondaryCta.href}
                  data-ga={secondaryCta.ga}
                  data-ga-source={source}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-sindoor-700 hover:text-saffron-600 px-2 py-2 transition-colors"
                >
                  {secondaryCta.label}
                  <span aria-hidden>→</span>
                </Link>
              ) : null}
            </div>
          )}

          {footText ? (
            <p className="mt-5 text-[0.7rem] uppercase tracking-[0.22em] text-ink-600 inline-flex items-center gap-1.5">
              {footnote?.icon ? <span aria-hidden>{footnote.icon}</span> : null}
              {footText}
            </p>
          ) : null}
        </div>
      </div>
    </JaliFrame>
  );
}
