import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ipHash, readClientIp } from "@/lib/crypto";
import { sendContactEmail } from "@/lib/email";

/**
 * Public contact-form endpoint. Accepts name + email + message (+ optional
 * phone/subject), saves a `ContactMessage` row, and rate-limits per-IP so
 * one bored person can't fill the inbox in a loop.
 *
 * Honeypot: the form ships a hidden `website` field. Real users leave it
 * blank; bots tend to fill every input. If it's non-empty we silently
 * accept (200) without persisting, denies the bot useful feedback.
 */

const MAX_MESSAGES_PER_HOUR = 5;

function isEmail(s: string): boolean {
  // Permissive but rejects the obvious garbage.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const message = String(body.message ?? "").trim();
  const honeypot = String(body.website ?? "").trim();
  const attachmentUrl = String(body.attachmentUrl ?? "").trim();
  const attachmentName = String(body.attachmentName ?? "").trim();
  const attachmentTypeRaw = String(body.attachmentType ?? "").trim();
  const attachmentType =
    attachmentTypeRaw === "pdf" || attachmentTypeRaw === "image"
      ? attachmentTypeRaw
      : null;

  // Honeypot REMOVED as a silent-drop gate. Browser autofill / password
  // managers were filling the hidden `website` field on legit users,
  // causing their messages to silently 200 without saving (form showed
  // success, inbox stayed empty). Same fix as /api/organise-request.
  // We still log trips for visibility, but no longer block on them.
  if (honeypot.length > 0) {
    console.warn(
      "[contact] honeypot filled (likely browser autofill, not bot):",
      { honeypotLen: honeypot.length, name: name.slice(0, 40) },
    );
  }

  // Field validation, returned as a flat map so the UI can highlight
  // individual inputs.
  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = "Please enter your name.";
  if (name.length > 80) errors.name = "Name is too long.";
  // Phone is now mandatory (callbacks are how we actually reach
  // organisers within a day); email is optional and only validated
  // when provided. Mirrors the client-side `required` swap in
  // ContactForm.tsx.
  if (phone.length < 6) errors.phone = "Please enter a phone number we can reach you on.";
  if (phone.length > 20) errors.phone = "Phone is too long.";
  if (email && !isEmail(email)) errors.email = "Please enter a valid email.";
  if (email.length > 120) errors.email = "Email is too long.";
  if (subject.length > 120) errors.subject = "Subject is too long.";
  if (message.length < 10)
    errors.message = "Tell us a little more (10+ characters).";
  if (message.length > 4000)
    errors.message = "Message is too long (max 4000 characters).";

  // Light sanity-check on attachment URL: must be absolute http(s) or
  // a relative `/uploads/...` path written by our own dev fallback.
  if (
    attachmentUrl &&
    !/^https?:\/\//.test(attachmentUrl) &&
    !attachmentUrl.startsWith("/uploads/")
  ) {
    errors.attachment = "Invalid attachment.";
  }
  if (attachmentName.length > 200) {
    errors.attachment = "Attachment filename is too long.";
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "validation", fields: errors }, { status: 400 });
  }

  const ip = ipHash(readClientIp(req.headers));

  // Rate-limit per-IP, last 60 min.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.contactMessage.count({
    where: { ipHash: ip, createdAt: { gte: oneHourAgo } },
  });
  if (recent >= MAX_MESSAGES_PER_HOUR) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many messages. Try again later." },
      { status: 429 },
    );
  }

  const ua = req.headers.get("user-agent")?.slice(0, 240) ?? null;

  const saved = await prisma.contactMessage.create({
    data: {
      name,
      email,
      phone: phone || null,
      subject: subject || null,
      message,
      attachmentUrl: attachmentUrl || null,
      attachmentName: attachmentName || null,
      attachmentType,
      ipHash: ip,
      userAgent: ua,
    },
  });

  // Fire-and-forget email forwarding to the team inbox via Resend.
  // We `await` here only because Netlify Functions terminate the
  // process the moment we return, a dangling promise would be
  // cancelled mid-flight. The send itself is fast (~150ms) and the
  // helper swallows its own errors, so a misconfigured / down email
  // service can never block the contact form HTTP response.
  //
  // Phone is now the mandatory channel; email is optional. When the
  // submitter doesn't provide an email, we still persist the row (and
  // the admin sees it in the inbox query), but we skip the email
  // forwarding because the helper uses the sender's email as reply-to
  //, without it there's nowhere meaningful for the team's reply to
  // land. The team's standard path for those messages is a phone
  // callback instead.
  if (email) {
    await sendContactEmail({
      name,
      email,
      phone: phone || undefined,
      subject: subject || undefined,
      message,
      attachmentUrl: attachmentUrl || undefined,
      attachmentName: attachmentName || undefined,
      attachmentType,
      contactMessageId: saved.id,
      ipHash: ip,
    });
  }

  return NextResponse.json({ ok: true });
}
