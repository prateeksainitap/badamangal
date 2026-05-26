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
 * Save → status APPROVED + the action redirects back to THIS edit page
 * so the operator can keep iterating without losing context. The
 * matching revalidatePath calls invalidate the admin layout + the
 * public homepage / detail pages so the new state is visible
 * immediately. Form is server-rendered with plain inputs; no JS
 * required.
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
import AdminShell from "@/components/admin/AdminShell";
import { getAdminNavCounts } from "@/lib/admin-nav-counts";
import BotHeartbeat from "@/components/admin/BotHeartbeat";

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
                approve spot
              </span>
            </h1>
            <p className="mt-2 text-sm text-cream-50/55 font-mono max-w-xl">
              <span className="text-cyan-300">$</span> Fix the caption /
              coords / address, then save to put this photo on the live
              map.
            </p>
          </div>
          <Link
            href="/admin/spots"
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/[0.08] border border-cyan-400/25 text-cyan-200 hover:bg-cyan-400/[0.16] hover:border-cyan-400/50 hover:text-cyan-100 px-4 py-2 text-sm transition-colors font-mono font-medium"
          >
            ← Back to spots queue
          </Link>
        </header>

        {/* Two-pane edit layout — primary photo + any extras pin to
            the left so the operator can verify the live photo (and
            its submitter-attached extras) while scrolling through
            the caption / coords / address fields on the right.
            AdminPhotoField writes to a hidden `<input name="photoUrl">`
            that's still inside this <form>, so editSpotAction's
            signature is unchanged. Below lg, the panes stack as
            before. */}
        <form
          action={action}
          className="grid gap-5 lg:gap-6 lg:grid-cols-12 items-start"
        >
          {/* LEFT — sticky photo pane. `lg:self-start` keeps the
              grid item from stretching to match the right pane's
              height, which is what allows `lg:sticky lg:top-20` to
              actually pin it as the right pane scrolls past. The
              extras gallery lives in this pane too so admins can
              see all the submitter's images while verifying.
              `top-20` (5rem ≈ 80px) clears the AdminShell's 56px
              sticky top bar with ~24px of breathing room. */}
          <aside className="lg:col-span-5 lg:sticky lg:top-20 lg:self-start rounded-2xl border border-cyan-400/20 bg-[#0B0E16]/85 backdrop-blur-sm p-5 sm:p-6 grid gap-5">
            <AdminPhotoField
              name="photoUrl"
              defaultValue={s.photoUrl ?? ""}
              label="Live photo"
              hint="Verify the photo here while editing the caption + coords on the right. Spots are time-limited; only swap if the original is genuinely wrong (rotated, cropped poorly, etc)."
            />

            {/* Extra photos gallery — submitters can attach up to 4
                additional photos via the public /spot form
                (Spot.extraPhotoUrls). Read-only — primary photoUrl
                remains the only editable one. */}
            {extraPhotoUrls.length > 0 ? (
              <div className="grid gap-2">
                <span className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/70 font-mono">
                  Extra photos ({extraPhotoUrls.length})
                </span>
                <span className="text-xs text-cream-50/55 font-mono">
                  Submitter attached these alongside the primary photo. Click
                  any to open the full image.
                </span>
                <ul className="flex flex-wrap gap-2">
                  {extraPhotoUrls.map((url, i) => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/55"
                        aria-label={`Open extra photo ${i + 1} of ${extraPhotoUrls.length} in a new tab`}
                        title="Open full image"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-20 w-20 rounded-xl object-cover border border-cyan-400/20 bg-[#0B0E16]/85 group-hover:border-cyan-400/55 transition-colors"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>

          {/* RIGHT — scrollable form fields. Same dark card styling
              the old single-pane form had. */}
          <div className="lg:col-span-7 grid gap-5 rounded-2xl border border-cyan-400/20 bg-[#0B0E16]/85 backdrop-blur-sm p-5 sm:p-7">
        <label className="grid gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/70 font-mono">
            Caption <span className="text-sindoor-700">·</span>
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
            className="rounded-xl border border-cyan-400/20 bg-[#080A10]/70 backdrop-blur-sm px-3 py-2 text-cream-50 font-mono placeholder:text-cream-50/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/45 focus:border-cyan-400/55 transition-colors"
          />
          <span className="text-xs text-cream-50/55 font-mono">
            Max 200 chars. The [bot:…] provenance tag was auto-stripped from
            this field; the bot moderation view keeps the sender / group /
            hash info until the row is approved.
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

        <fieldset className="grid gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.02] p-3">
          <legend className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/70 font-mono px-1">
            Expiry on save
          </legend>
          <label className="flex items-start gap-2 text-sm text-cream-50/85 font-mono">
            <input
              type="radio"
              name="ttl"
              value="keep"
              defaultChecked
              className="mt-1 accent-cyan-400"
            />
            <span>
              <strong className="text-cream-50">Keep current expiry</strong>{" "}
              <span className="text-cream-50/55">{ttlHint}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-cream-50/85 font-mono">
            <input
              type="radio"
              name="ttl"
              value="reset"
              className="mt-1 accent-cyan-400"
            />
            <span>
              <strong className="text-cream-50">Reset to 8 hours from now</strong>{" "}
              <span className="text-cream-50/55">
                — gives this spot a full TTL window even if the upload sat in
                PENDING for a while.
              </span>
            </span>
          </label>
        </fieldset>

        {/* Shared SubmitButton gives us a pending spinner + disable
            during the editAndApproveSpotAction round-trip. The
            primary-saffron variant is re-skinned globally to the
            cyan→violet gradient. */}
        <div className="flex items-center gap-3 mt-2">
          <SubmitButton
            variant="primary-saffron"
            size="md"
            pendingLabel="Saving…"
          >
            Save &amp; approve →
          </SubmitButton>
          <Link
            href="/admin/spots"
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
        className="rounded-xl border border-cyan-400/20 bg-[#080A10]/70 backdrop-blur-sm px-3 py-2 text-cream-50 font-mono placeholder:text-cream-50/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/45 focus:border-cyan-400/55 transition-colors"
      />
      {hint ? (
        <span className="text-xs text-cream-50/55 font-mono">{hint}</span>
      ) : null}
    </label>
  );
}
