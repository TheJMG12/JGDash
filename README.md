# JGDash

Personal dashboard: goals, day ring, and a bento hub. Passkey sign-in via Supabase (optional).

## Quick start

```bash
python3 -m http.server 8765
```

Open [http://127.0.0.1:8765/main.html](http://127.0.0.1:8765/main.html) for the goals dashboard (works without Supabase).

Hub: [http://127.0.0.1:8765/index.html](http://127.0.0.1:8765/index.html) · Sign-in: [http://127.0.0.1:8765/signin.html](http://127.0.0.1:8765/signin.html)

`main.html` is self-contained (inline CSS/JS) and also works from `file://`.

## Supabase passkeys

1. Values live in [`js/config.js`](js/config.js) (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SITE_URL`).
2. **Authentication → URL Configuration** (controls email links — not Passkeys):
   - Site URL = `https://jg-dash-nine.vercel.app`
   - Redirect URLs include `https://jg-dash-nine.vercel.app/**`
3. **Authentication → Passkeys**: RP ID = `jg-dash-nine.vercel.app`, Origins = `https://jg-dash-nine.vercel.app`
4. First visit: open the email sign-in/confirm link → Register passkey. Later: Sign in with Passkey.
