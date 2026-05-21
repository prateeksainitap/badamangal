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
import MapLocationInput from "@/components/admin/MapLocationInput";
import SubmitButton from "@/components/admin/SubmitButton";
import AdminPhotoField from "@/components/admin/AdminPhotoField";
import PhoneInput from "@/components/PhoneInput";
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

  const action = editAndPublishAction.bind(null, b.id);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 pb-24">
      <header className="pt-8 pb-4 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-600">
            Moderation
          </p>
          <h1 className="font-fraunces text-3xl text-sindoor-700 mt-1">
            Edit &amp; publish
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            Fix anything the model got wrong on the invite, then click
            <strong> Save &amp; publish</strong> to flip this row live.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm rounded-full px-3 py-1.5 border border-gold-500/50 text-ink-900 hover:bg-cream-50"
        >
          ← Back to queue
        </Link>
      </header>

      {/* Photo field lives inside the form now (vs the old read-only
          preview band that sat above it). AdminPhotoField renders the
          same wide preview at the top of the form and adds Replace /
          Take photo buttons that POST to /api/admin/upload-image. The
          new URL flows through a hidden <input name="photoUrl"> so
          the form action keeps reading photoUrl unchanged. */}
      <form action={action} className="mt-6 grid gap-5">
        <AdminPhotoField
          name="photoUrl"
          defaultValue={b.photoUrl ?? ""}
          label="Photo"
          hint="Replacing the photo only swaps the image. All other fields below stay as they are until you click Save & publish."
        />
        <Pair label="Name (English)" name="name" defaultValue={b.name} required />
        <Pair label="Name (हिन्दी)" name="nameHi" defaultValue={b.nameHi ?? ""} />

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
          label="विवरण (Hindi)"
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
          label="पता (Hindi)"
          name="addressHi"
          defaultValue={b.addressHi ?? ""}
        />

        {/* Latitude + Longitude now live inside MapLocationInput,
            which adds a "paste anything Maps-y" helper above the
            number inputs. The form fields are still
            `name="lat"`/`name="lng"`, so editAndPublishAction reads
            them unchanged. */}
        <MapLocationInput initialLat={b.lat} initialLng={b.lng} />

        <label className="grid gap-1.5">
          <span className="text-sm text-ink-600">
            Tuesday dates (one per line, DD-MM-YYYY)
          </span>
          {/* Display in DD-MM-YYYY (the format the admin reads / writes),
              but the DB row stays in YYYY-MM-DD ISO so the upcoming-date
              picker in /bhandara/[slug] (which sorts strings lexically
              and compares with today.toISOString().slice(0,10)) keeps
              working without a per-row format check. The conversion
              loop is intentionally tolerant of legacy rows that are
              already in DD-MM-YYYY or any other shape, formatDateForDisplay
              passes them through unchanged. */}
          <textarea
            name="tuesdayDates"
            defaultValue={tuesdayDates.map(formatDateForDisplay).join("\n")}
            rows={Math.max(2, tuesdayDates.length)}
            className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
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
          <span className="text-sm text-ink-600">
            Menu (comma-separated)
          </span>
          <input
            name="menu"
            defaultValue={menu.join(", ")}
            placeholder="puri, sabzi, prasad"
            className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
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
            <span className="text-sm text-ink-600">Organizer phone</span>
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
          <Pair
            label="UPI ID (optional)"
            name="upiId"
            defaultValue={b.upiId ?? ""}
          />
        </div>

        {/* Photo URL field used to live here as a plain text input.
            Now handled by the AdminPhotoField at the top of the form,
            which writes to a hidden <input name="photoUrl"> so the
            server action signature is unchanged. */}

        <label className="flex items-center gap-2 text-sm text-ink-900 mt-2">
          <input
            type="checkbox"
            name="isVerified"
            defaultChecked={b.isVerified}
            className="h-4 w-4 accent-leaf-600"
          />
          Mark as <strong>Verified</strong> (called &amp; confirmed by phone)
        </label>

        {/* Admin-controlled "feature on homepage" toggle. When on,
            this bhandara jumps to the very top of the homepage's
            FeaturedBhandaras row, ahead of today's-bhandara +
            verified-with-photo + everything else. Use for the lead
            story of the week (e.g. host bhandara for the next
            Tuesday, a venue that just landed press coverage). */}
        <label className="flex items-center gap-2 text-sm text-ink-900 mt-2">
          <input
            type="checkbox"
            name="isFeatured"
            defaultChecked={b.isFeatured}
            className="h-4 w-4 accent-saffron-600"
          />
          Mark as <strong>Featured on homepage</strong> (lands at the very top of the featured row)
        </label>

        {/* SubmitButton (shared across /admin) wraps the same saffron
            primary styling as the inline button it replaced, plus a
            useFormStatus()-driven pending state: button disables and
            swaps "Save & publish" → spinner + "Saving…" while the
            server action is in flight. Stops the admin from double-
            clicking on slow round-trips (Netlify cold start) and
            writing the same APPROVED row twice. Cancel stays a plain
            <Link> deliberately, the admin should always be able to
            bail to /admin even mid-submit. */}
        <div className="flex items-center gap-3 mt-4">
          <SubmitButton
            variant="primary-saffron"
            size="md"
            pendingLabel="Saving…"
          >
            Save &amp; publish
          </SubmitButton>
          <Link
            href="/admin"
            className="text-sm rounded-full px-3 py-2 border border-gold-500/50 text-ink-900 hover:bg-cream-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
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
      <span className="text-sm text-ink-600">
        {label}
        {required ? <span className="text-sindoor-700"> *</span> : null}
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
        className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
      />
      {hint ? <span className="text-xs text-ink-600">{hint}</span> : null}
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
      <span className="text-sm text-ink-600">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={3}
        className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
      />
    </label>
  );
}
