import type { Metadata } from "next";
import { cookies } from "next/headers";
import LiveFeedTimeline from "@/components/LiveFeedTimeline";
import { strings } from "@/content/strings";
import { prisma } from "@/lib/db";
import { LANG_COOKIE, resolveLocale } from "@/lib/i18n";
import { localised } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live from the bhandara, Bada Mangal Lucknow today · BadaMangal",
  description:
    "Real-time photos and updates from Bada Mangal bhandaras across Lucknow. See what's serving right now, where the crowds are, and follow the city's seva live.",
  alternates: localised("/live"),
  openGraph: {
    title: "Live from Lucknow's Bada Mangal bhandaras · BadaMangal",
    description:
      "Photos and updates from devotees across the city, refreshed in real time. Follow the seva live.",
    type: "website",
    locale: "hi_IN",
    alternateLocale: "en_IN",
  },
};

type SearchParams = Promise<{ lang?: string; bhandara?: string }>;

export default async function LivePage({
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
  const t = strings[locale];
  const isHi = locale === "hi";

  // Spots-only feed. The Post model (per-bhandara comments) was removed,
  // so the live timeline now shows just crowd-sourced photo/pin reports
  // that passers-by drop via the /spot form, auto-expiring after 8h.
  const spotRecords = await prisma.spot.findMany({
    where: {
      status: "APPROVED",
      expiresAt: { gt: new Date() },
      ...(sp.bhandara ? { bhandara: { slug: sp.bhandara } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      bhandara: {
        select: { slug: true, name: true, nameHi: true, lat: true, lng: true },
      },
    },
  });

  const spots = spotRecords.map((s) => ({
    id: `spot:${s.id}`,
    // Spots have their own coordinates even when not linked to a bhandara,
    // so the feed's "Get directions" CTA always works.
    bhandaraSlug: s.bhandara?.slug ?? null,
    bhandaraName:
      (locale === "hi" ? s.bhandara?.nameHi : s.bhandara?.name) ??
      s.bhandara?.name ??
      null,
    bhandaraLat: s.bhandara?.lat ?? s.lat,
    bhandaraLng: s.bhandara?.lng ?? s.lng,
    authorName:
      s.reporterName?.trim() ||
      (locale === "hi" ? "स्पॉटर" : "Spotter"),
    text: s.caption,
    photoUrl: s.photoUrl,
    language: s.language,
    createdAt: s.createdAt.toISOString(),
  }));


  const feed = spots.slice(0, 50);

  // For the "filter by bhandara" pill list, surface every approved bhandara
  // that has a currently-live spot tied to it.
  const bhandarasWithActivity = await prisma.bhandara.findMany({
    where: {
      status: "APPROVED",
      spots: {
        some: { status: "APPROVED", expiresAt: { gt: new Date() } },
      },
    },
    orderBy: { name: "asc" },
    select: { slug: true, name: true, nameHi: true },
    take: 40,
  });

  return (
    <div className="relative">
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 pt-10 pb-6 sm:pt-14 sm:pb-8 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron-50 border border-saffron-500/40 px-3 py-1 text-[0.65rem] font-mukta uppercase tracking-[0.28em] text-saffron-600 font-semibold">
          <span className="block w-1.5 h-1.5 rounded-full bg-saffron-600 motion-safe:animate-pulse" />
          {isHi ? "लाइव" : "Live"}
        </span>
        <h1
          className={`mt-4 text-4xl sm:text-5xl ${
            isHi ? "font-tiro text-sindoor-700" : "font-fraunces font-semibold text-sindoor-700"
          }`}
        >
          {isHi ? "भंडारा से सीधा" : "Live from the bhandara"}
        </h1>
        <p className="mt-3 text-ink-600 max-w-2xl mx-auto leading-relaxed">
          {isHi
            ? "लखनऊ के पंडालों से तस्वीरें, संदेश, और सेवा की झलक, हर कुछ सेकंड में नई।"
            : "Photos, blessings, and live updates from Lucknow's pandals, refreshed every few seconds."}
        </p>
      </section>

      <LiveFeedTimeline
        initial={feed}
        bhandaras={bhandarasWithActivity.map((b) => ({
          slug: b.slug,
          name: (locale === "hi" ? (b.nameHi ?? b.name) : b.name) ?? b.name,
        }))}
        activeBhandara={sp.bhandara ?? null}
        locale={locale}
        kicker={t.stats.sectionKicker}
        emptyHi="अभी कोई पोस्ट नहीं। बहुत जल्द भंडारा से तस्वीरें यहाँ दिखेंगी।"
        emptyEn="No posts yet. Photos and updates from the bhandara will appear here soon."
      />
    </div>
  );
}
