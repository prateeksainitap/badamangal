# Live comment feed — auto-moderated, secure, no nudity

> Goal: a live, moving stream of comments + photo posts about Bada Mangal bhandaras across Lucknow, with strong automated moderation so we never publish slurs, hate, NSFW, or spam.

---

## 1. Where the feed lives

Two surfaces:

**Surface A — homepage strip**
A horizontally scrolling marquee of the **last 12 approved posts**, slowed to a comfortable read pace, pausable on hover. Each card shows: avatar (auto-generated from name initial in a saffron circle), display name, location tag (e.g., "Aliganj"), and the comment text or thumbnail of a photo. Tapping a card opens the bhandara detail page if linked, else expands a modal.

**Surface B — per-bhandara detail page**
Below the bhandara hero, a comments section showing posts attached to that specific bhandara. Submit form at the top: name (required), phone (required, OTP'd), text or photo, "Post" button.

---

## 2. Submission rules

- **Identity:** name + phone (OTP-verified once per browser; persisted in cookie). No anonymous posting.
- **Length:** comment text 5–500 chars.
- **Photo:** optional, max 5MB, JPG/PNG/WebP. One photo per post.
- **Rate limit:** 1 post per phone per 60 seconds, max 10/day per phone.
- **No links:** strip any URL from comment text on submit (or block submission). Whitelist for badamangal.com only.
- **Cooldown after rejection:** 1 rejected post → 5 min cooldown; 3 rejected → 1 hour; 5 rejected → 24 hour shadowban (still appears posted to the user, doesn't appear publicly). All with notice in UI.

---

## 3. Moderation pipeline (auto)

Every submission goes through this gauntlet **before** it appears in the feed. If any stage rejects, the post is marked `REJECTED` and never published; the user sees a generic "Your post is being reviewed" message regardless of stage outcome (we don't tell them what triggered it — that helps spammers).

```
[POST] -> [Stage 1: structural] -> [Stage 2: text classifier] -> [Stage 3: text LLM] -> [Stage 4: image classifier] -> [Stage 5: rate-limit + dedup] -> [PUBLISHED]
```

### Stage 1 — Structural checks (instant)
- Length within bounds.
- No URLs or contact info (regex: phone numbers, emails, t.me/, wa.me/, instagram.com/...).
- No more than 3 emojis.
- Phone OTP cookie verified.

### Stage 2 — Text profanity / slur filter (instant, offline)
Use **`@2toad/profanity`** with a custom dictionary covering English, Hindi (Roman + Devanagari), and Lucknow-specific slurs. Maintain the dictionary in `src/lib/moderation/banned-terms.ts` — keep it private, don't commit on a public repo with leetspeak variants.

The filter must catch:
- Profanity
- Caste slurs
- Religious slurs against any community (Bada Mangal is multi-faith — protect this aggressively)
- Sexual content references
- Communal incitement keywords

Tools:
- npm: `@2toad/profanity` for the engine
- Add Hindi term list manually (the public packages are weak on Hindi)
- Test with a fixture file of known-bad strings before each release

### Stage 3 — Text LLM moderation (50-200ms)
Even after profanity passes, run the text through a moderation LLM for nuance — sarcastic hate, dog-whistles, communal coding.

Options (pick one):
- **Anthropic Moderation** via `claude-haiku-4-5-20251001` — cheap, multilingual, strong on Indian context. Recommended.
- **OpenAI moderation API** (`omni-moderation-latest`) — cheaper but weaker on Hindi.

Prompt (Anthropic Haiku):

```
You are a moderator for an inclusive Hindu festival website (Bada Mangal in Lucknow). The site is multi-faith — protect that. Reject content that contains:
- Hate, slurs, or harassment of any community (Hindu, Muslim, Sikh, Christian, caste, gender, region)
- Sexual content
- Threats or incitement
- Spam, promotion of unrelated services
- Instructions to break laws

Approve content that is devotional, joyful, kind, factual, or constructive — even if it expresses strong devotion.

Respond ONLY in JSON: {"action": "approve" | "reject", "category": "<short reason if reject, else null>"}.

Comment:
"""
${text}
"""
```

Cache decisions for 7 days by hash to save costs on duplicate texts.

### Stage 4 — Image classifier (if photo) (200-500ms)
- **NSFW + nudity:** use **NSFWJS** (TensorFlow.js, runs in Node) for an offline check. Reject if `Porn` or `Hentai` or `Sexy` ≥ 0.4 confidence.
- **Violence / gore:** use Cloudflare Images' built-in moderation OR Sightengine (paid) OR AWS Rekognition `DetectModerationLabels`.
- **Reverse-image-search check:** optional, hash with `imghash` and dedupe against a set of known-bad hashes maintained server-side.
- **Faces of minors:** if the image contains any detected face under threshold age (use AWS Rekognition `DetectFaces` with age estimation), reject by default — protect children.

If any check rejects, the photo is dropped and the post is rejected.

### Stage 5 — Rate limit + dedup (instant)
- Hash the comment text + image; reject if same hash posted in last 24h from same phone (anti-spam).
- Apply rate limits from §2.
- If passes, `INSERT` row with `status=APPROVED`, broadcast to live channel.

---

## 4. Real-time delivery

Two simple options. Prefer **Server-Sent Events (SSE)**.

**Option A — SSE (recommended)**
- Endpoint: `GET /api/feed/stream` returns `text/event-stream`.
- New approved posts push down the stream; clients render top-of-feed.
- Auto-reconnect on disconnect.
- Lightweight, no websocket overhead.

**Option B — Polling**
- `/api/feed?since=${timestamp}` polled every 8 seconds.
- Cheaper, simpler, fine for first season.

Pick **Option B for week-1 launch**, migrate to SSE in Phase 2 if traffic warrants.

---

## 5. Data model

```prisma
model Post {
  id             String   @id @default(cuid())
  bhandaraId     String?  // optional: post may be unattached (general comment)
  bhandara       Bhandara? @relation(fields: [bhandaraId], references: [id])
  // identity
  authorName     String
  authorPhoneHash String  // sha256(phone) — never store raw phone in the post
  // content
  text           String?
  photoUrl       String?
  language       String   // "hi" | "en" | "mixed"
  // moderation
  status         String   @default("PENDING") // PENDING | APPROVED | REJECTED | SHADOWED
  rejectReason   String?
  modSignals     Json?    // { profanityHit: true, llmCategory: "hate", nsfw: 0.7 }
  // metadata
  createdAt      DateTime @default(now())
  approvedAt     DateTime?
  ipHash         String   // for abuse tracking, hashed
  userAgent      String?
}

model PhoneVerification {
  phoneHash    String   @id // sha256(phone)
  verifiedAt   DateTime @default(now())
  postCount    Int      @default(0)
  lastPostAt   DateTime?
  blockedUntil DateTime?
}
```

Always store `phoneHash`, never raw phone. Salt the hash with a server secret.

---

## 6. UX details

- **Live feed is opt-in to render** with `prefers-reduced-motion`: on reduced motion, show a static list, no marquee.
- **Time stamps** in human relative format ("2 min ago"), with a refreshing tick.
- **Photo treatment**: 16:9 thumbnails with a subtle 1px gold border; click opens a lightbox. Photos always have `loading="lazy"`.
- **Trust signals**: a small "Auto-moderated" tag in the section heading: "Live from Lucknow · auto-moderated".
- **Reporting**: a small report flag on each post; clicking it sets `reportCount += 1`. Auto-archive when reportCount ≥ 3 pending admin review.
- **My posts**: a small "My posts" link that filters to the user's own posts (uses cookie to identify), so they can see what they posted.

---

## 7. Admin override panel

`/admin/feed` (gated by `ADMIN_PASSWORD` cookie):

- Live ticker of incoming posts.
- One-click approve / reject / shadowban.
- "Block phone for 7 days" button.
- "Add this term to banned list" button (auto-updates `banned-terms.ts`).
- "Re-run moderation on last 100" button (useful when classifier has been retuned).

---

## 8. Privacy & legal

- Privacy policy must explicitly state: phone is OTP'd, hashed, used only for moderation, never sold or shared.
- IP addresses hashed before storage.
- Comply with India's IT Rules 2021 for intermediary platforms (we are one once we accept user content):
  - Provide a Grievance Officer email in the footer.
  - Respond to takedown requests within 36 hours per the Rules.
- Photo upload TOS: posters confirm they have rights to the photo and grant the site display rights.
- Add a clear "Don't include faces of minors without consent" line on the upload form.

---

## 9. Cost estimates (Lucknow scale)

- LLM moderation: ~₹0.005/comment via Haiku → ₹500/100K comments. Negligible.
- NSFWJS: free (runs locally).
- Photo storage: Netlify Image CDN free tier covers first season. After ~1K photos/month, switch to Cloudflare R2 (₹0.015/GB/month).
- SMS OTP: ₹0.20–0.30 per OTP via MSG91. Plan for 500–2000 OTPs/season → ₹100–600.

Total moderation infrastructure: **under ₹2000 for the entire season.**

---

## 10. Acceptance test

Pre-launch, post these test inputs and verify:

| Input | Expected |
|---|---|
| Plain devotional comment in Hindi | ✅ approved |
| Plain devotional comment in English | ✅ approved |
| Slur in Hindi (Devanagari) | ❌ rejected (Stage 2) |
| Slur in Hindi (Roman) | ❌ rejected (Stage 2) |
| Polite-sounding hate dog-whistle | ❌ rejected (Stage 3) |
| Sexual joke | ❌ rejected (Stage 2 or 3) |
| Photo of nude figure | ❌ rejected (Stage 4) |
| Photo of food spread | ✅ approved |
| Spam URL "click here for free deal" | ❌ rejected (Stage 1) |
| Same exact comment posted twice in 1 minute | ❌ second rejected (Stage 5) |
| 11th post in same day from same phone | ❌ rejected (rate limit) |

If any of these fail, fix before launch.
