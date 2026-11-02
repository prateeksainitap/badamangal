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
import { InnerShell, PageHero, Kicker, KickSep, Chip, FormPanel, Section, Heading, FaqList } from "@/components/v2";
import { listingSeason } from "@/lib/season";

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
    eyebrow: "स्वयंसेवक",
    h1Part1: "लखनऊ के हर भण्डारे को",
    h1Part2: "सबके लिए सुलभ बनाएँ",
    pill: "केवल सेवा, कोई शुल्क नहीं",
    bodyParagraph:
      "डिलीवरी राइडर, कैब ड्राइवर, छात्र, या कोई भी जो योगदान देना चाहता है, अपने इलाके के भण्डारों की जानकारी, तस्वीरें और स्थान दर्ज करने में मदद करें। पूरे सीज़न के लिए हमारे volunteer WhatsApp समूह में जुड़ें।",
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
        body: "ज्येष्ठ माह के मंगलवार और शनिवार। तस्वीरें, समय, स्थान, प्रसाद, हर भण्डारे में करीब 10 मिनट।",
      },
      {
        num: "3",
        emoji: "🗺️",
        title: "लाइव हो जाता है",
        body: "हम review करके public directory और लाइव शहरी नक्शे पर publish करते हैं। हज़ारों श्रद्धालु अब इसे ढूँढ सकते हैं।",
      },
    ],
    contributionsHeading: "और तरीक़े जिनसे सेवा दे सकते हैं",
    contributionsSub: "Field volunteering के अलावा भी, मिशन के पीछे बहुत हाथ चाहिए।",
    contributions: [
      {
        emoji: "📸",
        title: "Field volunteer",
        body: "अपने इलाक़े के भंडारे की photo और location WhatsApp group में share करना।",
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
    benediction: "जय श्री राम, जय हनुमान",
    benedictionSub: "सवाल हो तो WhatsApp करें।",
  },
  en: {
    eyebrow: "Volunteer",
    h1Part1: "Make every bhandara in Lucknow",
    h1Part2: "easy to find for everyone",
    pill: "Pure seva, no fee",
    bodyParagraph:
      "Delivery riders, cab drivers, students, anyone with a phone who wants to contribute. Help us log bhandaras in your area with photos, time, and location. You get added to our volunteer WhatsApp group for the full season.",
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
        body: "Tuesdays and Saturdays in Jyeshtha. Photos, time, location, prasad. About 10 minutes per bhandara.",
      },
      {
        num: "3",
        emoji: "🗺️",
        title: "Goes live",
        body: "We review and publish on the public directory and the live city map. Thousands of devotees can now find it.",
      },
    ],
    contributionsHeading: "Other ways to contribute",
    contributionsSub:
      "Field volunteering isn't the only path. The mission needs many hands.",
    contributions: [
      {
        emoji: "📸",
        title: "Field volunteer",
        body: "Share photos and locations of bhandaras in your area to our WhatsApp group.",
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
        a: "No. Only on Bada Mangal Tuesdays and Bade Shanivar days. About 10 days across the whole season.",
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
    benediction: "Jai Shri Ram, Jai Hanuman",
    benedictionSub: "Questions? WhatsApp the BadaMangal team.",
  },
};

export default function VolunteerLandingView() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const t = COPY[isHi ? "hi" : "en"];
  const season = listingSeason();
  const lang = isHi ? "hi" : "en";
  // The Tuesday count follows the season people list for (lib/season.ts).
  const stats = t.stats.map((st, i) => (i === 0 ? { ...st, value: String(season.tuesdays.length) } : st));

  return (
    <InnerShell>
      <PageHero
        kicker={
          <Kicker>
            {t.eyebrow}
            <KickSep />
            {isHi ? `बड़ा मंगल ${season.year}` : `Bada Mangal ${season.year}`}
          </Kicker>
        }
        title={{
          en: "Make every bhandara in Lucknow easy to find for everyone",
          hi: "लखनऊ के हर भण्डारे को सबके लिए सुलभ बनाएँ",
        }}
        lede={t.bodyParagraph}
        meta={<Chip tone="gold" icon="check">{t.pill}</Chip>}
      />

      <section className="bmi-sec tight" style={{ paddingTop: 0 }}>
        <div className="bmi-wrap bmi-vol">
          {/* The form: first on phones (it is the action), the sticky
              right column on desktop. */}
          <div className="bmi-vol-form">
            <FormPanel>
              <div id="signup" className="scroll-mt-24">
                <Kicker>{t.formEyebrow}</Kicker>
                <h2 className={`bmi-h3 ${isHi ? "" : "lat"}`} lang={lang} style={{ color: "var(--sindoor)" }}>
                  {t.formHeading}
                </h2>
                <p className="bmi-field-hint" style={{ margin: "8px 0 24px" }}>{t.formHelper}</p>
                <VolunteerSignupForm />
              </div>
            </FormPanel>
          </div>

          <div className="bmi-vol-body">
            <ul className="bmi-stats" data-rv>
              {stats.map((st) => (
                <li key={st.label}>
                  <b>{st.value}</b>
                  <span lang={lang}>{st.label}</span>
                </li>
              ))}
            </ul>

            <div className="bmi-vol-block">
              <p className="bmi-ilabel" lang={lang}>{t.stepsHeading}</p>
              <p className="bmi-field-hint">{t.stepsSub}</p>
              <ol className="bmi-steplist" data-rv>
                {t.steps.map((step) => (
                  <li key={step.num}>
                    <span className="n" aria-hidden>{step.num}</span>
                    <span>
                      <h3 lang={lang}>{step.title}</h3>
                      <p lang={lang}>{step.body}</p>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="bmi-vol-block">
              <p className="bmi-ilabel" lang={lang}>{t.contributionsHeading}</p>
              <p className="bmi-field-hint">{t.contributionsSub}</p>
              <ul className="bmi-steplist plain two" data-rv>
                {t.contributions.map((c) => (
                  <li key={c.title}>
                    <span>
                      <h3 lang={lang}>{c.title}</h3>
                      <p lang={lang}>{c.body}</p>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="bmi-field-hint" style={{ marginTop: 16 }}>{t.contributionsFooter}</p>
            </div>
          </div>
        </div>
      </section>

      <Section
        id="faq"
        narrow
        heading={<Heading as="h2" en="FAQ" hi={t.faqHeading} />}
      >
        <FaqList
          lang={lang}
          items={t.faq.map((f, i) => ({ id: `vol-faq-${i + 1}`, q: f.q, a: f.a }))}
        />
        <p className="bmi-fine" style={{ marginTop: 28, textAlign: "center" }}>
          <b style={{ color: "var(--sindoor)" }}>{t.benediction}</b>
          <br />
          {t.benedictionSub}
        </p>
      </Section>
    </InnerShell>
  );
}
