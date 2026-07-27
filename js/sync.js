(function (global) {
  'use strict';

  // Stub for future cloud sync of goals:* keys via Supabase.
  function syncNow() {
    return Promise.resolve({ ok: true, skipped: true });
  }

  global.JGDash = global.JGDash || {};
  global.JGDash.sync = { syncNow: syncNow };
})(window);
