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
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { editAndPublishAction } from "@/app/admin/actions";
import { stripBotProvenance } from "@/lib/sanitize";
import MapLocationInput from "@/components/admin/MapLocationInput";

export const dynamic = "force-dynamic";
const COOKIE = "admin";

async function isAdmin(): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const c = await cookies();
  return c.get(COOKIE)?.value === expected;
}

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

      {/* Photo preview band, the most important context for the admin
          while filling fields. The thumbnail in /admin is 80px; here we
          render up to ~360px and link the open-full-tab fallback. */}
      {b.photoUrl ? (
        <a
          href={b.photoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-2 rounded-2xl border border-gold-500/40 overflow-hidden bg-cream-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-600"
          title="Open full image in a new tab"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={b.photoUrl}
            alt=""
            className="max-h-[420px] w-full object-contain"
          />
        </a>
      ) : null}

      <form action={action} className="mt-6 grid gap-5">
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
            Tuesday dates (one per line, YYYY-MM-DD)
          </span>
          <textarea
            name="tuesdayDates"
            defaultValue={tuesdayDates.join("\n")}
            rows={Math.max(2, tuesdayDates.length)}
            className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
            placeholder="2026-05-12"
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
          <Pair
            label="Organizer phone"
            name="organizerPhone"
            defaultValue={b.organizerPhone}
            required
          />
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

        <Pair
          label="Photo URL"
          name="photoUrl"
          defaultValue={b.photoUrl ?? ""}
        />

        <label className="flex items-center gap-2 text-sm text-ink-900 mt-2">
          <input
            type="checkbox"
            name="isVerified"
            defaultChecked={b.isVerified}
            className="h-4 w-4 accent-leaf-600"
          />
          Mark as <strong>Verified</strong> (called &amp; confirmed by phone)
        </label>

        <div className="flex items-center gap-3 mt-4">
          <button
            type="submit"
            className="inline-flex justify-center items-center gap-2 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-5 py-2.5 shadow-sm transition-colors"
          >
            Save &amp; publish
          </button>
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
 */
function Pair({
  label,
  name,
  defaultValue,
  required,
  type = "text",
  step,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  type?: string;
  step?: string;
  hint?: string;
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
        className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
      />
      {hint ? <span className="text-xs text-ink-600">{hint}</span> : null}
    </label>
  );
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
