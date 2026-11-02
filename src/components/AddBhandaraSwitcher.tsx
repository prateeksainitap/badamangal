"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BhandaraForm from "@/components/BhandaraForm";
import BhandaraScanner from "@/components/BhandaraScanner";
import { InnerShell, PageHero, Kicker, KickSep, Heading, Icon, Plate } from "@/components/v2";
import { HOME_ART } from "@/content/home-art";
import { trackEvent } from "@/lib/ga";
import type { Locale } from "@/content/strings";
import { useLocaleFromContext } from "@/lib/locale-context";
import { listingSeason } from "@/lib/season";

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
    <InnerShell>
      <PageHero
        crumbs={
          <div className="bmi-back">
            <button
              type="button"
              className="bmi-tl"
              onClick={() => {
                setRole(null);
                trackEvent("add_role_back");
              }}
            >
              <Icon name="back" />
              <span>{isHi ? "वापस" : "Back"}</span>
            </button>
          </div>
        }
        kicker={<Kicker>{pillText}</Kicker>}
        heading={<Heading as="h1" en={titleText} hi={titleText} long />}
        lede={subtitleText}
      />
      <section className="bmi-sec tight" style={{ paddingTop: 0 }}>
        <div className="bmi-wrap bmi-formgrid">
          <div>{isScanner ? <BhandaraScanner /> : <BhandaraForm />}</div>
          <div className="bmi-formart" aria-hidden>
            <Plate
              src={isScanner ? HOME_ART.oldLucknowBand.src : HOME_ART.sevaHands.src}
              width={isScanner ? HOME_ART.oldLucknowBand.width : HOME_ART.sevaHands.width}
              height={isScanner ? HOME_ART.oldLucknowBand.height : HOME_ART.sevaHands.height}
              alt=""
            />
          </div>
        </div>
      </section>
    </InnerShell>
  );
}

/* ── The chooser: three ways in, as hairline rows ─────────────────── */

function RoleChooser({
  isHi,
  onPick,
}: {
  isHi: boolean;
  onPick: (r: Role) => void;
}) {
  return (
    <InnerShell>
      <PageHero
        kicker={
          <Kicker>
            {isHi ? "बड़ा मंगल" : "Bada Mangal"}
            <KickSep />
            {listingSeason().year}
          </Kicker>
        }
        title={{
          en: "How would you like to add a bhandara?",
          hi: "अपना भंडारा कैसे जोड़ेंगे?",
        }}
        lede={
          isHi
            ? "टाइप करें, AI से पैम्फलेट पढ़वाएँ, या रास्ते में देखा हुआ भंडारा स्पॉट करें। तीनों रास्ते लखनऊ के नक़्शे पर सीधे जुड़ते हैं।"
            : "Type it in, scan a pamphlet with AI, or spot one you walked past. Three paths to the city map."
        }
      />
      <section className="bmi-sec tight" style={{ paddingTop: 0 }}>
        <div className="bmi-wrap">
          <div className="bmi-split">
            <ul className="bmi-paths" data-rv>
              <PathRow
                primary
                onClick={() => onPick("organizer")}
                kicker={isHi ? "व्यवस्थापक" : "Organizer"}
                title={isHi ? "मैं भंडारा आयोजित कर रहा हूँ" : "I'm organizing a bhandara"}
                body={
                  isHi
                    ? "तारीख़, समय, मेन्यू और लोकेशन भरें। शहर भर के लोग आपका भंडारा खोज पाएँगे।"
                    : "Add the dates, time, menu, and pin. The whole city can find your bhandara."
                }
                icon={<Icon name="thali" />}
                isHi={isHi}
              />
              <PathRow
                onClick={() => onPick("scanner")}
                kicker={isHi ? "AI से" : "AI scan"}
                title={isHi ? "मेरे पास भंडारा का पैम्फलेट है" : "I have a bhandara pamphlet"}
                body={
                  isHi
                    ? "पोस्टर अपलोड करें, AI नाम, तारीख़, समय, पता पढ़कर फ़ॉर्म स्वयं भर देगा।"
                    : "Upload the poster, AI reads the name, dates, time, and address and fills the form."
                }
                icon={<IconScanSparkle />}
                isHi={isHi}
              />
              <PathRow
                onClick={() => onPick("spotter")}
                kicker={isHi ? "स्पॉटर" : "Spotter"}
                title={isHi ? "मैंने अभी एक भंडारा देखा है" : "I just spotted a bhandara"}
                body={
                  isHi
                    ? "एक फ़ोटो खींचें, पिन छोड़ें, स्पॉट 8 घंटे के लिए लाइव हो जाएगा।"
                    : "Snap a photo, drop a pin, the spot stays live on the map for 8 hours."
                }
                icon={<Icon name="camera" />}
                isHi={isHi}
              />
            </ul>
            <div className="bmi-paths-art">
              <Plate
                src={HOME_ART.sevaHands.src}
                width={HOME_ART.sevaHands.width}
                height={HOME_ART.sevaHands.height}
                alt={isHi ? "भंडारे में पूड़ी और शरबत परोसते हाथ" : "Hands serving puri and sharbat at a bhandara"}
              />
            </div>
          </div>
        </div>
      </section>
    </InnerShell>
  );
}

function PathRow({
  onClick,
  kicker,
  title,
  body,
  icon,
  primary,
  isHi,
}: {
  onClick: () => void;
  kicker: string;
  title: string;
  body: string;
  icon: React.ReactNode;
  primary?: boolean;
  isHi: boolean;
}) {
  const lang = isHi ? "hi" : "en";
  return (
    <li>
      <button type="button" onClick={onClick} className={`bmi-path ${primary ? "p" : ""}`.trim()}>
        <span className="bmi-path-ic" aria-hidden>
          {icon}
        </span>
        <span>
          <span className="k" lang={lang}>{kicker}</span>
          <h2 lang={lang}>{title}</h2>
          <p lang={lang}>{body}</p>
        </span>
        <span className="go" aria-hidden>
          <Icon name="chevron" />
        </span>
      </button>
    </li>
  );
}

/* ── Icons for the chooser cards ─────────────────────────────────── */


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

