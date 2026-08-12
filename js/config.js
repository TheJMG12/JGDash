// JGDash config — Supabase project values.
// Use the legacy JWT anon key with supabase-js (REST + Auth). The sb_publishable_ key also works for some calls,
// but the JWT anon key is the supported client key for this dashboard.
window.JGDASH_CONFIG = {
  SUPABASE_URL: 'https://tidcaqcoluhqlfrlsoyu.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpZGNhcWNvbHVocWxmcmxzb3l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTY5MjAsImV4cCI6MjEwMDczMjkyMH0.kXHappMMfvKFoH3lle3NrtOM_F6Ivch9j4PJ9kzOfP8',
  // Used for magic-link / confirm-email redirects (must also be Site URL + Redirect URLs in Supabase).
  SITE_URL: 'https://jg-dash-nine.vercel.app',
  // Only these accounts can open app pages or keep local/cloud data on this browser.
  // Add your Supabase Auth user UUID(s) under OWNER_USER_IDS for extra lock (Authentication → Users).
  OWNER_EMAILS: ['justin.gosine17@stjohns.edu'],
  OWNER_USER_IDS: [],
  // Optional Finnhub key for live quotes / stock analyzer on finance.html (leave empty for sample mode).
  FINNHUB_API_KEY: '',
  MARKET_DATA_PROVIDER: 'finnhub',
  // WHOOP OAuth — Client ID only in the frontend. Client Secret stays in Vercel env vars.
  WHOOP_CLIENT_ID: '94892a88-8e3e-43b1-82b4-d27a7576c004',
  WHOOP_REDIRECT_URI: 'https://jg-dash-nine.vercel.app/api/whoop-callback'
};
