(function (global) {
  'use strict';

  var cfg = global.JGDASH_CONFIG || {};
  var client = null;

  function isConfigured() {
    return !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && global.supabase);
  }

  /** Canonical app origin for auth emails (prefer SITE_URL over whatever tab you are on). */
  function getSiteOrigin() {
    var site = (cfg.SITE_URL || '').replace(/\/$/, '');
    if (site) return site;
    return global.location && global.location.origin ? global.location.origin : '';
  }

  /** Full redirect target for magic links / email confirmations. */
  function getEmailRedirectTo(nextPath) {
    var next = nextPath || 'index.html';
    return getSiteOrigin() + '/signin.html?next=' + encodeURIComponent(next);
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
    getClient: getClient,
    getSiteOrigin: getSiteOrigin,
    getEmailRedirectTo: getEmailRedirectTo
  };
})(window);
