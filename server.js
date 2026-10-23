import 'dotenv/config';
import express from 'express';
import { rateLimit } from './src/ratelimit.js';
import { buildChat, chatOnce, chatStream, rememberLegacy, dailyReflection, lectioPrompts, composePrayer, MODEL } from './src/ai.js';
import { upsertSubscription, updatePrefs, removeSubscription, tick, sendDaily, loadSubs } from './src/push.js';
import { parseISODate, toISODate } from './src/liturgy.js';

const app = express();
app.set('trust proxy', 1); // Render sits behind one proxy; needed for per-IP rate limits
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});
app.options('*', (_req, res) => res.sendStatus(200));
app.use(express.json({ limit: '64kb' }));

const chatLimit    = rateLimit({ name: 'chat',    max: 20, windowMs: 5 * 60 * 1000 });
const composeLimit = rateLimit({ name: 'compose', max: 6,  windowMs: 10 * 60 * 1000 });
const generalLimit = rateLimit({ name: 'general', max: 60, windowMs: 5 * 60 * 1000 });

/** Accepts YYYY-MM-DD within ±2 days of server time (or old clients' toDateString()). */
function requestDate(raw) {
  let d = parseISODate(raw) || (raw ? new Date(raw) : null);
  if (!d || isNaN(d)) d = new Date();
  const days = Math.abs(d - new Date()) / 86400000;
  return toISODate(days > 2.5 ? new Date() : d);
}

// ---- Chat ----
// Messages are never logged or written to disk.
app.post('/chat', chatLimit, async (req, res) => {
  const chat = buildChat(req.body);
  if (chat.error) return res.status(400).json({ error: chat.error });
  try {
    const reply = await chatOnce(chat.messages);
    if (chat.legacy) rememberLegacy(req.body.sessionId, chat.message, reply);
    res.json({ reply });
  } catch (err) {
    console.error('[chat] OpenAI error:', err.status || err.message);
    res.status(500).json({ error: 'Failed to contact the AI service.' });
  }
});

// Server-Sent Events: `data: {"t":"..."}` per chunk, then `data: {"done":true}`.
app.post('/chat/stream', chatLimit, async (req, res) => {
  const chat = buildChat(req.body);
  if (chat.error) return res.status(400).json({ error: chat.error });

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();
  const send = obj => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const abort = new AbortController();
  res.on('close', () => { if (!res.writableEnded) abort.abort(); });

  try {
    for await (const t of chatStream(chat.messages, abort.signal)) send({ t });
    send({ done: true });
  } catch (err) {
    if (!abort.signal.aborted) {
      console.error('[chat/stream] error:', err.status || err.message);
      send({ error: 'Failed to contact the AI service.' });
    }
  }
  res.end();
});

// ---- Daily content (cached per date, shared by everyone) ----
app.get('/daily-reflection', generalLimit, async (req, res) => {
  try {
    res.json(await dailyReflection(requestDate(req.query.date)));
  } catch (err) {
    console.error('[reflection] error:', err.status || err.message);
    res.status(500).json({ error: 'Failed to generate reflection' });
  }
});

app.get('/lectio', generalLimit, async (req, res) => {
  try {
    res.json(await lectioPrompts(requestDate(req.query.date)));
  } catch (err) {
    console.error('[lectio] error:', err.status || err.message);
    res.status(500).json({ error: 'Failed to prepare Lectio Divina' });
  }
});

// Opt-in, never stored.
app.post('/prayer/compose', composeLimit, async (req, res) => {
  const intention = typeof req.body?.intention === 'string' ? req.body.intention.trim() : '';
  if (!intention) return res.status(400).json({ error: 'Intention is required.' });
  if (intention.length > 500) return res.status(400).json({ error: 'Please keep the intention under 500 characters.' });
  try {
    res.json({ prayer: await composePrayer(intention) });
  } catch (err) {
    console.error('[compose] error:', err.status || err.message);
    res.status(500).json({ error: 'Failed to compose prayer' });
  }
});

// ---- Push ----
app.post('/subscribe', generalLimit, (req, res) => {
  if (!upsertSubscription(req.body)) return res.status(400).json({ error: 'Invalid subscription' });
  res.json({ success: true });
});

app.post('/subscription/prefs', generalLimit, (req, res) => {
  if (!updatePrefs(req.body || {})) return res.status(404).json({ error: 'Subscription not found' });
  res.json({ success: true });
});

app.post('/unsubscribe', generalLimit, (req, res) => {
  if (req.body?.endpoint) removeSubscription(req.body.endpoint);
  res.json({ success: true });
});

function requireCron(req, res, next) {
  if (!process.env.CRON_SECRET || req.query.secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// cron-job.org: every 15 minutes → /cron/tick?secret=CRON_SECRET
app.get('/cron/tick', requireCron, async (_req, res) => res.json(await tick()));

// Legacy fixed-time jobs (?type=morning | prayer). Remove once the cron is switched.
app.get('/send-daily', requireCron, async (req, res) => res.json(await sendDaily(req.query.type || 'morning')));

// ---- Diagnostics (no personal data) ----
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

app.get('/push-status', (_req, res) => {
  res.json({
    vapid_configured: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    cron_secret_set:  !!process.env.CRON_SECRET,
    model:            MODEL,
    subscriptions:    loadSubs().length
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Anchor backend running at http://localhost:${PORT}`));
