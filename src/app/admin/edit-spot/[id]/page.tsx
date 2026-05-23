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
import { prisma } from "@/lib/db";
import { editAndApproveSpotAction } from "@/app/admin/actions";
import { isAdmin } from "@/lib/admin-auth";
import { stripBotProvenance } from "@/lib/sanitize";
import SubmitButton from "@/components/admin/SubmitButton";
import AdminPhotoField from "@/components/admin/AdminPhotoField";
import MapLocationInput from "@/components/admin/MapLocationInput";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminEditSpotPage({ params }: PageProps) {
  if (!(await isAdmin())) redirect("/admin");
  const { id } = await params;

  const s = await prisma.spot.findUnique({ where: { id } });
  if (!s) notFound();

  // Spot.extraPhotoUrls is stored as a JSON-encoded string of URLs.
  // Parse defensively — a malformed value shouldn't 500 the edit page.
  let extraPhotoUrls: string[] = [];
  try {
    const parsed = JSON.parse(s.extraPhotoUrls || "[]") as unknown;
    if (Array.isArray(parsed)) {
      extraPhotoUrls = parsed.filter(
        (u): u is string => typeof u === "string" && u.length > 0,
      );
    }
  } catch {
    extraPhotoUrls = [];
  }

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

      {/* Photo field is now editable inside the form via AdminPhotoField.
          Old read-only preview band was removed; the field still shows
          the current photo on top (same look as before) and adds
          Replace / Take photo buttons that POST to /api/admin/upload-image.
          The new URL flows through a hidden <input name="photoUrl"> read
          by editAndApproveSpotAction on save. */}
      <form action={action} className="mt-6 grid gap-5">
        <AdminPhotoField
          name="photoUrl"
          defaultValue={s.photoUrl ?? ""}
          label="Photo"
          hint="Spots are time-limited live photos. Only swap this if the original is genuinely wrong (rotated, cropped poorly, etc)."
        />

        {/* Extra photos gallery — submitters can attach up to 4 additional
            photos via the public /spot form (Spot.extraPhotoUrls). The
            edit page previously ignored that column entirely, so admins
            had no way to see the supplementary shots. Now: each extra is
            a clickable thumbnail that opens the full-resolution image
            in a new tab. Read-only for now — the primary photoUrl
            remains the only editable one. */}
        {extraPhotoUrls.length > 0 ? (
          <div className="grid gap-2">
            <span className="text-sm text-ink-600">
              Extra photos ({extraPhotoUrls.length})
              <span className="ml-2 text-xs text-ink-600/70">
                Submitter attached these alongside the primary photo. Click any to open the full image.
              </span>
            </span>
            <ul className="flex flex-wrap gap-2">
              {extraPhotoUrls.map((url, i) => (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-600"
                    aria-label={`Open extra photo ${i + 1} of ${extraPhotoUrls.length} in a new tab`}
                    title="Open full image"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-24 w-24 rounded-xl object-cover border border-gold-500/40 bg-cream-50 group-hover:border-saffron-500 transition-colors"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
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

        {/* MapLocationInput replaces the two plain lat/lng number
            inputs with the same paste-anything-Maps-y resolver the
            bhandara edit page uses. The widget still renders the
            name="lat" / name="lng" fields underneath that
            editAndApproveSpotAction reads from FormData, so the
            server action stays unchanged. Especially valuable here
            because bot-ingested spots usually arrive at lat=lng=0
            (WhatsApp strips EXIF GPS) and the admin needs a 1-click
            way to drop a real pin from a pasted Maps share-link. */}
        <MapLocationInput
          initialLat={s.lat}
          initialLng={s.lng}
          optional
        />

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

        {/* Shared SubmitButton gives us a pending spinner + disable
            during the editAndApproveSpotAction round-trip. Mirrors
            the bhandara edit page so both edit forms behave the
            same on slow Netlify cold starts. Cancel stays a Link
            (always allow escape). */}
        <div className="flex items-center gap-3 mt-2">
          <SubmitButton
            variant="primary-saffron"
            size="md"
            pendingLabel="Saving…"
          >
            Save &amp; approve
          </SubmitButton>
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
