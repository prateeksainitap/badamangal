"use client";

import Link from "next/link";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * Homepage promo section for the /pamphlet generator.
 *
 * Pitches the free A4 printable Bada Mangal pamphlet tool to
 * visitors who may not realise the directory does more than list
 * bhandaras. Two-column layout:
 *   • Left: warm pitch copy + CTA (the persuasion)
 *   • Right: stylised pamphlet preview (the proof, a tiny
 *     framed mockup with the same devotional motifs the real
 *     /pamphlet generator produces)
 *
 * Why a client component: like FeaturedBhandaras, we read locale
 * from React context so the Hindi toggle flips the section's
 * heading + body copy instantly (no router.refresh wait).
 */
export default function PamphletPromo() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const langSuffix = isHi ? "" : "?lang=en";

  return (
    <section
      aria-labelledby="pamphlet-promo-heading"
      className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-20"
    >
      <div className="relative overflow-hidden rounded-3xl border border-saffron-500/45 bg-gradient-to-br from-saffron-50 via-cream-50 to-saffron-50 shadow-warm">
        {/* Subtle decorative wash, saffron radial flares in the
            corners + gold dotted ring, mirrors the pamphlet's own
            ornament vocabulary. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(420px 220px at 8% 0%, rgba(242,148,76,0.22), transparent 65%), radial-gradient(420px 220px at 100% 100%, rgba(201,162,74,0.18), transparent 65%)",
          }}
        />

        <div className="relative grid gap-8 lg:grid-cols-2 items-center px-6 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-16">
          {/* LEFT, pitch + CTA */}
          <div>
            <p className="font-mukta uppercase tracking-[0.32em] text-saffron-600 text-[0.7rem] font-semibold">
              {isHi ? "नया · निःशुल्क" : "New · Free"}
            </p>
            <h2
              id="pamphlet-promo-heading"
              className={`mt-3 ${
                isHi
                  ? "font-tiro text-sindoor-700"
                  : "font-fraunces font-bold text-sindoor-700"
              } text-3xl sm:text-4xl lg:text-[2.6rem] leading-tight [text-wrap:balance]`}
            >
              {isHi ? (
                <>
                  अपने भंडारे का{" "}
                  <span className="text-saffron-600">मुफ़्त पैम्फलेट</span>{" "}
                  बनाएँ
                </>
              ) : (
                <>
                  Make a free{" "}
                  <span className="text-saffron-600">printable pamphlet</span>{" "}
                  for your bhandara
                </>
              )}
            </h2>
            <p className="mt-4 text-base sm:text-lg text-ink-600 leading-relaxed [text-wrap:pretty]">
              {isHi ? (
                <>
                  पारंपरिक डिज़ाइन, हिन्दी + अंग्रेज़ी, हनुमान जी की छवि,
                  QR कोड के साथ। 30 सेकंड में A4 साइज़ का प्रिंट-रेडी
                  पैम्फलेट तैयार। पास के किसी भी प्रेस शॉप से छपवाइए।
                </>
              ) : (
                <>
                  Traditional devotional design, bilingual, with Hanuman ji
                  and a QR code. A4 print-ready PNG in 30 seconds,
                  walk into any local press shop with it on WhatsApp
                  and they&apos;ll print copies for under ₹2 each.
                </>
              )}
            </p>

            {/* Feature checks */}
            <ul className="mt-6 grid sm:grid-cols-2 gap-3">
              {(isHi
                ? [
                    "हिन्दी + अंग्रेज़ी",
                    "QR कोड के साथ",
                    "A4 प्रिंट-रेडी",
                    "बिल्कुल मुफ़्त",
                  ]
                : [
                    "Hindi + English",
                    "QR code included",
                    "A4 print-ready",
                    "Completely free",
                  ]
              ).map((label) => (
                <li
                  key={label}
                  className="flex items-center gap-2 text-sm text-ink-900"
                >
                  <span
                    aria-hidden
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-leaf-600 text-cream-50 text-[0.7rem]"
                  >
                    ✓
                  </span>
                  <span className="font-medium">{label}</span>
                </li>
              ))}
            </ul>

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link
                href={`/pamphlet${langSuffix}`}
                data-ga="cta_home_pamphlet"
                data-ga-source="home_pamphlet_promo"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-semibold px-6 py-3 text-base shadow-warm transition-transform hover:-translate-y-0.5"
              >
                {isHi ? "पैम्फलेट बनाएँ" : "Make a pamphlet"}
                <span aria-hidden>→</span>
              </Link>
              <Link
                href={`/list-bhandara${langSuffix}`}
                data-ga="cta_home_pamphlet_list"
                data-ga-source="home_pamphlet_promo"
                className="inline-flex items-center text-sm font-semibold text-sindoor-700 hover:text-saffron-600 transition-colors"
              >
                {isHi ? "या पहले भंडारा लिस्ट करें →" : "Or list your bhandara first →"}
              </Link>
            </div>
          </div>

          {/* RIGHT, pamphlet preview mockup */}
          <div className="flex justify-center lg:justify-end">
            <PamphletPreviewMockup isHi={isHi} />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Visual mockup of what the generated pamphlet looks like, a
 * scaled-down preview tile that mirrors the API route's actual
 * design vocabulary (marigold corners, brass bell, Hanuman ji
 * placeholder, kaaryakram vivaran box, QR placeholder, jai shri
 * ram footer).
 *
 * It's not a real preview of any specific bhandara, it's
 * inspiration / "this is what you'll get" eye-candy. Hover state
 * tilts very slightly so the static thumbnail feels alive.
 */
function PamphletPreviewMockup({ isHi }: { isHi: boolean }) {
  return (
    <div
      aria-hidden
      className="relative w-[280px] sm:w-[320px] aspect-[210/297] rounded-2xl overflow-hidden border-[6px] border-sindoor-700 bg-cream-50 shadow-[0_25px_60px_-20px_rgba(156,42,42,0.35),0_8px_20px_-8px_rgba(156,42,42,0.25)] transition-transform duration-500 ease-out hover:-rotate-2 hover:scale-[1.03]"
      style={{
        background:
          "radial-gradient(ellipse 100% 40% at 50% 0%, #FFD9B8 0%, #FBF7F0 60%), radial-gradient(ellipse 100% 50% at 50% 100%, #FFF6EE 0%, #FBF7F0 70%), #FBF7F0",
      }}
    >
      {/* Inner gold border */}
      <div
        aria-hidden
        className="absolute inset-2 border-2 border-gold-500 rounded-lg"
      />
      {/* Marigold dot corners (cheap approximation of the real garland) */}
      <span
        aria-hidden
        className="absolute top-2 left-2 w-5 h-5 rounded-full bg-saffron-600 shadow-[0_0_0_3px_#FFD37A,0_0_0_5px_#E07A1F]"
      />
      <span
        aria-hidden
        className="absolute top-2 right-2 w-5 h-5 rounded-full bg-saffron-600 shadow-[0_0_0_3px_#FFD37A,0_0_0_5px_#E07A1F]"
      />

      {/* Inner content */}
      <div className="absolute inset-6 flex flex-col items-center text-center">
        {/* "॥ श्री हनुमते नमः ॥" header */}
        <p
          className={`mt-1 ${
            isHi ? "font-tiro" : "font-fraunces font-bold"
          } text-[10px] sm:text-[11px] text-sindoor-800 tracking-wide`}
        >
          {isHi ? "॥ श्री हनुमते नमः ॥" : "ŚRĪ HANUMATE NAMAḤ"}
        </p>

        {/* Mini sun emblem */}
        <span
          aria-hidden
          className="mt-1.5 inline-block w-2 h-2 rounded-full bg-saffron-600 shadow-[0_0_0_2px_#F2944C,0_0_0_4px_#C9A24A]"
        />

        {/* Hanuman ji mini-placeholder (sun-burst halo) */}
        <div
          aria-hidden
          className="mt-2 relative w-16 h-20 flex items-center justify-center"
        >
          <span className="absolute inset-0 rounded-full bg-saffron-500/30 blur-sm" />
          <span className="absolute inset-1 rounded-full border border-gold-500/55" />
          <span className="relative text-3xl">🕉</span>
        </div>

        {/* Title */}
        <p
          className={`mt-2 ${
            isHi ? "font-tiro" : "font-fraunces font-bold"
          } text-[15px] sm:text-[17px] text-sindoor-800 leading-tight`}
          style={{ textShadow: "1px 1px 0 rgba(201,162,74,0.25)" }}
        >
          {isHi ? "बड़ा मंगल भंडारा" : "BADA MANGAL BHANDARA"}
        </p>
        <p className="mt-1 text-[8px] text-ink-600">
          {isHi ? "आप सपरिवार सादर आमंत्रित हैं" : "You are warmly invited"}
        </p>

        {/* Name plaque */}
        <div className="mt-2 px-2 py-1 border-2 border-sindoor-700 bg-saffron-50 rounded-md">
          <p
            className={`${
              isHi ? "font-tiro" : "font-fraunces font-bold"
            } text-[11px] text-sindoor-900`}
          >
            {isHi ? "श्रीवास्तव परिवार" : "Shrivastav Pariwar"}
          </p>
        </div>

        {/* Programme box */}
        <div className="mt-2.5 w-full px-2 py-1.5 border border-dashed border-saffron-600 rounded-md bg-cream-50">
          <p className="text-[7px] text-sindoor-700 font-bold tracking-wide">
            {isHi ? "कार्यक्रम विवरण" : "PROGRAMME"}
          </p>
          <div className="mt-1 space-y-0.5">
            <p className="text-[7px] text-ink-900 text-left">
              <span className="font-bold text-sindoor-700">
                {isHi ? "दिनांक:" : "Date:"}
              </span>{" "}
              {isHi ? "12 मई, मंगलवार" : "12 May, Tuesday"}
            </p>
            <p className="text-[7px] text-ink-900 text-left">
              <span className="font-bold text-saffron-600">
                {isHi ? "समय:" : "Time:"}
              </span>{" "}
              {isHi ? "11:00 बजे से" : "From 11:00 AM"}
            </p>
            <p className="text-[7px] text-ink-900 text-left">
              <span className="font-bold text-saffron-600">
                {isHi ? "स्थान:" : "Place:"}
              </span>{" "}
              {isHi ? "हनुमान मंदिर, अलीगंज" : "Hanuman Mandir, Aliganj"}
            </p>
          </div>
        </div>

        {/* Closer + QR */}
        <p
          className={`mt-auto mb-1 ${
            isHi ? "font-tiro" : "font-fraunces font-bold"
          } text-[9px] text-sindoor-700`}
        >
          {isHi ? "॥ जय श्री राम · जय हनुमान ॥" : "JAI SHRI RAM · JAI HANUMAN"}
        </p>
        <div className="flex items-center gap-1">
          <div className="w-7 h-7 rounded-sm bg-ink-900 grid grid-cols-3 grid-rows-3 gap-px p-px">
            {/* Crude QR-ish pattern */}
            {Array.from({ length: 9 }).map((_, i) => (
              <span
                key={i}
                className={`block w-full h-full ${
                  [0, 2, 3, 5, 7, 8].includes(i) ? "bg-cream-50" : "bg-ink-900"
                }`}
              />
            ))}
          </div>
          <p className="text-[6px] text-ink-700 uppercase tracking-wider font-semibold">
            BadaMangal.com
          </p>
        </div>
      </div>
    </div>
  );
}
