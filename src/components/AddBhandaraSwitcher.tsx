"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BhandaraForm from "@/components/BhandaraForm";
import BhandaraScanner from "@/components/BhandaraScanner";
import { JaliCorner } from "@/components/ornaments";
import { trackEvent } from "@/lib/ga";
import type { Locale } from "@/content/strings";
import { useLocaleFromContext } from "@/lib/locale-context";

// "scanner" is the AI-pamphlet path: user uploads a poster, Gemini
// extracts the fields, and BhandaraForm appears pre-filled. Same
// publish pipeline as the "organizer" path on the back end (status
// PENDING → admin reviews → APPROVED), the difference is the entry
// experience: type vs upload.
type Role = "organizer" | "spotter" | "scanner";

type ListedBhandara = {
  id: string;
  slug: string;
  name: string;
  nameHi: string | null;
  area: string;
  lat: number;
  lng: number;
};

type Props = {
  /** Optional, ignored at runtime, locale resolves from the
   *  LocaleProvider context so the Hindi toggle flips every label
   *  without a server-tree refresh. Kept on the type for back-compat
   *  with any caller still passing it. */
  locale?: Locale;
  /** Optional override for the initial role. When omitted (the typical
   *  call from /list-bhandara now), the component reads `?role=` from
   *  the URL itself after mount, so the page stays statically renderable
   *  without losing the deep-link behaviour. */
  initialRole?: Role | null;
  /** Reserved for future use; kept for API compatibility with the page. */
  bhandaras?: ListedBhandara[];
};

/**
 * Two-track entry into the "Add a bhandara" experience.
 * 1) The user lands on a richly-styled chooser asking whether they're
 *    organizing a bhandara or just spotted one walking past.
 * 2) Picking "Organizer" swaps the chooser for the multi-step listing
 *    form, with a "← Back" pill to return to the chooser.
 *
 * Picking "Spotter" routes the user to /spot, the canonical spot page
 *, so the same V2 flow runs regardless of which entry point the user
 * came in from. Previously this component rendered SpotQuickForm
 * inline, which created two slightly-different versions of the same
 * page; routing them both to /spot is the single source of truth.
 */
export default function AddBhandaraSwitcher({
  locale: _localeProp,
  initialRole = null,
}: Props) {
  const router = useRouter();
  // Cookie-aware locale from context; the locale prop is ignored
  // (it's "en" everywhere since pages are statically prerendered).
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const langSuffix = locale === "en" ? "?lang=en" : "";
  const [role, setRole] = useState<Role | null>(initialRole);

  // Honour `?role=` deep links client-side. The page itself is
  // statically rendered now (no searchParams read on the server), so
  // this is where the URL-driven branch lives.
  //
  // Three roles understood here:
  //   • spotter  → bounce to /spot (canonical home for that flow)
  //   • organizer → drop straight on the typed listing form
  //   • scanner  → drop straight on the AI-pamphlet uploader
  //
  // The footer links use these deep links to skip the 3-card chooser
  // (which is the right experience for the homepage entry, but
  // unnecessary friction for visitors who already know they want a
  // specific path).
  useEffect(() => {
    if (initialRole !== null) return;
    const url = new URL(window.location.href);
    const r = url.searchParams.get("role");
    if (r === "spotter") {
      router.replace(`/spot${langSuffix}`);
      return;
    }
    if (r === "organizer" || r === "scanner") setRole(r);
  }, [initialRole, langSuffix, router]);

  if (role === null) {
    return (
      <RoleChooser
        isHi={isHi}
        onPick={(r) => {
          trackEvent("add_role_pick", { role: r });
          if (r === "spotter") {
            router.push(`/spot${langSuffix}`);
            return;
          }
          setRole(r);
        }}
      />
    );
  }

  // Organizer + scanner branches both land here; spotter routes out to
  // /spot (see RoleChooser onPick). Header copy + role pill swap on
  // which branch we're in so the user always knows which path they
  // picked. The Back button is shared (clears role and returns to the
  // 3-card chooser).
  const isScanner = role === "scanner";
  const pillText = isScanner
    ? isHi
      ? "पैम्फलेट स्कैन"
      : "Pamphlet scan"
    : isHi
      ? "व्यवस्थापक"
      : "Organizer";
  const titleText = isScanner
    ? isHi
      ? "पैम्फलेट अपलोड करें"
      : "Upload your pamphlet"
    : isHi
      ? "अपना भंडारा जोड़ें"
      : "List your bhandara";
  const subtitleText = isScanner
    ? isHi
      ? "अपना भंडारा पोस्टर अपलोड करें, AI ज़रूरी जानकारी पढ़कर फ़ॉर्म स्वयं भर देगा।"
      : "Upload a photo of your bhandara poster, our AI reads it and pre-fills the form for you."
    : isHi
      ? "कब, कहाँ और क्या परोस रहे हैं, बताएँ, और हम इसे शहर के नक़्शे पर जोड़ देंगे।"
      : "Tell us when, where, and what you're serving, we'll put it on the city map.";

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => {
            setRole(null);
            trackEvent("add_role_back");
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/45 bg-cream-50 px-3 py-1.5 text-xs font-semibold text-ink-900 hover:border-saffron-500 hover:text-saffron-600 transition-colors"
        >
          <span aria-hidden>←</span>
          {isHi ? "वापस" : "Back"}
        </button>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron-50 border border-saffron-500/40 px-3 py-1.5 leading-none text-[0.65rem] font-mukta uppercase tracking-[0.28em] text-saffron-600 font-semibold">
          {pillText}
        </span>
      </div>

      <header className="mb-6">
        <h1
          className={`text-3xl sm:text-4xl text-sindoor-700 leading-tight ${
            isHi ? "font-tiro" : "font-fraunces font-semibold"
          }`}
        >
          {titleText}
        </h1>
        <p className="mt-2 text-ink-600 max-w-2xl leading-relaxed">
          {subtitleText}
        </p>
      </header>
      {isScanner ? <BhandaraScanner /> : <BhandaraForm />}
    </div>
  );
}

/* ── The kick-ass chooser ─────────────────────────────────────────── */

function RoleChooser({
  isHi,
  onPick,
}: {
  isHi: boolean;
  onPick: (r: Role) => void;
}) {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Layered saffron + sindoor radial wash */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(800px 500px at 18% 22%, rgba(242,148,76,0.22), transparent 65%), radial-gradient(800px 500px at 82% 80%, rgba(156,42,42,0.14), transparent 65%), linear-gradient(180deg, #FFF7EB 0%, #FBF7F0 60%, #FBF7F0 100%)",
        }}
      />
      {/* Faint top gold rule */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/40 to-transparent"
      />

      <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-12 pb-16 sm:pt-20 sm:pb-24 text-center">
        <p className="font-mukta uppercase tracking-[0.32em] text-saffron-600 text-[0.7rem] sm:text-xs font-semibold inline-flex items-center gap-2">
          <span className="block w-1.5 h-1.5 rounded-full bg-saffron-600 motion-safe:animate-pulse" />
          {isHi ? "बड़ा मंगल · 2026" : "Bada Mangal · 2026"}
        </p>
        {/* Headline + subtitle were originally a binary "organizing
            vs spotter" question. Adding the AI-pamphlet card made it
            three paths, so the question reframes as "how do you want
            to add a bhandara?" and the subtitle counts the paths
            explicitly. Keeps the Devanagari/Fraunces editorial tone
            of the page while honestly describing what's below. */}
        <h1
          className={`mt-4 text-3xl sm:text-5xl leading-tight text-sindoor-700 [text-wrap:balance] ${
            isHi ? "font-tiro" : "font-fraunces font-semibold"
          }`}
        >
          {isHi
            ? "अपना भंडारा कैसे जोड़ेंगे?"
            : "How would you like to add a bhandara?"}
        </h1>
        <p className="mt-4 mx-auto max-w-2xl text-ink-600 leading-relaxed text-sm sm:text-base">
          {isHi
            ? "तीनों रास्ते लखनऊ के नक़्शे पर सीधे जुड़ते हैं, टाइप करें, AI से पैम्फलेट पढ़वाएँ, या रास्ते में देखा हुआ भंडारा स्पॉट करें। अपना चुनें, बाक़ी हम सरल रखते हैं।"
            : "Three paths to the city map, type it in, scan a pamphlet with AI, or spot one you walked past. Pick what fits, we keep the rest simple."}
        </p>

        {/* Marigold rule */}
        <div className="mt-7 mx-auto max-w-md flex items-center gap-3">
          <span className="h-px flex-1 bg-gold-500/45" />
          <span className="text-[0.62rem] sm:text-[0.65rem] uppercase tracking-[0.32em] text-gold-500 font-semibold">
            {isHi ? "अपना रास्ता" : "Your path"}
          </span>
          <span className="h-px flex-1 bg-gold-500/45" />
        </div>

        {/* Three big choice cards. Was 2 cards on `sm:grid-cols-2`;
            adding the AI-pamphlet path made 3 the natural number, so
            the grid is now sm:grid-cols-2 + lg:grid-cols-3. On a
            phone all three stack; on tablet the AI-pamphlet card
            wraps below the first two so the highest-intent action
            ("scan a pamphlet you already have") is the freshest one
            the eye lands on after the page-fold. */}
        <div className="mt-8 grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3 text-left">
          <ChoiceCard
            isHi={isHi}
            onClick={() => onPick("organizer")}
            tone="saffron"
            kicker={isHi ? "व्यवस्थापक" : "Organizer"}
            title={
              isHi ? "मैं भंडारा आयोजित कर रहा हूँ" : "I'm organizing a bhandara"
            }
            body={
              isHi
                ? "तारीख़, समय, मेन्यू और लोकेशन भरें। शहर भर के लोग आपका भंडारा खोज पाएँगे।"
                : "Add the dates, time, menu, and pin. The whole city can find your bhandara."
            }
            cta={isHi ? "भंडारा जोड़ें" : "List my bhandara"}
            icon={<IconHands />}
          />
          <ChoiceCard
            isHi={isHi}
            onClick={() => onPick("scanner")}
            tone="gold"
            kicker={isHi ? "AI से" : "AI scan"}
            title={
              isHi
                ? "मेरे पास भंडारा का पैम्फलेट है"
                : "I have a bhandara pamphlet"
            }
            body={
              isHi
                ? "पोस्टर अपलोड करें, AI नाम, तारीख़, समय, पता पढ़कर फ़ॉर्म स्वयं भर देगा। आप बस देख कर सबमिट करें।"
                : "Upload the poster, AI reads the name, dates, time, and address and fills the form. You just verify and submit."
            }
            cta={isHi ? "पैम्फलेट अपलोड करें" : "Upload pamphlet"}
            icon={<IconScanSparkle />}
          />
          <ChoiceCard
            isHi={isHi}
            onClick={() => onPick("spotter")}
            tone="sindoor"
            kicker={isHi ? "स्पॉटर" : "Spotter"}
            title={
              isHi ? "मैंने अभी एक भंडारा देखा है" : "I just spotted a bhandara"
            }
            body={
              isHi
                ? "एक फ़ोटो खींचें, पिन छोड़ें, स्पॉट 8 घंटे के लिए लाइव हो जाएगा।"
                : "Snap a photo, drop a pin, the spot stays live on the map for 8 hours."
            }
            cta={isHi ? "स्पॉट करें" : "Spot it now"}
            icon={<IconCameraSolid />}
          />
        </div>

      </div>
    </section>
  );
}

function ChoiceCard({
  isHi,
  onClick,
  tone,
  kicker,
  title,
  body,
  cta,
  icon,
}: {
  isHi: boolean;
  onClick: () => void;
  tone: "saffron" | "sindoor" | "gold";
  kicker: string;
  title: string;
  body: string;
  cta: string;
  icon: React.ReactNode;
}) {
  // Palette per tone. The new "gold" variant for the AI-scan card uses
  // the same gold accents already in the design system (jali corners,
  // dividers, sponsor rail), so it reads as "another official option"
  // alongside saffron (organizer) and sindoor (spotter) without
  // introducing a fourth brand colour. `btn btn-gold` doesn't exist
  // yet so we hand-roll an equivalent class string here.
  const palette =
    tone === "saffron"
      ? {
          ring: "border-saffron-500/45",
          glow:
            "radial-gradient(360px 260px at 20% 0%, rgba(242,148,76,0.20), transparent 65%), #FFF7EB",
          pillBg: "bg-saffron-50",
          pillBorder: "border-saffron-500/45",
          pillText: "text-saffron-600",
          iconBg: "bg-saffron-600",
          iconRing: "ring-saffron-500/30",
          ctaClass: "btn btn-primary",
        }
      : tone === "gold"
        ? {
            ring: "border-gold-500/50",
            glow:
              "radial-gradient(360px 260px at 50% 0%, rgba(201,162,74,0.22), transparent 65%), #FFF7EB",
            pillBg: "bg-gold-500/10",
            pillBorder: "border-gold-500/55",
            pillText: "text-gold-700",
            iconBg: "bg-gold-500",
            iconRing: "ring-gold-500/30",
            // btn-gold matches btn-primary's gradient+shadow recipe so
            // the three CTAs (List my, Upload pamphlet, Spot it now)
            // share size, padding, and elevation, only the colour
            // distinguishes them.
            ctaClass: "btn btn-gold",
          }
        : {
            ring: "border-sindoor-700/35",
            glow:
              "radial-gradient(360px 260px at 80% 0%, rgba(156,42,42,0.18), transparent 65%), #FFF7EB",
            pillBg: "bg-sindoor-700/8",
            pillBorder: "border-sindoor-700/30",
            pillText: "text-sindoor-700",
            iconBg: "bg-sindoor-700",
            iconRing: "ring-sindoor-700/30",
            ctaClass: "btn btn-sindoor",
          };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-3xl border ${palette.ring} text-left p-6 sm:p-7 shadow-warm transition-transform hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-600`}
      style={{ background: palette.glow }}
    >
      {/* Jali corners */}
      <JaliCorner
        position="tl"
        className="absolute top-3 left-3 w-8 h-8 text-gold-500/55"
      />
      <JaliCorner
        position="tr"
        className="absolute top-3 right-3 w-8 h-8 text-gold-500/55"
      />

      {/* Icon disc + kicker pill on a single line, vertically centered.
          Bumped the pill's text size + padding for legibility, and
          swapped `leading-none` for `leading-snug` so Devanagari
          matras (ी, ं, े) get vertical breathing room and the glyph
          stack sits optically centred in the pill. */}
      <div className="flex items-center gap-3">
        <span
          className={`shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full ${palette.iconBg} text-cream-50 shadow-warm`}
        >
          {icon}
        </span>
        {/* `whitespace-nowrap` + slightly tighter tracking-[0.2em]
            keeps the kicker on ONE line at every breakpoint, even
            on the tighter 3-column grid. Was tracking-[0.22em],
            which pushed the original two-word labels ("ORGANIZER /
            SEVADAR", "PASSER-BY / SPOTTER") onto a second line. Now
            paired with the single-word kicker text the cards use,
            the pill always sits as a clean one-line chip. */}
        <span
          className={`inline-flex items-center gap-1.5 rounded-full ${palette.pillBg} ${palette.pillBorder} border px-3.5 py-1.5 text-[0.7rem] sm:text-[0.75rem] font-mukta uppercase tracking-[0.2em] ${palette.pillText} font-semibold leading-snug whitespace-nowrap`}
        >
          {kicker}
        </span>
      </div>

      {/* Title */}
      <h2
        className={`mt-3 text-xl sm:text-2xl text-sindoor-700 leading-tight ${
          isHi ? "font-tiro" : "font-fraunces font-semibold"
        }`}
      >
        {title}
      </h2>

      {/* Body */}
      <p className="mt-2 text-sm text-ink-600 leading-relaxed">{body}</p>

      {/* CTA, visual only; the whole card is the click target */}
      <span
        className={`${palette.ctaClass} btn-sm mt-5 pointer-events-none transition-transform group-hover:translate-x-0.5`}
      >
        {cta}
        <span aria-hidden>→</span>
      </span>
    </button>
  );
}

/* ── Icons for the chooser cards ─────────────────────────────────── */

/** Organizer: a thali with a serving ladle resting across it, reads as
 *  "I'm cooking and serving the meal." */
function IconHands() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Plate / thali, concentric rings */}
      <circle cx="12" cy="14" r="7" />
      <circle cx="12" cy="14" r="4.2" />
      <circle cx="12" cy="14" r="0.9" fill="currentColor" stroke="none" />
      {/* Steam puffs above the plate */}
      <path d="M9 6c0 1 1 1 1 2s-1 1-1 2" />
      <path d="M12 5c0 1 1 1 1 2s-1 1-1 2" />
      <path d="M15 6c0 1 1 1 1 2s-1 1-1 2" />
    </svg>
  );
}

/** Scanner: a small document with a sparkle, reads as "we'll read
 *  this for you". Same 24×24 viewbox and 1.7 stroke as the other two
 *  card icons so the row reads as a coordinated set. */
function IconScanSparkle() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Page outline */}
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      {/* Text lines */}
      <path d="M9 12h6" />
      <path d="M9 16h4" />
      {/* AI sparkle */}
      <path
        d="M17 14l.6 1.4L19 16l-1.4.6L17 18l-.6-1.4L15 16l1.4-.6z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

/** Spotter: a clean outlined camera, parity with the rest of the site's
 *  camera glyph language. */
function IconCameraSolid() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8h3l1.6-2h8.8L18 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.5" r="3.6" />
      <circle cx="12" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
