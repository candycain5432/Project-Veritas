import fs from 'fs';
import path from 'path';
import webpush from 'web-push';
import { getLiturgicalDay, toISODate } from './liturgy.js';

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:williamtylercain441@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn('[push] VAPID keys not set — push notifications are disabled');
}

// Render's free-tier disk is wiped on restart; the app re-POSTs /subscribe on
// every open so the list heals itself. Keep storage behind these two functions.
const SUBS_FILE = path.join(process.cwd(), 'subscriptions.json');

export function loadSubs() {
  try { return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8')); } catch { return []; }
}
function saveSubs(subs) {
  try { fs.writeFileSync(SUBS_FILE, JSON.stringify(subs)); } catch {}
}

// ---- Preferences ----
export const SLOTS = ['morning', 'afternoon', 'night'];
const DEFAULT_REMINDERS = { morning: '08:00', afternoon: '15:00', night: null };
const DEFAULT_TZ = process.env.DEFAULT_TZ || 'America/New_York';

function validTz(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

function cleanReminders(r, fallback = DEFAULT_REMINDERS) {
  const out = { ...fallback };
  if (r && typeof r === 'object') {
    for (const slot of SLOTS) {
      if (r[slot] === null || r[slot] === false) out[slot] = null;
      else if (typeof r[slot] === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(r[slot])) out[slot] = r[slot];
    }
  }
  return out;
}

/**
 * Accepts either a bare PushSubscription (old clients) or
 * { subscription, tz, reminders } (Anchor 9+). Upserts by endpoint.
 */
export function upsertSubscription(body) {
  const sub = body?.subscription || body;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return false;
  const subs = loadSubs();
  const existing = subs.find(s => s.endpoint === sub.endpoint);
  const record = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    tz: validTz(body.tz) ? body.tz : existing?.tz || DEFAULT_TZ,
    reminders: cleanReminders(body.reminders, existing?.reminders),
    lastSent: existing?.lastSent || {}
  };
  if (existing) Object.assign(existing, record);
  else subs.push(record);
  saveSubs(subs);
  return true;
}

export function updatePrefs({ endpoint, tz, reminders }) {
  const subs = loadSubs();
  const s = subs.find(x => x.endpoint === endpoint);
  if (!s) return false;
  if (validTz(tz)) s.tz = tz;
  s.reminders = cleanReminders(reminders, s.reminders || DEFAULT_REMINDERS);
  saveSubs(subs);
  return true;
}

export function removeSubscription(endpoint) {
  saveSubs(loadSubs().filter(s => s.endpoint !== endpoint));
}

// ---- Notification content ----
async function verseOfDay() {
  try {
    const r = await fetch('https://beta.ourmanna.com/api/v1/get/?format=json', { signal: AbortSignal.timeout(6000) });
    const d = await r.json();
    const raw = d.verse?.details?.text || '';
    const ref = d.verse?.details?.reference || '';
    const text = raw.length > 110 ? raw.slice(0, 107) + '…' : raw;
    return text ? `${text}${ref ? ` — ${ref}` : ''}` : '';
  } catch { return ''; }
}

async function payloadFor(slot, iso, shared) {
  if (slot === 'morning') {
    // `shared` memoizes lookups across all subscribers in one send.
    shared.days ??= {};
    shared.days[iso] ??= getLiturgicalDay(iso);
    shared.verse ??= verseOfDay();
    const [day, verse] = await Promise.all([shared.days[iso], shared.verse]);
    const isFeria = !day.title || day.type === 'FERIA';
    return {
      title: isFeria ? '✦ Good morning from Anchor' : `✦ ${day.title}`,
      body: verse || `${day.season} — open Anchor for today's readings.`,
      url: './?open=today'
    };
  }
  if (slot === 'afternoon') {
    return {
      title: '🙏 The Hour of Mercy',
      body: 'Pause for the Divine Mercy Chaplet — or simply pray: Jesus, I trust in You.',
      url: './?open=chaplet'
    };
  }
  return {
    title: '🌙 Close the day with God',
    body: 'Take five quiet minutes for the Daily Examen before you rest.',
    url: './?open=examen'
  };
}

/** Sends one notification per item (an item is a subscription or { sub, ... }). */
async function sendAll(items, makePayload) {
  const gone = new Set();
  const delivered = new Set();
  await Promise.allSettled(items.map(async item => {
    const sub = item.sub || item;
    const payload = await makePayload(item);
    if (!payload) return;
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload));
      delivered.add(item);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) gone.add(sub.endpoint);
      else console.warn('[push] send failed:', err.statusCode || err.message);
    }
  }));
  return { sent: delivered.size, delivered, gone };
}

function localNow(tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date()).map(p => [p.type, p.value])
  );
  return { iso: `${parts.year}-${parts.month}-${parts.day}`, minutes: +parts.hour * 60 + +parts.minute };
}

const SEND_WINDOW_MIN = 30; // tolerate a late or skipped cron tick
let ticking = false;

/** Called every ~15 min. Sends each subscriber whichever reminder is due in their timezone. */
export async function tick() {
  if (ticking) return { skipped: true };
  ticking = true;
  try {
    const subs = loadSubs();
    const shared = {};
    const due = [];
    for (const sub of subs) {
      const tz = validTz(sub.tz) ? sub.tz : DEFAULT_TZ;
      const now = localNow(tz);
      const reminders = sub.reminders || DEFAULT_REMINDERS;
      sub.lastSent ||= {};
      for (const slot of SLOTS) {
        const t = reminders[slot];
        if (!t || sub.lastSent[slot] === now.iso) continue;
        const [h, m] = t.split(':').map(Number);
        const diff = now.minutes - (h * 60 + m);
        if (diff >= 0 && diff < SEND_WINDOW_MIN) due.push({ sub, slot, iso: now.iso });
      }
    }
    const { sent, delivered, gone } = await sendAll(due, d => payloadFor(d.slot, d.iso, shared));
    // Only mark delivered slots, so a transient failure is retried on the next tick.
    for (const d of delivered) d.sub.lastSent[d.slot] = d.iso;
    // Re-read before saving so subscriptions added mid-tick aren't lost.
    const latest = loadSubs();
    const byEndpoint = new Map(subs.map(s => [s.endpoint, s]));
    saveSubs(latest
      .filter(s => !gone.has(s.endpoint))
      .map(s => ({ ...s, lastSent: { ...s.lastSent, ...byEndpoint.get(s.endpoint)?.lastSent } })));
    console.log(`[push] tick: ${sent}/${due.length} sent, ${gone.size} pruned, ${subs.length} total`);
    return { due: due.length, sent, pruned: gone.size };
  } finally {
    ticking = false;
  }
}

/** Legacy fixed-time sender (kept until cron-job.org is switched to /cron/tick). */
export async function sendDaily(type) {
  const subs = loadSubs();
  const slot = type === 'prayer' ? 'afternoon' : 'morning';
  const payload = await payloadFor(slot, toISODate(new Date()), {});
  const { sent, gone } = await sendAll(subs, () => payload);
  if (gone.size) saveSubs(loadSubs().filter(s => !gone.has(s.endpoint)));
  console.log(`[push] ${type}: sent ${sent}/${subs.length}`);
  return { sent, total: subs.length };
}
