(function (global) {
  'use strict';

  var LOCK_SKIP = false;

  async function ensureSession() {
    var api = global.JGDash && global.JGDash.supabase;
    if (!api || !api.isConfigured()) {
      // Soft-fail: no Supabase config → allow local/file:// demos
      return { session: null, skipped: true };
    }
    var sb = api.getClient();
    var result = await sb.auth.getSession();
    var session = result.data && result.data.session;
    if (!session) {
      var here = location.pathname.split('/').pop() || 'index.html';
      if (here !== 'signin.html') {
        location.replace('signin.html?next=' + encodeURIComponent(here));
      }
      return { session: null, skipped: false };
    }
    return { session: session, skipped: false };
  }

  global.JGDash = global.JGDash || {};
  global.JGDash.lock = {
    ensureSession: ensureSession,
    skip: function () { LOCK_SKIP = true; }
  };

  if (!LOCK_SKIP) {
    document.addEventListener('DOMContentLoaded', function () {
      ensureSession().catch(function (err) {
        console.warn('JGDash lock:', err);
      });
    });
  }
})(window);
