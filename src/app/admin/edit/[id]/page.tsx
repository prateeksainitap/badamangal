/**
 * Admin "edit & publish" page for a PENDING bhandara.
 *
 * Reached from the "Edit & publish" button on bot-ingested rows in the
 * moderation queue. The bot pipeline writes lat/lng=0 and often leaves
 * organizer/area/etc. blank because Gemini couldn't read them off the
 * invite poster, this page is where the admin fills those gaps before
 * the listing goes live.
 *
 * The form is intentionally a plain server-rendered <form> with no
 * client-side state. We POST to the `editAndPublishAction` server
 * action which validates, writes, flips status → APPROVED, and
 * redirects back to /admin. Reload-safe; no JS required.
 *
 * Field display order mirrors the public detail page so the admin reads
 * top-to-bottom in the same shape an end user will see.
 */
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { editAndPublishAction } from "@/app/admin/actions";
import { stripBotProvenance } from "@/lib/sanitize";
import { resolveBhandaraCoords } from "@/lib/geocodeFallback";
import MapLocationInput from "@/components/admin/MapLocationInput";
import SubmitButton from "@/components/admin/SubmitButton";
import UpiQrUploadField from "@/components/UpiQrUploadField";
import AdminPhotoField from "@/components/admin/AdminPhotoField";
import PhoneInput from "@/components/PhoneInput";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminNavCounts } from "@/lib/admin-nav-counts";
import BotHeartbeat from "@/components/admin/BotHeartbeat";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
// Admin auth check moved to @/lib/admin-auth, see import above.
// Was a local reimplementation (one of 12 in the codebase); the
// single source means future auth changes (session expiry,
// HMAC signing, IP allowlist) are a one-file edit.

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminEditPage({ params }: PageProps) {
  if (!(await isAdmin())) redirect("/admin");
  const { id } = await params;

  const b = await prisma.bhandara.findUnique({ where: { id } });
  if (!b) notFound();

  // Parse the JSON-encoded array columns so we can round-trip into
  // <textarea> / <input> values. tuesdayDates → one date per line,
  // menu → comma-separated.
  let tuesdayDates: string[] = [];
  try {
    const v = JSON.parse(b.tuesdayDates);
    if (Array.isArray(v)) tuesdayDates = v.filter((x) => typeof x === "string");
  } catch {
    /* tolerate legacy rows */
  }
  let menu: string[] = [];
  try {
    const v = JSON.parse(b.menu);
    if (Array.isArray(v)) menu = v.filter((x) => typeof x === "string");
  } catch {
    /* tolerate legacy rows */
  }

  // Auto-resolve 0,0 coords via the geocode fallback chain.
  // Bhandaras ingested before the chain landed (or where every
  // candidate missed at ingest time) sit at lat=lng=0 and force the
  // admin to manually paste a Maps link to publish. Now we try the
  // same prioritised candidate list at view time and prefill the
  // lat/lng inputs with the best hit, same data path as ingest, so
  // results are consistent. MapLocationInput surfaces a "auto / X"
  // tag so the admin sees the pre-fill is a guess (not human-pinned)
  // and can override with a real paste if it landed wrong.
  let mapInitialLat = b.lat;
  let mapInitialLng = b.lng;
  let autoResolvedFrom: string | undefined;
  if (b.lat === 0 && b.lng === 0) {
    try {
      const hit = await resolveBhandaraCoords({
        address: b.address,
        area: b.area,
        landmark: b.landmark,
        organizerName: b.organizerName,
        name: b.name,
      });
      if (hit) {
        mapInitialLat = hit.lat;
        mapInitialLng = hit.lng;
        autoResolvedFrom = hit.candidateTag;
      }
    } catch (err) {
      // Fallback chain shouldn't block page render. If Ola Maps is
      // down or rate-limits us, fall through to the existing
      // 0,0-with-warning UI so the admin can still paste manually.
      console.warn("[admin/edit] auto-resolve failed:", err);
    }
  }

  const action = editAndPublishAction.bind(null, b.id);

  return (
    <AdminShell navCounts={await getAdminNavCounts()} botHeartbeat={<BotHeartbeat />}>
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 font-mono text-[10px]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400/[0.06] border border-cyan-400/20 px-2.5 py-1 uppercase tracking-[0.18em] text-cyan-300/85">
                <span aria-hidden className="relative inline-flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-cyan-400/70 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
                </span>
                Moderation
              </span>
            </div>
            <h1 className="font-fraunces text-3xl sm:text-4xl text-cream-50 leading-[1.05] tracking-tight">
              Edit &amp;{" "}
              <span className="bg-gradient-to-r from-cyan-300 to-violet-300 bg-clip-text text-transparent">
                publish
              </span>
            </h1>
            <p className="mt-2 text-sm text-cream-50/55 font-mono max-w-xl">
              <span className="text-cyan-300">$</span> Fix anything Gemini got
              wrong on the invite, then save to flip this listing live.
            </p>
          </div>
          <Link
            href="/admin/bhandaras"
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-4 py-2 text-sm transition-colors font-mono font-medium"
          >
            ← Back to bhandaras queue
          </Link>
        </header>

        {/* Two-pane edit layout, pamphlet pins to the left so the
            operator can keep reading it while scrolling through the
            form on the right. AdminPhotoField writes to a hidden
            `<input name="photoUrl">` that's still inside the same
            <form>, so the server action signature is unchanged.
            Below lg, the panes stack (photo on top, form below)
            same UX the old single-column page had. */}
        <form
          action={action}
          className="grid gap-5 lg:gap-6 lg:grid-cols-12 items-start"
        >
          {/* LEFT, sticky pamphlet pane. `lg:self-start` keeps the
              grid item from stretching to match the right pane's
              height, which is what allows `lg:sticky lg:top-20` to
              actually pin it as the right pane scrolls past.
              `top-20` (5rem ≈ 80px) clears the AdminShell's 56px
              (h-14) sticky top bar with ~24px of breathing room so
              the pamphlet doesn't visually crash into it. */}
          <aside className="lg:col-span-5 lg:sticky lg:top-20 lg:self-start rounded-2xl border border-cyan-400/20 bg-[#0B0E16]/85 backdrop-blur-sm p-5 sm:p-6">
            <AdminPhotoField
              name="photoUrl"
              defaultValue={b.photoUrl ?? ""}
              label="Pamphlet"
              hint="Read the pamphlet here while you verify + fix the form on the right. Replacing the photo only swaps the image; other fields stay until you click Save & publish."
            />
          </aside>

          {/* RIGHT, scrollable form fields. Keeps the same dark
              card styling the old single-pane form had. */}
          <div className="lg:col-span-7 grid gap-5 rounded-2xl border border-cyan-400/20 bg-[#0B0E16]/85 backdrop-blur-sm p-5 sm:p-7">
        {/* Labels rendered in font-mono (see Pair component below), which
            doesn't ship Devanagari glyphs, so Hindi characters used to
            print as ???? boxes. Admin is English-only, so the parenthetical
            "(Hindi)" is enough to identify the localised field. */}
        <Pair label="Name (English)" name="name" defaultValue={b.name} required />
        <Pair label="Name (Hindi)" name="nameHi" defaultValue={b.nameHi ?? ""} />

        {/* Strip the WhatsApp-bot provenance tag from the textarea
            value so the admin doesn't have to delete "[bot:whatsapp …]"
            by hand before every save. The tag's diagnostic info
            (sender, group, hash) is captured in the bot moderation
            view above; once the admin clicks "Save & publish" the
            row is no longer in the bot queue and the tag is no
            longer useful, so dropping it on save is the right
            default. The bot row's parseBotTag in /admin?type=whatsapp
            keeps reading the RAW description from Prisma, so the
            queue still surfaces the provenance pill until publish. */}
        <PairArea
          label="Description"
          name="description"
          defaultValue={stripBotProvenance(b.description) ?? ""}
        />
        <PairArea
          label="Description (Hindi)"
          name="descriptionHi"
          defaultValue={stripBotProvenance(b.descriptionHi) ?? ""}
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <Pair label="Area" name="area" defaultValue={b.area} required />
          <Pair
            label="Landmark"
            name="landmark"
            defaultValue={b.landmark ?? ""}
          />
        </div>

        <Pair label="Address" name="address" defaultValue={b.address} required />
        <Pair
          label="Address (Hindi)"
          name="addressHi"
          defaultValue={b.addressHi ?? ""}
        />

        {/* Latitude + Longitude now live inside MapLocationInput,
            which adds a "paste anything Maps-y" helper above the
            number inputs. The form fields are still
            `name="lat"`/`name="lng"`, so editAndPublishAction reads
            them unchanged. */}
        <MapLocationInput
          initialLat={mapInitialLat}
          initialLng={mapInitialLng}
          autoResolvedFrom={autoResolvedFrom}
        />

        <label className="grid gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/70 font-mono">
            Tuesday dates (one per line, DD-MM-YYYY)
          </span>
          <textarea
            name="tuesdayDates"
            defaultValue={tuesdayDates.map(formatDateForDisplay).join("\n")}
            rows={Math.max(2, tuesdayDates.length)}
            className="rounded-xl border border-cyan-400/20 bg-[#080A10]/70 backdrop-blur-sm px-3 py-2 text-cream-50 font-mono placeholder:text-cream-50/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/45 focus:border-cyan-400/55 transition-colors"
            placeholder="12-05-2026"
          />
        </label>

        <div className="grid sm:grid-cols-2 gap-4">
          <Pair
            label="Start time (HH:MM)"
            name="timeStart"
            defaultValue={b.timeStart}
            required
          />
          <Pair
            label="End time (HH:MM, optional)"
            name="timeEnd"
            defaultValue={b.timeEnd ?? ""}
          />
        </div>

        <label className="grid gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/70 font-mono">
            Menu (comma-separated)
          </span>
          <input
            name="menu"
            defaultValue={menu.join(", ")}
            placeholder="puri, sabzi, prasad"
            className="rounded-xl border border-cyan-400/20 bg-[#080A10]/70 backdrop-blur-sm px-3 py-2 text-cream-50 font-mono placeholder:text-cream-50/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/45 focus:border-cyan-400/55 transition-colors"
          />
        </label>

        <div className="grid sm:grid-cols-2 gap-4">
          <Pair
            label="Organizer name"
            name="organizerName"
            defaultValue={b.organizerName}
            required
          />
          {/* Phone is intentionally optional on the admin edit form,
              bot-ingested rows often have a blank or junk phone field
              because Gemini couldn't parse a number off the poster, and
              forcing the admin to invent one just to publish blocks
              the queue. Shared PhoneInput component renders the +91
              chip + caps at 10 digits, identical to public forms. The
              component runs in uncontrolled mode here (defaultValue
              only, no value/onChange) because the parent <form
              action={...}> reads via FormData on the server action;
              the inner <input name="organizerPhone"> wires straight
              into editAndPublishAction. */}
          <label className="grid gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/70 font-mono">
              Organizer phone
            </span>
            <PhoneInput
              name="organizerPhone"
              defaultValue={b.organizerPhone}
              hint="10-digit mobile number. Optional."
            />
          </label>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Pair
            label="WhatsApp (optional)"
            name="organizerWhatsapp"
            defaultValue={b.organizerWhatsapp ?? ""}
          />
        </div>

        {/* ── Donations (optional) ────────────────────────────────────
            Lifted the UPI input out of the WhatsApp / UPI grid into a
            dedicated section. The old two-column treatment made UPI
            look like contact metadata; operators routinely missed it
            when an organiser wanted donations enabled. The fieldset
            chrome mirrors the same block on ScanReview and the
            wording on the public BhandaraForm so all three flows feel
            like one feature. When the value is populated, the public
            /bhandara/[slug] page renders a 'Sponsor this bhandara'
            UPI deep-link. */}
        <fieldset className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.03] p-3">
          <legend className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/85 font-mono px-1">
            Enable donations (optional)
          </legend>
          <p className="text-xs text-cream-50/65 mt-1 leading-relaxed">
            Add the organiser&apos;s UPI ID so the public bhandara page
            surfaces a &quot;Sponsor this bhandara&quot; button. Leave blank
            to keep donations off for this listing.
          </p>
          <div className="mt-2.5 space-y-3">
            <Pair
              label="UPI ID"
              name="upiId"
              defaultValue={b.upiId ?? ""}
              hint="e.g. rajesh@oksbi  ·  9876543210@upi"
            />
            {/* Companion QR upload. Some organisers only know their
                UPI as a printed QR; uploading it here lets the public
                bhandara page render their custom QR (or a Razorpay
                dynamic-amount QR for trust-registered organisers)
                instead of falling back to a client-generated QR from
                the upiId text. */}
            <UpiQrUploadField
              name="upiQrUrl"
              defaultValue={b.upiQrUrl ?? ""}
            />
          </div>
        </fieldset>

        {/* Photo URL field used to live here as a plain text input.
            Now handled by the AdminPhotoField at the top of the form,
            which writes to a hidden <input name="photoUrl"> so the
            server action signature is unchanged. */}

        {/* The text used to live as three sibling nodes inside the
            flex container ("Mark as", <strong>...</strong>, "(hint)"),
            which made each one its own flex item with `gap-2` visibly
            stretching the words apart and forcing weird column-wraps
            when the label was long. Wrapping the entire copy in a
            single <span> makes it one flex item that wraps as normal
            prose. `items-start` aligns the checkbox to the first line
            of text instead of vertically centering against a wrapped
            two-line block. */}
        <label className="flex items-start gap-2 text-sm text-cream-50/85 mt-2 font-mono leading-relaxed">
          <input
            type="checkbox"
            name="isVerified"
            defaultChecked={b.isVerified}
            className="h-4 w-4 mt-0.5 shrink-0 accent-leaf-400"
          />
          <span>
            Mark as <strong className="text-cream-50">Verified</strong>{" "}
            <span className="text-cream-50/55">(called &amp; confirmed by phone)</span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm text-cream-50/85 mt-2 font-mono leading-relaxed">
          <input
            type="checkbox"
            name="isFeatured"
            defaultChecked={b.isFeatured}
            className="h-4 w-4 mt-0.5 shrink-0 accent-cyan-400"
          />
          <span>
            Mark as <strong className="text-cream-50">Featured on homepage</strong>{" "}
            <span className="text-cream-50/55">(lands at the very top of the featured row)</span>
          </span>
        </label>

        <div className="flex items-center gap-3 mt-4">
          <SubmitButton
            variant="primary-saffron"
            size="md"
            pendingLabel="Saving…"
          >
            Save &amp; publish →
          </SubmitButton>
          <Link
            href="/admin/bhandaras"
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-4 py-2 text-sm transition-colors font-mono font-medium"
          >
            Cancel
          </Link>
        </div>
          </div>
        </form>
      </div>
    </AdminShell>
  );
}

/**
 * Single-line input wrapper. Kept inline (not extracted) so the file
 * is self-contained, this page is one of one in the admin flow and
 * we don't need a shared form-kit yet.
 *
 * Supports the usual HTML constraint attributes (maxLength, pattern,
 * inputMode) so callers like the organizer-phone field can enforce
 * "10 digits or nothing" without forking the component.
 */
function Pair({
  label,
  name,
  defaultValue,
  required,
  type = "text",
  step,
  hint,
  maxLength,
  pattern,
  inputMode,
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  type?: string;
  step?: string;
  hint?: string;
  maxLength?: number;
  pattern?: string;
  inputMode?:
    | "text"
    | "search"
    | "email"
    | "tel"
    | "url"
    | "none"
    | "numeric"
    | "decimal";
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/70 font-mono">
        {label}
        {required ? <span className="text-sindoor-700"> ·</span> : null}
      </span>
      <input
        name={name}
        type={type}
        step={step}
        required={required}
        defaultValue={defaultValue}
        maxLength={maxLength}
        pattern={pattern}
        inputMode={inputMode}
        className="rounded-xl border border-cyan-400/20 bg-[#080A10]/70 backdrop-blur-sm px-3 py-2 text-cream-50 font-mono placeholder:text-cream-50/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/45 focus:border-cyan-400/55 transition-colors"
      />
      {hint ? (
        <span className="text-xs text-cream-50/55 font-mono">{hint}</span>
      ) : null}
    </label>
  );
}

/**
 * Convert a YYYY-MM-DD ISO date (the DB storage format) to DD-MM-YYYY
 * for display in the admin textarea. The DB has to stay ISO so the
 * sort + future-Tuesday picker in /bhandara/[slug] (which does
 * `d >= today.toISOString().slice(0,10)` lexically) keeps working.
 * Legacy rows in any other shape pass through unchanged so the admin
 * can read and re-save them without an explicit migration step.
 */
function formatDateForDisplay(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Multi-line textarea variant for descriptions and the like. */
function PairArea({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/70 font-mono">
        {label}
      </span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={3}
        className="rounded-xl border border-cyan-400/20 bg-[#080A10]/70 backdrop-blur-sm px-3 py-2 text-cream-50 font-mono placeholder:text-cream-50/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/45 focus:border-cyan-400/55 transition-colors"
      />
    </label>
  );
}
