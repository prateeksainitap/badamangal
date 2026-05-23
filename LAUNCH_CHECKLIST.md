# BadaMangal Soft-Launch Checklist

Prepared overnight while you slept. The site has been audited by three
independent passes (security, UX/QA, engineering). Everything below
is grouped by **what you MUST do before flipping the switch** vs
**what landed in code already** vs **what to watch after launch**.

The standing rule (`don't push anything online until I say so`) was
respected — **no `git push` was run, no Vercel deploy triggered**. All
changes are in your working tree, ready for you to review and commit.

---

## ⚠️  P0 — DO BEFORE DEPLOY (your hands only)

These are things I can't safely do on your behalf. Each takes 1–10 min.

### 1. Rotate every shared secret AND change the admin password
The audit confirmed `.env` + `.env.local` are gitignored and never
committed — but they exist on disk, and any past screenshare /
pair-session may have exposed them. Treat as compromised, regenerate:

- **`ADMIN_PASSWORD`** — currently `upfront-bins-respond`, three
  dictionary words, brute-forceable in hours. **Generate ≥24
  random chars** (1Password / `openssl rand -base64 24`).
- **`BOT_INGEST_SECRET`** — regenerate; then `ssh prateeksaini@prateek-macbook-pro.local`
  and update `~/Library/LaunchAgents/com.badamangal.ingest.plist` env
  block to the new value before launchctl-kicking the bot.
- **`MOD_SECRET`** (IP/phone hash salt) — regenerate.
- **`GEMINI_API_KEY`** — rotate in Google AI Studio.
- **`RESEND_API_KEY`** — rotate in Resend dashboard.
- **`SUPABASE_SERVICE_ROLE_KEY`** — rotate in Supabase Settings → API.
- **`R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY`** — rotate in
  Cloudflare R2.
- **`OLA_MAPS_SERVER_KEY`** + **`NEXT_PUBLIC_OLA_MAPS_API_KEY`** —
  regenerate at Ola Maps console; same step covers both.
- **`NEWS_REFRESH_TOKEN`** — regenerate. **Critical detail:** the
  current value in `/.env` uses curly smart quotes (`“…”`, U+201C/U+201D)
  not ASCII `"`. If the Vercel env was copy-pasted from this file the
  cron auth will silently 401 forever. Re-paste with plain ASCII
  quotes (or use the Vercel UI's text field which won't auto-curl).

Paste each new value into Vercel Project Settings → Environment
Variables → Production. Trigger a redeploy after — env changes do
not auto-apply.

### 2. Stage selectively for commit — do NOT `git add .`
Your working tree has 31 modified+untracked files. Several are
**parked** per your earlier instructions and must NOT ship:

| Status | Path | Action |
|---|---|---|
| `??` | `src/app/organise/` (directory) | Skip |
| `??` | `src/app/api/organise/` (directory) | Skip |
| `??` | `src/components/SundarKaandForm.tsx` | Skip |
| `??` | `src/components/OpeningLoader.tsx` | Skip |
| `M`  | `prisma/schema.prisma` — `model SundarKaandRequest` block (lines 452–492) | Strip before commit |

Everything else in `git status` is intentional and shippable. Suggested
selective add:

```bash
# Stage what should ship; leave parked files out
git add prisma/schema.prisma  # then manually strip SundarKaandRequest block
git add src/app/admin/actions.ts src/app/admin/edit-spot/ src/app/admin/page.tsx
git add src/app/admin/discover/ src/app/admin/mentions/
git add src/app/api/admin/discover-bhandaras/ src/app/api/admin/ingest-screenshot/
git add src/app/api/bot/community-stats/ src/app/api/bot/message/ src/app/api/bot/heartbeat/
git add src/app/api/mentions/ src/app/api/spots/route.ts
git add src/app/api/volunteer/signup/route.ts
git add src/app/page.tsx src/app/sitemap.ts
git add src/components/Footer.tsx src/components/StatsSection.tsx
git add src/components/LiveChatterBoard.tsx src/components/MentionHeatmap.tsx
git add src/components/AdminLiveRefresh.tsx src/components/admin/AdminLiveRefresh.tsx
git add src/components/admin/ScreenshotIngestPanel.tsx src/components/admin/MapLocationInput.tsx
git add src/content/strings.ts src/lib/crypto.ts src/lib/fileValidate.ts
git add src/lib/geocodeServer.ts src/lib/olaMaps.ts src/lib/profanity-filter.ts
git add src/lib/stats.ts src/lib/vision.ts tailwind.config.ts
git add scripts/bm-ingest-text-patch.mjs scripts/clean-test-mentions.ts scripts/count-mentions.ts
git add LAUNCH_CHECKLIST.md
```

Verify with `git status` — only the 4 parked items should be left as `??`.

### 3. Apply the BhandaraMention schema to prod DB
The model exists in `prisma/schema.prisma` (lines 525–577) and is
referenced by 4 deployed endpoints. The table was created in dev via
raw SQL — verify it's also in prod, OR run `prisma db push` against
prod after committing. Quick check:

```bash
psql "$PROD_DATABASE_URL" -c '\d "BhandaraMention"' | head -20
```

If the table is missing, prod will 500 on first POST to
`/api/bot/message` and 500 on the homepage SSR query.

### 4. Restart the WhatsApp bot AFTER Vercel deploy completes
The bot's `STATS_URL` + `MESSAGE_URL` were reverted on disk back to
`https://badamangal.com/...` (was pointing at the local cloudflared
tunnel during dev). The IN-MEMORY URLs are still the tunnel until you
restart the process:

```bash
ssh prateeksaini@prateek-macbook-pro.local 'launchctl kickstart -k gui/$(id -u)/com.badamangal.ingest'
ssh prateeksaini@prateek-macbook-pro.local 'tail -n 50 -f ~/Library/Logs/bm-ingest/stdout.log'
# Expect: "[stats] POST 200 ..." within ~12 s of restart.
```

Do this AFTER the Vercel deploy succeeds, otherwise the bot will
POST to live URLs that 404 until the new endpoints land.

### 5. Confirm prod env vars
The 21 prod env vars are documented in the "env" section below. Cross-
check Vercel Settings → Environment Variables against that list. The
audit specifically called out: missing `BOT_INGEST_SECRET` → bot stops;
missing `GEMINI_API_KEY` → all /scan + /message POSTs 502; missing
`DATABASE_URL` → boot crash.

---

## ✅  What I already fixed in code (no action needed from you)

### UI / UX
1. **Removed orange borders** from chat + map cards; merged into one
   shared frosted-glass frame.
2. **Improved mention-density legend** — frosted pill bar, breathing
   chip dots, dividers, green pulse on active-zones counter.
3. **LIVE pill** moved into Live chat header, swapped saffron gradient
   for black + green pulse dot, hides cleanly when count is 0.
4. **Live chat header** uses a proper SVG chat bubble glyph (was 💬).
5. **WhatsApp glyph redesigned** (canonical Simple Icons path), plus
   composite tiles: group = people glyph + WA badge, channel =
   megaphone + WA badge. Applied to homepage cards + footer rows.
6. **Mobile chat panel** now has fixed `h-[28rem]` so the chat body
   scrolls internally instead of expanding the page.
7. **Stats panel layout**: 2/3/5-col responsive grid (was 4 + orphan
   row), numbers bumped to sindoor-700 at 3xl/4xl bold with warm
   shadow for visibility.
8. **WhatsApp hero number** (9,650+) rendered at clamp(2.75rem, 6.5vw,
   4.5rem) extrabold white with emerald glow — visible from across
   the room.
9. **Per-card member counts** at clamp(1.9rem, 3.4vw, 2.5rem) white
   extrabold with emerald shadow; "members" reduced to label.
10. **Section reorder** — LiveChatterBoard now sits ABOVE the listed
    bhandara cards, right after HappeningNow.
11. **ASKING messages** suppress map pins, Directions CTA, photo→map
    deep-link, AND area-count chips. DB row keeps coords for admin.
12. **WhatsApp tile in footer** matches homepage icon scheme.
13. **WCAG AA contrast fix** — added `leaf-400` (#5DAE5D) for any
    leaf-coloured text on dark backgrounds (the existing `leaf-600`
    failed 4.5:1 on ink-900). Swapped 6 usages in LiveChatterBoard.

### Security
14. **XFF spoof fix** (`src/lib/crypto.ts`) — `readClientIp` now
    prefers platform-trusted headers (`x-vercel-forwarded-for` →
    Cloudflare → Netlify → x-real-ip), and falls back to the
    RIGHT-most XFF entry not the left-most. Closes the per-IP rate-
    limit bypass on every endpoint that uses `ipHash(readClientIp(...))`.
15. **`/api/spots` photo URL allowlist** — `photoUrl` + each entry of
    `extraPhotoUrls` must now resolve to `*.supabase.co`,
    `*.r2.cloudflarestorage.com`, `*.r2.dev`, `*.badamangal.com`, or
    `/uploads/*`. Closes the homepage `<img src=…>` injection.
16. **Volunteer-signup rate limit restored** — 5/IP/24h. Closes the
    storage-DoS vector through the volunteer upload quota.
17. **`/api/mentions/feed` originalText leak** — fallback path now
    runs through `stripBotProvenance` so a null `cleanedText` row
    can't ship raw `[bot:from:Sharma · msg:wa-abc-123 …]` provenance
    to the public JSON.
18. **`/api/bot/heartbeat`** now Bearer-gated (was public DB-write).
    No legitimate caller broke — nothing currently pings it.
19. **HEIC client/server alignment** — stripped HEIC/HEIF from the
    client allowlist so iPhone "Most Efficient" uploads now surface
    the helpful "switch to Most Compatible" guidance instead of a
    generic 415 from the server.

### Engineering
20. **Gemini Vision retry + 12s timeout** — was failing every
    transient 503 with no recovery and could hang the Vercel function.
21. **Geocode fetches** (Ola Maps × 3 + Nominatim × 1) now all have
    5s `AbortSignal.timeout()`.
22. **`/api/bot/message` `maxDuration = 20`** — was relying on the
    default 10s which could be exceeded by a Gemini-retry path.
23. **Sitemap** — added `/volunteer`, `/faq`, `/gallery` (were
    missing).

### Bot (Baileys, on the spare Mac)
24. **Community-stats push wired** — bot enumerates all groups every
    30 min, sums per-community + per-group counts, POSTs to
    `/api/bot/community-stats`. Live numbers from the most recent
    push: **9,651 members across 2 communities + 1 group + 1
    channel** (3,975 Bada Mangal Community / 3,572 Balaji Ka Bhandara
    Community / 930 Bhandara Group / 1,174 Jai Shree Ram Channel
    followers).
25. **Tunnel URLs reverted to production** in `~/bm-ingest/bot.mjs`
    (with backup at `bot.mjs.bak.preProdRevert-…`).

### Data cleanup
26. **Test mentions deleted** — 30 test rows (multi-loc-test, merge-*,
    claude-*, BM Ingest 2 group, smoke group) removed from
    BhandaraMention. 11 real-group rows kept as starter content; they
    expire naturally via 24h TTL. Spot table untouched (no test
    spots were promoted).

---

## 🟡  Open items deferred (P1/P2 — fix this week, not today)

Documented for transparency; nothing here is a launch-blocker:

| # | Issue | Fix |
|---|---|---|
| L1 | Rate limiter is in-memory; ineffective across serverless instances | Lower caps + add Cloudflare/Netlify edge rules in front of `/api/*`; plan DB-backed limiter later |
| L2 | `/api/pamphlet/ai-fill` uses bespoke (spoofable) IP rate-limit | Replace `clientIp()` with `ipHash(readClientIp(...))` + `checkRateLimit` |
| L3 | Admin scan rate-limits keyed on IP not session | Key on `"admin:" + cookie.value` so quota follows the session |
| L4 | LiveChatterBoard is English-only | Wire `useLocaleFromContext`, add Hindi strings |
| L5 | MentionHeatmap fallback (no Ola key) lopsides the grid | Wrap fallback in matching `chatter-glass` shell |
| L6 | OG `locale` field is `en_IN` on /, `hi_IN` on /spot, /list-bhandara, etc. | Pick one site-wide default |
| L7 | No global error monitoring (Sentry/PostHog) | Drop a minimal `error.tsx` per route segment in 30 min, real telemetry next week |
| L8 | DB count() per POST on `/api/contact`, `/api/organise-request`, `/api/spots` | Extend `checkRateLimit` to cover these, short-circuit before DB |
| L9 | `Spot.bhandaraId` + `BhandaraMention.bhandaraId` missing `@@index` | Add when row counts grow |
| L10 | `images.remotePatterns: ['**']` (wildcard) in `next.config.js` | Tighten to known hosts |
| L11 | No `security.txt`, no per-route `error.tsx` | Add over the week |
| L12 | Add per-IP login lockout on `loginAction` (5 attempts / 15 min) | Use existing `checkRateLimit` — 10-minute change |

---

## 🧪  Pre-deploy smoke tests (run AFTER Vercel deploy)

These confirm the new endpoints work in prod. Replace `https://badamangal.com`
if you're using a preview URL.

```bash
# 1. Homepage + key routes return 200
for path in / /map /live /spot /list-bhandara /contact /faq /resources \
            /history /archive /admin /robots.txt /sitemap.xml \
            /api/bhandaras /api/spots /api/mentions/feed; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" -m 10 "https://badamangal.com$path")
  echo "  $code  $path"
done
# Expect: all 200 except /map (404 — no such route, expected).

# 2. /api/bot/community-stats GET returns the live total
curl -sS https://badamangal.com/api/bot/community-stats
# Expect: {"ok":true,"id":"community_total_members","count":9651,...}

# 3. /api/bot/message rejects without auth
curl -sS -X POST https://badamangal.com/api/bot/message -H 'content-type: application/json' -d '{}'
# Expect: {"ok":false,"error":"forbidden"} with HTTP 403

# 4. /api/bot/heartbeat now requires auth
curl -sS https://badamangal.com/api/bot/heartbeat
# Expect: {"ok":false,"error":"forbidden"} with HTTP 403

# 5. /api/mentions/feed returns the unified stream
curl -sS 'https://badamangal.com/api/mentions/feed?limit=10'
# Expect: {"count":N,"mentions":[...]} with N >= 11 (the kept starter mentions)
```

---

## 🧪  Manual QA cases (run in browser after deploy)

Target sequence — ~15 minutes, covers every public surface that
changed in this session:

### Homepage (desktop, then mobile via DevTools toggle)
- [ ] Hero loads; Hanuman illustration crisp; halo rotates slowly
- [ ] Countdown timer shows time-to-next-Tuesday in IST (or "Today is" banner if it's a Tuesday)
- [ ] MapBoard pins render; clicking a pin opens the bhandara card
- [ ] HappeningNow shows live spots if any are within 8h
- [ ] **LiveChatterBoard sits HERE** (above the listed bhandaras grid) — confirm reorder landed
- [ ] Map + chat sit in ONE shared frosted card (no double borders)
- [ ] Chat panel on mobile: scrollable inside its 28rem container, doesn't expand page
- [ ] LIVE pill in chat header shows mention count
- [ ] "Connected" indicator on the right with green pulse dot
- [ ] At least one chat bubble visible with `~ Name` sender format
- [ ] **No `Directions` CTA on ASKING bubbles** (those show "is asking" intent)
- [ ] No location pill on ASKING bubbles
- [ ] Active-areas chips do not include any area that appears only via ASKING messages
- [ ] BhandaraCardsSection grid renders below the chatter section
- [ ] StatsSection has 5 tiles in one row on desktop (Listed · Spotted · Areas · Tuesdays · Community); 9,651 (or current value) on the Community tile
- [ ] Stats numbers are BIG and bold (sindoor-700, 3xl/4xl)
- [ ] "Join the chat on WhatsApp" section shows hero total (white, ~4.5rem) with green LIVE pulse
- [ ] Each WhatsApp card shows: per-kind glyph in green tile + WA badge bottom-right (community = WA alone, group = people, channel = megaphone)
- [ ] Member counts on cards are HERO-size (white extrabold + emerald glow)
- [ ] Footer "Join the chat on WhatsApp" tile rows match homepage scheme
- [ ] No console errors in DevTools after a full scroll-through

### Forms
- [ ] `/list-bhandara` — fill, upload a JPG, submit; success state visible
- [ ] `/list-bhandara` — try uploading a HEIC: get the helpful "switch to Most Compatible" message (not a generic 415)
- [ ] `/spot` — drop a pin in Lucknow, add caption, submit; should appear on the map within ~30s
- [ ] `/spot` — try POSTing via curl with `photoUrl: "https://evil.com/x.gif"` → expect 400 with the host-allowlist error
- [ ] `/contact` — submit a test message, expect Resend email + row in `/admin`
- [ ] `/volunteer/signup` — sign up, get a `BM-LKO-XXXXXX` code; signup #6 from same IP should 429

### Admin
- [ ] `/admin` — login with the NEW rotated password
- [ ] Mentions queue shows real WhatsApp traffic; approve/reject works
- [ ] Spots queue shows new spots; map shows pin
- [ ] Discover-bhandaras admin tool returns results (Gemini grounded search)

### Bot pipeline (only confirms after bot restart in step 4 above)
- [ ] Send a message in a real bhandara WhatsApp group (`Bhandara at <area> 11 AM today`)
- [ ] Within ~10s, message appears in `/admin?type=mentions` as APPROVED
- [ ] Within ~12s, message appears on the homepage LiveChatterBoard
- [ ] If the message has a WhatsApp Location share, a Spot pin appears on MapBoard within ~60s (next ISR revalidate)
- [ ] Send a location share + text "bhandara at X" → confirm the auto-Spot also creates

---

## 📊  Watch in the first 24h after launch

- **Vercel Function Logs** — search for: `Timed out fetching a new connection`,
  `Gemini API error`, `classify_failed`. Spikes here = traffic pressure or
  Gemini outage.
- **Supabase Dashboard → Database → Active connections** — should stay
  under the pool limit. If it red-lines, the `connection_limit=1` in
  `DATABASE_URL` is the lever (see audit P1 eng #4).
- **`/api/bot/community-stats` GET** every couple hours — confirm the
  number is moving (proves bot is alive + pushing).
- **Email inbox** for contact/organise submissions — confirms Resend is
  flowing.
- **Admin mentions queue** — confirms classifier isn't 502'ing and
  profanity filter is catching what it should.

---

## 📋  Env var checklist (Vercel → Project → Settings → Env Vars)

Server-only (do NOT prefix `NEXT_PUBLIC_`):
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OLA_MAPS_SERVER_KEY`
- `ADMIN_PASSWORD`
- `MOD_SECRET`
- `GEMINI_API_KEY`
- `BOT_INGEST_SECRET`
- `RESEND_API_KEY`
- `CONTACT_EMAIL_TO`
- `NEWS_REFRESH_TOKEN` (verify ASCII quotes!)
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL`

Client-exposed:
- `NEXT_PUBLIC_OLA_MAPS_API_KEY`
- `NEXT_PUBLIC_SITE_URL` (= `https://badamangal.com`)
- `NEXT_PUBLIC_GA_ID`
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`

Drop (no longer referenced in source):
- `ANTHROPIC_API_KEY`

---

🙏  May Hanuman Ji bless the launch. Ping me when you wake up if
anything's unclear.
