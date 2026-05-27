// One-shot insert: draft Terms & Conditions for the /volunteer
// signup page. Plain-English, bilingual summary on top, ~700
// words total. Designed to be readable in 90 seconds on a phone
// before someone checks the consent box and submits.
//
// Not legal advice. If you want a lawyer to review, this is the
// draft to hand them.
//
// Idempotent: skipped if a row with the same `source` slug
// already exists.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SOURCE_SLUG = "volunteer-terms-draft.md";

const TITLE = "Volunteer programme, terms & conditions (draft for /volunteer)";

const SUMMARY =
  "Draft T&C text for the /volunteer signup form. Covers DPDP-compliant data consent, honorarium framing, photo/content rights, suspension grounds, and 18+/Lucknow eligibility. Bilingual summary on top, plain English below. Review for tone + ask a lawyer before publishing.";

const BODY = `# Volunteer programme · terms & conditions

**Status:** Draft. Review for tone, then have a Lucknow-based
lawyer give it 30 minutes before going live. This is not legal
advice; it's a starting point.

---

## Where this lives

Add to \`/volunteer\` (the signup page) as a small expandable
section above the Submit button. Required-to-check consent
checkbox:

> ☐ मैंने terms पढ़े और मानता/मानती हूँ। I have read and
> agree to the terms.

The form should not submit until this is checked. The volunteer
row in DB should store \`termsAcceptedAt: DateTime\` for audit
trail (DPDP Act requirement around consent capture).

---

## Hindi summary (visible by default)

> *BadaMangal volunteer programme में आप-छह बातें जो जानना ज़रूरी*
> *है:*
>
> 1. *यह community seva है, कोई नौकरी नहीं। Honorarium goodwill*
>    *के तौर पर है, salary नहीं।*
> 2. *आप 18 साल या उससे ऊपर के होने चाहिए।*
> 3. *आपका phone number हम WhatsApp coordination में use करेंगे।*
>    *कभी भी opt-out कर सकते हैं।*
> 4. *जो photos आप seva के दौरान capture करते हैं, उनका use*
>    *BadaMangal अपनी website + social media पर कर सकता है।*
> 5. *Seva के दौरान सावधानी रखना आपकी responsibility है।*
>    *BadaMangal accidents, injury, खोई हुई चीज़ों के लिए*
>    *responsible नहीं है।*
> 6. *आप कभी भी programme से बाहर निकल सकते हैं। हम भी ज़रूरी*
>    *हुआ तो suspend कर सकते हैं।*
>
> *नीचे विस्तार से English में पढ़ें।*

---

## Full text (English)

### 1. About the programme

BadaMangal is a community initiative documenting Bada Mangal
bhandaras in Lucknow. Volunteers help by spotting bhandaras on
Tuesdays, verifying organizer phone numbers, and supporting
community coordination on WhatsApp. This is a **community seva
arrangement, not employment**.

### 2. Eligibility

You must be **18 years of age or older** and currently resident
in or familiar with Lucknow. By signing up you confirm both.

### 3. Data we collect

When you sign up, we collect:

- **Name**: for coordination and ID card
- **Phone number**: for WhatsApp messages (your unique volunteer
  code + Tuesday plans)
- **UPI ID**: to pay honorarium directly to you
- **Areas you cover**: to assign you to the right team

After your first call with us, you may share additionally:

- **Photo**: for your ID card
- **Postal address**: to mail the ID card
- **Last 4 digits of Aadhaar or voter ID**: trust signal,
  matched against UPI account name at first payout
- **Year of birth**: to filter under-18s

**We do not sell, rent, or share any of this data with third
parties.** We use it only for the volunteer coordination
described above. You can request deletion at any time by
WhatsApping the BadaMangal number; we will remove your record
within 7 days, except records we are required to keep for
financial/audit reasons (e.g., past honorarium payouts).

This consent is captured per India's Digital Personal Data
Protection Act, 2023.

### 4. Communication consent

By signing up, you consent to receive WhatsApp messages from the
BadaMangal coordination number for:

- Sending your volunteer code
- Sharing weekly Tuesday plans (every Monday evening)
- Coordinating live during a Bada Mangal Tuesday

You may opt out at any time by replying "STOP" to any message.
This does not require you to delete your volunteer record; it
just pauses outbound coordination.

### 5. Honorarium

Honorarium is a **discretionary goodwill gratuity, not a salary,
wage, or contractual payment**.

- We may revise the per-submission amount at any time
- We may withhold honorarium for any submission that does not
  meet our quality bar (incomplete data, duplicates, etc.)
- Honorarium amounts are typically settled weekly via UPI by
  Tuesday evening
- Any tax liability on honorarium received is the volunteer's
  responsibility
- No employment, agency, contractor, or partnership relationship
  is created by your participation

### 6. Photos + content you capture

Photos and information you capture during seva (bhandara banner
photos, walker-eye-view shots, location pins, captions) may be
used by BadaMangal on its website (badamangal.com), social media
channels, press materials, sponsor pitches, and physical
pamphlets. You retain personal ownership of your photos; you grant
BadaMangal a non-exclusive, irrevocable, royalty-free license to
use them for community purposes.

**Faces:** if you capture a photograph that prominently features
identifiable individuals, please obtain their verbal consent
before submission. We will remove any photo from our surfaces on
written request from the depicted person.

### 7. Conduct expectations

We expect every volunteer to:

- Be **respectful** to organizers, community members, and other
  volunteers, regardless of caste, religion, or social standing
- Use the volunteer code only for **genuine submissions**:
  fake, duplicate, or speculative submissions are grounds for
  suspension
- Not impersonate other volunteers, organizers, or BadaMangal
  staff
- Not spam community WhatsApp groups, contact organizers
  outside the coordination channel, or collect payment from
  organizers under BadaMangal's name

### 8. Suspension + termination

BadaMangal may suspend or terminate your participation at our
discretion, including (but not limited to) for:

- Conduct violations under section 7
- Failure to verify your phone number / WhatsApp number
- Inactivity for 8+ consecutive Tuesdays during season
- A pattern of low-quality or duplicate submissions
- Any conduct that brings the programme into disrepute

You may also opt out at any time by WhatsApping us. There is no
notice period and no penalty.

### 9. Safety + liability

Seva participation involves walking, photographing, and
interacting with community members in public spaces. **You
participate at your own risk.** BadaMangal is not liable for:

- Personal injury, accident, or health issues during seva
- Loss or damage of personal belongings (phone, scooter, etc.)
- Disputes between you and any organizer, community member, or
  third party
- Any indirect, consequential, or incidental damages

Please take normal urban-mobility precautions: helmet if you
ride a scooter, awareness in crowds, and your own medical/
accident insurance if you don't have one.

### 10. Children's safety

The BadaMangal volunteer programme is for adults. Volunteers
must be **18 or older**. Bhandaras themselves are public events
open to all ages, but our programme involves coordination,
travel, and operational decisions we don't ask minors to take.

### 11. Changes to these terms

We may update these terms from time to time. When we do, we will
notify active volunteers on the coordination WhatsApp number and
update the "Last updated" date below. Continued participation
after a material change constitutes acceptance.

### 12. Governing law + disputes

These terms are governed by the laws of India. Any disputes will
be subject to the exclusive jurisdiction of the courts of
Lucknow, Uttar Pradesh.

### 13. Contact

For any question, opt-out request, data deletion request, or
takedown request related to a photo, WhatsApp **+91 XXXXX XXXXX**
or email **prateeeksaini@gmail.com**.

---

*Last updated: 2026-05-27*
*BadaMangal · Lucknow*

---

## Implementation checklist (for when you ship this)

When wiring this into \`/volunteer\`:

1. **Add a \`<details>\` accordion** above the Submit button
   titled "नियम और शर्तें · Terms & conditions". Default closed.
   Inside renders the Hindi summary, then the English full text
   below. Less than 90 seconds to read at typical phone speed.

2. **Add a required checkbox** below the accordion:
   "मैंने terms पढ़े और मानता/मानती हूँ। I have read and agree to the terms."
   Form Submit button stays disabled until checked.

3. **Schema change**: add to \`Volunteer\`:
   \`\`\`prisma
   termsAcceptedAt   DateTime?
   termsVersion      String?    // "2026-05-27" or whatever the
                                 // "Last updated" date is at signup
   \`\`\`
   Set both on form submit. The DPDP Act 2023 compliance posture
   needs *capturable, dated consent*, not just an unchecked
   checkbox in HTML.

4. **Add a footer link** in the AppFooter pointing to
   \`/volunteer/terms\` with the same text rendered as a
   standalone page (for the rare case a volunteer wants to
   re-read the terms after signup).

5. **Update the welcome message templates** (already in Content
   Hub) to mention "By replying you reaffirm the terms you
   accepted at signup", light touch, not a wall of legalese.

## Things to ask the lawyer

If you want a Lucknow lawyer to review (recommended for a
~30-minute review, ~₹2,000-3,000 fee), the specific questions
worth their attention:

- **Section 5 honorarium framing**: is "discretionary goodwill
  gratuity, not salary" sufficient under Indian Contract Act +
  Payment of Wages Act to prevent re-classification as
  employment? Some lawyers prefer "ex gratia payment" terminology.
- **Section 6 photo rights**: is "non-exclusive, irrevocable,
  royalty-free license for community purposes" the right phrase,
  or should it be "perpetual" instead of "irrevocable"?
- **Section 9 liability disclaimer**: Indian consumer
  protection law sometimes voids broad disclaimers. Worth
  asking which parts of section 9 are actually enforceable.
- **Section 12 governing law + jurisdiction**: exclusive vs
  non-exclusive jurisdiction, do you need an arbitration clause
  for a community programme of this size? (Probably not, but
  ask.)
`;

const TAGS = [
  "volunteer",
  "terms",
  "legal",
  "dpdp",
  "signup",
  "compliance",
  "draft",
];

async function main() {
  const existing = await prisma.content.findFirst({
    where: { source: SOURCE_SLUG },
    select: { id: true },
  });
  if (existing) {
    console.log(
      `[seed] volunteer-terms draft already exists (id=${existing.id}), skipping.`,
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
  console.log(`[seed] inserted: ${created.id}, ${created.title}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
