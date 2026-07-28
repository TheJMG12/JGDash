# AGENTS.md

## Cursor Cloud specific instructions

- This is a **static multi-page site** (no npm app, no build). From `/workspace`, serve with `python3 -m http.server 8765` (or any static server).
- **Goals UI:** open `main.html` — fully self-contained (inline CSS/JS, `localStorage`). Works on `file://` for demos.
- **Hub:** `index.html` bento grid → `main.html`, `gym.html`, `health.html`, `po-water.html`, `finance.html`.
- **Auth:** `signin.html` + `js/lock.js`. If `js/config.js` has empty `SUPABASE_URL` / `SUPABASE_ANON_KEY`, lock **soft-skips** so local demos work. Passkeys need Supabase Passkeys enabled, RP ID matching the serve host (`localhost` or the Vercel hostname), and HTTPS/localhost (WebAuthn will not run on `file://`).
- Client opt-in: `auth.experimental.passkey: true` in `js/supabase-client.js`. **`registerPasskey()` requires an existing session**. Default Supabase email is a **magic link** (not a 6-digit code): open the link on the same device → session on `signin.html` → register passkey. `signInWithPasskey()` is for returning users. Redirect URLs must include the Vercel origin.
- Goals day boundary is **6 AM** local; awake ring window is **8:00 AM → midnight**. Polish button needs `ANTHROPIC_API_KEY` set inside `main.html` (empty → add as-typed).
