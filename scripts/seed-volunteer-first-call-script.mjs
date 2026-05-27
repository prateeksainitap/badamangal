// One-shot insert: phone-call questionnaire / cheat sheet for
// onboarding a volunteer on the first WhatsApp or phone call.
//
// Internal operator playbook (not sent to anyone). Lives in the
// Content Hub Strategy tab so Prateek can pull it up on a phone
// while talking to a fresh signup.
//
// Idempotent: skipped if a row with the same `source` slug
// already exists.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SOURCE_SLUG = "volunteer-first-call-script.md";

const TITLE = "Volunteer first-call script (operator playbook)";

const SUMMARY =
  "Phone-call cheat sheet for onboarding a fresh /volunteer signup. Six sections, bilingual question phrasings, red-flag watchlist, and where each answer slots into the Volunteer record afterwards. Pull up on a phone while talking; ~10-12 minute call.";

const BODY = `# Volunteer first-call script

Internal operator playbook for the call you make after a fresh
\`/volunteer\` signup hits \`/admin/volunteers\` as PENDING. Pull
this up on your phone while talking. Target call length: 10-12
minutes.

## Goals of this call

1. **Verify the person is real** (signup wasn't a typo, prank,
   or competitor scraping)
2. **Match capability to role** (don't assign moderator work to
   someone who only wants field photography)
3. **Capture operational data** (photo for ID card, postal
   address for ID delivery, government ID for trust + payout)
4. **Set expectations** (honorarium structure, code system,
   Tuesday plan cadence)
5. **Build relationship** (warm, mutual respect, sense of seva)

If any of #1-#3 fails, do NOT click "Approve & send code" in
admin. Mark them SUSPENDED if it's a clear no-fit, or leave them
PENDING with a note if you need a second call.

---

## Section 1 · Opening pleasantries (~30 sec)

> *नमस्कार [NAME] जी, मैं प्रतीक बोल रहा हूँ, badamangal.com से।*
> *आपने हमारे साथ volunteer के लिए साइनअप किया था, उसी पर 2 मिनट*
> *बात कर सकते हैं?*
>
> (Namaste [Name] ji, this is Prateek from badamangal.com. You
> signed up to volunteer with us, do you have 2 minutes to talk
> about that?)

Read the energy in the first 5 seconds. If they sound confused
("kaun?", "kahan signup?") → either the number was mis-typed at
signup, or the signup is fake. Pause, verify name, decide.

If they sound warm + engaged → proceed.

---

## Section 2 · Verification (~2 min)

Just confirms the basics. Should feel like small-talk, not an
interrogation.

| What to confirm | Suggested phrasing |
|---|---|
| Name spelling | "आपका पूरा नाम कैसे लिखूँ हम records में? / How should I spell your name on records?" |
| Live in Lucknow | "अभी आप लखनऊ में रहते हैं? कितने साल से? / Are you currently in Lucknow? How long?" |
| How they heard about us | "Bada Mangal के बारे में कैसे पता चला आपको? / How did you hear about Bada Mangal?" |

**Red flags:**
- They've been in Lucknow less than 6 months → may not know areas well enough to spot
- "Friend sent me the link, I don't know what this is" → educate first, then re-decide
- Tone is transactional ("how much will I get paid?") in the first 30 seconds → handle expectations carefully, see Section 6

---

## Section 3 · Capability & services (~3 min)

The open-ended one. Let them talk; you take notes.

> *Bada Mangal के दौरान आप क्या-क्या कर सकते हैं हमारे लिए?*
> *कौन से काम में आपका मन है?*
>
> (What can you do for us during Bada Mangal? What kind of work
> are you drawn to?)

**Common roles + how to recognize a fit:**

| Role | What they say that signals fit | Time commitment |
|---|---|---|
| **Field volunteer** (spotter) | "मैं इलाके में घूम सकता हूँ", "I can walk around taking photos", "mere paas scooter hai" | 3-4 hours, mostly Tuesday morning |
| **Phone seva** (organizer verification) | "मुझे लोगों से बात करना अच्छा लगता है", "I'm comfortable calling strangers" | 2-3 hours, can be off-Tuesday |
| **Moderator** (chat cleanup) | "मैं typing fast कर सकता हूँ", "I'm on WhatsApp all day anyway" | 1-2 hours daily, Tue + Sat heaviest |
| **Photographer** (dedicated camera) | "मेरे पास DSLR है", "photography mera shauk hai" | 3-5 hours Tuesday, premium output |
| **Content writer** (Hindi/Eng captions, social) | "मैं Hindi में achchi tarah likh sakta hoon", "I run a Insta page", "I write blogs" | 2-3 hours/week off-season |
| **Tech contributor** | "I code", "main developer hoon", "I can help with the website" | Variable, project-based |
| **Translator** | "Hindi-English दोनों में comfortable हूँ" | 1-2 hours/week |
| **Driver / mobile spotter** | "Activa hai mere paas", "I have a car" | 4-6 hours Tuesday, covers wide area |

**Capture in notes:**
- 1 primary role
- 0-2 secondary roles
- A short quote in their own words ("loves walking the old city")

**Probing follow-ups:**
- "क्या आप किसी और NGO में volunteer कर चुके हैं?" (Past volunteering experience?)
- "Smartphone पर camera + maps comfortable use कर लेते हैं?" (Tech comfort check)
- "Hindi typing आती है?" (Critical for chat moderator role)

---

## Section 4 · Geography & availability (~2 min)

Most signups will give you ONE area on the form. Probe to see if
they actually know multiple, or if they checked boxes hopefully.

| Question | Why it matters |
|---|---|
| "इन areas में से कौन-सा आप सबसे अच्छे से जानते हैं?" | Pick a PRIMARY area for assignment |
| "अगर हम आपको पास के दूसरे area में भेजें (e.g., Aliganj instead of Indira Nagar) तो problem है?" | Flexibility check; useful when one area is over-staffed |
| "कैसे travel करते हैं — पैदल, scooter, गाड़ी?" | Determines coverage radius |
| "8 बड़े मंगल में से कितने पर आ सकते हैं?" | Commitment depth; one-off helpers OK but flag separately |
| "Bada Mangal के दिन subah, dopahar, ya shaam — best time?" | Morning (8-11am) is peak; afternoon (12-3) is secondary |
| "Bada Shanivar पर भी active रहेंगे?" | Optional extension |

**Capture:** 1 primary area, 2-3 secondary areas, transport mode,
Tuesdays committed (write as range, "5-8 of 8"), time-of-day
preference.

---

## Section 5 · Operational data for ID card (~2 min)

The "logistical" part. Keep it brisk.

| Ask | Why | Where it goes |
|---|---|---|
| WhatsApp number confirmation (read back the digits on file) | If wrong, the auto-welcome with code never lands | \`Volunteer.phone\` (already captured at signup, just verify) |
| Permanent postal address for ID card delivery | We mail laminated ID cards by Speed Post | Notes column (not yet a DB field) |
| Photo for ID card | Front-facing, clean background, smiling. They WhatsApp it after the call. | Save to local folder + R2 \`/volunteer-ids/\` for archive |
| Aadhaar last-4 digits OR voter ID last-4 | Trust signal; matched against UPI account name at first payout | Notes (do NOT store full Aadhaar/voter ID; last-4 only) |
| Date of birth (year is enough) | Filter teens out for solo field work; pair adults | Notes |
| Emergency contact (name + relation + phone) | If something happens on a Tuesday | Notes |

**For the photo:** ask them to WhatsApp it to your number right
after the call. Don't dictate format; just "good front-facing
photo, jaisa ID card pe lagta hai". You'll crop/format yourself.

---

## Section 6 · Set expectations (~2 min)

The part most operators rush through and most volunteers
remember.

**Honorarium:**

> *हम हर submission के बाद थोड़ा honorarium देते हैं — chai-paani*
> *जितना, कोई salary नहीं समझिए। मंगलवार शाम तक UPI पर आ जाता है।*
> *Exact amount काम के हिसाब से तय होता है।*
>
> (Small honorarium per submission, like chai-paani money, not a
> salary. Lands on UPI by Tuesday evening. Exact amount depends
> on the work.)

Be HONEST about the amount range. If you over-promise here and
they realize on Tuesday it's less than expected, you lose them
forever. Better to undersell.

**Code system:**

> *आपको एक unique code मिलेगा (BM-LKO-XXXXXX format), उसी से हर*
> *submission identify होती है। Code save कर लीजिए, WhatsApp पर*
> *भेज देंगे।*

**Communication cadence:**

> *हर सोमवार शाम मैं आपको WhatsApp करूँगा — अगले मंगलवार का plan*
> *कौन से area में, क्या-क्या करना है, कितने लोग हैं team में।*
> *Tuesday subah 7am tak respond कर दीजिएगा confirmed या नहीं।*

**Opt-out is OK:**

> *अगर किसी मंगलवार आप busy हैं, बस मुझे बता दीजिए — कोई problem*
> *नहीं। साल भर fixed commitment नहीं है।*

This lowering of pressure paradoxically increases retention.
"Drop in / drop out anytime" feels safer than "we expect you
every Tuesday".

---

## Section 7 · Closing (~30 sec)

> *बहुत खूब [NAME] जी, ये सब note कर लिया हमने। अगले 1-2 दिन में*
> *मैं verify कर के आपको code भेज दूँगा। Photo WhatsApp कर दीजिएगा*
> *अभी, और permanent address भी text कर दीजिए ID card के लिए।*
>
> *कोई और सवाल है आपका हमसे?*

Let them ask. Most don't. The ones who do are the ones who'll
become reliable — they care enough to ask.

End with:

> *जय बजरंगबली। मिलते हैं next Tuesday पर।*

---

## After the call · 3-minute admin checklist

1. **Update Volunteer notes** in \`/admin/volunteers\` → click
   the row → add a structured note:
   \`\`\`
   Call 27 May 2026 · 12 min
   Role: Field spotter (primary), Photographer (secondary)
   Areas: Indira Nagar (primary), Munshipulia, Polytechnic
   Transport: Activa
   Tuesdays: 5-8 of 8 committed; morning preferred
   Photo: ✓ received via WA
   Address: ✓ received via WA, in R2 archive
   Aadhaar last-4: XXXX
   DOB year: 1989
   Emergency contact: [name] (brother) +91 XXXXX-XXXXX
   Vibe: Warm, articulate, knows the area well. Green light.
   \`\`\`
2. **Save the photo** to local + R2 \`/volunteer-ids/\` with
   filename \`[code-or-name]_[YYYY-MM-DD].jpg\`
3. **Click "Approve & send code on WhatsApp"** in the admin row
   → auto-welcome fires with their issued code + first-submit link
4. **Order the ID card** if 5+ volunteers have been onboarded since
   the last batch (we batch ID card printing to save per-piece
   cost)

---

## Disqualification — when to NOT approve

Don't issue a code if any of these are true. Mark SUSPENDED with
a one-line reason in the notes.

- **Phone goes to a completely different name** — signup might
  be impersonation
- **Refuses to share photo + address** for ID card after the
  expectation is set — operational blocker; we can't issue an ID
- **Aggressive about the honorarium** ("how much exactly will I
  get for Tuesday morning?") with no genuine interest in the
  seva angle — wrong fit
- **Cannot commit to even 2 Tuesdays of the 8** — too thin to
  train + retain
- **Lives outside Lucknow district** — out of scope for now
- **Under 16 years old** — legal + safety; can re-apply at 18
- **Has been suspended on a previous BM Ingest group** — name +
  phone-suffix check against the existing community moderation
  log

For ambiguous cases, mark "needs 2nd call" in notes and queue
for next week.

---

## Voice notes

- **Code-switch freely.** If they speak Hindi, you speak Hindi. If
  they switch to English mid-sentence, switch with them. Don't
  force one language.
- **Names + honorifics matter.** Always "ji" suffix on names of
  people 25+; first-name fine for younger.
- **Listen 60% / talk 40%.** This is a discovery call, not a
  sales pitch. The signup already opted in; you're confirming
  fit, not convincing.
- **Take 3-5 verbatim phrases** to capture in notes. Their exact
  words help you remember them later when assigning Tuesday plans.

## Open improvements

These would make the workflow cleaner; ask whenever you want any:

1. **Notes field on the Volunteer model.** Currently you'd write
   notes into the Submission notes column or admin internal
   tool. A first-class \`Volunteer.notes\` markdown field would
   make the post-call summary one click.
2. **Photo upload field on the Volunteer card.** Drag-and-drop
   the WhatsApp-received photo into the admin row, auto-uploads
   to R2 + saves the URL.
3. **"Needs 2nd call" status.** Today the only transitions are
   PENDING → PROBATIONARY / SUSPENDED. A third state would let
   the operator queue ambiguous signups without rejecting.
4. **Bulk ID-card export.** "Print 5 ID cards" button that
   generates a PDF with the 5 most-recently approved volunteers'
   photo + name + code + area.
`;

const TAGS = [
  "volunteer",
  "onboarding",
  "phone-call",
  "playbook",
  "first-call",
  "internal",
];

async function main() {
  const existing = await prisma.content.findFirst({
    where: { source: SOURCE_SLUG },
    select: { id: true },
  });
  if (existing) {
    console.log(
      `[seed] first-call script already exists (id=${existing.id}), skipping.`,
    );
    await prisma.$disconnect();
    return;
  }
  const created = await prisma.content.create({
    data: {
      kind: "STRATEGY",
      audience: "INTERNAL",
      channel: "INTERNAL",
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
