# Project Veritas — Anchor backend

Express server behind [Anchor](https://candycain5432.github.io/Anchor/), the Catholic prayer companion.
Deployed on Render (`project-veritas-backend.onrender.com`).

The server keeps **no chat logs** and stores nothing about users except push subscriptions
(endpoint, timezone, reminder times). Chat history lives on the user's device and is sent with each message.

## Environment

| Variable | Required | Notes |
|---|---|---|
| `OPENAI_API_KEY` | yes | Set in the Render dashboard only — never commit `.env`. |
| `OPENAI_MODEL` | no | Chat model. Defaults to `gpt-4o-mini`. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | for push | Public key must match `VAPID_PUBLIC_KEY` in Anchor's `js/push.js`. |
| `CRON_SECRET` | for push | Shared secret for the cron routes. Cron routes refuse all calls if unset. |
| `DEFAULT_TZ` | no | Timezone for old subscriptions that never sent one. Default `America/New_York`. |

## Routes

| Method | Path | |
|---|---|---|
| POST | `/chat` | `{ message, history?, context?, sessionId? }` → `{ reply }` |
| POST | `/chat/stream` | Same body; Server-Sent Events `{t}` chunks then `{done:true}` |
| GET | `/daily-reflection?date=YYYY-MM-DD` | Cached per date |
| GET | `/lectio?date=YYYY-MM-DD` | `{ ref, questions[3], word }`, cached per date |
| POST | `/prayer/compose` | `{ intention }` → `{ prayer }` (not stored) |
| POST | `/subscribe` | `{ subscription, tz, reminders: { morning, afternoon, night } }` (`"HH:MM"` or `null`) |
| POST | `/subscription/prefs` | `{ endpoint, tz, reminders }` |
| POST | `/unsubscribe` | `{ endpoint }` |
| GET | `/cron/tick?secret=…` | Sends whatever reminders are due in each subscriber's timezone |
| GET | `/send-daily?secret=…&type=morning\|prayer` | Legacy fixed-time sender |
| GET | `/health`, `/push-status` | Diagnostics (counts only) |

Rate limits (per IP): chat 20 / 5 min, compose 6 / 10 min, everything else 60 / 5 min.

## Push reminders

Create one job on [cron-job.org](https://cron-job.org) that calls
`https://project-veritas-backend.onrender.com/cron/tick?secret=CRON_SECRET` **every 15 minutes**.
(This also keeps the free Render instance warm.) The old `/send-daily` jobs can then be deleted.

Render's free disk is wiped on restart, so `subscriptions.json` is temporary; the app re-sends its
subscription every time it opens, which restores it.

## Run locally

```sh
npm install
cp .env.example .env   # fill in values
npm run dev
```
