"use client";

import Link from "next/link";
import { useLocaleFromContext } from "@/lib/locale-context";
import { PageHero, Kicker } from "@/components/v2";

/** Hero for /volunteer/signup in the visitor's language (one language
 *  per heading). */
export default function SignupHero() {
  const isHi = useLocaleFromContext() === "hi";
  return (
    <PageHero
      kicker={<Kicker>{isHi ? "स्वयंसेवक" : "Volunteer"}</Kicker>}
      title={{ en: "Sign up", hi: "अभी जुड़ें" }}
      lede={
        <>
          {isHi
            ? "30 सेकंड का फ़ॉर्म भरिए। आपका volunteer code तुरंत मिल जाएगा और आप उसी समय भण्डारे document करना शुरू कर सकते हैं।"
            : "30-second form. You'll get your volunteer code instantly and can start submitting bhandaras right away."}{" "}
          <Link href="/volunteer" data-ga="volunteer_signup_about_link" className="bmi-tl inline">
            {isHi ? "यह क्या है?" : "What's this?"}
          </Link>
        </>
      }
    />
  );
}
