(function (global) {
  'use strict';

  var cfg = global.JGDASH_CONFIG || {};
  var client = null;

  function isConfigured() {
    return !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && global.supabase);
  }

  function getClient() {
    if (client) return client;
    if (!isConfigured()) return null;
    client = global.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        experimental: { passkey: true }
      }
    });
    return client;
  }

  global.JGDash = global.JGDash || {};
  global.JGDash.supabase = {
    isConfigured: isConfigured,
    getClient: getClient
  };
})(window);
