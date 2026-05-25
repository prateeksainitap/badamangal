"use client";

/**
 * Locale-aware header for /volunteer/submit.
 *
 * Tiny client island that sits above the submission form and
 * renders the eyebrow + H1 + "see full guide" subhead in the
 * visitor's chosen language. The /volunteer/submit page used to
 * hardcode the header bilingually (English eyebrow + Hindi H1 +
 * English subhead). Now the LangToggle pill in the global header
 * controls this too.
 */

import Link from "next/link";
import { useLocaleFromContext } from "@/lib/locale-context";

const COPY = {
  hi: {
    eyebrow: "🚩 भण्डारा भेजें",
    h1: "भण्डारा भेजें",
    sub1: "10 तस्वीरें + 2 video + 1 live spot लें।",
    seeGuide: "पूरी गाइड देखें",
  },
  en: {
    eyebrow: "🚩 Submit a bhandara",
    h1: "Submit a bhandara",
    sub1: "Take 10 photos + 2 videos + 1 live spot.",
    seeGuide: "See full guide",
  },
};

export default function VolunteerSubmitHeader() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const t = COPY[isHi ? "hi" : "en"];

  return (
    <header className="pt-8 sm:pt-12 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-saffron-600 font-medium">
        {t.eyebrow}
      </p>
      <h1
        className={`text-3xl sm:text-4xl text-sindoor-700 mt-2 ${
          isHi ? "font-mukta font-bold" : "font-fraunces"
        }`}
      >
        {t.h1}
      </h1>
      <p className="mt-3 text-sm text-ink-600">
        {t.sub1}{" "}
        <Link
          href="/volunteer"
          className="underline decoration-dotted underline-offset-4 hover:text-saffron-600"
        >
          {t.seeGuide}
        </Link>
      </p>
    </header>
  );
}
