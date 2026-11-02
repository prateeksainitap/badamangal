"use client";

/**
 * Locale-aware header for /volunteer/submit: kicker, H1 and the
 * "see full guide" line in the visitor's chosen language.
 */

import Link from "next/link";
import { useLocaleFromContext } from "@/lib/locale-context";
import { PageHero, Kicker } from "@/components/v2";

const COPY = {
  hi: {
    eyebrow: "स्वयंसेवक",
    h1: "भण्डारा भेजें",
    sub1: "10 तस्वीरें, 2 वीडियो और 1 लाइव स्पॉट लें।",
    seeGuide: "पूरी गाइड देखें",
  },
  en: {
    eyebrow: "Volunteer",
    h1: "Submit a bhandara",
    sub1: "Take 10 photos, 2 videos and 1 live spot.",
    seeGuide: "See full guide",
  },
};

export default function VolunteerSubmitHeader() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const t = COPY[isHi ? "hi" : "en"];

  return (
    <PageHero
      kicker={<Kicker>{t.eyebrow}</Kicker>}
      title={{ en: COPY.en.h1, hi: COPY.hi.h1 }}
      lede={
        <>
          {t.sub1}{" "}
          <Link href="/volunteer" className="bmi-tl inline">
            {t.seeGuide}
          </Link>
        </>
      }
    />
  );
}
