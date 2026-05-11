import type { Metadata } from "next";
import { cookies } from "next/headers";
import SpotQuickForm from "@/components/SpotQuickForm";
import { LANG_COOKIE, resolveLocale } from "@/lib/i18n";
import { localised } from "@/lib/seo";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Spot a bhandara, share a Bada Mangal sighting · BadaMangal",
  description:
    "Walked past a Bada Mangal bhandara in Lucknow? Add a photo and your location in 30 seconds, no login. Goes live on the city map for 8 hours.",
  alternates: localised("/spot"),
  openGraph: {
    title: "Spot a Bada Mangal bhandara · BadaMangal Lucknow",
    description:
      "One photo and your location is enough, share the bhandara you just walked past with the rest of Lucknow.",
    type: "website",
    locale: "hi_IN",
    alternateLocale: "en_IN",
  },
};

type SearchParams = Promise<{ lang?: string }>;

export default async function SpotPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const c = await cookies();
  const locale = resolveLocale({
    urlLang: sp.lang,
    cookieLang: c.get(LANG_COOKIE)?.value,
  });
  const isHi = locale === "hi";

  // Approved listings still pulled so the form can infer the nearest
  // area from GPS coords (used internally; no list-pick UI in V2).
  const listings = await prisma.bhandara.findMany({
    where: { status: "APPROVED" },
    select: { id: true, slug: true, name: true, nameHi: true, area: true, lat: true, lng: true },
    orderBy: [{ area: "asc" }, { name: "asc" }],
    take: 200,
  });

  return (
    <div className="mx-auto max-w-md sm:max-w-xl lg:max-w-2xl px-4 sm:px-6 py-8 sm:py-12">
      <header className="text-center mb-7">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron-50 border border-saffron-500/40 px-3 py-1 text-[0.62rem] font-mukta uppercase tracking-[0.28em] text-saffron-600 font-semibold">
          <span className="block w-1.5 h-1.5 rounded-full bg-saffron-600 motion-safe:animate-pulse" />
          {isHi ? "स्पॉट करें" : "Spot"}
        </span>
        <h1
          className={`mt-3 text-3xl sm:text-[2.25rem] leading-tight ${
            isHi
              ? "font-tiro text-sindoor-700"
              : "font-fraunces font-semibold text-sindoor-700"
          }`}
        >
          {isHi
            ? "क्या आपने अभी कोई भंडारा देखा?"
            : "Spotted a bhandara nearby?"}
        </h1>
        <p className="mt-2 text-sm text-ink-600 leading-relaxed">
          {isHi
            ? "एक फ़ोटो, आपकी लोकेशन, बस। बाक़ी हम संभालेंगे।"
            : "One photo and your location is enough. We'll handle the rest."}
        </p>

        {/* Trust strip — moved to the top so people see it before doubting */}
        <div className="mt-4 inline-flex items-center gap-2 sm:gap-3 flex-wrap justify-center text-[11px] text-ink-600">
          <span className="inline-flex items-center gap-1">
            <IconClock /> {isHi ? "30 सेकंड" : "30 seconds"}
          </span>
          <span aria-hidden className="text-gold-500/55">·</span>
          <span className="inline-flex items-center gap-1">
            <IconLock /> {isHi ? "लॉगिन ज़रूरी नहीं" : "no login needed"}
          </span>
          <span aria-hidden className="text-gold-500/55">·</span>
          <span className="inline-flex items-center gap-1">
            <IconClockExpire /> {isHi ? "8 घंटे तक लाइव" : "8 hours on the map"}
          </span>
        </div>
      </header>

      <SpotQuickForm
        locale={locale}
        bhandaras={listings.map((b) => ({
          id: b.id,
          slug: b.slug,
          name: b.name,
          nameHi: b.nameHi ?? null,
          area: b.area,
          lat: b.lat,
          lng: b.lng,
        }))}
      />
    </div>
  );
}

function IconClock() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
function IconClockExpire() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2" />
      <path d="M9 3h6" />
    </svg>
  );
}
