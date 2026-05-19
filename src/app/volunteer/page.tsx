/**
 * /volunteer — public marketing + recruitment page for the volunteer
 * programme. Server-rendered shell with hero, "how it works",
 * pay structure, FAQ, and a big signup CTA.
 *
 * The actual signup form lives at /volunteer/signup. We keep this
 * page intentionally read-only so it can ISR-cache aggressively;
 * the form has its own client component with React state.
 *
 * Audience: students, delivery boys, porters, existing devotees who
 * want to earn ₹50 per documented bhandara during Bada Mangal +
 * Bade Shanivar days. Copy is Hindi-leaning (the audience) with
 * English for the gig-economy / college layer.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { JaliCorner, MarigoldDivider } from "@/components/ornaments";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Volunteer with BadaMangal · Lucknow",
  description:
    "Help us list every Bada Mangal bhandara in Lucknow. Spend 10 minutes per bhandara taking 10 photos plus 2 videos plus a live spot photo, fill the listing. A small honorarium per documented bhandara, paid via UPI every Sunday.",
  alternates: { canonical: `${SITE_URL}/volunteer` },
  openGraph: {
    title: "Volunteer with BadaMangal",
    description:
      "Document a bhandara during the Bada Mangal season. 10 photos plus 2 videos plus 1 live spot photo, plus the listing fields. Small honorarium per submission, paid via UPI every Sunday.",
    url: `${SITE_URL}/volunteer`,
    type: "website",
  },
};

export default function VolunteerLandingPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 pb-24">
      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section className="relative mt-8 sm:mt-12 rounded-3xl border border-gold-500/40 bg-gradient-to-br from-saffron-50 via-cream-50 to-cream-50 px-6 py-12 sm:px-12 sm:py-16 overflow-hidden">
        <JaliCorner position="tl" className="absolute top-3 left-3 w-12 h-12 text-gold-500/60" />
        <JaliCorner position="tr" className="absolute top-3 right-3 w-12 h-12 text-gold-500/60" />
        <JaliCorner position="bl" className="absolute bottom-3 left-3 w-12 h-12 text-gold-500/60" />
        <JaliCorner position="br" className="absolute bottom-3 right-3 w-12 h-12 text-gold-500/60" />

        <p className="text-xs uppercase tracking-[0.2em] text-saffron-600 font-medium text-center">
          🚩 Volunteer · स्वयंसेवक · Bada Mangal 2026
        </p>
        <h1 className="font-fraunces text-3xl sm:text-5xl text-sindoor-700 mt-3 text-center leading-tight">
          लखनऊ के हर भण्डारे को{" "}
          <br className="hidden sm:block" />
          <span className="text-saffron-600">सबके लिए सुलभ बनाएँ</span>
        </h1>
        <p className="mt-4 text-center text-lg sm:text-xl text-ink-900 max-w-2xl mx-auto">
          अपने क्षेत्र के बड़े मंगल भण्डारों की जानकारी, तस्वीरें और लाइव नक़्शे
          की सूचनाएँ भेजकर हमारी सूची को बढ़ाने में सहयोग कीजिए।
        </p>
        <p className="mt-3 text-center text-base text-ink-600 max-w-2xl mx-auto">
          Help fellow devotees find every bhandara in Lucknow. Spend about 10 minutes
          at a bhandara, document it, and your work goes live on the public directory.
        </p>
        {/* Hero stays seva-only — the honorarium info lives in its
            own dedicated section lower on the page so it's discoverable
            without colouring the lead message as a gig opportunity. */}

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/volunteer/signup"
            data-ga="volunteer_hero_cta"
            data-ga-source="volunteer_page_hero"
            className="inline-flex items-center gap-2 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-6 py-3 text-base shadow-sm transition-colors"
          >
            🙏 अभी जुड़ें · Apply to volunteer →
          </Link>
          <a
            href="#how"
            data-ga="volunteer_hero_how"
            className="inline-flex items-center gap-2 rounded-full border border-gold-500/60 bg-cream-50 hover:bg-saffron-50 text-ink-900 font-medium px-6 py-3 text-base transition-colors"
          >
            कैसे काम करता है? · How it works
          </a>
        </div>
      </section>

      <div className="my-10 flex justify-center">
        <MarigoldDivider size={320} className="text-gold-500" />
      </div>

      {/* ─── How it works ────────────────────────────────────── */}
      <section id="how" className="mt-4">
        <h2 className="font-fraunces text-2xl sm:text-3xl text-sindoor-700 text-center">
          कैसे काम करता है · How it works
        </h2>
        <p className="mt-2 text-center text-sm text-ink-600">
          4 steps · ~10 minutes per bhandara
        </p>

        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Step
            num="1"
            title="Apply"
            titleHi="आवेदन करें"
            body="Fill 1 short form: name, WhatsApp, UPI ID, your areas. Our team manually reviews each application within 24 hours and sends your volunteer code to your WhatsApp."
          />
          <Step
            num="2"
            title="Visit a bhandara"
            titleHi="भण्डारे पर जाएँ"
            body="Tuesdays + Saturdays in Jyeshtha mass. Pick any bhandara in your area you can reach in 10 minutes."
          />
          <Step
            num="3"
            title="Capture + submit"
            titleHi="फोटो + विवरण भेजें"
            body="10 photos + 2 videos + 1 live-map photo + fill the listing form (name, address, time, menu). Done in under 10 minutes."
          />
          <Step
            num="4"
            title="Honorarium"
            titleHi="सेवा-राशि"
            body="Approved submissions are acknowledged with a small honorarium via UPI every Sunday. Think of it as a thank-you for the time you spent, not a wage."
          />
        </div>
      </section>

      <div className="my-10 flex justify-center">
        <MarigoldDivider size={320} className="text-gold-500" />
      </div>

      {/* ─── What each submission needs ───────────────────────── */}
      <section className="mt-4">
        <h2 className="font-fraunces text-2xl sm:text-3xl text-sindoor-700 text-center">
          एक पूर्ण submission में क्या चाहिए · What each submission needs
        </h2>
        <p className="mt-2 text-center text-sm text-ink-600 max-w-xl mx-auto">
          एक भण्डारे पर ~10 मिनट लगते हैं। Each item below helps fellow devotees actually find and reach the bhandara.
        </p>

        <div className="mt-6 rounded-3xl border border-gold-500/40 bg-cream-50 p-6 sm:p-8 shadow-sm">
          <ul className="grid sm:grid-cols-2 gap-4">
            <BundleItem
              emoji="📸"
              title="10 photos"
              body="2-3 each: VENUE (pandal, decoration) · PEOPLE (devotees, organizers, queue) · FOOD (puri, sabzi, prasad) · BANNER (the invite poster)"
            />
            <BundleItem
              emoji="🎥"
              title="2 videos"
              body="10-30 seconds each. One pandal pan, one prasad-serving moment."
            />
            <BundleItem
              emoji="📍"
              title="1 live spot photo"
              body="Taken RIGHT NOW where you're standing. Goes on the live city map for 8 hours so other devotees can see this bhandara is active."
            />
            <BundleItem
              emoji="📋"
              title="Listing fields"
              body="Bhandara name, area, address, organizer name, start time, menu. Read off the banner or ask the organizer."
            />
          </ul>

          <div className="mt-6 rounded-2xl border border-saffron-600/40 bg-saffron-50/60 p-4">
            <p className="text-sm text-ink-900">
              <strong>Acknowledgement (honorarium):</strong>{" "}
              full submission ₹50 · partial submission ₹25 · fake / incomplete: nothing.
            </p>
            <p className="mt-1 text-xs text-ink-600">
              GPS is auto-checked at submit time, so the photos must be taken from the actual bhandara location. Stock images or photos from a previous Tuesday are rejected. The honorarium exists to thank volunteers for their time, not to incentivise volume.
            </p>
          </div>
        </div>
      </section>

      <div className="my-10 flex justify-center">
        <MarigoldDivider size={320} className="text-gold-500" />
      </div>

      {/* ─── Honorarium info ──────────────────────────────────────
          Dedicated, lowkey "is there money?" answer placed mid-page
          so curious visitors find it without having to dig through
          the FAQ, but it doesn't lead the hero (which is and should
          stay seva-framed, not gig-economy-framed). Cream-soft card
          on a single line of copy: the ₹50 number is named once,
          the framing wraps it as a thank-you, not a wage. */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 mt-4">
        <div className="rounded-2xl border border-gold-500/40 bg-cream-50/70 px-5 py-5 sm:px-6 sm:py-6 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-saffron-600 font-medium">
            सेवा-राशि · About the honorarium
          </p>
          {/* Hindi sentence */}
          <p className="mt-3 text-sm sm:text-base text-ink-900 leading-relaxed">
            प्रत्येक स्वीकृत प्रविष्टि पर{" "}
            <strong>₹50 की सेवा-राशि</strong> हर रविवार आपके UPI पर
            भेजी जाती है। (अधूरी प्रविष्टि पर ₹25)
          </p>
          {/* English sentence, separate line */}
          <p className="mt-2 text-sm sm:text-base text-ink-900 leading-relaxed">
            <strong>₹50</strong> honorarium per approved submission,
            paid to your UPI every Sunday. (₹25 for partial submissions.)
          </p>
          {/* Bilingual closing note, each line one language */}
          <p className="mt-3 text-xs text-ink-600 italic leading-relaxed">
            यह आपके समय और श्रम के प्रति एक छोटी कृतज्ञता है, वेतन नहीं।
          </p>
          <p className="mt-1 text-xs text-ink-600 italic leading-relaxed">
            Think of it as a thank-you for your time, not a wage.
          </p>
        </div>
      </section>

      <div className="my-10 flex justify-center">
        <MarigoldDivider size={320} className="text-gold-500" />
      </div>

      {/* ─── Who can join ──────────────────────────────────────── */}
      <section className="mt-4">
        <h2 className="font-fraunces text-2xl sm:text-3xl text-sindoor-700 text-center">
          कौन जुड़ सकता है · Who can join
        </h2>
        <p className="mt-2 text-center text-sm text-ink-600">
          You need a smartphone + WhatsApp + UPI. That's it.
        </p>

        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <AudienceCard
            emoji="🎓"
            title="Students"
            body="Free on Tuesday + Saturday mornings. Want to contribute to a local service project."
          />
          <AudienceCard
            emoji="🛵"
            title="Delivery partners"
            body="Already on the road all day. A 5-minute bhandara stop fits between deliveries."
          />
          <AudienceCard
            emoji="🙏"
            title="Devotees"
            body="If you're going to a bhandara anyway, document it. Sewa + a small honorarium for the effort."
          />
          <AudienceCard
            emoji="🚖"
            title="Drivers"
            body="Bhandaras are on every route during Jyeshtha. Pause briefly, contribute, continue."
          />
        </div>
      </section>

      <div className="my-10 flex justify-center">
        <MarigoldDivider size={320} className="text-gold-500" />
      </div>

      {/* ─── FAQ ───────────────────────────────────────────────── */}
      <section className="mt-4">
        <h2 className="font-fraunces text-2xl sm:text-3xl text-sindoor-700 text-center">
          सवाल-जवाब · FAQ
        </h2>

        <div className="mt-6 grid gap-3">
          <Faq
            qHi="कब और कितनी सेवा-राशि मिलेगी?"
            qEn="When + how much honorarium do I receive?"
            aHi="हर स्वीकृत प्रविष्टि पर ₹50, हर रविवार आपके UPI पर। आप जितने भण्डारे कर सकें, उतने करें। कोई न्यूनतम सीमा नहीं, कोई अधिकतम सीमा नहीं।"
            aEn="₹50 per approved submission, paid to your UPI every Sunday. You decide how many bhandaras to document. No minimum, no cap."
          />
          <Faq
            qHi="अगर मेरी प्रविष्टि अस्वीकृत हो जाए तो?"
            qEn="What if my submission is rejected?"
            aHi="हम WhatsApp पर कारण बताएँगे — आमतौर पर तस्वीरें धुँधली होने, बैनर न होने, GPS मेल न खाने, या किसी और ने पहले वही भण्डारा भेज देने पर। आप दूसरा भण्डारा कर सकते हैं, कोई दंड नहीं।"
            aEn="We'll WhatsApp you the reason — usually blurry photos, missing banner, GPS mismatch, or duplicate (someone else submitted it first). You can submit another bhandara, no penalty."
          />
          <Faq
            qHi="क्या मुझे रोज़ काम करना होगा?"
            qEn="Do I have to work every day?"
            aHi="नहीं। सिर्फ बड़े मंगल (मंगलवार) और बड़े शनिवार के दिन। बीच के दिनों में कोई काम नहीं। पूरे ऋतु में कुल मिलाकर 10 दिन।"
            aEn="No. Only on Bada Mangal (Tuesday) and Bade Shanivar (Saturday) days. Nothing in between. About 10 days across the whole season."
          />
          <Faq
            qHi="मेरा volunteer code खो गया तो?"
            qEn="I lost my volunteer code?"
            aHi="WhatsApp पर हमें अपना मोबाइल नंबर भेज दीजिए, हम code दोबारा भेज देंगे।"
            aEn="Send us your mobile number on WhatsApp and we'll resend your code."
          />
          <Faq
            qHi="दो लोगों ने एक ही भण्डारा भेजा तो?"
            qEn="If two volunteers submit the same bhandara?"
            aHi="पहले जिसने पूरी प्रविष्टि भेजी, उसे सेवा-राशि मिलेगी। दूसरे को 'DUPLICATE' संदेश मिल जाएगा, कोई सेवा-राशि नहीं। इसलिए जल्दी प्रविष्टि भेजना ज़रूरी है।"
            aEn="Whoever submitted the complete entry first receives the honorarium. The other gets a 'DUPLICATE' notice, no honorarium. So submitting quickly matters."
          />
        </div>
      </section>

      <div className="my-10 flex justify-center">
        <MarigoldDivider size={320} className="text-gold-500" />
      </div>

      {/* ─── Final CTA ─────────────────────────────────────────── */}
      <section className="mt-4 text-center">
        <h2 className="font-fraunces text-2xl sm:text-3xl text-sindoor-700">
          तैयार हैं? · Ready to start?
        </h2>
        <p className="mt-3 text-base text-ink-600 max-w-xl mx-auto">
          आवेदन सिर्फ 30 seconds में। Approval के बाद आपका volunteer code WhatsApp पर 24 घंटे के अंदर भेज दिया जाएगा।
        </p>
        <Link
          href="/volunteer/signup"
          data-ga="volunteer_final_cta"
          data-ga-source="volunteer_page_footer"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-8 py-3.5 text-base shadow-sm transition-colors"
        >
          🙏 अभी जुड़ें · Apply to volunteer →
        </Link>
        <p className="mt-4 text-xs text-ink-600">
          सवाल हो तो WhatsApp करें · Questions? WhatsApp the BadaMangal team.
        </p>
      </section>
    </main>
  );
}

/* ─── Small inline sub-components ────────────────────────────── */

function Step({
  num,
  title,
  titleHi,
  body,
}: {
  num: string;
  title: string;
  titleHi: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-gold-500/40 bg-cream-50 p-5 shadow-sm">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-saffron-600 text-cream-50 font-fraunces text-xl">
        {num}
      </div>
      <h3 className="mt-3 font-fraunces text-lg text-sindoor-700">{title}</h3>
      <p className="text-sm text-saffron-600 font-medium">{titleHi}</p>
      <p className="mt-2 text-sm text-ink-600 leading-relaxed">{body}</p>
    </div>
  );
}

function BundleItem({
  emoji,
  title,
  body,
}: {
  emoji: string;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="text-2xl flex-shrink-0">
        {emoji}
      </span>
      <div>
        <p className="font-medium text-ink-900">{title}</p>
        <p className="text-sm text-ink-600 leading-relaxed">{body}</p>
      </div>
    </li>
  );
}

function AudienceCard({
  emoji,
  title,
  body,
}: {
  emoji: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-gold-500/40 bg-cream-50 p-5 shadow-sm">
      <span aria-hidden className="text-3xl">
        {emoji}
      </span>
      <h3 className="mt-2 font-medium text-ink-900">{title}</h3>
      <p className="mt-1 text-sm text-ink-600 leading-relaxed">{body}</p>
    </div>
  );
}

/**
 * FAQ entry with cleanly-separated bilingual content. Hindi question
 * + Hindi answer go on their own lines; English question + English
 * answer go on theirs. No inline code-switching ("WhatsApp पर reason
 * बताएँगे..."), which was hard to scan and made the page feel
 * cluttered. Devanagari + Latin readers can each lock onto their
 * own column without parsing the other.
 */
function Faq({
  qHi,
  qEn,
  aHi,
  aEn,
}: {
  qHi: string;
  qEn: string;
  aHi: string;
  aEn: string;
}) {
  return (
    <details className="group rounded-2xl border border-gold-500/40 bg-cream-50 p-4 shadow-sm">
      <summary className="cursor-pointer list-none flex justify-between items-start gap-3 font-medium text-ink-900">
        <span>
          <span className="block">{qHi}</span>
          <span className="block mt-0.5 text-sm font-normal text-ink-600">
            {qEn}
          </span>
        </span>
        <span className="text-saffron-600 group-open:rotate-45 transition-transform text-xl leading-none shrink-0">
          +
        </span>
      </summary>
      <p className="mt-3 text-sm text-ink-900 leading-relaxed">{aHi}</p>
      <p className="mt-2 text-sm text-ink-600 leading-relaxed">{aEn}</p>
    </details>
  );
}
