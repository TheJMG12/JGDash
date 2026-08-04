# JGDash

Personal dashboard: goals, day ring, and a bento hub. Passkey sign-in via Supabase (optional)

## Cloud sync

Dashboard pages store data in `localStorage`. When you are signed in **once**, `js/sync.js` keeps those keys in sync via Supabase automatically (on save, every minute, on tab focus, and via the **Sync** button). **No Supabase Storage bucket is required** — only the `user_kv` table.

Media items (and other list data) are **merged by id**, so adding different articles on phone vs desktop keeps both instead of one device overwriting the other.

1. In the Supabase SQL editor, run `supabase/migrations/001_user_kv.sql`.
2. Sign in on each device with the **same account** (email + password is most reliable; passkey/magic link need the production URL).
3. Keep using the app — sync is automatic. Use the topbar **Sync** button anytime for an immediate pass.
4. If Sync says “Sign in…”, you are not authenticated on that device yet.

Synced: goals, habits, projects, finance, training, health, media (including Visual Bookmarks / Watchlist / Reading List). Not synced yet: uploaded video/image blobs in IndexedDB, theme preference, health PIN.
