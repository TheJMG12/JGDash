/* JGDash cloud sync — mirrors allowlisted localStorage keys to Supabase user_kv */
(function (global) {
  'use strict';

  var META_KEY = 'jg_sync_meta_v1';
  var TABLE = 'user_kv';
  var DEBOUNCE_MS = 900;
  var EXACT_KEYS = [
    'goal_streak_v1',
    'habits_v1',
    'projects_v1',
    'jg_finance_data_v1',
    'jg_training_data_v1',
    'jg_health_data_v1',
    'jg_media_data_v1'
  ];

  var applyingRemote = false;
  var installed = false;
  var debounceTimer = null;
  var syncing = null;
  var lastStatus = { state: 'idle', message: 'Not synced yet' };
  var listeners = [];

  function nowIso() {
    return new Date().toISOString();
  }

  function isSyncKey(key) {
    if (!key || typeof key !== 'string') return false;
    if (key === META_KEY) return false;
    if (key.indexOf('goals:') === 0) return true;
    return EXACT_KEYS.indexOf(key) !== -1;
  }

  function readMeta() {
    try {
      var raw = localStorage.getItem(META_KEY);
      if (!raw) return { mtimes: {}, lastSyncAt: null, lastError: null };
      var parsed = JSON.parse(raw);
      if (!parsed.mtimes) parsed.mtimes = {};
      return parsed;
    } catch (e) {
      return { mtimes: {}, lastSyncAt: null, lastError: null };
    }
  }

  function writeMeta(meta) {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch (e) { /* ignore quota */ }
  }

  function touchLocal(key, iso) {
    var meta = readMeta();
    meta.mtimes[key] = iso || nowIso();
    writeMeta(meta);
  }

  function parseValue(raw) {
    if (raw == null) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return { __jg_raw: String(raw) };
    }
  }

  function serializeValue(value) {
    if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, '__jg_raw')) {
      return String(value.__jg_raw);
    }
    return JSON.stringify(value);
  }

  function listLocalKeys() {
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (isSyncKey(k)) keys.push(k);
    }
    return keys;
  }

  function setStatus(state, message, extra) {
    lastStatus = {
      state: state,
      message: message || '',
      at: nowIso(),
      extra: extra || null
    };
    listeners.forEach(function (fn) {
      try { fn(lastStatus); } catch (e) { /* ignore */ }
    });
    try {
      global.dispatchEvent(new CustomEvent('jg-sync-status', { detail: lastStatus }));
    } catch (e) { /* ignore */ }
  }

  function getClientAndUser() {
    var api = global.JGDash && global.JGDash.supabase;
    if (!api || !api.isConfigured()) {
      return Promise.resolve({ skipped: true, reason: 'not_configured' });
    }
    var client = api.getClient();
    if (!client) return Promise.resolve({ skipped: true, reason: 'no_client' });
    return client.auth.getSession().then(function (res) {
      var session = res.data && res.data.session;
      if (!session || !session.user) {
        return { skipped: true, reason: 'signed_out', client: client };
      }
      return { skipped: false, client: client, user: session.user, session: session };
    });
  }

  function applyRemoteRow(key, value, updatedAt) {
    applyingRemote = true;
    try {
      localStorage.setItem(key, serializeValue(value));
      touchLocal(key, updatedAt || nowIso());
    } finally {
      applyingRemote = false;
    }
  }

  function syncNow(opts) {
    opts = opts || {};
    if (syncing) return syncing;

    setStatus('syncing', 'Syncing…');
    syncing = getClientAndUser().then(function (ctx) {
      if (ctx.skipped) {
        var msg = ctx.reason === 'signed_out'
          ? 'Sign in to sync across devices'
          : 'Cloud sync unavailable';
        setStatus('skipped', msg, { reason: ctx.reason });
        return { ok: true, skipped: true, reason: ctx.reason, applied: [], pushed: [] };
      }

      var client = ctx.client;
      var userId = ctx.user.id;
      var meta = readMeta();

      return client
        .from(TABLE)
        .select('key,value,updated_at')
        .eq('user_id', userId)
        .then(function (pull) {
          if (pull.error) {
            var err = pull.error;
            var missing = /schema cache|does not exist|PGRST205/i.test(err.message || '');
            setStatus('error', missing
              ? 'Sync table missing — run supabase/migrations/001_user_kv.sql'
              : (err.message || 'Pull failed'));
            return {
              ok: false,
              error: err,
              missingTable: missing,
              applied: [],
              pushed: []
            };
          }

          var remoteRows = pull.data || [];
          var remoteMap = {};
          remoteRows.forEach(function (row) { remoteMap[row.key] = row; });

          var applied = [];
          remoteRows.forEach(function (row) {
            if (!isSyncKey(row.key)) return;
            var localRaw = null;
            try { localRaw = localStorage.getItem(row.key); } catch (e) { localRaw = null; }
            var localMtime = meta.mtimes[row.key] || null;
            var remoteTime = row.updated_at ? new Date(row.updated_at).getTime() : 0;
            var localTime = localMtime ? new Date(localMtime).getTime() : 0;

            // Remote wins if newer than local mtime, or local key missing
            if (localRaw == null || remoteTime > localTime) {
              applyRemoteRow(row.key, row.value, row.updated_at);
              applied.push(row.key);
            }
          });

          // Refresh meta after applies
          meta = readMeta();

          var toPush = [];
          listLocalKeys().forEach(function (key) {
            var localMtime = meta.mtimes[key] || nowIso();
            if (!meta.mtimes[key]) {
              meta.mtimes[key] = localMtime;
            }
            var remote = remoteMap[key];
            var localTime = new Date(localMtime).getTime();
            var remoteTime = remote && remote.updated_at ? new Date(remote.updated_at).getTime() : 0;
            if (!remote || localTime >= remoteTime) {
              var raw = localStorage.getItem(key);
              toPush.push({
                user_id: userId,
                key: key,
                value: parseValue(raw),
                updated_at: localMtime
              });
            }
          });
          writeMeta(meta);

          if (!toPush.length) {
            meta.lastSyncAt = nowIso();
            meta.lastError = null;
            writeMeta(meta);
            setStatus('ok', applied.length
              ? ('Updated ' + applied.length + ' from cloud')
              : 'Up to date');
            return { ok: true, applied: applied, pushed: [] };
          }

          return client
            .from(TABLE)
            .upsert(toPush, { onConflict: 'user_id,key' })
            .then(function (pushRes) {
              if (pushRes.error) {
                meta.lastError = pushRes.error.message || 'Push failed';
                writeMeta(meta);
                setStatus('error', meta.lastError);
                return {
                  ok: false,
                  error: pushRes.error,
                  applied: applied,
                  pushed: []
                };
              }
              meta.lastSyncAt = nowIso();
              meta.lastError = null;
              writeMeta(meta);
              var pushedKeys = toPush.map(function (r) { return r.key; });
              setStatus('ok', 'Synced ' + pushedKeys.length + ' item' + (pushedKeys.length === 1 ? '' : 's'));
              return { ok: true, applied: applied, pushed: pushedKeys };
            });
        });
    }).catch(function (err) {
      var message = (err && err.message) || 'Sync failed';
      setStatus('error', message);
      return { ok: false, error: err, applied: [], pushed: [] };
    }).then(function (result) {
      syncing = null;
      try {
        global.dispatchEvent(new CustomEvent('jg-sync-complete', { detail: result }));
      } catch (e) { /* ignore */ }

      // If cloud data landed before page scripts finished, reload once so UIs pick it up.
      if (result && result.applied && result.applied.length && !opts.skipReload) {
        try {
          if (!sessionStorage.getItem('jg_sync_boot_reload')) {
            sessionStorage.setItem('jg_sync_boot_reload', '1');
            global.location.reload();
          } else {
            sessionStorage.removeItem('jg_sync_boot_reload');
          }
        } catch (e) { /* ignore */ }
      } else {
        try { sessionStorage.removeItem('jg_sync_boot_reload'); } catch (e) { /* ignore */ }
      }
      return result;
    });

    return syncing;
  }

  function scheduleSync() {
    if (applyingRemote) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      syncNow({ skipReload: true });
    }, DEBOUNCE_MS);
  }

  function installHooks() {
    if (installed) return;
    installed = true;
    var store = global.localStorage;
    if (!store || store.__jgSyncPatched) return;

    var rawSet = store.setItem.bind(store);
    var rawRemove = store.removeItem.bind(store);

    store.setItem = function (key, value) {
      rawSet(key, value);
      if (isSyncKey(key) && !applyingRemote) {
        touchLocal(key);
        scheduleSync();
      }
    };

    store.removeItem = function (key) {
      rawRemove(key);
      if (isSyncKey(key) && !applyingRemote) {
        var meta = readMeta();
        delete meta.mtimes[key];
        writeMeta(meta);
        scheduleSync();
      }
    };

    store.__jgSyncPatched = true;
  }

  function boot() {
    installHooks();
    // Seed mtimes for existing keys so first push has timestamps
    var meta = readMeta();
    var changed = false;
    listLocalKeys().forEach(function (key) {
      if (!meta.mtimes[key]) {
        meta.mtimes[key] = nowIso();
        changed = true;
      }
    });
    if (changed) writeMeta(meta);

    syncNow().catch(function () { /* status already set */ });
  }

  function onStatus(fn) {
    if (typeof fn === 'function') listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (x) { return x !== fn; });
    };
  }

  global.JGDash = global.JGDash || {};
  global.JGDash.sync = {
    syncNow: syncNow,
    scheduleSync: scheduleSync,
    installHooks: installHooks,
    isSyncKey: isSyncKey,
    getStatus: function () { return lastStatus; },
    onStatus: onStatus,
    META_KEY: META_KEY,
    EXACT_KEYS: EXACT_KEYS.slice()
  };

  installHooks();

  if (global.document) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      setTimeout(boot, 0);
    }
    global.addEventListener('online', function () { syncNow({ skipReload: true }); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') syncNow({ skipReload: true });
    });
  }
})(window);
