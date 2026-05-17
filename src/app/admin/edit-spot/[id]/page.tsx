/**
 * Admin "edit & approve" page for a Spot (live photo).
 *
 * Mirrors /admin/edit/[id] (the bhandara edit page) but for the simpler
 * Spot row shape:
 *   - caption + area + address + language
 *   - lat / lng, bot-ingested spots often land 0,0 because the WhatsApp
 *     forward strips EXIF GPS; the admin fills these in from the photo
 *   - reporterName, the WA forward's sender, kept editable so admin
 *     can correct "Praveen" → "Praveen Yadav" etc.
 *   - TTL choice: keep the existing expiresAt, or reset it to now + 8h
 *     so a freshly-reviewed spot gets a full window on the city map
 *     even if the upload sat in PENDING for a few hours.
 *
 * Save → status APPROVED + redirect back to the WhatsApp-bot spot tab.
 * Form is server-rendered with plain inputs; no JS required.
 */
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { editAndApproveSpotAction } from "@/app/admin/actions";
import { stripBotProvenance } from "@/lib/sanitize";

export const dynamic = "force-dynamic";
const COOKIE = "admin";

async function isAdmin(): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const c = await cookies();
  return c.get(COOKIE)?.value === expected;
}

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminEditSpotPage({ params }: PageProps) {
  if (!(await isAdmin())) redirect("/admin");
  const { id } = await params;

  const s = await prisma.spot.findUnique({ where: { id } });
  if (!s) notFound();

  const action = editAndApproveSpotAction.bind(null, s.id);
  // Compute a friendly remaining-TTL hint for the "Keep current
  // expiry" radio so the admin sees how much window is left before
  // they hit Save. Negative values mean the spot already expired and
  // would only return to the map if the admin picks "Reset to 8h".
  const msLeft = s.expiresAt.getTime() - Date.now();
  const hoursLeft = Math.floor(msLeft / (60 * 60 * 1000));
  const minutesLeft = Math.floor((msLeft % (60 * 60 * 1000)) / 60000);
  const ttlHint =
    msLeft <= 0
      ? "(already expired)"
      : `(≈ ${hoursLeft}h ${minutesLeft}m remaining)`;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 pb-24">
      <header className="pt-8 pb-4 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-600">
            Moderation
          </p>
          <h1 className="font-fraunces text-3xl text-sindoor-700 mt-1">
            Edit &amp; approve spot
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            Fix the caption / coords / address, then click
            <strong> Save &amp; approve</strong> to put this photo on
            the live map.
          </p>
        </div>
        <Link
          href="/admin?type=whatsapp&status=spot"
          className="text-sm rounded-full px-3 py-1.5 border border-gold-500/50 text-ink-900 hover:bg-cream-50"
        >
          ← Back to bot spots
        </Link>
      </header>

      {s.photoUrl ? (
        <a
          href={s.photoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-2 rounded-2xl border border-gold-500/40 overflow-hidden bg-cream-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-600"
          title="Open full image in a new tab"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={s.photoUrl}
            alt=""
            className="max-h-[420px] w-full object-contain"
          />
        </a>
      ) : null}

      <form action={action} className="mt-6 grid gap-5">
        <label className="grid gap-1.5">
          <span className="text-sm text-ink-600">
            Caption <span className="text-sindoor-700">*</span>
          </span>
          {/* Strip the [bot:whatsapp …] provenance tag from the
              textarea value so the admin doesn't have to delete it
              by hand. The WhatsApp-bot moderation view reads the
              raw caption from Prisma, so the queue still shows the
              sender + group pill until the row is approved here. */}
          <textarea
            name="caption"
            defaultValue={stripBotProvenance(s.caption) ?? ""}
            rows={3}
            maxLength={200}
            placeholder="Puri-sabzi being served outside a saffron-draped pandal."
            className="rounded-xl border border-gold-500/50 bg-white px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-saffron-600 focus:border-saffron-600"
          />
          <span className="text-xs text-ink-600">
            Max 200 chars. The [bot:…] provenance tag was auto-stripped
            from this field; the bot moderation view keeps the
            sender / group / hash info until the row is approved.
          </span>
        </label>

        <div className="grid sm:grid-cols-2 gap-4">
          <Pair
            label="Area"
            name="area"
            defaultValue={s.area ?? ""}
            hint="Lucknow neighbourhood. Optional."
          />
          <Pair
            label="Language"
            name="language"
            defaultValue={s.language ?? "mixed"}
            hint="One of: hi / en / mixed"
          />
        </div>

        <Pair
          label="Address"
          name="address"
          defaultValue={s.address ?? ""}
          hint="Visible signboard text or a quick locality description. Optional."
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <Pair
            label="Latitude"
            name="lat"
            type="number"
            step="any"
            defaultValue={String(s.lat)}
            required
            hint="Lucknow ≈ 26.6 – 27.0"
          />
          <Pair
            label="Longitude"
            name="lng"
            type="number"
            step="any"
            defaultValue={String(s.lng)}
            required
            hint="Lucknow ≈ 80.7 – 81.2"
          />
        </div>

        <Pair
          label="Reporter / sender name"
          name="reporterName"
          defaultValue={s.reporterName ?? ""}
          hint="Whoever forwarded the photo into the WhatsApp group."
        />

        <fieldset className="grid gap-2 rounded-xl border border-gold-500/40 bg-cream-50/50 p-3">
          <legend className="text-sm text-ink-600 px-1">
            Expiry on save
          </legend>
          <label className="flex items-start gap-2 text-sm text-ink-900">
            <input
              type="radio"
              name="ttl"
              value="keep"
              defaultChecked
              className="mt-1 accent-saffron-600"
            />
            <span>
              <strong>Keep current expiry</strong>{" "}
              <span className="text-ink-600">{ttlHint}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-ink-900">
            <input
              type="radio"
              name="ttl"
              value="reset"
              className="mt-1 accent-saffron-600"
            />
            <span>
              <strong>Reset to 8 hours from now</strong>{" "}
              <span className="text-ink-600">
               , gives this spot a full TTL window even if the upload
                sat in PENDING for a while.
              </span>
            </span>
          </label>
        </fieldset>

        <div className="flex items-center gap-3 mt-2">
          <button
            type="submit"
            className="inline-flex justify-center items-center gap-2 rounded-full bg-saffron-600 hover:bg-saffron-500 text-cream-50 font-medium px-5 py-2.5 shadow-sm transition-colors"
          >
            Save &amp; approve
          </button>
          <Link
            href="/admin?type=whatsapp&status=spot"
            className="text-sm rounded-full px-3 py-2 border border-gold-500/50 text-ink-900 hover:bg-cream-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

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
