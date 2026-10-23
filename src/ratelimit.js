// Tiny in-memory sliding-window rate limiter. Good enough for a single Render
// instance; resets on restart, which is fine for abuse protection.
const buckets = new Map(); // key -> array of timestamps

export function rateLimit({ name, max, windowMs }) {
  return (req, res, next) => {
    const key = `${name}:${req.ip}`;
    const now = Date.now();
    const hits = (buckets.get(key) || []).filter(t => now - t < windowMs);
    if (hits.length >= max) {
      const retry = Math.ceil((windowMs - (now - hits[0])) / 1000);
      res.set('Retry-After', String(retry));
      return res.status(429).json({ error: `You're going a little fast — please wait ${retry}s and try again.` });
    }
    hits.push(now);
    buckets.set(key, hits);
    next();
  };
}

// Drop stale keys so the map can't grow forever.
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [key, hits] of buckets) {
    if (!hits.length || hits[hits.length - 1] < cutoff) buckets.delete(key);
  }
}, 10 * 60 * 1000).unref();
