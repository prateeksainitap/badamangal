# BadaMangal.com

**The digital home of Lucknow's Bada Mangal Bhandara tradition.**

A bilingual (Hindi default + English) Next.js site that maps every Bada Mangal Bhandara in Lucknow during Jyeshtha. Three audiences:

- **Devotees** find bhandaras near them on a live map.
- **Organizers (sevadars)** list their pandals via a moderated form.
- **Sponsors** (including NRIs) fund organizers via UPI deep links: no escrow, no platform fee.

The 2026 season has **8 Bada Mangals**, the rarest cycle in 19 years. Dates: May 5, 12, 19, 26, June 2, 9, 16, 23.

> _जय श्री राम। जय हनुमान।_

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript (strict) |
| Styling | Tailwind CSS (custom brand tokens, no shadcn) |
| Database | Prisma · SQLite for dev, Postgres (Neon) for prod |
| Map | Vanilla Leaflet via dynamic import in client components |
| i18n | URL `?lang=` + `bm_lang` cookie + tiny `strings.ts` dictionary |
| Forms | Server actions + zod validation |
| OG images | `next/og` (Satori) with runtime Google Fonts fetch |
| Hosting | Netlify (`@netlify/plugin-nextjs`) |
| Analytics | GA4 via `next/script` + manual route-change `page_view` |

No external auth in MVP. The organizer form is public and manually moderated by an admin.

---

## Getting started

```bash
git clone <repo>
cd badamangal-app
cp .env.example .env
npm install
npm run db:push           # generates Prisma client + creates ./prisma/dev.db
npm run db:seed           # 25 sample listings spread across all 12 areas
npm run dev               # http://localhost:3000
```

Open the homepage. To moderate, visit `/admin` and use the password from `.env` (`changeme` by default).

---

## Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Prisma connection string. Dev: `file:./dev.db`. Prod: Neon/Supabase Postgres. |
| `NEXT_PUBLIC_SITE_URL` | yes | Canonical origin used in metadata, sitemap, share URLs. |
| `ADMIN_PASSWORD` | yes | Password for `/admin`. Stored in an `httpOnly` cookie after login. |
| `NEXT_PUBLIC_GA_ID` | no | GA4 Measurement ID (e.g. `G-XXXXXXX`). Leave empty to disable analytics. |

`.env.example` ships with sensible defaults. Never commit a real `ADMIN_PASSWORD`; set it in Netlify's env settings instead.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next dev server with hot reload |
| `npm run build` | Generates Prisma client + runs `next build` |
| `npm run start` | Serves the production build |
| `npm run lint` | `next lint` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | Pushes the schema to the configured DB and regenerates the client |
| `npm run db:seed` | Wipes & re-seeds 25 sample listings (all `APPROVED`) |
| `npm run db:studio` | Opens Prisma Studio at `localhost:5555` |

---

## Project layout

```
src/
├── app/
│   ├── layout.tsx              root layout, fonts, GA, header/footer
│   ├── page.tsx                homepage (hero, countdown, map, cards)
│   ├── globals.css             Tailwind + reduced-motion + first-letter
│   ├── icon.svg                favicon (saffron square + cream gada)
│   ├── opengraph-image.tsx     root OG (next/og)
│   ├── robots.ts / sitemap.ts  SEO
│   ├── bhandara/[slug]/
│   │   ├── page.tsx            detail page (UPI, WhatsApp, directions)
│   │   └── opengraph-image.tsx per-listing OG
│   ├── list-bhandara/page.tsx  organizer submission form
│   ├── history/page.tsx        400-year story (SEO pillar, ~1500 words)
│   ├── admin/
│   │   ├── page.tsx            moderation queue
│   │   └── actions.ts          login / approve / reject (server actions)
│   └── api/bhandaras/route.ts  GET (list) + POST (create pending)
├── components/                 BhandaraMap, Card, Form, Countdown, etc.
├── content/
│   ├── strings.ts              bilingual UI strings (hi / en)
│   └── history.ts              long-form bilingual prose
├── lib/                        db, dates, lucknow, menu, slugify, validation
├── types/bhandara.ts
prisma/
├── schema.prisma               single Bhandara model (no separate Organizer in MVP)
└── seed.ts                     ~25 listings across 12 Lucknow areas
```

### Conventions

- **Server Components by default.** `"use client"` only for interactivity (map, form, countdown, language toggle, GA tracker).
- **All UI strings** live in `src/content/strings.ts`. Never hardcode user-facing copy in components. The history prose lives in `src/content/history.ts`.
- **`@/*` path alias** maps to `src/*`.
- **Locale resolution:** `?lang=` URL param overrides the `bm_lang` cookie; both default to Hindi. Server pages call `resolveLocale({ urlLang, cookieLang })` from `@/lib/i18n`. Client components use the `useT()` hook.
- **No `any`.** Use `unknown` and narrow.

---

## Deploy to Netlify

1. **Provision a Postgres.** Neon free tier is fine. Copy the connection string.
2. **Update Prisma**:

   In `prisma/schema.prisma`, change the datasource:

   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

3. **Push the site to GitHub.**
4. **Netlify → New site from Git** → pick the repo. The bundled `netlify.toml` already declares the build command and the Next plugin:

   ```toml
   [build]
     command = "npm run build"
     publish = ".next"

   [[plugins]]
     package = "@netlify/plugin-nextjs"
   ```

5. **Set environment variables** in Site settings → Environment:

   - `DATABASE_URL`: your Neon Postgres URL
   - `ADMIN_PASSWORD`: a strong password (not `changeme`)
   - `NEXT_PUBLIC_SITE_URL`: `https://badamangal.com`
   - `NEXT_PUBLIC_GA_ID`: your GA4 Measurement ID

6. **First deploy**:

   ```bash
   # locally, after switching to postgres provider:
   DATABASE_URL=<neon-url> npm run db:push
   DATABASE_URL=<neon-url> npm run db:seed
   ```

   Then trigger a deploy in Netlify. Future migrations: run `npx prisma migrate dev` locally, commit the migration files, and add `npx prisma migrate deploy` to the build command.

7. **Domain:** point `BadaMangal.com` to Netlify; configure `BadaMangalBhandara.com` as a 301 redirect domain.

---

## Swap SQLite → Postgres for prod

The schema is identical apart from the `provider` line. Steps:

```diff
 datasource db {
-  provider = "sqlite"
+  provider = "postgresql"
   url      = env("DATABASE_URL")
 }
```

Then:

```bash
DATABASE_URL=<neon-url> npm run db:push
DATABASE_URL=<neon-url> npm run db:seed   # only on a fresh prod DB
```

The current schema stores `tuesdayDates`, `menu`, and `menuHi` as JSON-encoded strings (so the data layer is portable). Once on Postgres you may switch these to `String[]` columns if you ever want native array filtering; at that point also add a migration.

---

## Useful Claude Code prompts going forward

Past prompts that worked well in this codebase, in order:

```
Phase 5 · Sponsor flow polish:
  Each detail page already has a UPI deep link. Add (a) a 30-second
  "share-back" widget where organizers paste a photo URL after the bhandara
  finishes, and (b) a public sponsor leaderboard on each listing. Use a new
  Sponsorship model in Prisma; no escrow, just an audit trail.

Phase 6 · Phone OTP for organizers:
  Add MSG91-based OTP signup so organizers can edit their own listings
  without going back through moderation. Keep manual review for first-time
  submissions. Add a small "claim this listing" flow for already-published
  bhandaras.

Phase 7 · NRI flow:
  Add a separate /sponsor-from-abroad page that surfaces 5 hand-curated,
  verified pandals with USD/INR conversion, photo-back guarantee, and a
  10% platform fee toggle. Use Razorpay International for the payment.

Phase 8 · Year-round mode:
  Generalize the 8-Tuesday cycle into a season config (Jyeshtha 2026 →
  Saawan 2026 → Kartik 2026 etc.). Most code already keys off
  src/lib/dates.ts. Refactor that into a SeasonConfig type and let the
  organizer form pick a season.
```

Smaller pragmatic prompts:

```
"Add a 'Report this listing' button on the detail page that emails
admin@badamangal.com via Resend with the slug and the user's reason."

"Add basic rate limiting to POST /api/bhandaras: max 3 submissions per
IP per hour, in-memory for now, swap to Upstash later."

"Generate a one-page PDF flyer per bhandara with the QR code to its detail
page, for organizers to print and stick on lampposts."
```

---

## Known TODOs

- Photo upload (currently URL paste; add UploadThing or Cloudinary in Phase 4 of post-launch).
- Phone OTP for organizers (Phase 2 post-launch).
- Real-time "fresh batch / running low / closed" status from organizers.
- Push notifications.
- LMC partnership for the "Verified" badge.

---

## Credits

- Story compiled from oral tradition and Lucknow newspaper archives. Errors are the project's, not the city's.
- Color tokens, typography, and tone laid out in `../STRATEGY.md` and `CLAUDE.md`.
- Map tiles: OpenStreetMap. Fonts: Tiro Devanagari Hindi, Fraunces, Mukta, Cormorant Garamond, all on Google Fonts.

> _जहाँ भक्ति, वहाँ भंडारा।_
> _Lucknow's table is always set._
