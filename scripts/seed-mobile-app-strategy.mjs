// One-shot insert: "Mobile app strategy" Content row.
//
// Drops a single STRATEGY entry into /admin/content so the plan
// for building a native Bada Mangal app lives alongside the
// off-season strategy, personas, and marketing-calendar docs.
// Idempotent: skips if a row with the same `source` slug
// already exists, so re-running just no-ops.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SOURCE_SLUG = "mobile-app-strategy-2026-05-27.md";

const TITLE = "Mobile app strategy: building a Bada Mangal app";

const SUMMARY =
  "Should we build a native app for Bada Mangal? When, why, who for, what stack, what risks, and a 6-month timeline tied to the 2027 season. Recommendation: Capacitor MVP in the off-season, then re-evaluate.";

const BODY = `# Mobile app strategy

_Last updated: 2026-05-27. Author: Prateek + Claude._

## TL;DR

A native Bada Mangal app is **not urgent for 2026** (web + WhatsApp covers
the current 9,600-member community well), but is the **single highest
leverage off-season investment** for 2027. The right play is a
**Capacitor MVP between July and October 2026** focused on three native
superpowers the web can't match: **push notifications**, **fast camera
spot-reporting**, and **offline-cached "my Tuesday" plan**. Total cash
cost ~₹27,000/year (Apple + Google), solo build effort ~3-4 weeks for
the MVP.

If the off-season pilot validates with 50+ users, escalate to a proper
Expo (React Native) v1 for Bada Mangal 2027.

---

## Why an app at all?

The web app is doing 95% of what an app needs to do. The 5% gap is
where an app earns its keep:

1. **Tuesday wake-up push** — the single most-asked feature. "Wake me
   up at 7 AM with the nearest 5 bhandaras." Web can't do this.
   WhatsApp can (and the bot does), but only for the 9,600 who're
   already in the groups.
2. **Camera-first spot reporting** — current web flow needs the
   visitor to (a) open browser, (b) load homepage, (c) tap a CTA,
   (d) approve camera + GPS. Native short-circuits to (b) and (c).
   Tuesday spot volume could 3-5x with a 2-tap report.
3. **Offline "my Tuesday"** — visitors plan on Sunday, walk on
   Tuesday with patchy 4G. A cached list of 5 saved bhandaras + map
   tiles means the app works in a bhandara queue with no signal.
4. **Discoverability beyond WhatsApp** — anyone who lands via reddit
   or press has no obvious "save this for later" affordance on web.
   App icon on the home screen is a year-round retention hook.
5. **Year-round liturgical use cases** — pamphlet builder for any
   bhandara (Sawan, Navratri, Diwali, Makar Sankranti, Holi),
   organizer registration, volunteer matching. Off-season needs a
   home; web traffic dies between Tuesdays but a notification can
   wake the audience back up.

---

## Who it's for, in priority order

| Persona | Their job-to-be-done | App's killer feature |
|---|---|---|
| **Walker / Spotter** (the visitor) | Find nearby bhandara on a Tuesday, share what they saw | Push + map + camera spot |
| **Organizer** (the bhandara-running family) | Register their bhandara, post updates, see how many attended | Push to subscribers + analytics |
| **Volunteer** | RSVP for seva, see needs by area | Filter + claim |
| **Operator (Prateek)** | Moderate, scan posters, monitor health on the move | Admin shell mobile UI |

Build in this exact order. Walker is the largest segment (~80% of
expected app installs). Organizer + Volunteer cover the long tail.
Operator is convenience-only — desktop admin already works.

---

## What goes in (feature scope by release)

### MVP (v0) — Capacitor wrapper

**Goal:** prove the three native superpowers work and people want them.

- Home tab = the existing /map (PWA wrapped, native shell)
- Browse tab = list of bhandaras with date filter
- Detail screen (native nav)
- **Native camera** for spot reporting → POSTs to existing /api/spots
- **Native GPS** for "near me"
- **Push notifications** via OneSignal SDK
- **Save bhandara** to a local on-device "My Tuesday" list
- **Subscription**: opt-in for Tuesday-morning push
- App icon, splash screen, app store screenshots

Out of scope for MVP: Hindi-only UI, organizer screens, volunteer
flow, payments, in-app messaging.

**Effort:** 3-4 weeks solo. Reuses every API route the web already
exposes.

### v1 — Native Expo build

**Trigger:** MVP retention > 30% week-2, push opt-in > 50%, or 500+
installs by November 2026.

- Fully native screens (not WebView) for the four core flows
- Native map (Mapbox GL Native) with offline tiles
- Organizer registration flow (the sticky-pamphlet two-pane layout,
  redone for mobile)
- Volunteer screens (signup, "needs in my area", RSVP)
- Sponsor flow (UPI deep link → native UPI app handoff)
- Bilingual (en + hi) toggle baked into onboarding
- Deep links from WhatsApp shares ("badamangal://bhandara/slug")
- App analytics (PostHog or Vercel Analytics for mobile)

**Effort:** 8-10 weeks solo. Build in Feb-April 2027 with eye on
season launch.

### v2 — Post-2027-season

- Operator/admin app (compress /admin into 4 screens)
- One-tap WhatsApp → app forward (capture share intent from the bot
  pipeline that already exists)
- Organizer self-serve analytics dashboard
- In-app live chat (currently the LiveChatterBoard webview is fine,
  but native chat with WhatsApp-style bubbles would feel native)
- Apple Watch / Wear OS companion ("nearest bhandara" complication
  on Tuesday morning — high-effort, very low impact)

---

## How — three realistic stacks

### Option A: Capacitor wrapping the existing PWA  ★ RECOMMENDED for MVP

- The Next.js web app is the core; Capacitor is a thin native shell
- Native bridges for camera, push, geolocation, share
- Single codebase, no parallel mobile codebase to maintain
- Operator already speaks Next.js + React — zero new tech learning
- App Store risk: Apple's 4.2 ("doesn't provide enough native value")
  is real for naive WebView wrappers, but mitigated by genuine native
  features (camera, push, share intent, biometric save)
- **3-4 weeks to MVP**

### Option B: Expo (React Native) full rebuild

- Proper native app, native screens, native nav
- Higher quality, longer build
- Operator already writes React — JSX shape transfers
- EAS Build + Submit handles iOS + Android one-click
- **6-10 weeks to MVP**, **3-4 months to v1**

### Option C: Native Swift + Kotlin

- Highest quality, two codebases
- Realistic only with a hire or contractor
- **Not viable for a solo operator with a day job**

### Recommendation

**Capacitor (Option A) for the off-season MVP.** Cheap, fast, reuses
everything that works. If retention + push opt-in clear the v1 trigger
bar by November 2026, **rebuild on Expo for the 2027 season**. The
Capacitor codebase isn't load-bearing past v1 — it's a probe.

---

## Cost

| Item | Cost |
|---|---|
| Apple Developer Program | $99 / year (~₹8,300) |
| Google Play Console | $25 one-time (~₹2,100) |
| OneSignal push notifications | Free tier covers up to 10K subscribers |
| App icon + screenshots | ~₹15,000 if outsourced (or 1 weekend solo) |
| Capacitor / Expo / OSS deps | Free |
| Backend (existing Vercel + Supabase) | No change |
| **Total recurring** | **~₹8,300 / year** |
| **Total upfront** | **~₹17,000** (one-time + design) |

Compared to the time investment (3-4 weeks of off-season nights), the
cash cost is trivial.

---

## Risks (sorted by likelihood × impact)

1. **Seasonal-app rejection.** Apple/Google sometimes flag apps that
   only have meaningful content 11 weeks a year. *Mitigation:*
   year-round content via off-season calendar (Sawan, Navratri,
   Diwali, Makar Sankranti, Holi), pamphlet builder, organizer
   coordination.
2. **Push notification fatigue.** One Tuesday-morning push is gold;
   four mid-week pings is uninstall fuel. *Mitigation:* default to
   one push per week, opt-in for more.
3. **Solo maintenance burden.** Two platforms means twice the bug
   reports on the rare-2026 Tuesdays. *Mitigation:* MVP stays
   thin-WebView for the first season so the web fixes a Tuesday-day
   bug for both at once.
4. **App Store 4.2 ("wrapped website") rejection.** *Mitigation:*
   the three native bridges (camera, push, save-to-device) are
   real native features, not just a Safari shortcut.
5. **WhatsApp dependency stays load-bearing.** App users will spot
   bhandaras, but the ingest funnel is still the WhatsApp bot.
   *Mitigation:* prioritize the "direct spot-report from app"
   pipeline so the WhatsApp dependency doesn't grow.
6. **Single-operator burnout.** Adding mobile to a one-person team
   compresses already-tight Tuesday windows. *Mitigation:*
   off-season build only. Hard gate: no app shipping in May-June
   2026; freeze the codebase pre-season for both web and mobile.

---

## Go / No-go gates

**GO** if all three:
- [ ] Off-season runway: at least 4 contiguous weeks free between
      July 2026 and April 2027
- [ ] 5 organizer + 5 walker interviews validate the three killer
      features (push, camera, offline save)
- [ ] Cash for Apple Dev fee (~₹8,300) committed

**NO-GO** if any:
- WhatsApp + web is already saturating community (>50K WhatsApp
  members would suggest the community is too WhatsApp-locked-in to
  warrant an app)
- Press / organizer push for "more reach" doesn't materialize off-season
- Pre-2027 season prep work (server hardening, content recovery,
  organizer outreach) hasn't been completed by March 2027

---

## Suggested timeline (off-season 2026 → 2027 season)

| Month | Milestone |
|---|---|
| **July 2026** | User research (5 organizers, 5 walkers). Write screen specs. |
| **August 2026** | Capacitor MVP: shell, camera, push, save, near-me. |
| **September 2026** | Internal beta with 20 users. Iterate on push timing + opt-in flow. |
| **October 2026** | Apple + Google submission. Public soft-launch. Marketing on reddit + WhatsApp. |
| **November-December 2026** | Festival uses (Diwali pamphlet, etc.) drive year-round retention. |
| **January 2027** | Re-evaluate: 500+ installs, > 30% W2 retention, > 50% push opt-in? |
| **Feb-Apr 2027** | If GO, build Expo v1 with native screens + organizer + volunteer flows. |
| **May 2027** | Bada Mangal 2027 launch — primary use case lands with native polish. |

---

## What's next if this is GO

1. **Validate via interviews** (1 week, 10 conversations)
2. **Pick stack final** (Capacitor MVP confirmed → Expo v1 trigger bar set)
3. **Create Apple Dev + Google Play accounts** (1 day)
4. **Spec MVP screens** (3 days, output: a Figma file + spec doc)
5. **Build Capacitor MVP** (3-4 weeks, output: TestFlight + Play
   internal track)
6. **Internal beta** (2 weeks, 20 users)
7. **Soft launch on stores** (1 week submission + review wait)

Total off-season effort to public MVP: **6-8 weeks** including review
queues.

---

## Open questions to settle before week 1

1. Push provider — OneSignal vs Expo Notifications vs Firebase Cloud
   Messaging? (Capacitor talks to all three; OneSignal is the easiest
   for non-FCM-native setups.)
2. Hindi-first UI vs English-first with a toggle? (Web is currently
   en-default with a hi toggle. App should probably ask on first run
   and remember.)
3. Anonymous use vs phone-OTP login? (Web is anonymous; app could be
   anonymous-by-default with "save phone for sponsor flow" gated.)
4. Single app for visitor + organizer, or two apps? (Recommend single
   with role-detection on first run.)
5. Indian Play Store nuances (Telecom Regulatory Authority of India,
   in-app payments via UPI)? Worth one call to a India-mobile-app
   consultant before submission.

---

## Bottom line

The app is **the right next bet, but the wrong this-Tuesday bet.**
Build in the 11-month off-season window between Bada Mangal 2026 (the
double-season ending June 23) and Bada Mangal 2027. The web app
continues to do its job. The mobile MVP is an off-season experiment
that, if it works, becomes the 2027 season's primary surface.
`;

const TAGS = ["mobile", "strategy", "roadmap", "app", "off-season"];

async function main() {
  const existing = await prisma.content.findFirst({
    where: { source: SOURCE_SLUG },
    select: { id: true },
  });
  if (existing) {
    console.log(
      `[seed] mobile-app-strategy already exists (id=${existing.id}), skipping.`,
    );
    await prisma.$disconnect();
    return;
  }
  const created = await prisma.content.create({
    data: {
      kind: "STRATEGY",
      audience: "INTERNAL",
      channel: "INTERNAL",
      language: "en",
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
