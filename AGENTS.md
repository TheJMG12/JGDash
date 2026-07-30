# AGENTS.md

## Cursor Cloud specific instructions

- This is a **static multi-page site** (no npm app, no build). From `/workspace`, serve with `python3 -m http.server 8765` (or any static server).
- **Goals UI:** open `main.html` — fully self-contained (inline CSS/JS, `localStorage`). Works on `file://` for demos.
- **Hub:** `index.html` bento grid → `main.html`, `gym.html`, `health.html`, `po-water.html`, `finance.html`.
- **Auth:** `signin.html` + `js/lock.js`. If `js/config.js` has empty `SUPABASE_URL` / `SUPABASE_ANON_KEY`, lock **soft-skips** so local demos work. Passkeys need Supabase Passkeys enabled, RP ID matching the serve host (`localhost` or the Vercel hostname), and HTTPS/localhost (WebAuthn will not run on `file://`).
- Client opt-in: `auth.experimental.passkey: true` in `js/supabase-client.js`. **`registerPasskey()` requires an existing session**. Default Supabase email is a **magic link**: open on same device → `signin.html` → register passkey. `js/config.js` `SITE_URL` drives `emailRedirectTo`. If confirm emails still go to localhost, change Supabase **Authentication → URL Configuration → Site URL** to the Vercel origin (Passkeys RP settings do not control email links). Allowlist Redirect URLs: `https://jg-dash-nine.vercel.app/**`.
- Goals day boundary is **6 AM** local; awake ring window is **8:00 AM → midnight**. Polish button needs `ANTHROPIC_API_KEY` set inside `main.html` (empty → add as-typed).
- Theme (light/dark) is global via `js/theme.js` + the topbar **Light/Dark** control (left of Sign out). Preference is stored in `localStorage` key `jg_theme`.
