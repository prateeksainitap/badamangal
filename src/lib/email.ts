/**
 * Server-side email dispatch via Resend.
 *
 * Currently the only email we send is the contact-form forwarding
 * notification, visitors fill out /contact and we mirror their
 * message into the team inbox in addition to persisting it in the
 * ContactMessage table.
 *
 * Configured via env vars:
 *   RESEND_API_KEY      , from https://resend.com → API Keys
 *   CONTACT_EMAIL_TO    , comma-separated list of receivers
 *                          (e.g. "namaste@badamangal.com,prateek@…")
 *   CONTACT_EMAIL_FROM  , verified sender, defaults to
 *                          "BadaMangal <namaste@badamangal.com>".
 *                          The domain MUST be verified in Resend
 *                          (DNS records take ~10 min) before sends
 *                          succeed; until then sends 4xx silently.
 *
 * If RESEND_API_KEY isn't set, every send is a clean no-op, the
 * site still works, ContactMessage rows still save to Prisma, the
 * team just doesn't get the immediate notification. This makes
 * local dev painless: no email setup required.
 */
import { Resend } from "resend";

/** Cap Resend round-trip at 5s. The contact-form / organise-request
 *  POST already persisted the row to the DB BEFORE we send the
 *  email, so failing fast on a slow Resend doesn't lose any data;
 *  it just means the team has to triage from /admin rather than
 *  from the inbox notification. A hung email-send would otherwise
 *  burn the full Vercel function timeout (10s default, 60s max)
 *  and leave the visitor staring at a spinner. */
const RESEND_TIMEOUT_MS = 5000;

async function sendWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

let cached: Resend | null | undefined;

function client(): Resend | null {
  if (cached !== undefined) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    cached = null;
    return null;
  }
  cached = new Resend(key);
  return cached;
}

export type ContactEmailInput = {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: "pdf" | "image" | null;
  /** Used in the email subject line + body for traceability. */
  contactMessageId: string;
  /** IP hash for spam audits if needed; never shown in the email body. */
  ipHash: string;
};

const DEFAULT_FROM = "BadaMangal <namaste@badamangal.com>";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Forward a contact-form submission to the configured inbox.
 * Silently no-ops if Resend isn't configured. Errors are logged
 * server-side but never thrown, a failed email must not block the
 * contact-form HTTP response.
 */
export async function sendContactEmail(
  input: ContactEmailInput,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const resend = client();
  if (!resend) {
    return { ok: false, skipped: true };
  }

  const to = (process.env.CONTACT_EMAIL_TO ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (to.length === 0) {
    console.warn("[email] RESEND_API_KEY set but CONTACT_EMAIL_TO is empty");
    return { ok: false, skipped: true };
  }

  const from = process.env.CONTACT_EMAIL_FROM || DEFAULT_FROM;

  const subject = `Contact form: ${
    input.subject?.trim() || "no subject"
  }, ${input.name}`;

  // Plain-text version for clients that strip HTML.
  const text = [
    `From: ${input.name} <${input.email}>`,
    input.phone ? `Phone: ${input.phone}` : null,
    input.subject ? `Subject: ${input.subject}` : null,
    "",
    "Message:",
    input.message,
    "",
    input.attachmentUrl
      ? `Attachment (${input.attachmentType ?? "file"}): ${input.attachmentUrl}`
      : null,
    "",
    "-",
    `Message ID: ${input.contactMessageId}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Lightweight HTML, Resend renders just fine without tables/CSS.
  // Quoted message uses a left-border block to feel email-native.
  const attachmentLine = input.attachmentUrl
    ? `<p style="margin:16px 0 0;font-size:13px;color:#666"><strong>Attachment (${escapeHtml(
        input.attachmentType ?? "file",
      )}):</strong> <a href="${escapeHtml(
        input.attachmentUrl,
      )}">${escapeHtml(input.attachmentName || input.attachmentUrl)}</a></p>`
    : "";
  const html = `
<div style="font-family:-apple-system,Segoe UI,sans-serif;color:#1a1410;max-width:560px">
  <p style="margin:0 0 6px;font-size:13px;color:#9c2a2a;text-transform:uppercase;letter-spacing:0.12em">New contact-form message</p>
  <h2 style="margin:0 0 16px;font-size:20px">${escapeHtml(input.name)} &lt;${escapeHtml(input.email)}&gt;</h2>
  ${
    input.phone
      ? `<p style="margin:0 0 4px"><strong>Phone:</strong> ${escapeHtml(input.phone)}</p>`
      : ""
  }
  ${
    input.subject
      ? `<p style="margin:0 0 4px"><strong>Subject:</strong> ${escapeHtml(input.subject)}</p>`
      : ""
  }
  <blockquote style="margin:14px 0 0;padding:10px 14px;border-left:3px solid #e07a1f;background:#fffaf3;white-space:pre-wrap">${escapeHtml(
    input.message,
  )}</blockquote>
  ${attachmentLine}
  <hr style="border:none;border-top:1px solid #e8d9b8;margin:24px 0 12px" />
  <p style="margin:0;font-size:11px;color:#888">Message ID: <code>${escapeHtml(
    input.contactMessageId,
  )}</code> · Reply directly to this email to respond to the sender.</p>
</div>`;

  try {
    const { error } = await sendWithTimeout(
      resend.emails.send({
        from,
        to,
        // Magic: replyTo on the sender's email means hitting Reply
        // in the inbox goes straight to the visitor, not back to
        // our own sender address. Removes one annoying step from
        // triage.
        replyTo: input.email,
        subject,
        text,
        html,
      }),
      RESEND_TIMEOUT_MS,
      "Resend (contact)",
    );
    if (error) {
      console.error("[email] resend send failed", error);
      return { ok: false, error: String(error.message ?? error) };
    }
    return { ok: true };
  } catch (err) {
    console.error("[email] unexpected send error", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Organise-Bhandara lead-capture notification ─────────────────────────
//
// Sister to sendContactEmail, fires when someone submits the request
// form on /organise-bhandara. Same Resend client, same CONTACT_EMAIL_TO
// inbox; the email subject + body shape are tuned to a service-quote
// inquiry rather than a generic message so the triage queue can
// distinguish them at a glance.
//
// replyTo flips to the requester's email when provided so hitting
// Reply lands in their inbox; when only phone is given (the common
// case), the team's standard reply path is a callback.

export type OrganiseRequestEmailInput = {
  name: string;
  phone: string;
  email?: string;
  area?: string;
  addressNotes?: string;
  /** Array of YYYY-MM-DD ISO dates. Empty array → "Date TBD" in the
   *  body. Multi-date because organisers commonly want to run the
   *  same bhandara on every Tuesday of the season. */
  eventDates: string[];
  eventTime?: string;
  /** "PLATES" | "WHEAT_KG" */
  quantityType: string;
  quantityValue: number;
  /** "SMALL" | "MEDIUM" | "LARGE" | "CUSTOM" */
  packageTier: string;
  notes?: string;
  source?: string;
  /** OrganiseRequest row ID for traceability in the body footer. */
  requestId: string;
  ipHash: string;
};

export async function sendOrganiseRequestEmail(
  input: OrganiseRequestEmailInput,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const resend = client();
  if (!resend) return { ok: false, skipped: true };

  const to = (process.env.CONTACT_EMAIL_TO ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (to.length === 0) {
    console.warn(
      "[email] RESEND_API_KEY set but CONTACT_EMAIL_TO empty (organise request)",
    );
    return { ok: false, skipped: true };
  }

  const from = process.env.CONTACT_EMAIL_FROM || DEFAULT_FROM;

  // Quantity prettified: "500 plates" or "200 kg wheat".
  const qtyLabel =
    input.quantityType === "WHEAT_KG"
      ? `${input.quantityValue} kg wheat`
      : `${input.quantityValue} plates`;
  const tierLabel =
    input.packageTier === "CUSTOM"
      ? "Custom request"
      : `${input.packageTier.charAt(0)}${input.packageTier.slice(1).toLowerCase()} package`;
  // Pretty-print the dates. Single date renders inline ("19 May 2026
  // · 11:00"); 2-3 dates list inline ("19 May, 26 May, 02 Jun ·
  // 11:00"); 4+ dates collapse to "N dates · …" with the full list
  // surfaced in the body via the "Dates:" row below. Time appends
  // only when given; "Date TBD" when nothing's picked yet.
  const formatDmy = (iso: string): string => {
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${String(d).padStart(2, "0")} ${months[m - 1]} ${y}`;
  };
  const dateList = input.eventDates.map(formatDmy);
  let dateLabel: string;
  if (input.eventDates.length === 0) dateLabel = "Date TBD";
  else if (input.eventDates.length <= 3) dateLabel = dateList.join(", ");
  else dateLabel = `${input.eventDates.length} dates`;
  const eventWhen = input.eventTime ? `${dateLabel} · ${input.eventTime}` : dateLabel;

  const subject = `Organise-bhandara request: ${input.name}, ${qtyLabel} (${tierLabel})`;

  const text = [
    `New /organise-bhandara request, ${tierLabel}`,
    "",
    `From: ${input.name}`,
    `Phone: ${input.phone}`,
    input.email ? `Email: ${input.email}` : null,
    "",
    `When: ${eventWhen}`,
    // Surface the full date list when there are 4+ dates (the header
    // collapsed to "N dates"); for 1-3 they're already inline above.
    input.eventDates.length >= 4
      ? `Dates: ${dateList.join(", ")}`
      : null,
    input.area ? `Area: ${input.area}` : null,
    input.addressNotes ? `Address / venue: ${input.addressNotes}` : null,
    `Size: ${qtyLabel}`,
    input.notes ? `Notes: ${input.notes}` : null,
    input.source ? `Source: ${input.source}` : null,
    "",
    "-",
    `Request ID: ${input.requestId}`,
  ]
    .filter(Boolean)
    .join("\n");

  const row = (label: string, value: string): string =>
    `<p style="margin:0 0 4px"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
  const html = `
<div style="font-family:-apple-system,Segoe UI,sans-serif;color:#1a1410;max-width:560px">
  <p style="margin:0 0 6px;font-size:13px;color:#9c2a2a;text-transform:uppercase;letter-spacing:0.12em">New organise-bhandara request · ${escapeHtml(tierLabel)}</p>
  <h2 style="margin:0 0 16px;font-size:20px">${escapeHtml(input.name)} · ${escapeHtml(input.phone)}</h2>
  ${input.email ? row("Email", input.email) : ""}
  ${row("When", eventWhen)}
  ${input.eventDates.length >= 4 ? row("Dates", dateList.join(", ")) : ""}
  ${input.area ? row("Area", input.area) : ""}
  ${input.addressNotes ? row("Address / venue", input.addressNotes) : ""}
  ${row("Size", qtyLabel)}
  ${
    input.notes
      ? `<p style="margin:14px 0 0"><strong>Notes:</strong></p><blockquote style="margin:6px 0 0;padding:10px 14px;border-left:3px solid #C9A24A;background:#fffaf3;white-space:pre-wrap">${escapeHtml(
          input.notes,
        )}</blockquote>`
      : ""
  }
  <hr style="border:none;border-top:1px solid #e8d9b8;margin:24px 0 12px" />
  <p style="margin:0;font-size:11px;color:#888">Request ID: <code>${escapeHtml(input.requestId)}</code>${
    input.source ? ` · Source: ${escapeHtml(input.source)}` : ""
  } · Reply hits the requester if they gave an email; otherwise call ${escapeHtml(input.phone)}.</p>
</div>`;

  try {
    const { error } = await sendWithTimeout(
      resend.emails.send({
        from,
        to,
        replyTo: input.email || undefined,
        subject,
        text,
        html,
      }),
      RESEND_TIMEOUT_MS,
      "Resend (organise)",
    );
    if (error) {
      console.error("[email] organise-request send failed", error);
      return { ok: false, error: String(error.message ?? error) };
    }
    return { ok: true };
  } catch (err) {
    console.error("[email] unexpected organise-request send error", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
