# JGDash

Personal dashboard: goals, day ring, and a bento hub. Passkey sign-in via Supabase (optional)

## Cloud sync

Dashboard pages store data in `localStorage`. When you are signed in **once**, `js/sync.js` keeps those keys in sync via Supabase automatically (on save, every minute, on tab focus, and via the **Sync** button).

**Owner-only access:** see [`SECURITY.md`](SECURITY.md). Set `OWNER_EMAILS` in `js/config.js`, disable Supabase email sign-ups, and run migrations `004` + `005`.

1. In the Supabase SQL editor, run `supabase/migrations/001_user_kv.sql`.
2. For Training Video Library playback across devices, also run `supabase/migrations/002_training_videos_storage.sql`.
3. For MyMind image sync, run `003_media_images_storage.sql`.
4. Run **`004_owner_only_access.sql`** and **`005_owner_only_storage.sql`** so only your email can touch cloud data.
5. Sign in on each device with the **owner** account (email + password is most reliable; passkey/magic link need the production URL).
6. Keep using the app — sync is automatic. Use the topbar **Sync** button anytime for an immediate pass.
7. If Sync says “Sign in…”, you are not authenticated on that device yet.

Synced: goals, habits, projects, finance, training, health, media (including MyMind / Watchlist / Reading List). Training `.mp4` blobs sync via Supabase Storage bucket `training-videos`. MyMind image uploads sync via bucket `media-images`. Not synced: theme preference, health PIN.

## WHOOP (Health)

Vercel serverless routes under `api/`:

- `/api/whoop-callback` — OAuth code → tokens, redirects to `health.html#…`
- `/api/whoop-refresh` — refresh access token
- `/api/whoop-data` — Bearer proxy to WHOOP developer API (`/cycle` → v1, else v2)

Set these **Vercel** env vars (Production + Preview): `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `WHOOP_REDIRECT_URI` (`https://jg-dash-nine.vercel.app/api/whoop-callback`). The Client ID may also live in `js/config.js`; the Client Secret must **never** be committed.

Health → **Connect WHOOP** starts OAuth; `js/whoop.js` syncs live recovery/sleep/strain/HRV (≈4 calls/sync, 15‑minute cache, client buffers 80/min · 8000/day under WHOOP’s 100/min · 10000/day limits).
