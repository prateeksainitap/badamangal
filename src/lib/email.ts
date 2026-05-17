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
    const { error } = await resend.emails.send({
      from,
      to,
      // Magic: replyTo on the sender's email means hitting Reply in
      // the inbox goes straight to the visitor, not back to our own
      // sender address. Removes one annoying step from triage.
      replyTo: input.email,
      subject,
      text,
      html,
    });
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
