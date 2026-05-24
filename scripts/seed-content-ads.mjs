// One-shot seeder, inserts the ad-slot inventory + sponsor outreach
// pitches (EN+HI, multi-channel) into the Content table so they appear
// in /admin/content immediately.
//
// Run once:
//   node scripts/seed-content-ads.mjs
//
// Idempotent on the title, re-running updates the existing row rather
// than creating duplicates. Safe to re-run after editing copy.
//
// Style constraints (per operator preference):
//   • No em dashes, use periods / colons / short sentences instead
//   • Sign as "Prateek" with first-person verbs, never "team"
//   • Specific, current numbers (from latest community-stats POST)
//   • Lucknow SMB tone, direct, no Silicon-Valley jargon
//
// Inserts go to the Content table the Content Hub renders.
// Tags include "ad-slots-2027" so the operator can filter to this
// batch in /admin/content via the search box.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── 1. Ad inventory ──────────────────────────────────────────────────
// One doc, two languages. The English version is the source of truth;
// the Hindi mirrors structure (tables stay English-column-headers since
// Devanagari column headers wrap awkwardly).

const INVENTORY_EN = `# Ad slots on badamangal.com, 2027 inventory

The Bada Mangal season (Apr–Jun 2027) is the single largest community moment in Lucknow's calendar. badamangal.com is the only digital surface that aggregates every bhandara, every live spot, and the city's chatter about all of it. This is the operator-facing inventory of every ad slot I can sell.

## Reach snapshot (live, end of Season 1)

- **9,597+ WhatsApp community members** across 14 groups + 1 broadcast channel
- **3,754 cumulative web visitors** (Season 1, May 2026)
- **139 bhandaras listed**, 110 verified, growing into Season 2
- **147 live spot reports** in 5 Tuesdays
- **~280 peak concurrent users** on a Tuesday afternoon
- **Average dwell time 4 min** on homepage on Tuesdays

## Slot inventory

### Tier 1: premium, in-product

| # | Slot | Location | Format | Visibility | Price (₹) | Inventory |
|---|---|---|---|---|---|---|
| 1 | Homepage hero strip | \`/\` between header + content | 1200×90 banner image OR text+logo | 100% of homepage visitors | 15,000 / season | 1 |
| 2 | Live chat sponsor card | Inside the live chat panel, pinned top | 320×80 card with brand name + tagline | 100% of live-chat openers (Tue+Sat) | 12,000 / season | 1 |
| 3 | Pamphlet PDF footer | Auto-generated organiser pamphlets | 1600×200 logo strip in PDF footer | Every organiser download (139 in S1, projected 250+ S2) | 15,000 / season | 1 |
| 4 | Featured Bhandara badge | Top of bhandara grid on homepage | "Featured" tag + brand name on 1 bhandara | 100% of homepage visitors | 8,000 / Tuesday | 5 (one per Tuesday) |

### Tier 2: contextual

| # | Slot | Location | Format | Visibility | Price (₹) | Inventory |
|---|---|---|---|---|---|---|
| 5 | Bhandara detail sidebar | Right rail on \`/bhandara/[slug]\` | 250×250 box | Anyone opening any bhandara | 5,000 / season | 1 per area (rotation) |
| 6 | Map marker, sponsor pin | Live map | Premium-styled custom marker on sponsor's own bhandara | Map openers | 4,000 / season | Unlimited (one per sponsored bhandara) |
| 7 | Gallery photo slot | Homepage photo grid | 1 sponsored photo per week | Gallery viewers | 2,000 / week | 1 per week |
| 8 | Spot tile sticker | Live spot card on map + chat | Small brand sticker on a sponsored spot | Spot viewers | 1,500 / sponsored spot | Per-spot |

### Tier 3: distribution

| # | Slot | Location | Format | Visibility | Price (₹) | Inventory |
|---|---|---|---|---|---|---|
| 9 | WhatsApp pinned message | Bada Mangal Community announce group | 1 pinned message / week, branded | 9,597 members | 8,000 / week | 1 per week |
| 10 | Email outreach footer | Operator-sent outreach mails (organiser follow-ups, press, sponsor) | 200×60 logo + tagline | Recipients of operator outreach | 3,000 / month | 1 |
| 11 | Weekly Tuesday digest | Email digest after each Tuesday | Full-width sponsored block | Newsletter subscribers (TBD) | 5,000 / Tuesday | 5 |

### Tier 4: extended

| # | Slot | Location | Format | Visibility | Price (₹) | Inventory |
|---|---|---|---|---|---|---|
| 12 | Co-branded WhatsApp invite template | Organiser-generated WhatsApp invite | Brand footer in the template | Every organiser using the template | 10,000 / season | 1 |
| 13 | Bhandara-day branded merchandise match | Sponsor supplies merch (cups, water bottles, banners), I match with willing organisers | Per-bhandara physical branding | Visitors at sponsored bhandara | Negotiated | Custom |

## How to buy

1. Tell me which slot(s) you want via WhatsApp (+91 XXXX XXXXXX). I confirm availability within 2 hours.
2. I send a Razorpay link or UPI ID. Pay 50% to lock the slot, 50% before Season 2 starts (1 Apr 2027).
3. Send the creative (logo, banner, copy) by **15 March 2027**. I'll review for fit and ship live by **1 April 2027**.
4. Weekly impressions report every Wednesday for season-long slots.

## Bundle deals

- **Tier 1 bundle** (slots 1+2+3+4): ₹50,000 / season (₹0 savings, but priority placement)
- **Tier 1+2 bundle** (slots 1, 2, 3 + 1 Tier 2): ₹55,000 / season
- **Season takeover** (every Tier 1 + 2 + 3 slot exclusively yours): ₹2,00,000 / season

## What I will NOT sell

- The bhandara listings themselves. Every listing is free for organisers. We never charge for inclusion.
- Email/phone of any community member.
- Anything that violates WhatsApp ToS or the trust of organisers who shared their bhandara.

## Audit + measurement

Every slot ships with a weekly impressions report (sent every Wednesday morning by email):
- Slot impressions (pageviews where the slot rendered)
- Clicks on any embedded link (UTM-tagged)
- Brand-mention pickup in the live chat (if any)

Honest reporting, if a Tuesday underperforms a baseline by 20%+, I prorate.

Prateek
Builder, badamangal.com
+91 XXXX XXXXXX | prateek@badamangal.com
`;

const INVENTORY_HI = `# badamangal.com पर विज्ञापन स्लॉट्स, 2027 इन्वेंटरी

लखनऊ के कैलेंडर में बड़ा मंगल का मौका सबसे बड़ा सामुदायिक पल है। Apr–Jun 2027 के सीज़न के लिए badamangal.com शहर का इकलौता डिजिटल प्लेटफ़ॉर्म है जो हर भंडारा, हर live spot, और इस पूरे शहर की चर्चा एक जगह दिखाता है। यह उन सभी विज्ञापन स्लॉट्स की लिस्ट है जो मैं sponsors को बेच सकता हूँ।

## अभी का reach (सीज़न 1 के अंत तक)

- **9,597+ WhatsApp सदस्य** 14 ग्रुप्स + 1 broadcast channel में
- **3,754 web visitors** (मई 2026, सीज़न 1)
- **139 भंडारे listed**, 110 verified
- **147 live spot reports** 5 मंगलवारों में
- **~280 peak concurrent users** एक मंगल दोपहर में
- **औसत 4 मिनट dwell time** होमपेज पर मंगलवार को

## स्लॉट इन्वेंटरी

### Tier 1: premium, in-product

| # | Slot | Location | Format | Visibility | Price (₹) | Inventory |
|---|---|---|---|---|---|---|
| 1 | होमपेज hero strip | \`/\` header + content के बीच | 1200×90 banner या text+logo | 100% homepage visitors | 15,000 / season | 1 |
| 2 | Live chat sponsor card | Live chat panel में pinned top | 320×80 card | 100% live-chat openers (Tue+Sat) | 12,000 / season | 1 |
| 3 | Pamphlet PDF footer | Organiser के लिए auto-generated PDF | 1600×200 logo strip footer में | हर organiser download (S1 में 139, S2 में 250+) | 15,000 / season | 1 |
| 4 | Featured Bhandara badge | होमपेज bhandara grid के ऊपर | "Featured" tag + brand name | 100% homepage visitors | 8,000 / Tuesday | 5 (हर मंगल को 1) |

### Tier 2: contextual

| # | Slot | Location | Format | Visibility | Price (₹) | Inventory |
|---|---|---|---|---|---|---|
| 5 | Bhandara detail sidebar | \`/bhandara/[slug]\` का right rail | 250×250 box | जो भी कोई भंडारा खोले | 5,000 / season | 1 per area (rotation) |
| 6 | Map marker, sponsor pin | Live map पर | Custom premium-styled pin | Map openers | 4,000 / season | Unlimited (1 per sponsored bhandara) |
| 7 | Gallery photo slot | होमपेज photo grid | हफ़्ते में 1 sponsored photo | Gallery viewers | 2,000 / week | 1 per week |
| 8 | Spot tile sticker | Live spot card map + chat पर | छोटा brand sticker | Spot viewers | 1,500 / sponsored spot | Per-spot |

### Tier 3: distribution

| # | Slot | Location | Format | Visibility | Price (₹) | Inventory |
|---|---|---|---|---|---|---|
| 9 | WhatsApp pinned message | Bada Mangal Community announce group | हफ़्ते में 1 pinned message, branded | 9,597 सदस्य | 8,000 / week | 1 per week |
| 10 | Email outreach footer | Operator-sent emails के footer में | 200×60 logo + tagline | Recipients | 3,000 / month | 1 |
| 11 | Weekly Tuesday digest | हर मंगल के बाद email digest | Full-width sponsored block | Newsletter subscribers | 5,000 / Tuesday | 5 |

### Tier 4: extended

| # | Slot | Location | Format | Visibility | Price (₹) | Inventory |
|---|---|---|---|---|---|---|
| 12 | Co-branded WhatsApp invite template | Organiser-generated WhatsApp invite | Brand footer template में | हर organiser जो template use करे | 10,000 / season | 1 |
| 13 | Branded merchandise match | Sponsor merch (cups, bottles, banners) देता है, मैं willing organisers से match कराता हूँ | Per-bhandara physical branding | Sponsored bhandara के visitors | Negotiated | Custom |

## कैसे खरीदें

1. WhatsApp पर बताएँ कौन से slot चाहिए (+91 XXXX XXXXXX)। मैं 2 घंटे में availability confirm करूँगा।
2. मैं Razorpay link या UPI ID भेजूँगा। 50% advance पर slot lock, 50% Season 2 शुरू होने से पहले (1 Apr 2027)।
3. Creative (logo, banner, copy) **15 March 2027** तक भेजें। मैं fit के लिए review करूँगा और **1 April 2027** तक live कर दूँगा।
4. Season-long slots के लिए हर बुधवार weekly impressions report।

## Bundle deals

- **Tier 1 bundle** (slots 1+2+3+4): ₹50,000 / season
- **Tier 1+2 bundle** (slots 1, 2, 3 + 1 Tier 2): ₹55,000 / season
- **Season takeover** (हर Tier 1 + 2 + 3 slot exclusive): ₹2,00,000 / season

## क्या मैं नहीं बेचूँगा

- भंडारा listings खुद। हर listing organisers के लिए free है। हम listing के पैसे कभी नहीं लेते।
- किसी community member का Email / phone।
- कुछ भी जो WhatsApp ToS या organisers का trust तोड़े।

## Audit + measurement

हर slot के साथ हर बुधवार सुबह email पर weekly impressions report:
- Slot impressions
- Clicks (UTM-tagged links)
- Live chat में brand-mention pickup

ईमानदार reporting: अगर कोई मंगलवार baseline से 20%+ कम perform करे, मैं prorate करूँगा।

Prateek
Builder, badamangal.com
+91 XXXX XXXXXX | prateek@badamangal.com
`;

// ── 2. Outreach pitches, Instagram DM ──────────────────────────────

const IG_EN = `Hi {{Brand}} team,

I'm Prateek, builder of badamangal.com. We're the live map for Lucknow's Bada Mangal season, every bhandara, every spot, the city's chatter, all in one place. Season 1 just wrapped: 9,597 WhatsApp members, 3,754 web visitors, 139 listed bhandaras.

I'm opening a small ad inventory for Season 2 (Apr–Jun 2027). Thinking your brand on the live chat sponsor card or as a Featured Bhandara badge would land well with our audience: Lucknow families, devout + curious, high intent on Tuesdays.

Rates start at ₹2,000/week (gallery slot) and go up to ₹15,000/season (homepage hero). Honest impressions reporting weekly. I prorate if a Tuesday underperforms.

5-min chat? Reply here or WhatsApp +91 XXXX XXXXXX.

Prateek
`;

const IG_HI = `नमस्ते {{Brand}} team,

मैं Prateek हूँ, badamangal.com का builder। हम लखनऊ के बड़ा मंगल season का live map हैं: हर भंडारा, हर spot, और शहर की चर्चा एक जगह। Season 1 अभी खत्म हुआ: 9,597 WhatsApp सदस्य, 3,754 web visitors, 139 listed bhandaras.

Season 2 (Apr–Jun 2027) के लिए मैं छोटा ad inventory खोल रहा हूँ। आपकी brand live chat sponsor card पर या Featured Bhandara badge के रूप में अच्छी fit होगी: हमारी audience लखनऊ की families हैं, श्रद्धालु + curious, मंगलवार को high intent।

Rates ₹2,000/week (gallery slot) से शुरू होकर ₹15,000/season (homepage hero) तक। हर हफ़्ते ईमानदार impressions report। मंगल underperform करे तो prorate करूँगा।

5 मिनट बात करें? यहाँ reply करें या WhatsApp +91 XXXX XXXXXX.

Prateek
`;

// ── 3. Outreach pitches, WhatsApp message ──────────────────────────

const WA_EN = `Hi, this is Prateek from badamangal.com.

We're Lucknow's live Bada Mangal map. 9,597 WhatsApp members + 3,754 web visitors in Season 1.

I'm selling 13 ad slots for Season 2 (Apr–Jun 2027). Lucknow families, high intent on Tuesdays.

Slots from ₹2,000/week. Honest weekly reporting. Want to take a look?

Prateek
+91 XXXX XXXXXX
`;

const WA_HI = `नमस्ते, मैं Prateek बोल रहा हूँ badamangal.com से।

हम लखनऊ का live Bada Mangal map हैं। Season 1 में 9,597 WhatsApp सदस्य और 3,754 web visitors।

Season 2 (Apr–Jun 2027) के लिए मैं 13 ad slots बेच रहा हूँ। लखनऊ families, मंगल को high intent।

Slots ₹2,000/week से शुरू। हर हफ़्ते ईमानदार reporting। एक नज़र देखें?

Prateek
+91 XXXX XXXXXX
`;

// ── 4. Outreach pitches, Email ─────────────────────────────────────

const EMAIL_EN = `Subject: Sponsoring Lucknow's Bada Mangal 2027 (small ask)

Hi {{First name}},

I'm Prateek. I built badamangal.com last year and we just wrapped Season 1: 9,597 WhatsApp members, 3,754 web visitors, 139 bhandaras listed across 14 community groups. ₹0 paid marketing, all organic.

Season 2 starts 1 April 2027 (5 Tuesdays of Jyeshtha). I'm opening a small ad inventory: 13 slots across the homepage, live chat, organiser pamphlets, and email digests. Prices from ₹2,000/week up to ₹15,000/season.

I think {{Brand}} would fit well because:
- Our audience is exactly your demographic: Lucknow families, ages 25–60, high disposable income on Tuesdays
- Bada Mangal is a 5-Tuesday burst, not an always-on campaign, it matches a brand spend that wants a sharp seasonal moment
- Honest weekly reporting + prorate if a Tuesday underperforms

I've attached the full inventory PDF. Easiest next step is a 15-minute call. I'm in Lucknow (Aliganj) and happy to come to your office.

When works for you next week?

Warm regards,
Prateek
Builder, badamangal.com
+91 XXXX XXXXXX
prateek@badamangal.com
`;

const EMAIL_HI = `Subject: लखनऊ के Bada Mangal 2027 sponsorship (छोटी request)

नमस्ते {{First name}} जी,

मैं Prateek हूँ। मैंने पिछले साल badamangal.com बनाया था और Season 1 अभी खत्म हुआ: 9,597 WhatsApp सदस्य, 3,754 web visitors, 14 community groups में 139 भंडारे listed। ₹0 paid marketing, सब कुछ organic।

Season 2 1 अप्रैल 2027 से शुरू हो रहा है (ज्येष्ठ के 5 मंगलवार)। मैं छोटा ad inventory खोल रहा हूँ: होमपेज, live chat, organiser पंफ़लेट, email digests पर 13 slots। दाम ₹2,000/week से ₹15,000/season तक।

मुझे लगता है {{Brand}} के लिए अच्छा fit होगा क्योंकि:
- हमारी audience बिल्कुल आपकी demographic है: लखनऊ families, 25–60 साल, मंगल को high disposable income
- Bada Mangal एक 5-मंगल burst है, always-on नहीं, sharp seasonal moment वाले brand spend के लिए perfect
- हर हफ़्ते ईमानदार reporting, और मंगल underperform करे तो prorate

पूरा inventory PDF attached है। अगला step बस 15 मिनट का call। मैं लखनऊ (Aliganj) में हूँ, आपके office आ सकता हूँ।

अगले हफ़्ते कब time मिलेगा?

सादर,
Prateek
Builder, badamangal.com
+91 XXXX XXXXXX
prateek@badamangal.com
`;

// ── 5. Outreach, Reddit post (r/lucknow) ───────────────────────────

const REDDIT_EN = `**Title:** I built a live map of every Bada Mangal bhandara in Lucknow last year. Opening sponsorship slots for Season 2.

Hi r/lucknow,

Last year I built [badamangal.com](https://badamangal.com), a live aggregator of every Bada Mangal bhandara in the city. Season 1 (May 2026):

- **139 bhandaras** listed across the 5 Tuesdays of Jyeshtha
- **9,597 WhatsApp members** in our community groups + channel
- **3,754 web visitors** over the season
- **147 live spot reports** posted from the field
- Built entirely by me, ₹0 paid marketing, all organic

Season 2 starts April 2027. I'm opening a small ad inventory to fund the bot infra + a small bhandara support pool (we want to help under-resourced organisers with cups, water, basic supplies).

**13 ad slots** total, homepage banner, live chat sponsor card, pamphlet PDF footer, featured bhandara badge, map sponsor pin, weekly WhatsApp pinned post, email digest, etc. Prices from ₹2,000/week to ₹15,000/season. Full inventory at badamangal.com/sponsor.

What I will NOT do:
- Sell or share any community member's phone or email
- Charge organisers for listing (bhandara listings stay 100% free, always)
- Run anything that violates WhatsApp ToS

If you run a Lucknow business (restaurant, mithai shop, real estate, hospital, anything family-facing), Bada Mangal is the single biggest organic intent moment in the local calendar. Happy to chat.

Comments + DMs open. Operator here, AMA.

Prateek
`;

// ── 6. Helper to upsert by title ────────────────────────────────────

async function upsertContent(row) {
  const existing = await prisma.content.findFirst({
    where: { title: row.title },
    select: { id: true },
  });
  if (existing) {
    await prisma.content.update({
      where: { id: existing.id },
      data: row,
    });
    return `updated  ${row.title}`;
  }
  await prisma.content.create({ data: row });
  return `created  ${row.title}`;
}

// ── 7. Run ──────────────────────────────────────────────────────────

async function main() {
  const TAGS = ["ad-slots-2027", "sponsor", "season-2"];
  const rows = [
    {
      kind: "STRATEGY",
      audience: "SPONSOR",
      channel: "INTERNAL",
      language: "en",
      title: "Ad slot inventory + pricing, Season 2 (EN)",
      summary:
        "Operator-facing inventory of every ad slot on badamangal.com, with pricing tiers and bundle deals. The master doc behind every sponsor outreach pitch.",
      body: INVENTORY_EN,
      tags: TAGS,
    },
    {
      kind: "STRATEGY",
      audience: "SPONSOR",
      channel: "INTERNAL",
      language: "hi",
      title: "Ad slot inventory + pricing, Season 2 (HI)",
      summary:
        "Sponsors के साथ share करने के लिए ad inventory + pricing का Hindi version।",
      body: INVENTORY_HI,
      tags: TAGS,
    },
    {
      kind: "PITCH",
      audience: "SPONSOR",
      channel: "INSTAGRAM",
      language: "en",
      title: "Instagram DM, sponsor outreach (EN)",
      summary: "Short Instagram DM template for cold-pitching a local brand on Season 2 ad slots.",
      body: IG_EN,
      tags: TAGS,
    },
    {
      kind: "PITCH",
      audience: "SPONSOR",
      channel: "INSTAGRAM",
      language: "hi",
      title: "Instagram DM, sponsor outreach (HI)",
      summary: "Lucknow local brands के लिए Instagram DM template (Hindi).",
      body: IG_HI,
      tags: TAGS,
    },
    {
      kind: "PITCH",
      audience: "SPONSOR",
      channel: "WHATSAPP",
      language: "en",
      title: "WhatsApp message, sponsor outreach (EN)",
      summary: "Very short WhatsApp cold-pitch message, under 100 words.",
      body: WA_EN,
      tags: TAGS,
    },
    {
      kind: "PITCH",
      audience: "SPONSOR",
      channel: "WHATSAPP",
      language: "hi",
      title: "WhatsApp message, sponsor outreach (HI)",
      summary: "बहुत छोटा WhatsApp cold-pitch (under 100 words).",
      body: WA_HI,
      tags: TAGS,
    },
    {
      kind: "PITCH",
      audience: "SPONSOR",
      channel: "EMAIL",
      language: "en",
      title: "Email outreach, sponsor pitch (EN)",
      summary:
        "Longer-form sponsor email pitch with the value prop, fit explanation, and CTA. Attaches the inventory PDF.",
      body: EMAIL_EN,
      tags: TAGS,
    },
    {
      kind: "PITCH",
      audience: "SPONSOR",
      channel: "EMAIL",
      language: "hi",
      title: "Email outreach, sponsor pitch (HI)",
      summary: "Sponsor outreach email का Hindi version, formal tone, with CTA.",
      body: EMAIL_HI,
      tags: TAGS,
    },
    {
      kind: "PITCH",
      audience: "SPONSOR",
      channel: "REDDIT",
      language: "en",
      title: "Reddit post, r/lucknow sponsor + community update",
      summary:
        "Long-form, AMA-style post for r/lucknow announcing Season 2 sponsorship slots. Less salesy than the DM/email pitches.",
      body: REDDIT_EN,
      tags: TAGS,
    },
  ];

  console.log(`▶ seeding ${rows.length} content rows…`);
  for (const r of rows) {
    const result = await upsertContent(r);
    console.log(`  ${result}`);
  }
  console.log("✓ done");
}

main()
  .catch((err) => {
    console.error("✗ seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
