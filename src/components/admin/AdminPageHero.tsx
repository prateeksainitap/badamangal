/**
 * Merged page hero used on every admin sub-page.
 *
 * Originally this was an illustration-only strip that sat ABOVE the
 * page's eyebrow/title/subtitle block, producing two stacked
 * sections of chrome before the operator hit any actual data. We
 * collapsed it into a single panel: eyebrow + title + subtitle +
 * primary-action on the left, the page's isometric illustration
 * tucked into the right as a decorative aside. Same pattern as the
 * /admin/home greeting hero.
 *
 * Backward compatible: callers can still render the illustration-
 * only form by omitting `title`. That preserves any legacy page
 * that hasn't been migrated yet. Once every page passes a title,
 * the illustration-only branch can be deleted.
 */
import AdminHeroArt from "@/components/admin/AdminHeroArt";

type Subject =
  | "dashboard"
  | "bhandaras"
  | "spots"
  | "mentions"
  | "organise"
  | "volunteers"
  | "discover"
  | "gallery"
  | "scan"
  | "content"
  | "emails"
  | "login";

type Props = {
  subject: Subject;
  /** Small uppercase eyebrow above the title, e.g. "Moderation",
   *  "Scan", "Inbox". Renders as the same cyan-pulse chip every
   *  admin page already uses. */
  eyebrow?: string;
  /** Main page heading. Plain text. Pair with `titleAccent` to
   *  highlight a phrase in the cyan→violet gradient. Omit to fall
   *  back to the illustration-only layout (legacy). */
  title?: string;
  /** Phrase appended to `title` and rendered with the cyan-to-violet
   *  gradient + clip-text. e.g. title="Upload an invite,"
   *  titleAccent="publish in seconds". */
  titleAccent?: string;
  /** Optional one-liner under the title. Accepts ReactNode so the
   *  page can include a "$" prompt prefix in cyan. */
  subtitle?: React.ReactNode;
  /** Right-aligned actions, typically a "← Dashboard" link or a
   *  Scan & publish CTA. */
  primaryAction?: React.ReactNode;
};

export default function AdminPageHero({
  subject,
  eyebrow,
  title,
  titleAccent,
  subtitle,
  primaryAction,
}: Props) {
  // Legacy fall-through: when no title is passed, render the old
  // illustration-only band. Remove once every caller has migrated.
  if (!title) {
    return (
      <div
        aria-hidden
        className="mb-5 rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-[#0B0E16] via-[#0A0C13] to-[#080A10] overflow-hidden relative"
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-50 admin-data-grid pointer-events-none"
        />
        <div className="relative h-24 sm:h-28 md:h-32 lg:h-36">
          <AdminHeroArt subject={subject} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative mb-6 rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-[#0B0E16] via-[#0A0C13] to-[#080A10] overflow-hidden">
      {/* Same data-grid texture the legacy band used so the merged
          panel still reads as the "console surface" the operator's
          eye recognises. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-50 admin-data-grid pointer-events-none"
      />
      {/* Two-column on sm+, text on the left grows to fill, the
          illustration tucks into the right as a fixed-width aside.
          Stacks on mobile so the title doesn't fight a giant SVG
          for horizontal room. */}
      <div className="relative grid items-center gap-4 sm:gap-5 p-4 sm:p-5 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="flex items-center gap-2 mb-1.5 font-mono text-[10px]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400/[0.06] border border-cyan-400/20 px-2.5 py-1 uppercase tracking-[0.18em] text-cyan-300/85">
                <span aria-hidden className="relative inline-flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-cyan-400/70 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
                </span>
                {eyebrow}
              </span>
            </div>
          ) : null}
          <h1 className="font-fraunces text-2xl sm:text-3xl text-cream-50 leading-[1.05] tracking-tight">
            {title}
            {titleAccent ? (
              <>
                {" "}
                <span className="bg-gradient-to-r from-cyan-300 via-cyan-200 to-violet-300 bg-clip-text text-transparent">
                  {titleAccent}
                </span>
              </>
            ) : null}
          </h1>
          {subtitle ? (
            <p className="text-[13px] text-cream-50/55 mt-1.5 max-w-2xl font-mono">
              {subtitle}
            </p>
          ) : null}
          {primaryAction ? (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {primaryAction}
            </div>
          ) : null}
        </div>
        {/* Decorative illustration aside. Hidden on small screens
            where vertical room is already tight; appears as a
            ~96–144px-wide block on sm+ so it accents the hero
            without dominating it. */}
        <div
          aria-hidden
          className="hidden sm:block relative h-20 sm:h-24 md:h-28 w-32 sm:w-40 md:w-48 shrink-0"
        >
          <AdminHeroArt subject={subject} />
        </div>
      </div>
    </div>
  );
}
