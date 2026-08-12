# Securing JGDash (owner-only)

JGDash is a **static** site on Vercel. Anyone can download the HTML/JS shell, but **your personal data** must stay private. Security has two layers:

1. **Client gate** (`js/lock.js` + `OWNER_EMAILS` in `js/config.js`) — pages stay hidden and redirect to sign-in unless the signed-in user is you. Non-owner sessions are signed out and local dashboard data is wiped.
2. **Supabase RLS** — cloud rows and Storage objects are only readable/writable by your Auth user (and, after migrations `004`/`005`, only when the JWT email matches the owner).

## What this PR / setup does in the app

- Hides page content until auth + owner check succeeds
- Blocks “Create account” in the UI; magic links use `shouldCreateUser: false`
- Allowlists `OWNER_EMAILS` (and optional `OWNER_USER_IDS`)
- Clears synced `localStorage` / known IndexedDB stores on deny and on **Sign out**

## Required: lock Supabase (do this once)

In [Supabase Dashboard](https://supabase.com/dashboard) → your JGDash project:

1. **Authentication → Providers → Email**
   - Turn **OFF** “Enable sign ups” (or equivalent “Allow new users / Sign ups”) so strangers cannot create accounts even if they hit the API.
2. **Authentication → Users**
   - Confirm only your user exists (`justin.gosine17@stjohns.edu`). Delete unknown users.
   - Copy your **User UID** into `OWNER_USER_IDS` in `js/config.js` (recommended).
3. **SQL Editor** — run in order if not already applied:
   - `supabase/migrations/001_user_kv.sql`
   - `002_training_videos_storage.sql`
   - `003_media_images_storage.sql`
   - **`004_owner_only_access.sql`** (owner email on `user_kv`)
   - **`005_owner_only_storage.sql`** (owner email on Storage)
4. **Project Settings → API**
   - Never put the **service_role** key in the frontend or git. Only the **anon** key belongs in `js/config.js`.
5. **Authentication → URL Configuration**
   - Site URL + Redirect URLs limited to `https://jg-dash-nine.vercel.app/**` (no open wildcards to other domains).

## Vercel / deployment

- Keep the project **private** on GitHub if the repo is private.
- WHOOP secrets (`WHOOP_CLIENT_SECRET`, etc.) stay in Vercel env vars only.
- Optional: Vercel → Deployment Protection / password on preview deployments so random visitors cannot even load the shell.

## Honest limits (static apps)

| Protected | Not fully protectable on a public static host |
|-----------|-----------------------------------------------|
| Cloud sync data (`user_kv`) via RLS | HTML/CSS/JS source (anyone can View Source) |
| Storage images/videos via RLS | UI layout / feature names |
| Browser local copy after Sign out (wiped) | Data still on a device while you are signed in |
| Other Supabase accounts using your app | Someone with your password / unlocked phone |

**Practical habits:** strong unique password + passkey; Sign out on shared computers; Health PIN for therapy notes; don’t share your phone unlock.

## Changing owner email

1. Update `OWNER_EMAILS` in `js/config.js`
2. Re-run `004` / `005` with the new email (or edit the policies in SQL Editor)
3. Disable signups still on in Supabase
