"use client";

/**
 * Homepage testimonials section, "Lucknow is liking us…".
 *
 * Seeded from the screenshots stored in
 * /Users/prateeksaini/Documents/Personal/Bada Mangal/Testimonials.
 * Every entry traces back to a real message, email, WhatsApp DM /
 * group, Telegram broadcast, or a Reddit comment. No fabrication.
 *
 * Layout:
 *   1. A small "social-proof strip" up top with the Reddit
 *      r/lucknow post's stats (9.4K views / 133 upvotes / 30
 *      comments), pulled from the May-26 Reddit insights screenshot.
 *      Sets the credibility frame before any single voice speaks.
 *   2. One featured wide card (Shashwat's email, longest + most
 *      generous quote).
 *   3. A masonry-style grid of the remaining shorter quotes,
 *      mixing emoji-ful WhatsApp blurbs ("Website to mst hai yar
 *      👍🔥") with longer Reddit stories (Crouts on the Allahabad
 *      student diaspora). CSS columns instead of CSS grid so cards
 *      with very different body lengths don't leave weird vertical
 *      gaps.
 *   4. A "share yours" CTA at the foot.
 *
 * Locale-aware: section chrome (eyebrow, heading, sub, share CTA,
 * stat labels) flips with the LangToggle. Testimonial bodies stay
 * in their original language, translating a Hindi-Roman line into
 * English (or vice versa) would feel inauthentic.
 *
 * Future: when more testimonials accumulate, consider promoting
 * curation into the DB (an `isTestimonial` flag on ContactMessage
 * + a checkbox in /admin/emails). For now the curation decision
 * is "owner edits this file".
 */

import { useLocaleFromContext } from "@/lib/locale-context";
import Link from "next/link";

type Testimonial = {
  /** Visible name. */
  name: string;
  /** Optional Lucknow area / city label. */
  locality?: string;
  /** Optional role / context badge (e.g. "Born and Raised"). */
  role?: string;
  /** ISO date the testimonial was received. */
  dateIso: string;
  /** Quote text, sender's exact words. */
  body: string;
  /** Source label, "Email", "WhatsApp", "Telegram", "Reddit". */
  source: string;
};

/** Reddit r/lucknow post metrics (May 26 screenshot). Surfaces as
 *  a small social-proof strip at the top of the section so a first-
 *  time visitor sees external validation before a single quote. */
// Updated 2026-05-26 evening: views ticked 9.2K, 9.4K.
// Updated 2026-05-30: views ticked to 9.6K.
// Updated 2026-06-24: views crossed 10K.
const REDDIT_STATS = {
  views: "10K",
  upvotes: "133",
  comments: "30",
  community: "r/lucknow",
};

const TESTIMONIALS: Testimonial[] = [
  // First names only (per design call 2026-05-26), surnames felt
  // formal in a community testimonial card. Reddit usernames stay
  // as-is since they ARE the identity people picked for themselves.
  {
    name: "Nidhi",
    locality: "Lucknow",
    dateIso: "2026-05-19",
    body:
      "The website has made it easy for people across the globe to get all the information and updates regarding bhandaras happening nearby. I really liked the doodle type of pictures in the history making it more engaging. Lets not forget how spot maps are created using Hanuman ji's Gada making it more relatable to the auspicious occasion. I don't think any website could be better than this. Glad you took the initiative and done a wonderful job. 🙏",
    source: "WhatsApp",
  },
  {
    // Source corrected to WhatsApp (was Telegram). The screenshot
    // looks Telegram-ish at first glance but it's WhatsApp's
    // "Balaji ka bhandara (3)" community group.
    name: "Vaibhav",
    locality: "Lucknow",
    dateIso: "2026-05-20",
    body: "Really admirable website 🔥",
    source: "WhatsApp",
  },
  {
    // Role kept to just the Reddit user-flair ("illahabadi amrood")
    //, the "Reddit" prefix was redundant with the "via Reddit"
    // line in the source row below, and the pill rendered as an
    // orange "REDDIT" chip that competed with the flair text.
    name: "Crouts",
    locality: "Allahabad",
    role: "illahabadi amrood",
    dateIso: "2026-05-22",
    body:
      "Demn boi, good work! In our city Allahabad we have a humungous student diaspora, on every such Tuesdays there's an unofficial ritual that students will not cook and go on bhandara hopping around the city. Badhiya WhatsApp group bana rakha hai kab kaha kidhar kya mil raha haha.",
    source: "Reddit",
  },
  {
    name: "savyasachi-",
    role: "Born and Raised",
    dateIso: "2026-05-22",
    body: "Ye hui na baat. City's tradition goes online. 😎",
    source: "Reddit",
  },
  {
    name: "Anonymous donor",
    locality: "Lucknow",
    dateIso: "2026-05-23",
    body: "Website to mst hai yar 👍🔥",
    source: "WhatsApp",
  },
  {
    // No role badge, Reddit username alone is enough; the source
    // chip below already shows "via Reddit", so a redundant pill
    // would just add visual noise.
    name: "ducksayswhack",
    dateIso: "2026-05-22",
    body:
      "I'm not from Lko but bf is. He will LOVE this haha. Ty OP.",
    source: "Reddit",
  },
];

/** The "lead" testimonial, gets its own wide card above the grid.
 *  Shashwat's email is the longest, most generous quote we have and
 *  carries a verifiable real name + email + phone, so it earns the
 *  prominence. */
const FEATURED: Testimonial = {
  name: "Shashwat",
  locality: "Lucknow",
  dateIso: "2026-05-23",
  body:
    "Hats off to this creativity guys, absolutely phenomenal design, absolutely gorgeous UX/UI, loved it. Wishing you all the very best for all your future endeavours.",
  source: "Email",
};

const COPY = {
  hi: {
    eyebrow: "🙏 लखनऊ की आवाज़",
    h1: "लखनऊ हमें पसंद कर रहा है",
    sub: "अब तक लोगों ने क्या कहा। और जुड़ते रहेंगे।",
    quoteOpen: "“",
    sourceVia: "के ज़रिए",
    statsHeading: "r/lucknow पर हमारी पोस्ट",
    statsViews: "views",
    statsUpvotes: "upvotes",
    statsComments: "comments",
    shareTitle: "क्या आप भी कुछ कहना चाहेंगे?",
    shareBody:
      "हमें WhatsApp या email कीजिए। यह सेवा आप जैसे लोगों के बल पर चलती है।",
    shareCta: "अपनी बात कहें →",
  },
  en: {
    eyebrow: "🙏 What Lucknow is saying",
    h1: "Lucknow is liking us",
    sub: "Unfiltered notes from the community so far. More keep landing.",
    quoteOpen: "“",
    sourceVia: "via",
    statsHeading: "Our post on r/lucknow",
    statsViews: "views",
    statsUpvotes: "upvotes",
    statsComments: "comments",
    shareTitle: "Have something to add?",
    shareBody:
      "WhatsApp us or drop an email. This whole thing runs on community love.",
    shareCta: "Share your thoughts →",
  },
};

function formatDate(iso: string, isHi: boolean): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [yStr, mStr, dStr] = iso.split("-");
  const day = parseInt(dStr ?? "0", 10);
  const monIdx = parseInt(mStr ?? "0", 10) - 1;
  const en = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const hi = [
    "जन", "फ़र", "मार्च", "अप्रैल", "मई", "जून",
    "जुल", "अग", "सित", "अक्ट", "नव", "दिस",
  ];
  const months = isHi ? hi : en;
  return `${day} ${months[monIdx] ?? ""} ${yStr}`;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (
    parts[0]!.slice(0, 1) + (parts[parts.length - 1] ?? "").slice(0, 1)
  ).toUpperCase();
}

/** Small inline avatar circle. */
function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center w-9 h-9 rounded-full bg-sindoor-700 text-cream-50 font-fraunces font-bold text-sm"
    >
      {initialsFor(name)}
    </span>
  );
}

/** Open-quote glyph used at the head of every testimonial card.
 *  Replaces the earlier giant unicode " character that rendered as
 *  muddy dark-grey on cream (low-opacity text becomes ambiguously
 *  coloured). This SVG carries the brand saffron exactly + scales
 *  cleanly via the `size` prop. */
function QuoteGlyph({ size = 28 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      style={{ color: "#F2944C" }}
      aria-hidden
    >
      {/* Two curly-quote tear-drops; balanced, mirrored, with a
          soft outer round so the form reads as decorative quote
          rather than literal text. */}
      <path
        opacity="0.65"
        d="M7 5C4.79 5 3 6.79 3 9v4.5C3 16.54 5.46 19 8.5 19H9v-3.5h-.5A2 2 0 0 1 6.5 13.5v-.5H9V9c0-2.21-.79-4-2-4zm10 0c-2.21 0-4 1.79-4 4v4.5c0 3.04 2.46 5.5 5.5 5.5h.5v-3.5h-.5a2 2 0 0 1-2-2v-.5H19V9c0-2.21-.79-4-2-4z"
      />
    </svg>
  );
}

/** Attribution row used by both the featured card + the grid cards. */
function Attribution({
  q,
  t,
  isHi,
}: {
  q: Testimonial;
  t: (typeof COPY)["en"];
  isHi: boolean;
}) {
  return (
    <div className="mt-5 flex items-center gap-3">
      <Avatar name={q.name} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink-900 truncate">
          {q.name}
          {q.role ? (
            <span className="ml-2 inline-flex items-center text-[10px] uppercase tracking-[0.14em] text-saffron-600 bg-saffron-50 border border-saffron-500/40 rounded-full px-2 py-0.5 font-mono">
              {q.role}
            </span>
          ) : null}
        </p>
        <p className="text-xs text-ink-600 font-mono">
          {[q.locality, formatDate(q.dateIso, isHi), `${t.sourceVia} ${q.source}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </div>
  );
}

export default function HomeTestimonials() {
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const t = COPY[isHi ? "hi" : "en"];

  return (
    <section
      aria-labelledby="testimonials-heading"
      className="mx-auto max-w-5xl px-4 sm:px-6 py-12 sm:py-20"
    >
      {/* Heading band */}
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.22em] text-saffron-600 font-mono font-semibold">
          {t.eyebrow}
        </p>
        <h2
          id="testimonials-heading"
          className={`mt-3 inline-flex items-center justify-center gap-3 sm:gap-4 text-3xl sm:text-4xl text-sindoor-700 leading-tight ${
            isHi ? "font-mukta font-extrabold" : "font-fraunces font-semibold"
          }`}
        >
          <span>{t.h1}</span>
          {/* Saffron heart flourish. SVG (not emoji) so the colour
              matches the brand palette exactly + scales cleanly with
              the heading. The aria-hidden span keeps screen readers
              from reading "heart", the H1 already communicates the
              sentiment.

              Path geometry uses the standard Material-Icons heart
              shape (perfectly mirrored left/right lobes around the
              x=12 axis). The previous hand-drawn path had asymmetric
              control points so the left lobe rendered slightly
              higher + narrower than the right; visible enough that
              the operator flagged it. This path is mirror-symmetric
              by construction. */}
          <span aria-hidden className="inline-flex items-center">
            <svg
              viewBox="0 0 24 24"
              width="32"
              height="32"
              className="sm:w-10 sm:h-10 drop-shadow-[0_3px_8px_rgba(242,148,76,0.35)]"
              fill="currentColor"
              style={{ color: "#F2944C" }}
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </span>
        </h2>
        <p className="mt-3 text-sm sm:text-base text-ink-600 max-w-xl mx-auto">
          {t.sub}
        </p>

        {/* Reddit social-proof strip. Tiny gold-bordered chip showing
            the r/lucknow post's view + upvote + comment counts.
            Pulled from the Reddit insights screenshot in the
            Testimonials folder.

            Mobile layout (operator request 2026-05-26 evening): the
            heading takes its own line at the top, stats flow on the
            line below. Forced via `basis-full sm:basis-auto` on the
            heading + `text-center sm:text-left`, plus the rounded-full
            pill softens to rounded-2xl on mobile so the multi-line
            content doesn't get cramped by the pill geometry. */}
        <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-2xl sm:rounded-full border border-gold-500/45 bg-cream-50 px-4 py-2.5 sm:py-2">
          <span className="basis-full sm:basis-auto text-center sm:text-left text-[10px] sm:text-xs uppercase tracking-[0.14em] text-saffron-600 font-mono font-semibold">
            {t.statsHeading}
          </span>
          <span aria-hidden className="hidden sm:inline text-gold-500/60">
            ·
          </span>
          <span className="text-xs sm:text-sm text-ink-900">
            <span className="font-fraunces font-extrabold text-sindoor-700">
              {REDDIT_STATS.views}
            </span>{" "}
            <span className="text-ink-600">{t.statsViews}</span>
          </span>
          <span aria-hidden className="text-gold-500/60">
            ·
          </span>
          <span className="text-xs sm:text-sm text-ink-900">
            <span className="font-fraunces font-extrabold text-sindoor-700">
              ↑ {REDDIT_STATS.upvotes}
            </span>{" "}
            <span className="text-ink-600">{t.statsUpvotes}</span>
          </span>
          <span aria-hidden className="text-gold-500/60">
            ·
          </span>
          <span className="text-xs sm:text-sm text-ink-900">
            <span className="font-fraunces font-extrabold text-sindoor-700">
              {REDDIT_STATS.comments}
            </span>{" "}
            <span className="text-ink-600">{t.statsComments}</span>
          </span>
        </div>

        <div className="mt-6 mx-auto h-px w-28 bg-gradient-to-r from-transparent via-gold-500/55 to-transparent" />
      </div>

      {/* Featured testimonial, Shashwat's email. Wide hero card so
          the most-generous quote earns the prominence. */}
      <article className="relative mt-10 overflow-hidden rounded-3xl border-2 border-saffron-500/45 bg-cream-50 p-7 sm:p-10 shadow-[0_24px_60px_-30px_rgba(156,42,42,0.32)] max-w-3xl mx-auto">
        <div
          aria-hidden
          className="absolute inset-0 -z-0"
          style={{
            background:
              "radial-gradient(700px 420px at 92% 8%, rgba(242,148,76,0.14), transparent 60%), radial-gradient(700px 420px at 8% 92%, rgba(214,73,73,0.08), transparent 60%)",
          }}
        />
        {/* Tasteful saffron quote glyph, sits comfortably inside
            the card padding (not crammed at the corner) and uses
            an SVG instead of the unicode ", so it matches the
            brand palette without the muddy "dark grey at low
            opacity" look that text rendering gives on cream. */}
        <span aria-hidden className="absolute top-6 left-6 sm:top-8 sm:left-8">
          <QuoteGlyph size={44} />
        </span>
        <div className="relative pl-10 sm:pl-14 pt-2">
          <p
            className={`text-xl sm:text-2xl text-ink-900 leading-relaxed ${
              /[ऀ-ॿ]/.test(FEATURED.body) ? "font-mukta" : "font-fraunces"
            }`}
          >
            {FEATURED.body}
          </p>
          <Attribution q={FEATURED} t={t} isHi={isHi} />
        </div>
      </article>

      {/* Masonry grid of the remaining quotes. CSS columns lets
          cards with very different body lengths sit next to each
          other without artificial vertical padding. */}
      <div className="mt-10 columns-1 sm:columns-2 lg:columns-3 gap-5 space-y-5 [&>article]:break-inside-avoid">
        {TESTIMONIALS.map((q, i) => (
          <article
            key={`${q.name}-${q.dateIso}-${i}`}
            className="relative overflow-hidden rounded-2xl border border-gold-500/45 bg-cream-50 p-5 sm:p-6 shadow-sm"
          >
            <span aria-hidden className="absolute top-5 left-5">
              <QuoteGlyph size={26} />
            </span>
            <div className="relative pl-8 pt-1">
              <p
                className={`text-base text-ink-900 leading-relaxed ${
                  /[ऀ-ॿ]/.test(q.body) ? "font-mukta" : "font-fraunces"
                }`}
              >
                {q.body}
              </p>
              <Attribution q={q} t={t} isHi={isHi} />
            </div>
          </article>
        ))}
      </div>

      {/* Share-your-thoughts CTA */}
      <div className="mt-12 text-center">
        <p
          className={`text-base sm:text-lg text-sindoor-700 ${
            isHi ? "font-mukta font-semibold" : "font-fraunces font-semibold"
          }`}
        >
          {t.shareTitle}
        </p>
        <p className="mt-1 text-sm text-ink-600 max-w-md mx-auto">
          {t.shareBody}
        </p>
        <Link
          href="/contact"
          data-ga="testimonial_share_cta"
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-saffron-500/55 bg-cream-50 hover:bg-saffron-50 text-sindoor-700 font-semibold px-5 py-2.5 text-sm transition-colors"
        >
          {t.shareCta}
        </Link>
      </div>
    </section>
  );
}
