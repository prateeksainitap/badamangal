// One-shot insert: bilingual WhatsApp welcome message for newly
// approved volunteers. Mirrors the live template that the
// approveAndIssueVolunteerCodeAction server action sends (see
// src/app/admin/actions.ts → buildVolunteerCodeWhatsappUrl).
//
// Why both? The action's hard-coded template guarantees a working
// flow even if the DB is unreachable. This Content row is the
// editable copy-paste reference — when you tweak the wording
// here, also update the action's literal so they stay in sync.
//
// Place it in /admin/content under Templates → Volunteer audience,
// WhatsApp channel, bilingual language.
//
// Idempotent: skipped if a row with the same `source` slug already
// exists.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SOURCE_SLUG = "volunteer-welcome-whatsapp.md";

const TITLE = "Volunteer welcome (auto-sent on approval)";

const SUMMARY =
  "The bilingual WhatsApp message that fires the moment you click 'Approve & send code on WhatsApp' on a Pending volunteer. Code + submit-link auto-merged from the DB row.";

const BODY = `# Volunteer welcome message — auto-generated on approval

This is the **WhatsApp message that gets sent automatically** the
moment you click \`✅ Approve & send code on WhatsApp\` on a
pending volunteer in \`/admin/volunteers\`.

You don't need to type or copy anything — the platform merges
\`{{name}}\` and \`{{code}}\` from the volunteer's row, then opens
\`wa.me/91<phone>?text=<merged-message>\` in a new tab. All you
do is tap Send in WhatsApp.

This Content Hub entry exists as your **editable reference**:
if you want to change the wording, update both this row and the
\`buildVolunteerCodeWhatsappUrl\` helper in
\`src/app/admin/actions.ts\` so they stay in sync.

## How it gets generated

When a volunteer signs up via \`/volunteer\`:
1. Their row lands in \`/admin/volunteers\` as \`PENDING\`
2. You click "Approve & send code on WhatsApp"
3. Server action \`approveAndIssueVolunteerCodeAction\`:
   - Generates a random unique code (\`BM-LKO-XXXXXX\`)
   - Flips status \`PENDING\` → \`PROBATIONARY\`
   - Returns the wa.me URL with the message pre-filled
4. New tab opens at \`web.whatsapp.com\` (or the WhatsApp app on mobile)
5. You tap Send

The flow is **idempotent** — clicking twice re-opens the same
wa.me link with the same code (no duplicate codes are issued).

## Placeholders

| Token | Replaced with | Source field |
|---|---|---|
| \`{{name}}\` | Volunteer's name | \`Volunteer.name\` |
| \`{{code}}\` | Their issued code | \`Volunteer.code\` |
| \`{{submitUrl}}\` | \`https://badamangal.com/volunteer/submit?code={{code}}\` | derived |

## The message body (bilingual)

> *जय बजरंगबली*
>
> नमस्कार **{{name}}** जी,
>
> BadaMangal volunteer programme में आपका स्वागत है। आपका आवेदन
> स्वीकृत हो गया है।
>
> **आपका volunteer code:**
> **{{code}}**
>
> **पहला भण्डारा submit करें:**
> {{submitUrl}}
>
> यह code save कर लीजिए। हर submission में इसकी ज़रूरत होगी।
>
> ==========
>
> Welcome to the BadaMangal volunteer programme. Your application
> is approved.
>
> **Your volunteer code:** **{{code}}**
> **Submit your first bhandara:** {{submitUrl}}
>
> Save this code. You will need it for every submission.
>
> धन्यवाद · Dhanyavaad
> BadaMangal Team

## Design choices baked into the copy

1. **Hindi first, English second.** Most Lucknow volunteers are
   Hinglish-comfortable; leading with Hindi reads as a respectful
   "I'm a fellow community member", not "translated by a tool".
2. **No em dashes.** Site-wide style rule. Uses commas + hyphens
   instead.
3. **No emojis in the message body.** WhatsApp Web's preview pane
   uses a font without emoji support and renders them as \`�\` —
   the delivered message would be fine, but the preview looks
   broken. We keep the body bulletproof across every WA client.
4. **Code displayed twice.** Once in the Hindi block, once in
   English. Volunteers screenshot one or the other; we cover both
   reading habits.
5. **Submit link is the only URL.** Every other action they need
   (lookup code, view dashboard, etc.) is reachable from there.
   One link = less cognitive load on first read.
6. **"Save this code" instruction in both languages.** Bahut zaroori
   — without the code, every future submission is a manual lookup
   for us.

## If you want to change the wording

Edit it in both places to keep them in sync:

1. **This Content row** (editable via the in-page editor)
2. **\`src/app/admin/actions.ts\`** → search for
   \`buildVolunteerCodeWhatsappUrl\` and update the \`message\`
   string literal

Future: we could refactor the action to read this row from the DB
at runtime so a single edit in Content Hub propagates. Not done
yet because (a) the action needs to stay fast on the approve
hot-path, (b) a hardcoded fallback is safer if the DB is slow.
For now, keep both in sync manually.

## Re-opening WhatsApp if the first send didn't go through

The "Re-open WhatsApp" button on the volunteer card stays
available after the first approval, re-using the same code +
wa.me URL. Idempotent: zero risk of issuing a second code by
mistake.

## Tracking + GA events

The button fires three GA events for analytics:

- \`admin_volunteer_approve_attempt\` (click registered)
- \`admin_volunteer_approve_success\` (code issued + wa.me opened)
- \`admin_volunteer_approve_error\` (server action rejected)

The \`already_issued\` flag on success distinguishes "fresh code
just minted" from "reused existing code" (re-open scenario).
`;

const TAGS = ["volunteer", "whatsapp", "onboarding", "auto-send", "template"];

async function main() {
  const existing = await prisma.content.findFirst({
    where: { source: SOURCE_SLUG },
    select: { id: true },
  });
  if (existing) {
    console.log(
      `[seed] volunteer-welcome template already exists (id=${existing.id}), skipping.`,
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
  console.log(`[seed] inserted: ${created.id} — ${created.title}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
