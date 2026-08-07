/* JGDash cloud sync — mirrors allowlisted localStorage keys to Supabase user_kv.
 *
 * Whole-key last-write-wins used to drop Media items when two devices edited
 * the same blob. We now merge array collections by item id, auto-sync every
 * minute while signed in, and never invent "now" mtimes for untouched keys.
 */
(function (global) {
  'use strict';

  var META_KEY = 'jg_sync_meta_v1';
  var TABLE = 'user_kv';
  var DEBOUNCE_MS = 900;
  var INTERVAL_MS = 60 * 1000;
  var EXACT_KEYS = [
    'goal_streak_v1',
    'habits_v1',
    'projects_v1',
    'jg_finance_data_v1',
    'jg_training_data_v1',
    'jg_health_data_v1',
    'jg_media_data_v1'
  ];

  // Top-level array fields merged by item `id` (not whole-blob LWW).
  var MERGE_ARRAY_FIELDS = {
    habits_v1: ['items'],
    jg_media_data_v1: ['items', 'visuals', 'watchlist', 'books', 'feeds'],
    jg_finance_data_v1: ['transactions', 'budgets', 'goals', 'holdings'],
    jg_training_data_v1: ['sessions', 'exercises', 'drills', 'notes', 'videos', 'prs', 'milestones']
  };

  // Nested object stores (health) — recursive id-aware merge.
  var DEEP_MERGE_KEYS = {
    jg_health_data_v1: true
  };

  var applyingRemote = false;
  var installed = false;
  var debounceTimer = null;
  var intervalTimer = null;
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

  function stableStringify(value) {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  }

  function valuesEqual(a, b) {
    return stableStringify(a) === stableStringify(b);
  }

  function itemTime(it) {
    if (!it || typeof it !== 'object') return 0;
    var candidates = [it.updatedAt, it.savedAt, it.createdAt, it.addedAt, it.date, it.ts];
    var best = 0;
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (c == null || c === '') continue;
      if (typeof c === 'number' && isFinite(c)) {
        best = Math.max(best, c < 1e12 ? c * 1000 : c);
        continue;
      }
      var n = Date.parse(String(c));
      if (!isNaN(n)) best = Math.max(best, n);
    }
    return best;
  }

  function mergeArrayById(localArr, remoteArr) {
    var map = {};
    var orphans = [];

    function ingest(list) {
      (list || []).forEach(function (it) {
        if (!it || typeof it !== 'object') {
          orphans.push(it);
          return;
        }
        if (it.id == null || it.id === '') {
          orphans.push(it);
          return;
        }
        var id = String(it.id);
        var prev = map[id];
        if (!prev) {
          map[id] = it;
          return;
        }
        var lt = itemTime(it);
        var rt = itemTime(prev);
        if (lt > rt) map[id] = it;
        else if (lt === rt) {
          // Deterministic tie-break: prefer lexicographically larger JSON
          if (stableStringify(it) > stableStringify(prev)) map[id] = it;
        }
      });
    }

    ingest(remoteArr);
    ingest(localArr);

    var out = Object.keys(map).map(function (id) { return map[id]; });
    // Keep unique orphan rows (no id) from both sides
    var seen = {};
    orphans.forEach(function (it) {
      var sig = stableStringify(it);
      if (seen[sig]) return;
      seen[sig] = true;
      out.push(it);
    });
    return out;
  }

  /** Main-page daily goals are arrays of {text, done, queued} — often without id. */
  function goalIdentity(it) {
    if (!it || typeof it !== 'object') return null;
    if (it.id != null && it.id !== '') return 'id:' + String(it.id);
    var text = String(it.text || '').trim().toLowerCase();
    if (!text) return null;
    return 'text:' + text;
  }

  function mergeGoalsArray(localArr, remoteArr) {
    var map = {};
    var order = [];

    function ingest(list) {
      (list || []).forEach(function (it) {
        if (!it || typeof it !== 'object') return;
        var key = goalIdentity(it);
        if (!key) return;
        var prev = map[key];
        if (!prev) {
          map[key] = {
            id: it.id || undefined,
            text: it.text,
            done: !!it.done,
            queued: !!it.queued
          };
          order.push(key);
          return;
        }
        // Union flags; keep non-empty text; keep id if either has one
        map[key] = {
          id: prev.id || it.id || undefined,
          text: (it.text && String(it.text).trim()) ? it.text : prev.text,
          done: !!(prev.done || it.done),
          queued: !!(prev.queued || it.queued)
        };
      });
    }

    // Remote first so local edits (done/queued) still win via OR, and local-only tasks append.
    ingest(remoteArr);
    ingest(localArr);

    return order.map(function (key) {
      var g = map[key];
      if (!g.id) {
        // Stable-ish id from text so future merges use id path
        g.id = 'g_' + key.replace(/^text:/, '').replace(/[^a-z0-9]+/g, '_').slice(0, 40);
      }
      return g;
    });
  }

  function mergeStringList(localArr, remoteArr) {
    var seen = {};
    var out = [];
    (remoteArr || []).concat(localArr || []).forEach(function (v) {
      var s = String(v);
      if (seen[s]) return;
      seen[s] = true;
      out.push(v);
    });
    return out;
  }

  function mergeObjectByIdArrays(localVal, remoteVal, arrayFields) {
    var localObj = localVal && typeof localVal === 'object' && !Array.isArray(localVal) ? localVal : {};
    var remoteObj = remoteVal && typeof remoteVal === 'object' && !Array.isArray(remoteVal) ? remoteVal : {};
    var out = {};
    var keys = {};
    Object.keys(remoteObj).forEach(function (k) { keys[k] = true; });
    Object.keys(localObj).forEach(function (k) { keys[k] = true; });
    Object.keys(keys).forEach(function (k) {
      var lv = localObj[k];
      var rv = remoteObj[k];
      if (arrayFields.indexOf(k) !== -1) {
        out[k] = mergeArrayById(Array.isArray(lv) ? lv : [], Array.isArray(rv) ? rv : []);
        return;
      }
      if (k === 'collections' && (Array.isArray(lv) || Array.isArray(rv))) {
        out[k] = mergeStringList(Array.isArray(lv) ? lv : [], Array.isArray(rv) ? rv : []);
        return;
      }
      if (k === 'tombstones') {
        out[k] = mergeTombstones(lv, rv);
        return;
      }
      if (lv === undefined) out[k] = rv;
      else if (rv === undefined) out[k] = lv;
      else if (valuesEqual(lv, rv)) out[k] = lv;
      else {
        // Scalar / nested object: prefer side with newer item-ish timestamps when possible,
        // otherwise prefer local (device that just edited).
        out[k] = lv;
      }
    });
    return out;
  }

  function mergeTombstones(localTombs, remoteTombs) {
    var out = {};
    var localObj = localTombs && typeof localTombs === 'object' && !Array.isArray(localTombs) ? localTombs : {};
    var remoteObj = remoteTombs && typeof remoteTombs === 'object' && !Array.isArray(remoteTombs) ? remoteTombs : {};
    var ids = {};
    Object.keys(localObj).forEach(function (id) { ids[id] = true; });
    Object.keys(remoteObj).forEach(function (id) { ids[id] = true; });
    Object.keys(ids).forEach(function (id) {
      var lt = localObj[id];
      var rt = remoteObj[id];
      if (lt == null) out[id] = rt;
      else if (rt == null) out[id] = lt;
      else {
        var ln = Date.parse(String(lt)) || 0;
        var rn = Date.parse(String(rt)) || 0;
        out[id] = rn >= ln ? rt : lt;
      }
    });
    return out;
  }

  function stripTombstoned(obj, arrayFields, tombstones) {
    if (!obj || !tombstones) return obj;
    arrayFields.forEach(function (field) {
      if (!Array.isArray(obj[field])) return;
      obj[field] = obj[field].filter(function (it) {
        return !(it && it.id != null && tombstones[String(it.id)]);
      });
    });
    return obj;
  }

  function deepMergeIdAware(localVal, remoteVal) {
    if (remoteVal === undefined) return localVal;
    if (localVal === undefined) return remoteVal;
    if (Array.isArray(localVal) || Array.isArray(remoteVal)) {
      return mergeArrayById(Array.isArray(localVal) ? localVal : [], Array.isArray(remoteVal) ? remoteVal : []);
    }
    if (localVal && remoteVal && typeof localVal === 'object' && typeof remoteVal === 'object') {
      var out = {};
      var keys = {};
      Object.keys(remoteVal).forEach(function (k) { keys[k] = true; });
      Object.keys(localVal).forEach(function (k) { keys[k] = true; });
      Object.keys(keys).forEach(function (k) {
        if (!(k in localVal)) out[k] = remoteVal[k];
        else if (!(k in remoteVal)) out[k] = localVal[k];
        else out[k] = deepMergeIdAware(localVal[k], remoteVal[k]);
      });
      return out;
    }
    // Prefer local scalar when both exist (this device just edited).
    return localVal;
  }

  function normalizeHabitsStore(val) {
    if (Array.isArray(val)) {
      return { items: val.slice(), tombstones: {} };
    }
    if (val && typeof val === 'object') {
      return {
        items: Array.isArray(val.items) ? val.items : [],
        tombstones: (val.tombstones && typeof val.tombstones === 'object' && !Array.isArray(val.tombstones))
          ? val.tombstones
          : {}
      };
    }
    return { items: [], tombstones: {} };
  }

  function mergeKey(key, localVal, remoteVal) {
    // Habits: normalize legacy bare arrays even when one side is missing.
    if (key === 'habits_v1') {
      if (remoteVal == null && localVal == null) return { items: [], tombstones: {} };
      if (remoteVal == null) return normalizeHabitsStore(localVal);
      if (localVal == null) return normalizeHabitsStore(remoteVal);
      var localHabits = normalizeHabitsStore(localVal);
      var remoteHabits = normalizeHabitsStore(remoteVal);
      var mergedHabits = mergeObjectByIdArrays(localHabits, remoteHabits, ['items']);
      if (!mergedHabits.tombstones || typeof mergedHabits.tombstones !== 'object') mergedHabits.tombstones = {};
      stripTombstoned(mergedHabits, ['items'], mergedHabits.tombstones);
      return mergedHabits;
    }

    if (remoteVal == null) return localVal;
    if (localVal == null) return remoteVal;

    // Daily goals are TOP-LEVEL arrays (not objects). Empty local must not wipe remote.
    if (key.indexOf('goals:') === 0) {
      if (Array.isArray(localVal) || Array.isArray(remoteVal)) {
        return mergeGoalsArray(Array.isArray(localVal) ? localVal : [], Array.isArray(remoteVal) ? remoteVal : []);
      }
    }

    if (key === 'projects_v1') {
      if (Array.isArray(localVal) || Array.isArray(remoteVal)) {
        return mergeArrayById(Array.isArray(localVal) ? localVal : [], Array.isArray(remoteVal) ? remoteVal : []);
      }
    }

    if (DEEP_MERGE_KEYS[key]) {
      return deepMergeIdAware(localVal, remoteVal);
    }

    if (MERGE_ARRAY_FIELDS[key]) {
      var mergedObj = mergeObjectByIdArrays(localVal, remoteVal, MERGE_ARRAY_FIELDS[key]);
      if (key === 'jg_media_data_v1') {
        if (!mergedObj.tombstones || typeof mergedObj.tombstones !== 'object') mergedObj.tombstones = {};
        stripTombstoned(mergedObj, MERGE_ARRAY_FIELDS[key], mergedObj.tombstones);
      }
      return mergedObj;
    }

    // goal_streak_v1 — shallow object merge
    if (key === 'goal_streak_v1') {
      if (typeof localVal === 'object' && typeof remoteVal === 'object' && localVal && remoteVal &&
          !Array.isArray(localVal) && !Array.isArray(remoteVal)) {
        var out = {};
        var all = {};
        Object.keys(remoteVal).forEach(function (k) { all[k] = true; });
        Object.keys(localVal).forEach(function (k) { all[k] = true; });
        Object.keys(all).forEach(function (k) {
          var lv = localVal[k];
          var rv = remoteVal[k];
          if (lv === undefined) out[k] = rv;
          else if (rv === undefined) out[k] = lv;
          else if (k === 'count') out[k] = Math.max(Number(lv) || 0, Number(rv) || 0);
          else out[k] = lv;
        });
        return out;
      }
    }

    return localVal;
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

    var quiet = !!opts.quiet;
    if (!quiet) setStatus('syncing', 'Syncing…');
    else if (lastStatus.state !== 'ok') setStatus('syncing', 'Syncing…');

    syncing = getClientAndUser().then(function (ctx) {
      if (ctx.skipped) {
        var msg = ctx.reason === 'signed_out'
          ? 'Sign in once — then sync runs automatically'
          : 'Cloud sync unavailable';
        // Auto/interval sync stays quiet when signed out (no nagging).
        if (!quiet || ctx.reason !== 'signed_out') {
          setStatus('skipped', msg, { reason: ctx.reason });
        }
        return { ok: true, skipped: true, reason: ctx.reason, applied: [], pushed: [], merged: [] };
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
              pushed: [],
              merged: []
            };
          }

          var remoteRows = pull.data || [];
          var remoteMap = {};
          remoteRows.forEach(function (row) { remoteMap[row.key] = row; });

          var keySet = {};
          listLocalKeys().forEach(function (k) { keySet[k] = true; });
          remoteRows.forEach(function (row) {
            if (isSyncKey(row.key)) keySet[row.key] = true;
          });

          var applied = [];
          var mergedKeys = [];
          var toPush = [];
          var pushIso = nowIso();

          Object.keys(keySet).forEach(function (key) {
            var remote = remoteMap[key];
            var localRaw = null;
            try { localRaw = localStorage.getItem(key); } catch (e) { localRaw = null; }
            var localVal = localRaw == null ? null : parseValue(localRaw);
            var remoteVal = remote ? remote.value : null;
            var localMtime = meta.mtimes[key] || null;
            // Missing mtime ⇒ treat as unknown/old so we do not clobber cloud with stale sample data.
            var localTime = localMtime ? new Date(localMtime).getTime() : 0;
            var remoteTime = remote && remote.updated_at ? new Date(remote.updated_at).getTime() : 0;

            var canMerge = !!(MERGE_ARRAY_FIELDS[key] || DEEP_MERGE_KEYS[key] || key === 'habits_v1' ||
              key === 'projects_v1' || key.indexOf('goals:') === 0 || key === 'goal_streak_v1');

            var finalVal;
            var localChanged = false;
            var shouldPush = false;

            if (remoteVal == null && localVal != null) {
              finalVal = localVal;
              shouldPush = true;
              if (!localMtime) {
                meta.mtimes[key] = pushIso;
                localMtime = pushIso;
              }
            } else if (localVal == null && remoteVal != null) {
              finalVal = remoteVal;
              applyRemoteRow(key, finalVal, remote.updated_at);
              applied.push(key);
              meta = readMeta();
            } else if (localVal != null && remoteVal != null && canMerge) {
              finalVal = mergeKey(key, localVal, remoteVal);
              // Goals safety: empty local must adopt remote tasks, never the reverse.
              if (key.indexOf('goals:') === 0 && Array.isArray(remoteVal) && remoteVal.length > 0 &&
                  Array.isArray(finalVal) && finalVal.length === 0) {
                finalVal = mergeGoalsArray(Array.isArray(localVal) ? localVal : [], remoteVal);
              }
              if (!valuesEqual(finalVal, localVal)) {
                applyRemoteRow(key, finalVal, pushIso);
                applied.push(key);
                localChanged = true;
                mergedKeys.push(key);
                meta = readMeta();
              } else {
                finalVal = localVal;
              }
              // Push only when content changed — not merely because local mtime is newer.
              // (Newer empty local mtimes were wiping phone tasks on the Main page.)
              if (localChanged || !valuesEqual(finalVal, remoteVal)) {
                shouldPush = true;
              }
            } else if (localVal != null && remoteVal != null) {
              // Non-merge keys: classic LWW by mtime (missing local mtime loses to remote)
              if (remoteTime > localTime) {
                finalVal = remoteVal;
                applyRemoteRow(key, finalVal, remote.updated_at);
                applied.push(key);
                meta = readMeta();
              } else {
                finalVal = localVal;
                shouldPush = localTime >= remoteTime;
              }
            } else {
              return;
            }

            if (shouldPush && finalVal != null) {
              // Never push an empty goals day over a non-empty cloud day.
              if (key.indexOf('goals:') === 0 && Array.isArray(finalVal) && finalVal.length === 0 &&
                  remoteVal && Array.isArray(remoteVal) && remoteVal.length > 0) {
                shouldPush = false;
                if (!localChanged) {
                  applyRemoteRow(key, remoteVal, remote.updated_at);
                  applied.push(key);
                  finalVal = remoteVal;
                  meta = readMeta();
                }
              }
            }

            if (shouldPush && finalVal != null) {
              // Also block shrinking a goals day to empty / fewer items when local had nothing.
              if (key.indexOf('goals:') === 0 && Array.isArray(finalVal) && Array.isArray(remoteVal) &&
                  Array.isArray(localVal) && localVal.length === 0 && finalVal.length < remoteVal.length) {
                shouldPush = false;
              }
            }

            if (shouldPush && finalVal != null) {
              var stamp = localChanged ? pushIso : (localMtime || (remote && remote.updated_at) || pushIso);
              if (localChanged || !meta.mtimes[key]) {
                meta.mtimes[key] = stamp;
              }
              toPush.push({
                user_id: userId,
                key: key,
                value: finalVal,
                updated_at: meta.mtimes[key]
              });
            }
          });

          writeMeta(meta);

          if (!toPush.length) {
            meta.lastSyncAt = nowIso();
            meta.lastError = null;
            writeMeta(meta);
            var localCount = listLocalKeys().length;
            var msg;
            if (applied.length || mergedKeys.length) {
              msg = 'Updated ' + (applied.length || mergedKeys.length) + ' from cloud';
            } else if (!localCount && !remoteRows.length) {
              msg = 'Signed in — open a hub page and save something';
            } else {
              msg = 'Up to date (' + localCount + ' keys)';
            }
            setStatus('ok', msg, { localCount: localCount, remoteCount: remoteRows.length });
            return {
              ok: true,
              applied: applied,
              pushed: [],
              merged: mergedKeys,
              localCount: localCount,
              remoteCount: remoteRows.length
            };
          }

          return client
            .from(TABLE)
            .upsert(toPush, { onConflict: 'user_id,key' })
            .select('key')
            .then(function (pushRes) {
              if (pushRes.error) {
                meta.lastError = pushRes.error.message || 'Push failed';
                writeMeta(meta);
                setStatus('error', meta.lastError);
                return {
                  ok: false,
                  error: pushRes.error,
                  applied: applied,
                  pushed: [],
                  merged: mergedKeys
                };
              }
              meta.lastSyncAt = nowIso();
              meta.lastError = null;
              writeMeta(meta);
              var pushedKeys = toPush.map(function (r) { return r.key; });
              setStatus('ok', 'Synced ' + pushedKeys.length + ' key' + (pushedKeys.length === 1 ? '' : 's') +
                (mergedKeys.length ? (' · merged ' + mergedKeys.length) : '') +
                (applied.length && !mergedKeys.length ? (' · pulled ' + applied.length) : ''));
              return { ok: true, applied: applied, pushed: pushedKeys, merged: mergedKeys };
            });
        });
    }).catch(function (err) {
      var message = (err && err.message) || 'Sync failed';
      setStatus('error', message);
      return { ok: false, error: err, applied: [], pushed: [], merged: [] };
    }).then(function (result) {
      syncing = null;
      try {
        global.dispatchEvent(new CustomEvent('jg-sync-complete', { detail: result }));
      } catch (e) { /* ignore */ }

      // Reload once when cloud/merge changed local data so UIs refresh.
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
      syncNow({ skipReload: true, quiet: true });
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

  function startIntervalSync() {
    if (intervalTimer) return;
    intervalTimer = global.setInterval(function () {
      syncNow({ skipReload: true, quiet: true });
    }, INTERVAL_MS);
  }

  function boot() {
    installHooks();
    // Do NOT stamp existing keys with "now" — that made stale local data overwrite cloud.
    syncNow({ skipReload: false }).catch(function () { /* status already set */ });
    startIntervalSync();
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
    mergeKey: mergeKey,
    getStatus: function () { return lastStatus; },
    onStatus: onStatus,
    META_KEY: META_KEY,
    EXACT_KEYS: EXACT_KEYS.slice(),
    INTERVAL_MS: INTERVAL_MS
  };

  installHooks();

  if (global.document) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      setTimeout(boot, 0);
    }
    global.addEventListener('online', function () { syncNow({ skipReload: true, quiet: true }); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') syncNow({ skipReload: true, quiet: true });
    });
  }
})(window);
