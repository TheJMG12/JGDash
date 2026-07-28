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

1. Put your project URL and anon key in [`js/config.js`](js/config.js).
2. Dashboard → **Authentication → Passkeys**: enable; set RP ID / origins for `localhost` (or your host).
3. Enable email magic links for first-time enroll → **Register passkey** (Apple Passwords / WebAuthn).
4. Serve over `http://localhost` (not `file://`) for WebAuthn.
