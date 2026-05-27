// One-shot insert: WhatsApp acknowledgment message for fresh
// volunteer signups (status=PENDING, before admin has approved +
// issued a code).
//
// Why this exists alongside the auto-approval welcome:
//   • The auto-welcome (volunteer-welcome-whatsapp.md) fires when
//     admin clicks "Approve & send code on WhatsApp". That can be
//     hours or days after the signup form is submitted.
//   • In the meantime the signup just sees "Thanks, you'll hear
//     from us soon" on /volunteer and hears nothing on WhatsApp.
//     They wonder if it even registered.
//   • This template is the bridge: admin manually fires it the
//     moment a PENDING signup lands, so the volunteer feels seen
//     immediately + knows what to expect next.
//
// Manual send (not auto):
//   1. Open /admin/volunteers
//   2. See a new PENDING row
//   3. Copy this template body, paste their name in, open
//      wa.me/91<phone>?text=<encoded>, hit Send
//   4. Later (when verified), click "Approve & send code on
//      WhatsApp" to fire the AUTO welcome with their code
//
// Idempotent: skipped if a row with the same `source` slug
// already exists.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SOURCE_SLUG = "volunteer-signup-ack-whatsapp.md";

const TITLE = "Volunteer signup acknowledgment (manual, pre-approval)";

const SUMMARY =
  "Bridge message to send the moment a volunteer signs up, before you've had time to verify + issue a code. Sets expectation that the code is coming within 24-48 hours and asks one short question so the operator can place them on the right team.";

const BODY = `# Volunteer signup acknowledgment

**When to send:** the moment a new volunteer signs up via
\`/volunteer\` and appears in \`/admin/volunteers\` as
\`PENDING\`. Before you've had time to verify the phone number
and issue a code (which the auto-welcome template handles
separately).

**Why:** WhatsApp is the trust channel. If a signup hits the form
and hears nothing for 24+ hours, they assume the platform is
broken. This message is the bridge that says "we saw you, we're
on it, here's what's next".

**Send method:** copy this body, paste their name where indicated,
open WhatsApp Web / app, fire the message. Takes 30 seconds per
signup. The full auto-welcome (with their issued code) fires
later when you click "Approve & send code on WhatsApp".

---

## Copy-paste body (bilingual, Hindi first)

> *जय बजरंगबली*
>
> नमस्कार **[NAME]** जी,
>
> BadaMangal volunteer programme में आवेदन के लिए धन्यवाद।
> हमें आपका साइनअप मिल गया है।
>
> आगे क्या होगा:
> • अगले 24-48 घंटों में हम आपका WhatsApp number verify करेंगे
> • Verification के बाद आपको एक volunteer code भेजा जाएगा
> • उस code से आप हर मंगलवार के भण्डारे submit कर सकेंगे
>
> एक छोटा सवाल (आपको किस team में रखें, इसमें मदद होगी):
> लखनऊ का कौन सा इलाका आप सबसे अच्छे से जानते हैं?
>
> ==========
>
> Thanks for signing up to volunteer with BadaMangal. Your
> application is in our queue.
>
> What happens next:
> - We'll verify your WhatsApp number within 24-48 hours
> - After verification, you'll receive your volunteer code
> - With that code, you can submit bhandaras every Tuesday
>
> A small question (helps us put you on the right team):
> which part of Lucknow do you know best?
>
> Looking forward to having you,
> Prateek
> BadaMangal Team

## Tokens to fill in

| Token | What to replace it with |
|---|---|
| \`[NAME]\` | Volunteer's first name (from \`Volunteer.name\`) |

That's the only manual edit. Everything else is fixed copy.

## Design choices baked in

1. **Sets a clear timeline (24-48h)** so the volunteer doesn't
   refresh /volunteer wondering what happened. If verification
   takes longer, you can fire a one-line "still working on it"
   follow-up; the platform-side promise is honored either way.
2. **Lists what happens next as bullets** (not a wall of text)
   so it's scannable on a phone, the only place this gets read.
3. **Asks one small question** ("which part of Lucknow do you
   know best?"), three benefits:
   - Confirms the WhatsApp number is real + reachable (if they
     reply, you have a live person)
   - Gives them an immediate action while waiting for approval
   - Surfaces local-area knowledge that helps you assign them
     to a Tuesday team
4. **No em dashes** (site-wide style rule).
5. **No emojis in body**: WhatsApp Web's preview pane renders
   them as \`�\` on certain clients.
6. **Hindi first, English second**: matches the welcome
   template's posture; respects the audience.
7. **Signed as "Prateek" + first-person**: per the
   user_profile.md voice rule.

## Wiring it into the admin flow (optional follow-up)

This template is currently a copy-paste reference. If you want a
one-click "Send acknowledgment" button on the PENDING volunteer
card (parallel to the existing "Approve & send code on
WhatsApp"), the work is:

1. New server action \`sendSignupAckAction(id)\` that:
   - Builds a wa.me URL with name + this template merged
   - Returns the URL (does NOT change the volunteer's status)
2. New \`SendAckButton\` client component on the volunteer row
3. ~30 minutes of work; ask whenever you want it.
`;

const TAGS = [
  "volunteer",
  "whatsapp",
  "onboarding",
  "pending",
  "acknowledgment",
  "template",
];

async function main() {
  const existing = await prisma.content.findFirst({
    where: { source: SOURCE_SLUG },
    select: { id: true },
  });
  if (existing) {
    console.log(
      `[seed] signup-ack template already exists (id=${existing.id}), skipping.`,
    );
    await prisma.$disconnect();
    return;
  }
  const created = await prisma.content.create({
    data: {
      kind: "TEMPLATE",
      audience: "VOLUNTEER",
      channel: "WHATSAPP",
      language: "bilingual",
      title: TITLE,
      summary: SUMMARY,
      body: BODY,
      tags: TAGS,
      source: SOURCE_SLUG,
      lastEditor: "Prateek",
      status: "ACTIVE",
    },
    select: { id: true, title: true },
  });
  console.log(`[seed] inserted: ${created.id}, ${created.title}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
