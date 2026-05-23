/**
 * Patch for ~/bm-ingest/bot.mjs on the spare Mac.
 *
 * Drops a second `messages.upsert` listener onto your existing Baileys
 * `sock` that forwards text + location messages to /api/bot/message
 * (and lets the existing image handler keep doing its thing untouched).
 *
 * Why a second listener instead of patching the existing one:
 *   • Additive, zero risk of breaking your image flow.
 *   • Baileys allows N listeners on the same event; each gets every
 *     message. The image handler and this one independently decide
 *     whether to act based on message type.
 *   • Easy to delete later if we ever want to disable text ingest:
 *     remove this block, restart the bot, done.
 *
 * What to do:
 *   1. SSH to the spare Mac (or open Terminal directly on it).
 *   2. nano ~/bm-ingest/bot.mjs
 *   3. Paste the block below at the END of the file (after every
 *      existing line). It assumes `sock`, `INGEST_URL`, and the
 *      `BOT_INGEST_SECRET` env var are already in scope — they are
 *      in the existing bot. If you renamed those, update the three
 *      references marked with "ASSUMPTION" below.
 *   4. Save (Ctrl-O, Enter), exit (Ctrl-X).
 *   5. Restart the launchd-managed bot:
 *        launchctl kickstart -k gui/$UID/com.badamangal.bot
 *      (replace the label with whatever your plist uses — `launchctl
 *      list | grep badamangal` will show it.)
 *   6. Watch the log:
 *        tail -F ~/bm-ingest/bot.log | grep -E "text|location|message"
 *   7. From your personal phone, drop a text into BM Ingest 2:
 *        Bhandara at Ram Mandir, Sector E, Aliganj — 11 AM aaj
 *      Then check badamangal.com/admin/mentions for the PENDING row.
 *
 * If anything errors, paste the log lines back to me.
 */

// ════════════════════════════════════════════════════════════════════
//  Paste from HERE down into ~/bm-ingest/bot.mjs
// ════════════════════════════════════════════════════════════════════

// ─── TEXT + LOCATION INGEST → /api/bot/message ─────────────────────
//
// Sibling of the existing image-ingest listener. Forwards any
// non-image, bhandara-relevant message (plain text, reply text,
// WhatsApp Location share) into the website's mention pipeline so
// the homepage heatmap + chatter feed populate from live chat.
//
// Reads:
//   - sock                 ASSUMPTION: your Baileys socket var
//   - INGEST_URL           ASSUMPTION: e.g. https://badamangal.com/api/bot/ingest
//   - process.env.BOT_INGEST_SECRET  ASSUMPTION: same secret as image flow
//
// If any of those don't match the names in your bot.mjs, rename the
// three references below.

const MESSAGE_URL = INGEST_URL.replace(/\/api\/bot\/ingest\/?$/, "/api/bot/message");

/** Lucknow bounding box; matches the server-side filter. Coords outside
 *  this box are still posted (the server validates and just stores
 *  `null` for lat/lng), but we skip the wire if the share is obviously
 *  out-of-region to save Gemini quota. */
const LKO_BBOX = { latMin: 26.6, latMax: 27.0, lngMin: 80.7, lngMax: 81.2 };
const inLucknow = (lat, lng) =>
  lat >= LKO_BBOX.latMin && lat <= LKO_BBOX.latMax &&
  lng >= LKO_BBOX.lngMin && lng <= LKO_BBOX.lngMax;

/** Extract the message text from any of Baileys' three text-message
 *  shapes. Returns "" when the message has no text at all (e.g. it's
 *  a sticker / video / system message). */
function extractText(m) {
  return (
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    m.message?.imageMessage?.caption ||
    ""
  ).trim();
}

/** Extract { lat, lng, caption } from a Baileys location message,
 *  or null if the message isn't a location share. */
function extractLocation(m) {
  const loc = m.message?.locationMessage;
  if (!loc || typeof loc.degreesLatitude !== "number" || typeof loc.degreesLongitude !== "number") {
    return null;
  }
  return {
    lat: loc.degreesLatitude,
    lng: loc.degreesLongitude,
    caption: (loc.name || loc.address || "").trim(),
  };
}

/** Resolve the sender's display name. Baileys gives us `pushName` on
 *  the message envelope for incoming messages; fall back to the
 *  participant JID's user part when that's missing. */
function senderDisplayName(m) {
  if (m.pushName && m.pushName.trim()) return m.pushName.trim();
  const participant = m.key?.participant || m.key?.remoteJid || "";
  const userPart = participant.split("@")[0] || "";
  return userPart || "WhatsApp sender";
}

/** Look up the group's display name. Caches results so we don't ask
 *  Baileys for groupMetadata on every message. Falls back to the JID
 *  when the metadata fetch fails (private groups + recently-added bots
 *  sometimes 404 here for a few minutes). */
const groupNameCache = new Map();
async function groupDisplayName(jid) {
  if (groupNameCache.has(jid)) return groupNameCache.get(jid);
  try {
    const meta = await sock.groupMetadata(jid);
    const name = meta?.subject || jid;
    groupNameCache.set(jid, name);
    return name;
  } catch {
    groupNameCache.set(jid, jid);
    return jid;
  }
}

/** Single POST helper. Mirrors the existing image-ingest pattern but
 *  hits /api/bot/message instead. Logs status + a short slice of the
 *  response body so you can grep the bot log for what got created. */
async function postBotMessage(body, kindLabel) {
  try {
    const res = await fetch(MESSAGE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.BOT_INGEST_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const txt = await res.text();
    let json;
    try { json = JSON.parse(txt); } catch { json = { raw: txt }; }
    console.log(
      `[message:${kindLabel}] ${res.status} → ${JSON.stringify(json).slice(0, 220)}`,
    );
    return json;
  } catch (err) {
    console.error(`[message:${kindLabel}] network error:`, err?.message || err);
    return null;
  }
}

// In-memory dedup across reconnects — same belt-and-braces pattern as
// the image listener. Server also dedupes on msgId, but skipping the
// wire saves a Gemini call and a log line.
const seenMessageIds = new Set();

sock.ev.on("messages.upsert", async ({ messages, type }) => {
  if (type !== "notify") return;
  for (const m of messages) {
    try {
      // Only act on group messages, never DMs. The image listener
      // applies the same filter; mirror it so the two stay symmetric.
      const jid = m.key?.remoteJid || "";
      if (!jid.endsWith("@g.us")) continue;
      // Skip our own messages (we never auto-reply, but defence in
      // depth: if some future code does, we don't want to loop).
      if (m.key?.fromMe) continue;

      const msgId = m.key?.id || "";
      if (msgId && seenMessageIds.has(msgId)) continue;
      if (msgId) seenMessageIds.add(msgId);

      // Skip images entirely — that's the existing listener's job.
      // We pick up the caption on the image-ingest side already.
      if (m.message?.imageMessage) continue;

      const groupName = await groupDisplayName(jid);
      const senderName = senderDisplayName(m);

      // ── Location share ────────────────────────────────────────
      const loc = extractLocation(m);
      if (loc) {
        if (!inLucknow(loc.lat, loc.lng)) {
          console.log(
            `[message:location] skip (out-of-bbox) lat=${loc.lat.toFixed(4)} lng=${loc.lng.toFixed(4)}`,
          );
          continue;
        }
        const text = loc.caption ||
          `Location shared: ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`;
        await postBotMessage({
          text,
          groupName,
          senderName,
          msgId,
          locationLat: loc.lat,
          locationLng: loc.lng,
        }, "location");
        continue;
      }

      // ── Plain text / extended text ────────────────────────────
      const text = extractText(m);
      if (!text) continue;
      // Skip pure-emoji or super-short noise — the server's
      // classifier would route to UNRELATED anyway. Two chars is a
      // generous floor; "ok" / "ji" / "👍" all skip; "AKA" passes.
      if (text.length < 3) continue;

      await postBotMessage({
        text,
        groupName,
        senderName,
        msgId,
      }, "text");
    } catch (err) {
      console.error("[message] handler error:", err?.message || err);
    }
  }
});

console.log(`[bot] text + location ingest listener attached → ${MESSAGE_URL}`);

// ════════════════════════════════════════════════════════════════════
//  Paste UP TO HERE (this final console.log is the end of the patch).
// ════════════════════════════════════════════════════════════════════
