# BadaMangal.com — Project Context for Claude Code

> This file is your project memory. Read it first in every session.
> The full product strategy & brand brief lives one directory up: `../STRATEGY.md` and `../BadaMangal-Strategy.docx`. Read STRATEGY.md when you need product/brand depth.

---

## What this is

A bilingual (Hindi + English) website that helps Lucknow find, host, and sponsor **Bada Mangal Bhandaras** — community feasts held every Tuesday of the Hindu month of Jyeshtha. Three-sided platform: **devotees** find bhandaras, **organizers (sevadars)** list them, **sponsors** (including NRIs) fund them.

Domains owned: **BadaMangal.com** (primary) and **BadaMangalBhandara.com** (301 → primary).

## Why now

2026 has **8 Bada Mangals** — the rarest cycle in 19 years (Adhik Maas). Dates:
1. May 5, 2026 — passed
2. **May 12, 2026 — next**
3. May 19, 2026
4. May 26, 2026
5. June 2, 2026
6. June 9, 2026
7. June 16, 2026
8. June 23, 2026

Goal: ship MVP for **May 19** (Tuesday after next).

---

## Stack — already decided, do not re-litigate

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 15** App Router + TypeScript | strict mode, no `any` |
| Styling | **Tailwind CSS** | No shadcn/ui; keep deps light |
| Database | **Prisma + SQLite** for dev, **Postgres (Neon)** for prod | One schema file, swap `provider` for prod |
| Map | **Vanilla Leaflet** via dynamic import in a client component | Do NOT use react-leaflet (React 19 version drift) |
| i18n | **Simple locale dictionary** in `src/content/strings.ts` with a `useT()` hook reading from URL `?lang=hi` (default) or `?lang=en`. Avoid heavy i18n libs in MVP. |
| Forms | Server actions; `zod` for validation |
| Hosting | **Netlify** | `netlify.toml` configured for Next.js runtime |
| Analytics | **Google Analytics 4** | gtag in root layout, env-gated |
| Auth | None in MVP. Organizer form is public + manually moderated. Phone OTP added Phase 2. |

Existing files at the project root that you should build on (do not re-create):
- `package.json`
- `tsconfig.json`
- `next.config.js`

---

## Brand tokens — implement these in `tailwind.config.ts`

```ts
colors: {
  saffron:  { 50: "#FFF6EE", 500: "#F2944C", 600: "#E07A1F" },
  sindoor:  { 700: "#9C2A2A" },
  gold:     { 100: "#F5EAC9", 500: "#C9A24A" },
  ink:      { 600: "#5A4F46", 900: "#1A1410" },
  cream:    { 50: "#FBF7F0" },
  leaf:     { 600: "#3F7A3F" },  // "open now" pill
  alert:    { 500: "#C44A2C" },  // "closed" pill
}
```

**Body background:** `bg-cream-50` (warmer than white). **Body text:** `text-ink-900`. Never pure white, never pure black.

**Fonts** (Google Fonts, loaded via `next/font/google`):
- Headings (Devanagari): **Tiro Devanagari Hindi**
- Headings (Latin): **Fraunces**
- Body (both scripts): **Mukta**
- Numbers / display: **Cormorant Garamond**

**Tagline:** Hindi hero `जहाँ भक्ति, वहाँ भंडारा` + English subline `Lucknow's table is always set.`

---

## File structure — target shape

```
badamangal-app/
├── CLAUDE.md                       # this file
├── BUILD-PROMPT.md                 # phased build prompts (next to read)
├── README.md
├── package.json                    # exists
├── tsconfig.json                   # exists
├── next.config.js                  # exists
├── netlify.toml                    # YOU create
├── tailwind.config.ts              # YOU create
├── postcss.config.js               # YOU create
├── .env.example                    # YOU create
├── .gitignore                      # YOU create
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── public/
│   └── (favicon, og image — placeholders ok)
└── src/
    ├── app/
    │   ├── layout.tsx              # root layout, fonts, GA, header, footer
    │   ├── page.tsx                # homepage (hero, countdown, map)
    │   ├── globals.css             # Tailwind directives + custom CSS vars
    │   ├── bhandara/[slug]/page.tsx
    │   ├── list-bhandara/page.tsx  # organizer form
    │   ├── history/page.tsx        # the 400-year story
    │   ├── admin/page.tsx          # moderation queue (basic password gate via env)
    │   └── api/
    │       └── bhandaras/route.ts  # GET (list) + POST (create pending)
    ├── components/
    │   ├── BhandaraMap.tsx         # client, dynamic Leaflet
    │   ├── BhandaraCard.tsx
    │   ├── BhandaraForm.tsx        # client, posts to API
    │   ├── CountdownTimer.tsx      # client
    │   ├── Header.tsx
    │   ├── Footer.tsx
    │   ├── LangToggle.tsx
    │   └── WhatsAppShare.tsx
    ├── content/
    │   └── strings.ts              # all UI strings: { en: {...}, hi: {...} }
    ├── lib/
    │   ├── db.ts                   # Prisma client singleton
    │   ├── dates.ts                # 8 Bada Mangals + countdown helpers
    │   ├── i18n.ts                 # tiny useT() hook + getLocale()
    │   └── lucknow.ts              # area list, default map center
    └── types/
        └── bhandara.ts
```

---

## Data model — Prisma schema sketch

```prisma
// prisma/schema.prisma
generator client { provider = "prisma-client-js" }
datasource db    { provider = "sqlite"; url = env("DATABASE_URL") }

model Bhandara {
  id            String   @id @default(cuid())
  slug          String   @unique
  name          String
  nameHi        String?
  description   String?
  descriptionHi String?
  // location
  address       String
  area          String   // "Aliganj", "Hazratganj", etc.
  landmark      String?
  lat           Float
  lng           Float
  // schedule
  tuesdayDates  String   // JSON array of ISO dates this bhandara serves
  timeStart     String   // "11:00"
  timeEnd       String   // "16:00"
  // serving
  menu          String   // JSON array: ["puri","sabzi","halwa","sherbet"]
  capacityPlates Int?
  // contact
  organizerName  String
  organizerPhone String
  organizerWhatsapp String?
  upiId         String?  // for direct sponsor flow
  // media
  photoUrl      String?
  // moderation
  status        Status   @default(PENDING)
  isSponsored   Boolean  @default(false)
  sponsorTier   String?  // "free" | "boost-500" | "boost-1000" | "boost-2000"
  // metrics
  viewCount     Int      @default(0)
  shareCount    Int      @default(0)
  // timestamps
  createdAt     DateTime @default(now())
  approvedAt    DateTime?
}

enum Status { PENDING APPROVED REJECTED ARCHIVED }
```

For SQLite, replace `enum Status` with `status String @default("PENDING")` (SQLite doesn't support enums natively in Prisma).

---

## Key features — phased

**Phase 1 — Visual baseline (target: 2 hours)**
- Tailwind theme with brand tokens
- Root layout with fonts + GA placeholder
- Homepage: hero, 8-Bada-Mangal countdown, map placeholder, 3 sample cards
- Static seed data file (no DB yet) so the page renders from minute one

**Phase 2 — Real data (target: 2 hours)**
- Prisma + SQLite, seed with ~25 Lucknow bhandaras (real-ish; spread across Aliganj, Hazratganj, Aminabad, Gomti Nagar, Indira Nagar, Chowk, Alambagh, Mahanagar)
- Replace static data with DB queries
- API route for listing
- Bhandara detail page with WhatsApp share + UPI sponsor link

**Phase 3 — Submissions (target: 2 hours)**
- Organizer submission form posting to `/api/bhandaras` (status PENDING)
- `zod` validation, server action
- Admin moderation page gated by `ADMIN_PASSWORD` env var

**Phase 4 — Polish (target: 1 hour)**
- Hindi/English toggle (`?lang=hi` default, `?lang=en` opt-in)
- History page (400-year story)
- OpenGraph image, favicon
- Netlify deploy

---

## Conventions

- **Server Components by default.** Add `"use client"` only when you need state, effects, or browser APIs (map, form, countdown).
- **No `any`.** If a type is unknown, use `unknown` and narrow.
- **All UI strings live in `src/content/strings.ts`** keyed `{ hi: {...}, en: {...} }`. Never hardcode user-facing copy in components.
- **Mobile-first.** Design for 360–414px width, then scale up. Test in DevTools Pixel/iPhone simulators.
- **Map:** load Leaflet only on the client. Use `dynamic(() => import("./BhandaraMap"), { ssr: false })`.
- **Hindi rendering:** apply `font-mukta` class to all body, `font-tiro` to Devanagari headings. Test in Android Chrome.
- **Imports:** use `@/*` path alias.
- **No emojis in committed code.**

---

## Constraints

- **Keep deps minimal.** Before adding a package, ask if Tailwind + a 20-line custom component would do.
- **No localStorage / sessionStorage** anywhere except `lang` preference (cookie preferred).
- **No external auth** in MVP. Phone OTP comes in Phase 2 of post-launch (post-June 2026).
- **No payment custody.** Sponsor flow is `upi://` deep links direct to organizer's UPI ID. We never hold money.
- **Map tiles:** OpenStreetMap (free). If we move to Mapbox later, gate by `NEXT_PUBLIC_MAPBOX_TOKEN`.

---

## Tone & voice (for any user-facing copy you write)

Devotional but not preachy. Warm, plural, inclusive. "Aap" never "tu" in Hindi. Specific over abstract — "12,000 plates of puri-sabzi from 11am at the Aliganj police chowki" beats "many devotees gather." The Bada Mangal tradition has multi-faith roots — protect that in the storytelling.

---

## When stuck

- Brand or product question? → read `../STRATEGY.md`
- Tech choice? → re-read this file's Stack section. Don't introduce new libraries without asking.
- Build order? → follow `BUILD-PROMPT.md`
