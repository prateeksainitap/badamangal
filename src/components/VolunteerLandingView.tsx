"use client";

/**
 * /volunteer landing body, single-language render.
 *
 * The /volunteer page used to interleave Hindi and English in every
 * section (a Hindi line followed by an English line for every
 * heading, body, persona, FAQ question + answer, step body…). With
 * the LangToggle in the global header letting the visitor pick a
 * language, the bilingual interleave became visual noise: Hindi
 * readers had to scan past English duplicates and vice versa.
 *
 * This component reads `useLocaleFromContext` and renders ONE
 * language end-to-end. Toggle the pill in the header → entire page
 * re-renders in that language without a server round-trip.
 *
 * Why a client component:
 *   /volunteer/page.tsx stays as a server shell so the `metadata`
 *   export keeps powering the SEO snippet + social cards. All
 *   visible body content lives here so it can react synchronously
 *   to the language toggle.
 */

import { useLocaleFromContext } from "@/lib/locale-context";
import VolunteerSignupForm from "@/components/volunteer/VolunteerSignupForm";
import { JaliCorner, MarigoldDivider } from "@/components/ornaments";

type Locale = "hi" | "en";

type StringsBlock = {
  eyebrow: string;
  h1Part1: string;
  h1Part2: string;
  pill: string;
  bodyParagraph: string;
  personas: { emoji: string; label: string }[];
  stats: { value: string; label: string }[];
  stepsHeading: string;
  stepsSub: string;
  steps: { num: string; emoji: string; title: string; body: string }[];
  /** Roles beyond field-volunteering (phone outreach, moderation,
   *  content, tech). The 3-step "How your seva flows" block above
   *  covers the field-volunteer path; this block opens up the rest
   *  of the contribution surface for people who can't do field work
   *  but want to help in other ways. */
  contributionsHeading: string;
  contributionsSub: string;
  contributions: { emoji: string; title: string; body: string }[];
  contributionsFooter: string;
  formEyebrow: string;
  formHeading: string;
  formHelper: string;
  faqHeading: string;
  faqSub: string;
  faq: { q: string; a: string }[];
  benediction: string;
  benedictionSub: string;
};

const COPY: Record<Locale, StringsBlock> = {
  hi: {
    eyebrow: "🚩 स्वयंसेवक · बड़ा मंगल 2026",
    h1Part1: "लखनऊ के हर भण्डारे को",
    h1Part2: "सबके लिए सुलभ बनाएँ",
    pill: "🙏 केवल सेवा · कोई शुल्क नहीं",
    bodyParagraph:
      "डिलीवरी राइडर, कैब ड्राइवर, छात्र, या कोई भी जो योगदान देना चाहता है, अपने इलाके के भण्डारों की जानकारी, तस्वीरें और स्थान दर्ज करने में मदद करें। पूरे आठ मंगलवार के सीज़न के लिए हमारे WhatsApp समूह में जुड़ें।",
    personas: [
      { emoji: "🛵", label: "डिलीवरी राइडर" },
      { emoji: "🚖", label: "कैब ड्राइवर" },
      { emoji: "🎓", label: "छात्र" },
      { emoji: "✨", label: "आप भी" },
    ],
    stats: [
      { value: "8", label: "मंगलवार" },
      { value: "100+", label: "भण्डारे दर्ज करने हैं" },
      { value: "9,600+", label: "लखनऊ वासी पहले से जुड़े" },
    ],
    stepsHeading: "सेवा कैसे होती है",
    stepsSub: "तीन कदम। हर भण्डारे में लगभग 10 मिनट।",
    steps: [
      {
        num: "1",
        emoji: "📝",
        title: "जुड़ें",
        body: "ऊपर वाला form भरें। 24 घंटे के अंदर आपको volunteer WhatsApp समूह में जोड़ देंगे।",
      },
      {
        num: "2",
        emoji: "📸",
        title: "भण्डारे पर जाएँ",
        body: "ज्येष्ठ माह के मंगलवार + शनिवार। तस्वीरें, समय, स्थान, प्रसाद, हर भण्डारे में करीब 10 मिनट।",
      },
      {
        num: "3",
        emoji: "🗺️",
        title: "लाइव हो जाता है",
        body: "हम review करके public directory + लाइव शहरी नक्शे पर publish करते हैं। हज़ारों श्रद्धालु अब इसे ढूँढ सकते हैं।",
      },
    ],
    contributionsHeading: "और तरीक़े जिनसे सेवा दे सकते हैं",
    contributionsSub: "Field volunteering के अलावा भी, मिशन के पीछे बहुत हाथ चाहिए।",
    contributions: [
      {
        emoji: "📸",
        title: "Field volunteer",
        body: "अपने इलाक़े के भंडारे की photo + location WhatsApp group में share करना।",
      },
      {
        emoji: "📞",
        title: "Phone seva",
        body: "आयोजकों से call करके timings और address confirm करना।",
      },
      {
        emoji: "🛡️",
        title: "Moderator",
        body: "Community groups को साफ़-सुथरा और on-topic रखना, spam हटाना।",
      },
      {
        emoji: "✏️",
        title: "Content writer",
        body: "Hindi / English में posts लिखना, social media पर share करना।",
      },
      {
        emoji: "💻",
        title: "Tech contributor",
        body: "Website में features बनाना, tools में help करना, day-to-day brainstorming।",
      },
    ],
    contributionsFooter:
      "कोई भी skill, थोड़ा भी समय, मन से जो भी contribute कर सकते हैं, sab welcome है।",
    formEyebrow: "अभी जुड़ें",
    formHeading: "30 seconds का form",
    formHelper:
      "24 घंटे के अंदर हम आपको volunteer WhatsApp समूह में जोड़ देंगे और unique code भेजेंगे।",
    faqHeading: "सवाल-जवाब",
    faqSub: "हर सवाल पर tap करें।",
    faq: [
      {
        q: "क्या यह कोई नौकरी है? वेतन मिलेगा?",
        a: "नहीं। यह पूर्णतः स्वयंसेवक-आधारित निःशुल्क सेवा है। कोई वेतन नहीं मिलता। आप अपनी इच्छानुसार बड़े मंगल के दिन अपने क्षेत्र के भण्डारों की जानकारी हमें भेजते हैं।",
      },
      {
        q: "क्या मुझे रोज़ काम करना होगा?",
        a: "नहीं। सिर्फ बड़े मंगल (मंगलवार) और बड़े शनिवार के दिन। पूरे सीज़न में लगभग 10 दिन।",
      },
      {
        q: "क्या एक मंगलवार पर एक से ज़्यादा भण्डारा भेज सकते हैं?",
        a: "हाँ। जितने भण्डारे आप अपने क्षेत्र में पहुँच सकें, सब भेज सकते हैं। हर submission पर हमारी team review करती है।",
      },
      {
        q: "अगर मेरी प्रविष्टि अस्वीकृत हो जाए तो?",
        a: "हम WhatsApp पर कारण बताएँगे, आमतौर पर तस्वीरें धुँधली होने, बैनर न होने, या किसी और ने पहले वही भण्डारा भेज देने पर। आप दूसरा भण्डारा कर सकते हैं।",
      },
      {
        q: "मेरा volunteer code खो गया तो?",
        a: "WhatsApp पर हमें अपना मोबाइल नंबर भेज दीजिए, हम code दोबारा भेज देंगे।",
      },
    ],
    benediction: "🙏 जय श्री राम · जय हनुमान",
    benedictionSub: "सवाल हो तो WhatsApp करें।",
  },
  en: {
    eyebrow: "🚩 Volunteer · Bada Mangal 2026",
    h1Part1: "Make every bhandara in Lucknow",
    h1Part2: "easy to find for everyone",
    pill: "🙏 Pure seva · No fee",
    bodyParagraph:
      "Delivery riders, cab drivers, students, anyone with a phone who wants to contribute. Help us log bhandaras in your area with photos, time, and location. You get added to our volunteer WhatsApp group for the full 8-Tuesday Adhik Mas season.",
    personas: [
      { emoji: "🛵", label: "Delivery riders" },
      { emoji: "🚖", label: "Cab drivers" },
      { emoji: "🎓", label: "Students" },
      { emoji: "✨", label: "Anyone, really" },
    ],
    stats: [
      { value: "8", label: "Tuesdays" },
      { value: "100+", label: "bhandaras to log" },
      { value: "9,600+", label: "community already in" },
    ],
    stepsHeading: "How your seva flows",
    stepsSub: "Three steps. About 10 minutes per bhandara.",
    steps: [
      {
        num: "1",
        emoji: "📝",
        title: "Sign up",
        body: "Fill the form above. We'll add you to the volunteer WhatsApp group within 24 hours.",
      },
      {
        num: "2",
        emoji: "📸",
        title: "Visit & document",
        body: "Tuesdays + Saturdays in Jyeshtha. Photos, time, location, prasad. About 10 minutes per bhandara.",
      },
      {
        num: "3",
        emoji: "🗺️",
        title: "Goes live",
        body: "We review and publish on the public directory + the live city map. Thousands of devotees can now find it.",
      },
    ],
    contributionsHeading: "Other ways to contribute",
    contributionsSub:
      "Field volunteering isn't the only path. The mission needs many hands.",
    contributions: [
      {
        emoji: "📸",
        title: "Field volunteer",
        body: "Share photos + locations of bhandaras in your area to our WhatsApp group.",
      },
      {
        emoji: "📞",
        title: "Phone seva",
        body: "Call organizers to confirm timings and address.",
      },
      {
        emoji: "🛡️",
        title: "Moderator",
        body: "Keep the community groups clean and on-topic, remove spam.",
      },
      {
        emoji: "✏️",
        title: "Content writer",
        body: "Write posts in Hindi or English, help with social media.",
      },
      {
        emoji: "💻",
        title: "Tech contributor",
        body: "Build features for the website, help with tools, day-to-day brainstorming.",
      },
    ],
    contributionsFooter:
      "Any skill, any amount of time, anything you can offer is welcome.",
    formEyebrow: "Sign up",
    formHeading: "30-second form",
    formHelper:
      "We'll add you to the volunteer WhatsApp group within 24 hours and send your unique code.",
    faqHeading: "FAQ",
    faqSub: "Tap to expand.",
    faq: [
      {
        q: "Is this a job? Will I get paid?",
        a: "No, it's purely a volunteer-led free seva. There is no payment of any kind. You contribute on Bada Mangal Tuesdays when you have time.",
      },
      {
        q: "Do I have to volunteer every day?",
        a: "No. Only on Bada Mangal Tuesdays + Bade Shanivar days. About 10 days across the whole season.",
      },
      {
        q: "Can I document more than one bhandara per Tuesday?",
        a: "Yes. Submit as many bhandaras as you can visit in your area. We review each one.",
      },
      {
        q: "What if my submission is rejected?",
        a: "We'll WhatsApp you the reason. Usually blurry photos, missing banner, or duplicate. Just submit another bhandara.",
      },
      {
        q: "I lost my volunteer code?",
        a: "WhatsApp us your mobile number, we'll resend the code.",
      },
    ],
    benediction: "🙏 Jai Shri Ram · Jai Hanuman",
    benedictionSub: "Questions? WhatsApp the BadaMangal team.",
  },
};

export default function VolunteerLandingView() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const t = COPY[isHi ? "hi" : "en"];

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 pb-24">
      {/* ─── Hero (left) + Form (right), 2-col on lg ─────────── */}
      <section className="mt-8 sm:mt-14 grid gap-8 lg:grid-cols-12 lg:gap-12 items-start">
        {/* LEFT 7/12 */}
        <div className="lg:col-span-7">
          <p
            className={`text-xs uppercase tracking-[0.22em] text-saffron-600 font-mono font-semibold ${
              isHi ? "tracking-[0.16em]" : ""
            }`}
          >
            {t.eyebrow}
          </p>

          <h1
            className={`mt-4 text-3xl sm:text-4xl lg:text-5xl text-sindoor-700 leading-tight ${
              isHi ? "font-mukta font-extrabold" : "font-fraunces font-semibold"
            }`}
          >
            {t.h1Part1}{" "}
            <br className="hidden sm:block" />
            <span className="text-saffron-600">{t.h1Part2}</span>
          </h1>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-saffron-500/55 bg-saffron-50 text-sindoor-700 text-xs sm:text-sm font-mono font-semibold uppercase tracking-[0.16em] px-4 py-1.5">
            {t.pill}
          </div>

          <p className="mt-6 text-base sm:text-lg text-ink-900 leading-relaxed max-w-xl">
            {t.bodyParagraph}
          </p>

          {/* Persona chips */}
          <ul className="mt-6 flex flex-wrap gap-2">
            {t.personas.map((p) => (
              <li
                key={p.label}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-sindoor-700 bg-cream-50 border border-saffron-500/40 rounded-full px-3 py-1.5"
              >
                <span aria-hidden>{p.emoji}</span>
                {p.label}
              </li>
            ))}
          </ul>

          {/* Stats, bigger + bolder, homepage register */}
          <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
            {t.stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-gold-500/40 bg-cream-50 px-3 py-4 text-center"
              >
                <p
                  className={`font-fraunces font-extrabold text-3xl sm:text-4xl text-sindoor-700 leading-none tracking-tight ${
                    isHi ? "font-mukta" : ""
                  }`}
                >
                  {s.value}
                </p>
                <p className="mt-2 text-[10px] sm:text-xs uppercase tracking-[0.14em] text-ink-600 font-mono font-semibold leading-tight">
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          {/* "How your seva flows", moved up from below the form so
              visitors see the flow without scrolling past the FAQ.
              Sits inside the hero left column, right under the
              stats. Vertical layout on mobile is automatic because
              the parent column is full-width below the lg
              breakpoint. */}
          <div className="mt-10 sm:mt-12">
            <div className="flex items-center gap-3">
              <span aria-hidden className="h-px flex-1 bg-gold-500/40" />
              <span className="text-[11px] uppercase tracking-[0.18em] text-gold-500 font-mono font-semibold whitespace-nowrap">
                {t.stepsHeading}
              </span>
              <span aria-hidden className="h-px flex-1 bg-gold-500/40" />
            </div>
            <p className="mt-2 text-center text-xs sm:text-sm text-ink-600">
              {t.stepsSub}
            </p>

            <ol className="mt-6 grid gap-4 sm:grid-cols-3 text-left">
              {t.steps.map((step) => (
                <li
                  key={step.num}
                  className="rounded-2xl border border-gold-500/40 bg-cream-50 p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-saffron-600 text-cream-50 font-fraunces font-bold text-xl">
                      {step.num}
                    </div>
                    <span aria-hidden className="text-2xl">
                      {step.emoji}
                    </span>
                  </div>
                  <h3
                    className={`mt-3 text-lg text-sindoor-700 ${
                      isHi ? "font-mukta font-bold" : "font-fraunces font-semibold"
                    }`}
                  >
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm text-ink-600 leading-relaxed">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          {/* "Other ways to contribute", opens up the contribution
              surface beyond field volunteering. Field path is the
              hero; this section answers "what if I can't go to a
              bhandara but still want to help?" with 5 specific roles
              (phone, moderation, content, tech, plus field as #1
              for the visitor scanning quickly). Footer line reads
              as the warm catch-all that closes the door on
              "I don't think I have anything to offer" objections. */}
          <div className="mt-10 sm:mt-12">
            <div className="flex items-center gap-3">
              <span aria-hidden className="h-px flex-1 bg-gold-500/40" />
              <span className="text-[11px] uppercase tracking-[0.18em] text-gold-500 font-mono font-semibold whitespace-nowrap">
                {t.contributionsHeading}
              </span>
              <span aria-hidden className="h-px flex-1 bg-gold-500/40" />
            </div>
            <p className="mt-2 text-center text-xs sm:text-sm text-ink-600">
              {t.contributionsSub}
            </p>

            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-2 text-left">
              {t.contributions.map((c) => (
                <li
                  key={c.title}
                  className="rounded-2xl border border-gold-500/40 bg-cream-50 p-4 sm:p-5 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="inline-flex items-center justify-center shrink-0 w-10 h-10 rounded-full bg-saffron-500/10 text-2xl"
                    >
                      {c.emoji}
                    </span>
                    <div className="min-w-0">
                      <h3
                        className={`text-base text-sindoor-700 ${
                          isHi
                            ? "font-mukta font-bold"
                            : "font-fraunces font-semibold"
                        }`}
                      >
                        {c.title}
                      </h3>
                      <p className="mt-1 text-sm text-ink-600 leading-relaxed">
                        {c.body}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-5 text-center text-sm text-ink-900/85 leading-relaxed italic">
              {t.contributionsFooter}
            </p>
          </div>
        </div>

        {/* RIGHT 5/12, the form, sticky on desktop */}
        <div className="lg:col-span-5 lg:sticky lg:top-8">
          <div
            id="signup"
            className="relative scroll-mt-24 overflow-hidden rounded-3xl border-2 border-saffron-500/55 bg-cream-50 p-6 sm:p-8 shadow-[0_24px_60px_-30px_rgba(156,42,42,0.32)]"
          >
            <div
              aria-hidden
              className="absolute inset-0 -z-0"
              style={{
                background:
                  "radial-gradient(600px 360px at 100% 0%, rgba(242,148,76,0.16), transparent 65%), radial-gradient(600px 360px at 0% 100%, rgba(214,73,73,0.06), transparent 65%)",
              }}
            />
            <JaliCorner
              position="tl"
              className="absolute top-3 left-3 w-9 h-9 text-gold-500/55"
            />
            <JaliCorner
              position="tr"
              className="absolute top-3 right-3 w-9 h-9 text-gold-500/55"
            />
            <JaliCorner
              position="bl"
              className="absolute bottom-3 left-3 w-9 h-9 text-gold-500/55"
            />
            <JaliCorner
              position="br"
              className="absolute bottom-3 right-3 w-9 h-9 text-gold-500/55"
            />

            <div className="relative">
              <p className="text-[11px] uppercase tracking-[0.18em] text-saffron-600 font-mono font-semibold">
                {t.formEyebrow}
              </p>
              <h2
                className={`mt-1 text-2xl text-sindoor-700 ${
                  isHi ? "font-mukta font-bold" : "font-fraunces font-semibold"
                }`}
              >
                {t.formHeading}
              </h2>
              <p className="mt-1.5 text-xs text-ink-600 leading-relaxed">
                {t.formHelper}
              </p>

              <div className="mt-5">
                <VolunteerSignupForm />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="my-14 sm:my-20 flex justify-center">
        <MarigoldDivider size={280} className="text-gold-500/70" />
      </div>

      {/* ─── FAQ ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl">
        <h2
          className={`text-2xl sm:text-3xl text-sindoor-700 text-center ${
            isHi ? "font-mukta font-bold" : "font-fraunces font-semibold"
          }`}
        >
          {t.faqHeading}
        </h2>
        <p className="mt-2 text-center text-sm text-ink-600">{t.faqSub}</p>

        <div className="mt-6 grid gap-3">
          {t.faq.map((entry) => (
            <details
              key={entry.q}
              className="group rounded-2xl border border-gold-500/40 bg-cream-50 p-4 shadow-sm"
            >
              <summary className="cursor-pointer list-none flex justify-between items-start gap-3 font-medium text-ink-900">
                <span>{entry.q}</span>
                <span className="text-saffron-600 group-open:rotate-45 transition-transform text-xl leading-none shrink-0">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-ink-900 leading-relaxed">
                {entry.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      <div className="my-14 sm:my-20 flex justify-center">
        <MarigoldDivider size={220} className="text-gold-500/65" />
      </div>

      {/* ─── Benediction ───────────────────────────────────── */}
      <p
        className={`text-center text-lg sm:text-xl text-sindoor-700 ${
          isHi ? "font-tiro" : "font-fraunces italic"
        }`}
      >
        {t.benediction}
      </p>
      <p className="mt-2 text-center text-xs text-ink-600">
        {t.benedictionSub}
      </p>
    </main>
  );
}
