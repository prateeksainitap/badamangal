// One-shot insert: outbound "reachout" WhatsApp template for
// volunteers who have already signed up.
//
// This is the THIRD volunteer template in the Content Hub:
//   1. seed-volunteer-signup-ack-template.mjs
//      Manual bridge, fires the moment a signup lands as PENDING.
//   2. seed-volunteer-welcome-template.mjs
//      Auto-fires when admin approves + issues a code.
//   3. seed-volunteer-reachout-template.mjs (this file)
//      Manual proactive outreach. Three flavours covered by one
//      template, with a {{REASON}} switch:
//        a. PRE_TUESDAY: nudge active volunteer the Sunday/Monday
//           before a Bada Mangal Tuesday
//        b. DORMANT: re-engage a volunteer who has not submitted
//           for 4+ weeks during season
//        c. SEASON_KICKOFF: warm up everyone two weeks before a
//           Bada Mangal season starts
//
// Send method: copy this body, fill name + reason block, open the
// wa.me link from /admin/volunteers, send. Could be wired into a
// "Send reachout" button later (parallel to existing Approve +
// Send code).
//
// Idempotent: skipped if a row with the same `source` slug
// already exists.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SOURCE_SLUG = "volunteer-reachout-whatsapp.md";

const TITLE = "Volunteer reachout (manual, post-approval outreach)";

const SUMMARY =
  "Outbound WhatsApp template to reach out to an already-signed-up volunteer. Three variants in one template: pre-Tuesday nudge, dormant re-engagement, and season kickoff. Keep it warm, short, and ask one clear question so they have a reason to reply.";

const BODY = `# Volunteer reachout

**When to send:** when an existing volunteer needs a warm proactive
ping. Three common cases:

1. **Pre-Tuesday** (Sunday/Monday before a Bada Mangal Tuesday).
   "Tomorrow is BM, here is your plan."
2. **Dormant re-engagement** (no submission for 4 consecutive
   Tuesdays during season). "We miss seeing your submissions, all
   ok?"
3. **Season kickoff** (two weeks before the first Tuesday of a new
   Bada Mangal season). "Season starts soon, are you in?"

**Why one template covers all three:** the warm opener + closing
question is identical. The middle paragraph swaps based on which
case you are sending. That swap is one line of copy, not a whole
rewrite.

**Send method:** copy body, fill the two tokens (\`[NAME]\` and
\`[REASON_BLOCK]\`), open wa.me/91<phone>?text=<encoded>, hit Send.
30 seconds per recipient. The auto-welcome template already covers
the "code arrival" moment; this template is the moments after.

---

## Copy-paste body, bilingual, Hindi first

> *जय बजरंगबली*
>
> नमस्कार **[NAME]** जी,
>
> आशा है आप स्वस्थ हैं। BadaMangal की ओर से एक छोटा सा संदेश है।
>
> **[REASON_BLOCK]**
>
> एक छोटी सी जानकारी चाहिए: इस मंगलवार आप किसी भण्डारे पर जा पाएँगे
> या नहीं? हाँ या नहीं, बस एक शब्द में जवाब दे दीजिए, हम उसी के
> अनुसार आगे की योजना बना लेंगे।
>
> सेवा के लिए धन्यवाद,
> Prateek
> BadaMangal · Lucknow
>
> ==========
>
> Hello **[NAME]**, hope you are doing well. A quick note from
> BadaMangal.
>
> **[REASON_BLOCK_EN]**
>
> One small ask: will you be able to visit a bhandara this Tuesday?
> Just a yes or no in reply is enough, that lets me plan the
> Tuesday team around your availability.
>
> Thanks for the seva,
> Prateek
> BadaMangal · Lucknow

## Tokens to fill in

| Token | Where the value comes from |
|---|---|
| \`[NAME]\` | Volunteer first name from \`Volunteer.name\` |
| \`[REASON_BLOCK]\` | One of the three variants below, Hindi |
| \`[REASON_BLOCK_EN]\` | Matching English variant below |

## Reason variants

Pick one block based on which of the three cases applies. Drop it
into the placeholder above, no editing needed.

### Variant A: pre-Tuesday nudge

> इस मंगलवार बड़ा मंगल है। पिछले हफ़्ते की तरह इस बार भी अगर आप
> अपने इलाके के दो-तीन भण्डारों की तस्वीरें भेज दें तो हमें
> directory भरने में बहुत मदद मिलेगी।

> This Tuesday is a Bada Mangal day. Like last week, even two
> or three bhandara photos from your area would help us close
> the day's directory.

### Variant B: dormant re-engagement

> कुछ हफ़्तों से आपकी ओर से submission नहीं मिल रही। सब ठीक तो है?
> अगर कोई काम है या programme में कुछ बदलना है, बता दीजिए, हम
> मदद करेंगे।

> We have not seen submissions from you in a few weeks. All
> well? If something has come up or you want to pause for a
> bit, let me know, that is completely fine.

### Variant C: season kickoff

> Bada Mangal season दो हफ़्तों में शुरू हो रहा है। आपका volunteer
> code अब भी active है, बस confirm कर लीजिए कि इस बार भी आप साथ
> होंगे।

> The next Bada Mangal season starts in two weeks. Your
> volunteer code is still active, just wanted to confirm you
> are in for this run.

## Design choices baked in

1. **Asks one clear yes/no question** ("can you go this Tuesday?")
   so there is a reason to reply, and so a one-word reply is enough.
2. **Does not push for a long story** about why they have been
   quiet. Dormant volunteers feel awkward enough; the template
   gives them an out ("if you want to pause, that is fine").
3. **Three variants in one template** means the admin does not
   maintain three different templates. Less drift, less confusion.
4. **Bilingual, Hindi first** matches the welcome + ack templates'
   posture and respects the audience.
5. **Signed as "Prateek"** plus a first-person verb, per the
   site-wide voice rule.
6. **No emojis in the body**, WhatsApp Web's preview pane renders
   them as broken glyphs on certain clients.
7. **No em dashes**, per the platform writing-style rule.

## Wiring into the admin flow (optional follow-up)

This template is currently a copy-paste reference like the other
two. If you want a one-click "Send reachout" dropdown on the
volunteer row (variant selector + send), the work is:

1. New server action \`sendReachoutAction(id, variant)\` that:
   - Builds a wa.me URL with name + variant body merged
   - Returns the URL, does NOT change the volunteer's status
2. New \`SendReachoutMenu\` client component on the volunteer row,
   with a 3-item dropdown for the three variants
3. ~45 minutes of work. Ask whenever you want it.

## Cadence guidance

- **Pre-Tuesday nudge:** send Sunday evening or Monday morning,
  not Tuesday itself. Tuesday morning push belongs to the
  auto-fired weekly plan template.
- **Dormant re-engagement:** send once per dormant volunteer per
  season. Do not double-tap, that becomes spam.
- **Season kickoff:** send two weeks out so they have time to
  block their Tuesday calendar.
`;

const TAGS = [
  "volunteer",
  "whatsapp",
  "reachout",
  "reengagement",
  "outreach",
  "template",
];

async function main() {
  const existing = await prisma.content.findFirst({
    where: { source: SOURCE_SLUG },
    select: { id: true },
  });
  if (existing) {
    console.log(
      `[seed] reachout template already exists (id=${existing.id}), skipping.`,
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
