/**
 * JGDash auth gate — pages stay hidden until the signed-in user is the owner.
 * Cloud data is still protected by Supabase RLS; this stops other accounts from
 * using the UI and clears local copies when access is denied.
 */
(function (global) {
  'use strict';

  var LOCK_SKIP = false;
  var STYLE_ID = 'jgdash-auth-gate-style';
  var PENDING_CLASS = 'jgdash-auth-pending';
  var OK_CLASS = 'jgdash-auth-ok';
  var DENY_KEY = 'jgdash_auth_deny';

  /** Keys that must never linger for a non-owner / signed-out browser. */
  var ALWAYS_WIPE = [
    'jg_whoop_tokens_v1',
    'jg_whoop_metrics_v1',
    'jg_whoop_oauth_state_v1',
    'jg_health_privacy_pin_v1',
    'jg_health_privacy_locked_v1',
    'jgdash_pending_email',
    'jg_sync_meta_v1'
  ];

  var KEEP_KEYS = {
    jg_theme: true,
    jgdash_auth_deny: true
  };

  function pageName() {
    try {
      return (location.pathname.split('/').pop() || 'index.html').split('?')[0];
    } catch (e) {
      return 'index.html';
    }
  }

  function isSignInPage() {
    return pageName() === 'signin.html';
  }

  function injectGateStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      'html.' + PENDING_CLASS + ' body{visibility:hidden!important}' +
      'html.' + OK_CLASS + ' body{visibility:visible!important}';
    (document.head || document.documentElement).appendChild(style);
  }

  function setPending() {
    injectGateStyle();
    document.documentElement.classList.add(PENDING_CLASS);
    document.documentElement.classList.remove(OK_CLASS);
  }

  function reveal() {
    document.documentElement.classList.remove(PENDING_CLASS);
    document.documentElement.classList.add(OK_CLASS);
  }

  function cfg() {
    return global.JGDASH_CONFIG || {};
  }

  function ownerEmails() {
    var list = cfg().OWNER_EMAILS;
    if (!Array.isArray(list)) return [];
    return list.map(function (e) { return String(e || '').trim().toLowerCase(); }).filter(Boolean);
  }

  function ownerUserIds() {
    var list = cfg().OWNER_USER_IDS;
    if (!Array.isArray(list)) return [];
    return list.map(function (id) { return String(id || '').trim(); }).filter(Boolean);
  }

  function hasOwnerAllowlist() {
    return ownerEmails().length > 0 || ownerUserIds().length > 0;
  }

  function sessionUser(session) {
    return (session && session.user) || null;
  }

  function isOwnerSession(session) {
    var user = sessionUser(session);
    if (!user) return false;
    if (!hasOwnerAllowlist()) return false;
    var ids = ownerUserIds();
    if (ids.length && ids.indexOf(String(user.id)) !== -1) return true;
    var email = String(user.email || '').trim().toLowerCase();
    var emails = ownerEmails();
    if (email && emails.indexOf(email) !== -1) return true;
    return false;
  }

  function isSyncKey(key) {
    if (!key || typeof key !== 'string') return false;
    if (key.indexOf('goals:') === 0) return true;
    var exact = [
      'goal_streak_v1',
      'habits_v1',
      'projects_v1',
      'jg_finance_data_v1',
      'jg_training_data_v1',
      'jg_health_data_v1',
      'jg_media_data_v1'
    ];
    return exact.indexOf(key) !== -1;
  }

  function clearSensitiveLocalData() {
    try {
      var toRemove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || KEEP_KEYS[k]) continue;
        if (isSyncKey(k) || ALWAYS_WIPE.indexOf(k) !== -1 || k.indexOf('jg_') === 0 || k.indexOf('goals:') === 0) {
          toRemove.push(k);
        }
      }
      toRemove.forEach(function (k) {
        try { localStorage.removeItem(k); } catch (e) { /* ignore */ }
      });
    } catch (e) { /* ignore */ }

    try {
      if (global.indexedDB && indexedDB.databases) {
        indexedDB.databases().then(function (dbs) {
          (dbs || []).forEach(function (db) {
            var name = db && db.name;
            if (!name) return;
            if (/jg_|jgdash|media|training/i.test(name)) {
              try { indexedDB.deleteDatabase(name); } catch (err) { /* ignore */ }
            }
          });
        }).catch(function () { /* ignore */ });
      }
    } catch (e2) { /* ignore */ }
  }

  function redirectSignIn(reason) {
    if (isSignInPage()) {
      reveal();
      return;
    }
    var q = 'signin.html?next=' + encodeURIComponent(pageName());
    if (reason) {
      try { sessionStorage.setItem(DENY_KEY, reason); } catch (e) { /* ignore */ }
      q += '&deny=' + encodeURIComponent(reason);
    }
    location.replace(q);
  }

  async function rejectSession(sb, reason) {
    clearSensitiveLocalData();
    try {
      if (sb) await sb.auth.signOut();
    } catch (e) { /* ignore */ }
    redirectSignIn(reason || 'not_owner');
  }

  /**
   * @returns {Promise<{session: object|null, skipped: boolean, owner: boolean}>}
   */
  async function ensureSession() {
    if (isSignInPage()) {
      reveal();
      return { session: null, skipped: true, owner: false };
    }

    setPending();

    var api = global.JGDash && global.JGDash.supabase;
    if (!api || !api.isConfigured()) {
      clearSensitiveLocalData();
      redirectSignIn('not_configured');
      return { session: null, skipped: false, owner: false };
    }

    if (!hasOwnerAllowlist()) {
      clearSensitiveLocalData();
      redirectSignIn('no_owner_allowlist');
      return { session: null, skipped: false, owner: false };
    }

    var sb = api.getClient();
    var result = await sb.auth.getSession();
    var session = result.data && result.data.session;
    if (!session) {
      clearSensitiveLocalData();
      redirectSignIn('signed_out');
      return { session: null, skipped: false, owner: false };
    }

    if (!isOwnerSession(session)) {
      await rejectSession(sb, 'not_owner');
      return { session: session, skipped: false, owner: false };
    }

    reveal();
    return { session: session, skipped: false, owner: true };
  }

  global.JGDash = global.JGDash || {};
  global.JGDash.lock = {
    ensureSession: ensureSession,
    isOwnerSession: isOwnerSession,
    clearSensitiveLocalData: clearSensitiveLocalData,
    hasOwnerAllowlist: hasOwnerAllowlist,
    skip: function () { LOCK_SKIP = true; reveal(); }
  };

  // Hide immediately (script is in <head> on app pages).
  if (!isSignInPage()) setPending();

  if (!LOCK_SKIP) {
    var boot = function () {
      ensureSession().catch(function (err) {
        console.warn('JGDash lock:', err);
        clearSensitiveLocalData();
        redirectSignIn('lock_error');
      });
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }
})(window);
