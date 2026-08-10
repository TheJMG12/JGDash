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
    projects_v1: ['items'],
    jg_media_data_v1: ['items', 'visuals', 'watchlist', 'books', 'feeds'],
    jg_finance_data_v1: ['transactions', 'budgets', 'goals', 'holdings', 'watchlist'],
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

  /** Empty Health blob — same shape as health.html defaultData (no sample content). */
  function emptyHealthBlob() {
    return {
      therapy: {
        personal: {
          appointment: { when: '', therapist: '', mode: '', link: '', focus: '', tags: '' },
          mood: { lastSession: '', before: '', after: '', improved: '', difficult: '' },
          notes: { topicsGoalsFocus: '' },
          goals: [],
          homework: [],
          journal: { sessionNotes: '', questions: '' },
          history: [],
          reminders: []
        },
        couples: {
          appointment: { when: '', therapist: '', mode: '', link: '', focus: '', tags: '' },
          checkin: { connection: '', conflict: '', gratitude: '' },
          notes: { topicsGoalsFocus: '' },
          actions: [],
          themes: [],
          reflection: { improved: '', difficult: '' }
        }
      },
      nutrition: {
        targets: { calories: '', protein: '', carbs: '', fat: '', prepDay: '', prepNotes: '', budget: '' },
        meals: {},
        grocery: [],
        pantry: [],
        aisleNotes: [],
        recipes: []
      },
      habits: {
        supplements: [],
        tracks: [],
        weekKey: '',
        water: { cups: 0, date: '', updatedAt: null },
        manual: { appetite: '', cravings: '', digestive: '', stressors: '' },
        symptoms: [],
        body: { weight: '', waist: '', notes: '' },
        appointments: [],
        dailyNotes: ''
      },
      tombstones: {}
    };
  }

  /**
   * Score unique strings from the old auto-seeded Health demo.
   * Threshold keeps a lone "Greek yogurt bowl" meal from wiping real data.
   */
  function healthDemoScore(val) {
    if (!val || typeof val !== 'object') return 0;
    var score = 0;
    try {
      var therapy = val.therapy || {};
      var personal = therapy.personal || {};
      var couples = therapy.couples || {};
      var pAppt = personal.appointment || {};
      var cAppt = couples.appointment || {};
      if (String(pAppt.therapist || '') === 'Dr. Elena Vargas') score += 3;
      if (String(cAppt.therapist || '') === 'Jordan Lee, LMFT') score += 3;
      if (String((personal.journal || {}).sessionNotes || '').indexOf('midweek overload pattern') !== -1) score += 2;
      if (String((personal.mood || {}).improved || '').indexOf('pause-before-reply') !== -1) score += 2;
      var meal = val.nutrition && val.nutrition.meals && val.nutrition.meals['0-b'];
      if (meal && String(meal.title || '') === 'Greek yogurt bowl') score += 2;
      if (String((val.habits || {}).dailyNotes || '').indexOf('Prep chicken for Wed/Thu') !== -1) score += 2;
      var goals = (personal.goals) || [];
      if (goals.some(function (g) { return g && String(g.title || '') === 'Reduce rumination after 9 PM'; })) score += 2;
      var recipes = (val.nutrition && val.nutrition.recipes) || [];
      if (recipes.some(function (r) { return r && String(r.title || '') === 'High-protein chicken bowl'; })) score += 1;
    } catch (e) { /* ignore */ }
    return score;
  }

  /** True when the blob is the old sample seed (or mostly that seed) — never treat as live user data.
   *  Threshold 5: a lone leftover "Dr. Elena Vargas" field must not wipe real edits. */
  function looksLikeHealthDemoSeed(val) {
    return healthDemoScore(val) >= 5;
  }

  function healthContentWeight(val) {
    var n = 0;
    function walk(o) {
      if (o == null) return;
      if (typeof o === 'string') {
        if (String(o).trim()) n += 1;
        return;
      }
      if (typeof o !== 'object') return;
      if (Array.isArray(o)) {
        n += o.length;
        o.forEach(walk);
        return;
      }
      Object.keys(o).forEach(function (k) {
        if (k === 'tombstones') return;
        walk(o[k]);
      });
    }
    walk(val);
    return n;
  }

  /**
   * Resolve Health sync while treating demo seeds as non-data.
   * Poisoned cloud rows that still contain Elena/etc. are discarded and purged.
   */
  function resolveHealthSync(localVal, remoteVal, localTime, remoteTime) {
    var localDemo = looksLikeHealthDemoSeed(localVal);
    var remoteDemo = looksLikeHealthDemoSeed(remoteVal);
    var localUse = localDemo ? null : localVal;
    var remoteUse = remoteDemo ? null : remoteVal;
    var purgedDemo = !!(localDemo || remoteDemo);

    if (localUse == null && remoteUse == null) {
      return { finalVal: emptyHealthBlob(), forcePush: true, purgedDemo: true };
    }
    if (localUse == null) {
      return { finalVal: remoteUse, forcePush: purgedDemo, purgedDemo: purgedDemo };
    }
    if (remoteUse == null) {
      // Keep real local edits and push so cloud demo is overwritten.
      return { finalVal: localUse, forcePush: true, purgedDemo: purgedDemo };
    }
    var merged = mergeKey('jg_health_data_v1', localUse, remoteUse, {
      localTime: localTime,
      remoteTime: remoteTime,
      skipHealthDemoGuard: true
    });
    if (looksLikeHealthDemoSeed(merged)) {
      return { finalVal: emptyHealthBlob(), forcePush: true, purgedDemo: true };
    }
    return {
      finalVal: merged,
      forcePush: purgedDemo || !valuesEqual(merged, remoteUse),
      purgedDemo: purgedDemo
    };
  }

  /**
   * Recursive id-aware merge for nested health blobs.
   * preferRemote: when true, scalar / leaf conflicts take the remote value (LWW by key mtime).
   */
  function deepMergeIdAware(localVal, remoteVal, preferRemote) {
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
        else out[k] = deepMergeIdAware(localVal[k], remoteVal[k], preferRemote);
      });
      return out;
    }
    return preferRemote ? remoteVal : localVal;
  }

  function goalsItemCount(val) {
    if (Array.isArray(val)) return val.length;
    if (val && typeof val === 'object' && Array.isArray(val.items)) return val.items.length;
    return 0;
  }

  function stripTombstonedDeep(obj, tombstones) {
    if (!obj || !tombstones || typeof obj !== 'object') return obj;
    Object.keys(obj).forEach(function (k) {
      if (k === 'tombstones') return;
      var v = obj[k];
      if (Array.isArray(v)) {
        obj[k] = v.filter(function (it) {
          return !(it && typeof it === 'object' && it.id != null && tombstones[String(it.id)]);
        });
        obj[k].forEach(function (it) {
          if (it && typeof it === 'object') stripTombstonedDeep(it, tombstones);
        });
      } else if (v && typeof v === 'object') {
        // Health meal plan slots are keyed maps — honor meal:<slot> tombstones.
        if (k === 'meals') {
          Object.keys(v).forEach(function (slot) {
            if (tombstones['meal:' + slot]) delete v[slot];
          });
        } else {
          stripTombstonedDeep(v, tombstones);
        }
      }
    });
    return obj;
  }

  /**
   * Meal slots reuse keys (0-b, …). Tombstone union alone would re-kill a re-add when
   * the other device still has meal:<slot>. Use clock mtime (not content-weight): if the
   * newer device still has that slot filled, drop the tombstone (revive). Deletes on the
   * newer device keep the tomb and strip still removes the older meal.
   */
  function reconcileMealSlotTombs(merged, localH, remoteH, preferRemoteByTime) {
    if (!merged || typeof merged !== 'object') return;
    if (!merged.tombstones || typeof merged.tombstones !== 'object') return;
    var preferred = preferRemoteByTime ? remoteH : localH;
    var preferMeals = (preferred && preferred.nutrition && preferred.nutrition.meals) || {};
    Object.keys(merged.tombstones).forEach(function (id) {
      if (String(id).indexOf('meal:') !== 0) return;
      var slot = String(id).slice(5);
      if (preferMeals[slot]) delete merged.tombstones[id];
    });
  }

  /** Water intake: newer calendar day wins; same day → updatedAt LWW. */
  function mergeWaterIntake(a, b) {
    if (!a || typeof a !== 'object') return b && typeof b === 'object' ? b : { cups: 0, date: '', updatedAt: null };
    if (!b || typeof b !== 'object') return a;
    var ad = String(a.date || '');
    var bd = String(b.date || '');
    if (ad !== bd) return ad > bd ? a : b;
    var at = Date.parse(a.updatedAt) || 0;
    var bt = Date.parse(b.updatedAt) || 0;
    if (at !== bt) return at > bt ? a : b;
    return (Number(a.cups) || 0) >= (Number(b.cups) || 0) ? a : b;
  }

  /**
   * Habit weekKey is Monday (ET) of the habit week. Newer week wins patterns;
   * tracks that exist only on the older week are kept with an empty pattern.
   */
  function reconcileHabitWeek(merged, localH, remoteH) {
    if (!merged || typeof merged !== 'object') return;
    if (!merged.habits || typeof merged.habits !== 'object') merged.habits = {};
    var lh = (localH && localH.habits) || {};
    var rh = (remoteH && remoteH.habits) || {};
    var lKey = String(lh.weekKey || '');
    var rKey = String(rh.weekKey || '');
    merged.habits.water = mergeWaterIntake(lh.water, rh.water);
    if (!lKey && !rKey) return;
    if (lKey === rKey) {
      merged.habits.weekKey = lKey;
      return;
    }
    var preferLocal = lKey > rKey;
    var winner = preferLocal ? lh : rh;
    var loser = preferLocal ? rh : lh;
    merged.habits.weekKey = preferLocal ? lKey : rKey;
    var winMap = {};
    var out = [];
    (winner.tracks || []).forEach(function (t) {
      if (!t || t.id == null) return;
      winMap[String(t.id)] = true;
      out.push(t);
    });
    (loser.tracks || []).forEach(function (t) {
      if (!t || t.id == null) return;
      if (winMap[String(t.id)]) return;
      out.push({
        id: t.id,
        name: t.name,
        pattern: [0, 0, 0, 0, 0, 0, 0],
        updatedAt: t.updatedAt || new Date().toISOString()
      });
    });
    merged.habits.tracks = out;
  }

  function goalsHasTombstones(val) {
    var n = normalizeItemsStore(val);
    return Object.keys(n.tombstones || {}).length > 0;
  }

  function normalizeItemsStore(val) {
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

  function mergeItemsStore(localVal, remoteVal) {
    var localStore = normalizeItemsStore(localVal);
    var remoteStore = normalizeItemsStore(remoteVal);
    var merged = mergeObjectByIdArrays(localStore, remoteStore, ['items']);
    if (!merged.tombstones || typeof merged.tombstones !== 'object') merged.tombstones = {};
    stripTombstoned(merged, ['items'], merged.tombstones);
    return merged;
  }

  function mergeKey(key, localVal, remoteVal, opts) {
    opts = opts || {};
    // Habits + Projects: { items, tombstones } (legacy bare arrays migrated).
    if (key === 'habits_v1' || key === 'projects_v1') {
      if (remoteVal == null && localVal == null) return { items: [], tombstones: {} };
      if (remoteVal == null) return normalizeItemsStore(localVal);
      if (localVal == null) return normalizeItemsStore(remoteVal);
      return mergeItemsStore(localVal, remoteVal);
    }

    // Daily goals: prefer { items, tombstones }; legacy bare arrays supported.
    if (key.indexOf('goals:') === 0) {
      if (remoteVal == null && localVal == null) return { items: [], tombstones: {} };
      if (remoteVal == null) return normalizeItemsStore(localVal);
      if (localVal == null) return normalizeItemsStore(remoteVal);
      var localGoals = normalizeItemsStore(localVal);
      var remoteGoals = normalizeItemsStore(remoteVal);
      var mergedGoalItems = mergeGoalsArray(localGoals.items, remoteGoals.items);
      var mergedGoalTombs = mergeTombstones(localGoals.tombstones, remoteGoals.tombstones);
      var goalOut = { items: mergedGoalItems, tombstones: mergedGoalTombs };
      // Also drop items whose id is tombstoned
      stripTombstoned(goalOut, ['items'], goalOut.tombstones);
      return goalOut;
    }

    if (remoteVal == null) return localVal;
    if (localVal == null) return remoteVal;

    if (DEEP_MERGE_KEYS[key]) {
      var localTime = Number(opts.localTime) || 0;
      var remoteTime = Number(opts.remoteTime) || 0;
      var localH = localVal;
      var remoteH = remoteVal;
      // Demo seeds are never authoritative — drop them before merging.
      if (!opts.skipHealthDemoGuard && key === 'jg_health_data_v1') {
        if (looksLikeHealthDemoSeed(localH)) localH = null;
        if (looksLikeHealthDemoSeed(remoteH)) remoteH = null;
        if (localH == null && remoteH == null) return emptyHealthBlob();
        if (localH == null) return remoteH;
        if (remoteH == null) return localH;
      }
      // Scalar conflicts follow key mtime (newer device wins). Missing local mtime loses to cloud.
      var preferRemoteByTime = remoteTime > localTime;
      var preferRemote = preferRemoteByTime;
      if (healthContentWeight(localH) === 0 && healthContentWeight(remoteH) > 0) {
        preferRemote = true;
      }
      var deep = deepMergeIdAware(localH, remoteH, preferRemote);
      if (deep && typeof deep === 'object' && !Array.isArray(deep)) {
        deep.tombstones = mergeTombstones(
          localH && localH.tombstones,
          remoteH && remoteH.tombstones
        );
        // Revive/delete for meal slots follows clock mtime, not content-weight.
        reconcileMealSlotTombs(deep, localH, remoteH, preferRemoteByTime);
        if (key === 'jg_health_data_v1') {
          reconcileHabitWeek(deep, localH, remoteH);
        }
        stripTombstonedDeep(deep, deep.tombstones);
      }
      return deep;
    }

    if (MERGE_ARRAY_FIELDS[key]) {
      var mergedObj = mergeObjectByIdArrays(localVal, remoteVal, MERGE_ARRAY_FIELDS[key]);
      if (!mergedObj.tombstones || typeof mergedObj.tombstones !== 'object') {
        mergedObj.tombstones = mergeTombstones(
          localVal && localVal.tombstones,
          remoteVal && remoteVal.tombstones
        );
      } else {
        mergedObj.tombstones = mergeTombstones(
          localVal && localVal.tombstones,
          remoteVal && remoteVal.tombstones
        );
      }
      stripTombstoned(mergedObj, MERGE_ARRAY_FIELDS[key], mergedObj.tombstones);
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

            // Health: discard poisoned demo seeds from either side and purge cloud.
            if (key === 'jg_health_data_v1' && (localVal != null || remoteVal != null)) {
              var healthRes = resolveHealthSync(localVal, remoteVal, localTime, remoteTime);
              finalVal = healthRes.finalVal;
              if (!valuesEqual(finalVal, localVal)) {
                applyRemoteRow(key, finalVal, pushIso);
                applied.push(key);
                localChanged = true;
                mergedKeys.push(key);
                meta = readMeta();
              }
              if (healthRes.forcePush || localChanged || !valuesEqual(finalVal, remoteVal)) {
                shouldPush = true;
              }
            } else if (remoteVal == null && localVal != null) {
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
              var mergeOpts = { localTime: localTime, remoteTime: remoteTime };
              finalVal = mergeKey(key, localVal, remoteVal, mergeOpts);
              // Goals safety: empty local adopts remote unless local has tombstones
              // (intentional deletes — empty + tombstones must stay empty).
              if (key.indexOf('goals:') === 0) {
                var remoteGoalCount = goalsItemCount(remoteVal);
                var finalGoalCount = goalsItemCount(finalVal);
                var localGoalCount = goalsItemCount(localVal);
                if (remoteGoalCount > 0 && finalGoalCount === 0 && localGoalCount === 0 &&
                    !goalsHasTombstones(localVal) && !goalsHasTombstones(finalVal)) {
                  finalVal = mergeKey(key, localVal, remoteVal, mergeOpts);
                  if (goalsItemCount(finalVal) === 0) finalVal = normalizeItemsStore(remoteVal);
                }
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
              // Never push a bare empty goals day over cloud content — but DO push
              // intentional empties that carry tombstones so deletes stick.
              if (key.indexOf('goals:') === 0 && goalsItemCount(finalVal) === 0 && goalsItemCount(remoteVal) > 0) {
                if (goalsHasTombstones(finalVal) || goalsHasTombstones(localVal)) {
                  shouldPush = true;
                } else {
                  shouldPush = false;
                  if (!localChanged) {
                    applyRemoteRow(key, normalizeItemsStore(remoteVal), remote.updated_at);
                    applied.push(key);
                    finalVal = normalizeItemsStore(remoteVal);
                    meta = readMeta();
                  }
                }
              }
            }

            if (shouldPush && finalVal != null) {
              // Block shrinking a goals day when local had nothing AND no tombstones.
              if (key.indexOf('goals:') === 0 && goalsItemCount(localVal) === 0 &&
                  goalsItemCount(finalVal) < goalsItemCount(remoteVal) &&
                  !goalsHasTombstones(localVal) && !goalsHasTombstones(finalVal)) {
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
    looksLikeHealthDemoSeed: looksLikeHealthDemoSeed,
    emptyHealthBlob: emptyHealthBlob,
    resolveHealthSync: resolveHealthSync,
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
