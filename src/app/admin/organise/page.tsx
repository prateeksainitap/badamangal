/**
 * /admin/organise, moderation queue for OrganiseRequest leads.
 *
 * Pulls every row from the OrganiseRequest table (a) sorted with
 * NEW + CONTACTED first so the team's actionable queue is at the
 * top, (b) grouped by status implicitly via that ordering. Each
 * row renders a card with the lead's details + a button cluster
 * that fires server actions to move the lead through the workflow:
 *
 *   NEW  →  CONTACTED  →  CONFIRMED  →  COMPLETED
 *                              ↓             ↓
 *                          REJECTED      (terminal)
 *
 * Status changes fire revalidatePath("/admin/organise"), so the
 * queue is always live. No optimistic UI / no JS state, same
 * server-component + form-action pattern the bhandara moderation
 * surface uses.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  markOrganiseRequestContactedAction,
  markOrganiseRequestConfirmedAction,
  markOrganiseRequestCompletedAction,
  markOrganiseRequestRejectedAction,
  markOrganiseRequestNewAction,
  deleteOrganiseRequestAction,
} from "@/app/admin/actions";
import SubmitButton from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";
const COOKIE = "admin";

async function isAdmin(): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const c = await cookies();
  return c.get(COOKIE)?.value === expected;
}

type OrgRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  area: string | null;
  addressNotes: string | null;
  eventDates: string | null;
  eventTime: string | null;
  quantityType: string;
  quantityValue: number;
  packageTier: string;
  notes: string | null;
  status: string;
  source: string | null;
  createdAt: Date;
};

function parseDates(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (Array.isArray(v)) return v.filter((s): s is string => typeof s === "string");
  } catch {
    /* malformed legacy row */
  }
  return [];
}

function formatDmy(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${String(d).padStart(2, "0")} ${months[m - 1]} ${y}`;
}

function formatPhoneE164(digits: string): string {
  // DB column is freeform; normalise display to +91 9XXXXXXXXX where
  // possible. Anything that doesn't parse falls through as-is.
  const ten = digits.replace(/\D/g, "").slice(-10);
  if (ten.length === 10) return `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
  return digits;
}

function statusPill(status: string): { label: string; cls: string } {
  switch (status) {
    case "NEW":
      return { label: "NEW", cls: "bg-saffron-50 text-sindoor-700 border-saffron-500/55" };
    case "CONTACTED":
      return { label: "CONTACTED", cls: "bg-gold-500/10 text-gold-700 border-gold-500/55" };
    case "CONFIRMED":
      return { label: "CONFIRMED", cls: "bg-leaf-600/12 text-leaf-600 border-leaf-600/45" };
    case "COMPLETED":
      return { label: "COMPLETED", cls: "bg-ink-600/8 text-ink-600 border-ink-600/30" };
    case "REJECTED":
      return { label: "REJECTED", cls: "bg-alert-500/8 text-alert-500 border-alert-500/40" };
    default:
      return { label: status, cls: "bg-cream-50 text-ink-600 border-gold-500/40" };
  }
}

/**
 * Sort weight per status. Active queue (NEW, CONTACTED) up top so the
 * team sees what needs action without scrolling. CONFIRMED is mid-list
 * (work in progress). COMPLETED and REJECTED sink to the bottom as
 * historical context.
 */
function statusOrder(status: string): number {
  switch (status) {
    case "NEW": return 0;
    case "CONTACTED": return 1;
    case "CONFIRMED": return 2;
    case "COMPLETED": return 3;
    case "REJECTED": return 4;
    default: return 5;
  }
}

export default async function AdminOrganisePage() {
  if (!(await isAdmin())) redirect("/admin");

  const rows = await prisma.organiseRequest.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Sort by status priority, then most-recent-first within each bucket.
  const sorted = [...rows].sort((a, b) => {
    const sd = statusOrder(a.status) - statusOrder(b.status);
    if (sd !== 0) return sd;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const counts = {
    NEW: rows.filter((r) => r.status === "NEW").length,
    CONTACTED: rows.filter((r) => r.status === "CONTACTED").length,
    CONFIRMED: rows.filter((r) => r.status === "CONFIRMED").length,
    COMPLETED: rows.filter((r) => r.status === "COMPLETED").length,
    REJECTED: rows.filter((r) => r.status === "REJECTED").length,
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 pb-24">
      <header className="pt-8 pb-4 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-600">Moderation</p>
          <h1 className="font-fraunces text-3xl text-sindoor-700 mt-1">
            Organise-Bhandara Requests
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            Leads from <code className="text-saffron-600">/organise-bhandara</code>.
            Move each through NEW → CONTACTED → CONFIRMED → COMPLETED.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm rounded-full px-3 py-1.5 border border-gold-500/50 text-ink-900 hover:bg-cream-50"
        >
          ← Back to admin
        </Link>
      </header>

      {/* Status summary chips */}
      <div className="mt-3 flex flex-wrap gap-2">
        {(["NEW", "CONTACTED", "CONFIRMED", "COMPLETED", "REJECTED"] as const).map((s) => {
          const pill = statusPill(s);
          return (
            <span
              key={s}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-mukta uppercase tracking-[0.2em] font-semibold ${pill.cls}`}
            >
              {pill.label}
              <span className="font-numerals text-[0.85rem] tabular-nums opacity-80">
                {counts[s]}
              </span>
            </span>
          );
        })}
      </div>

      {/* Rows */}
      {sorted.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-gold-500/40 bg-cream-50 p-10 text-center">
          <p className="text-ink-600">
            No requests yet. They'll appear here as soon as anyone submits
            the form at <code className="text-saffron-600">/organise-bhandara</code>.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4">
          {sorted.map((row) => (
            <OrganiseCard key={row.id} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}

function OrganiseCard({ row }: { row: OrgRow }) {
  const dates = parseDates(row.eventDates);
  const qtyLabel =
    row.quantityType === "WHEAT_KG"
      ? `${row.quantityValue} kg wheat`
      : `${row.quantityValue} plates`;
  const tierLabel =
    row.packageTier === "CUSTOM"
      ? "Custom"
      : `${row.packageTier.charAt(0)}${row.packageTier.slice(1).toLowerCase()}`;
  const pill = statusPill(row.status);
  const phoneDisplay = formatPhoneE164(row.phone);
  const phoneE164 = `+91${row.phone.replace(/\D/g, "").slice(-10)}`;
  const createdAtLocal = row.createdAt.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <li className="rounded-2xl border border-gold-500/40 bg-cream-50 p-5 sm:p-6 shadow-warm">
      {/* Top row: name + status + meta */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="font-fraunces text-xl text-sindoor-700">{row.name}</p>
          <p className="mt-0.5 text-sm text-ink-600">
            <a
              href={`tel:${phoneE164}`}
              className="text-saffron-600 hover:text-sindoor-700 font-numerals tabular-nums"
            >
              {phoneDisplay}
            </a>
            {row.email ? (
              <>
                <span aria-hidden className="mx-2 text-gold-500/60">·</span>
                <a
                  href={`mailto:${row.email}`}
                  className="text-saffron-600 hover:text-sindoor-700"
                >
                  {row.email}
                </a>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-[0.65rem] font-mukta uppercase tracking-[0.22em] font-semibold ${pill.cls}`}
          >
            {pill.label}
          </span>
          <span className="text-[0.65rem] uppercase tracking-wider text-ink-600">
            {createdAtLocal} IST
          </span>
        </div>
      </div>

      {/* Details grid */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
        <div>
          <p className="text-[0.65rem] uppercase tracking-wider text-ink-600 font-mukta">
            Package
          </p>
          <p className="mt-0.5 text-ink-900 font-medium">{tierLabel}</p>
        </div>
        <div>
          <p className="text-[0.65rem] uppercase tracking-wider text-ink-600 font-mukta">
            Size
          </p>
          <p className="mt-0.5 text-ink-900 font-medium font-numerals tabular-nums">
            {qtyLabel}
          </p>
        </div>
        {row.area ? (
          <div>
            <p className="text-[0.65rem] uppercase tracking-wider text-ink-600 font-mukta">
              Area
            </p>
            <p className="mt-0.5 text-ink-900">{row.area}</p>
          </div>
        ) : null}
        {row.addressNotes ? (
          <div>
            <p className="text-[0.65rem] uppercase tracking-wider text-ink-600 font-mukta">
              Venue / landmark
            </p>
            <p className="mt-0.5 text-ink-900">{row.addressNotes}</p>
          </div>
        ) : null}
        {dates.length > 0 ? (
          <div className="sm:col-span-2">
            <p className="text-[0.65rem] uppercase tracking-wider text-ink-600 font-mukta">
              Dates {row.eventTime ? `· ${row.eventTime}` : ""}
            </p>
            <p className="mt-0.5 text-ink-900 font-numerals tabular-nums">
              {dates.map(formatDmy).join(" · ")}
            </p>
          </div>
        ) : row.eventTime ? (
          <div>
            <p className="text-[0.65rem] uppercase tracking-wider text-ink-600 font-mukta">
              Time
            </p>
            <p className="mt-0.5 text-ink-900 font-numerals tabular-nums">
              {row.eventTime}
            </p>
          </div>
        ) : null}
        {row.notes ? (
          <div className="sm:col-span-2">
            <p className="text-[0.65rem] uppercase tracking-wider text-ink-600 font-mukta">
              Notes from requester
            </p>
            <blockquote className="mt-1 rounded-xl border-l-2 border-saffron-500 bg-white px-3 py-2 text-ink-900 italic">
              {row.notes}
            </blockquote>
          </div>
        ) : null}
        {row.source ? (
          <div>
            <p className="text-[0.65rem] uppercase tracking-wider text-ink-600 font-mukta">
              Source
            </p>
            <p className="mt-0.5 text-ink-900 font-mono text-xs">{row.source}</p>
          </div>
        ) : null}
      </div>

      {/* Action buttons cluster, workflow varies by current status */}
      <div className="mt-5 pt-4 border-t border-gold-500/30 flex flex-wrap gap-2 items-center">
        {row.status === "NEW" || row.status === "REJECTED" ? (
          <form action={markOrganiseRequestContactedAction.bind(null, row.id)}>
            <SubmitButton variant="primary-green" pendingLabel="Marking…">
              📞 Mark contacted
            </SubmitButton>
          </form>
        ) : null}
        {row.status === "CONTACTED" ? (
          <form action={markOrganiseRequestConfirmedAction.bind(null, row.id)}>
            <SubmitButton variant="primary-green" pendingLabel="Saving…">
              ✓ Mark confirmed
            </SubmitButton>
          </form>
        ) : null}
        {row.status === "CONFIRMED" ? (
          <form action={markOrganiseRequestCompletedAction.bind(null, row.id)}>
            <SubmitButton variant="primary-green" pendingLabel="Saving…">
              🎉 Mark completed
            </SubmitButton>
          </form>
        ) : null}
        {row.status !== "REJECTED" && row.status !== "COMPLETED" ? (
          <form action={markOrganiseRequestRejectedAction.bind(null, row.id)}>
            <SubmitButton variant="outline-alert" pendingLabel="Saving…">
              ✗ Reject
            </SubmitButton>
          </form>
        ) : null}
        {row.status === "COMPLETED" || row.status === "REJECTED" ? (
          <form action={markOrganiseRequestNewAction.bind(null, row.id)}>
            <SubmitButton variant="outline-ink" pendingLabel="Saving…">
              ↩ Reopen as new
            </SubmitButton>
          </form>
        ) : null}
        <form
          action={deleteOrganiseRequestAction.bind(null, row.id)}
          className="ml-auto"
        >
          <SubmitButton
            variant="outline-alert"
            pendingLabel="Deleting…"
            confirm="Delete this request permanently? Use 'Reject' instead if you want to keep an audit trail."
          >
            🗑 Delete
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}
