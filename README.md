# JGDash

Personal dashboard: goals, day ring, and a bento hub. Passkey sign-in via Supabase (optional)

## Cloud sync

Dashboard pages store data in `localStorage`. When you are signed in, `js/sync.js` keeps those keys in sync via Supabase so phone and desktop stay aligned.

1. In the Supabase SQL editor, run `supabase/migrations/001_user_kv.sql`.
2. Sign in on each device (passkey or magic link).
3. Use the topbar **Sync** button anytime, or just keep using the app — saves sync automatically.

Synced: goals, habits, projects, finance, training, health, media. Not synced yet: uploaded video/image blobs in IndexedDB, theme preference, health PIN.
