"use client";

import Link from "next/link";
import { JaliCorner } from "@/components/ornaments";
import { useLocaleFromContext } from "@/lib/locale-context";

/**
 * Homepage promo banner for /organise-bhandara.
 *
 * Sits below AreaIndexGrid (in the slot the soft-launched PamphletPromo
 * used to occupy), targets visitors who came to the homepage for
 * discovery but might also want full-service organising help. Deep-
 * links with ?from=banner so the lead-capture email knows the
 * inbound channel.
 *
 * Two CTAs: primary "Get a free quote" goes straight to the form
 * anchor on /organise-bhandara; secondary "See packages" goes to
 * the same page's packages section. Both honour the lang query so
 * locale carries through.
 */
export default function OrganisePromo() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const langSuffix = locale === "en" ? "&lang=en" : "";

  return (
    <section
      aria-labelledby="organise-promo-heading"
      className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-14"
    >
      <div
        className="relative overflow-hidden rounded-3xl border border-saffron-500/45 p-8 sm:p-12 shadow-warm"
        style={{
          background:
            "radial-gradient(600px 300px at 15% 0%, rgba(242,148,76,0.22), transparent 65%), radial-gradient(600px 300px at 85% 100%, rgba(156,42,42,0.14), transparent 65%), linear-gradient(180deg, #FFF7EB 0%, #FBF7F0 100%)",
        }}
      >
        <JaliCorner position="tl" className="absolute top-3 left-3 w-9 h-9 text-gold-500/55" />
        <JaliCorner position="tr" className="absolute top-3 right-3 w-9 h-9 text-gold-500/55" />
        <JaliCorner position="bl" className="absolute bottom-3 left-3 w-9 h-9 text-gold-500/55" />
        <JaliCorner position="br" className="absolute bottom-3 right-3 w-9 h-9 text-gold-500/55" />

        <div className="text-center max-w-2xl mx-auto">
          <p className="font-mukta uppercase tracking-[0.3em] text-saffron-600 text-[0.65rem] sm:text-xs font-semibold inline-flex items-center gap-2">
            <span aria-hidden className="block w-1.5 h-1.5 rounded-full bg-saffron-600" />
            {isHi ? "पूर्ण सेवा आयोजन" : "Full-service organising"}
          </p>
          <h2
            id="organise-promo-heading"
            className={`mt-3 text-2xl sm:text-3xl text-sindoor-700 leading-tight [text-wrap:balance] ${
              isHi ? "font-tiro" : "font-fraunces font-semibold"
            }`}
          >
            {isHi
              ? "भंडारा आयोजित करना चाहते हैं? बाक़ी सब हम पर छोड़ दें।"
              : "Want to organise a bhandara? We'll handle the rest."}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-ink-600 leading-relaxed">
            {isHi
              ? "टेंट, कैटरिंग, थाली, प्रसाद, परिवहन। पैकेज चुनें या अपना बनाएँ, हमारी टीम हर इंतज़ाम करती है।"
              : "Tent, catering, plates, prasad, transport. Pick a package or build your own, our team handles the logistics end-to-end."}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/organise-bhandara?from=banner${langSuffix}`}
              data-ga="organise_banner_cta"
              data-ga-source="banner"
              className="btn btn-primary"
            >
              {isHi ? "मुफ़्त क़ीमत मँगवाएँ" : "Get a free quote"}
              <span aria-hidden>→</span>
            </Link>
            <Link
              href={`/organise-bhandara?from=banner${langSuffix}#packages`}
              data-ga="organise_banner_packages"
              data-ga-source="banner"
              className="btn btn-ghost"
            >
              {isHi ? "पैकेज देखें" : "See packages"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
