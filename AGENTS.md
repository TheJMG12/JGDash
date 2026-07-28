# AGENTS.md

## Cursor Cloud specific instructions

- This is a **static multi-page site** (no npm app, no build). From `/workspace`, serve with `python3 -m http.server 8765` (or any static server).
- **Goals UI:** open `main.html` — fully self-contained (inline CSS/JS, `localStorage`). Works on `file://` for demos.
- **Hub:** `index.html` bento grid → `main.html`, `gym.html`, `health.html`, `po-water.html`, `finance.html`.
- **Auth:** `signin.html` + `js/lock.js`. If `js/config.js` has empty `SUPABASE_URL` / `SUPABASE_ANON_KEY`, lock **soft-skips** so local demos work. Passkeys need Supabase Passkeys enabled, RP ID matching the serve host, and `http://localhost` (WebAuthn will not run on `file://`).
- Client opt-in: `auth.experimental.passkey: true` in `js/supabase-client.js`. Use `signInWithPasskey()` / `registerPasskey()` after a magic-link session.
- Goals day boundary is **6 AM** local; awake ring window is **8:00 AM → midnight**. Polish button needs `ANTHROPIC_API_KEY` set inside `main.html` (empty → add as-typed).
