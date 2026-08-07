/* JGDash WHOOP client — OAuth + rate-limited live metrics via Vercel api/whoop-*.
 *
 * Rate limits (WHOOP): 100/min, 10000/day. We stay under with buffers:
 *   80/min, 8000/day, and a 15-minute metrics cache (3 API calls per sync).
 */
(function (global) {
  'use strict';

  var TOKEN_KEY = 'jg_whoop_tokens_v1';
  var METRICS_KEY = 'jg_whoop_metrics_v1';
  var RATE_KEY = 'jg_whoop_rate_v1';
  var STATE_KEY = 'jg_whoop_oauth_state_v1';
  var CACHE_MS = 15 * 60 * 1000;
  var MIN_SYNC_GAP_MS = 5 * 60 * 1000;
  var MINUTE_CAP = 80;   // buffer under 100
  var DAY_CAP = 8000;    // buffer under 10000
  var SCOPES = 'read:recovery read:cycles read:sleep read:workout read:profile offline';

  function cfg() {
    return global.JGDASH_CONFIG || {};
  }

  function clientId() {
    return String(cfg().WHOOP_CLIENT_ID || '').trim();
  }

  function redirectUri() {
    return String(cfg().WHOOP_REDIRECT_URI || '').trim() ||
      ((cfg().SITE_URL || '').replace(/\/$/, '') + '/api/whoop-callback');
  }

  function apiBase() {
    // Prefer same origin on Vercel; fall back to SITE_URL for local demos hitting prod APIs.
    if (global.location && /vercel\.app$|jg-dash/i.test(global.location.hostname || '')) {
      return '';
    }
    var site = (cfg().SITE_URL || '').replace(/\/$/, '');
    return site || '';
  }

  function randomState() {
    var bytes = new Uint8Array(16);
    if (global.crypto && global.crypto.getRandomValues) {
      global.crypto.getRandomValues(bytes);
    } else {
      for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    var out = '';
    for (var j = 0; j < bytes.length; j++) {
      out += (bytes[j] < 16 ? '0' : '') + bytes[j].toString(16);
    }
    return out;
  }

  function saveOAuthState(state) {
    try { sessionStorage.setItem(STATE_KEY, state); } catch (e) {
      try { localStorage.setItem(STATE_KEY, state); } catch (e2) { /* ignore */ }
    }
  }

  function readOAuthState() {
    try {
      return sessionStorage.getItem(STATE_KEY) || localStorage.getItem(STATE_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function clearOAuthState() {
    try { sessionStorage.removeItem(STATE_KEY); } catch (e) { /* ignore */ }
    try { localStorage.removeItem(STATE_KEY); } catch (e2) { /* ignore */ }
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* quota */ }
  }

  function getTokens() {
    var t = readJson(TOKEN_KEY, null);
    if (!t || !t.access) return null;
    return t;
  }

  function setTokens( partial) {
    var cur = getTokens() || {};
    var next = {
      access: partial.access != null ? partial.access : cur.access,
      refresh: partial.refresh != null ? partial.refresh : cur.refresh,
      expiresAt: partial.expiresAt != null ? Number(partial.expiresAt) : cur.expiresAt
    };
    writeJson(TOKEN_KEY, next);
    return next;
  }

  function clearTokens() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
  }

  function getCachedMetrics() {
    return readJson(METRICS_KEY, null);
  }

  function setCachedMetrics(metrics) {
    writeJson(METRICS_KEY, metrics);
  }

  function clearCachedMetrics() {
    try { localStorage.removeItem(METRICS_KEY); } catch (e) { /* ignore */ }
  }

  function dayKey(d) {
    d = d || new Date();
    function p2(n) { return (n < 10 ? '0' : '') + n; }
    return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate());
  }

  function readRate() {
    var r = readJson(RATE_KEY, null) || { day: dayKey(), dayCount: 0, stamps: [] };
    var today = dayKey();
    if (r.day !== today) {
      r = { day: today, dayCount: 0, stamps: [] };
    }
    var cutoff = Date.now() - 60 * 1000;
    r.stamps = (r.stamps || []).filter(function (t) { return t >= cutoff; });
    return r;
  }

  function writeRate(r) {
    writeJson(RATE_KEY, r);
  }

  function getRateStatus() {
    var r = readRate();
    return {
      minuteUsed: r.stamps.length,
      minuteCap: MINUTE_CAP,
      dayUsed: r.dayCount,
      dayCap: DAY_CAP,
      day: r.day
    };
  }

  function canSpend(n) {
    n = n || 1;
    var r = readRate();
    if (r.stamps.length + n > MINUTE_CAP) {
      return { ok: false, reason: 'minute', status: getRateStatus() };
    }
    if (r.dayCount + n > DAY_CAP) {
      return { ok: false, reason: 'day', status: getRateStatus() };
    }
    return { ok: true, status: getRateStatus() };
  }

  function spend(n) {
    n = n || 1;
    var gate = canSpend(n);
    if (!gate.ok) return gate;
    var r = readRate();
    var now = Date.now();
    for (var i = 0; i < n; i++) r.stamps.push(now);
    r.dayCount += n;
    writeRate(r);
    return { ok: true, status: getRateStatus() };
  }

  function isConnected() {
    return !!getTokens();
  }

  function startConnect() {
    var id = clientId();
    if (!id) throw new Error('WHOOP_CLIENT_ID missing in js/config.js');
    var redirect = redirectUri();
    // WHOOP requires a non-empty `state` — missing/empty yields error=invalid_state.
    var state = randomState();
    saveOAuthState(state);
    var url = 'https://api.prod.whoop.com/oauth/oauth2/auth'
      + '?client_id=' + encodeURIComponent(id)
      + '&redirect_uri=' + encodeURIComponent(redirect)
      + '&response_type=code'
      + '&scope=' + encodeURIComponent(SCOPES)
      + '&state=' + encodeURIComponent(state);
    global.location.href = url;
  }

  function disconnect() {
    clearTokens();
    clearCachedMetrics();
    clearOAuthState();
  }

  /** Capture tokens from /health.html#whoop_access=… after OAuth callback. */
  function captureCallbackHash() {
    var hash = (global.location && global.location.hash) || '';
    if (!hash || hash.indexOf('whoop_access=') === -1) return false;
    var q = new URLSearchParams(hash.replace(/^#/, ''));
    var access = q.get('whoop_access');
    var refresh = q.get('whoop_refresh');
    var expires = q.get('whoop_expires');
    var returnedState = q.get('whoop_state') || '';
    var expected = readOAuthState();
    if (expected && returnedState && expected !== returnedState) {
      clearOAuthState();
      throw new Error('WHOOP OAuth state mismatch — try Connect again');
    }
    clearOAuthState();
    if (!access) return false;
    setTokens({
      access: access,
      refresh: refresh || '',
      expiresAt: expires ? Number(expires) : (Date.now() + 3600 * 1000)
    });
    // Clear tokens from URL so they are not bookmarked / shared.
    if (global.history && global.history.replaceState) {
      global.history.replaceState(null, '', global.location.pathname + global.location.search);
    } else {
      global.location.hash = '';
    }
    return true;
  }

  function ensureFreshToken() {
    var t = getTokens();
    if (!t) return Promise.reject(new Error('not_connected'));
    // Refresh 2 minutes before expiry
    if (t.expiresAt && Date.now() < (t.expiresAt - 2 * 60 * 1000)) {
      return Promise.resolve(t);
    }
    if (!t.refresh) return Promise.resolve(t); // try existing access
    var gate = spend(1); // refresh hits WHOOP token endpoint (server-side), count conservatively
    if (!gate.ok) return Promise.reject(new Error('rate_limited_' + gate.reason));
    return fetch(apiBase() + '/api/whoop-refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: t.refresh })
    }).then(function (r) {
      return r.text().then(function (text) {
        if (!r.ok) throw new Error('refresh_failed:' + text);
        var json = JSON.parse(text);
        return setTokens({
          access: json.access_token || t.access,
          refresh: json.refresh_token || t.refresh,
          expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000
        });
      });
    });
  }

  function whoopGet(path, query) {
    return ensureFreshToken().then(function (t) {
      var gate = spend(1);
      if (!gate.ok) {
        var err = new Error('rate_limited_' + gate.reason);
        err.rate = gate.status;
        throw err;
      }
      var qs = new URLSearchParams(query || {});
      qs.set('path', path);
      return fetch(apiBase() + '/api/whoop-data?' + qs.toString(), {
        headers: { 'Authorization': 'Bearer ' + t.access, 'Accept': 'application/json' }
      }).then(function (r) {
        return r.text().then(function (text) {
          var json = null;
          try { json = text ? JSON.parse(text) : null; } catch (e) { /* keep text */ }
          if (!r.ok) {
            var e2 = new Error('whoop_http_' + r.status);
            e2.status = r.status;
            e2.body = json || text;
            throw e2;
          }
          return json;
        });
      });
    });
  }

  function firstRecord(payload) {
    if (!payload) return null;
    if (Array.isArray(payload.records) && payload.records.length) return payload.records[0];
    if (Array.isArray(payload) && payload.length) return payload[0];
    return payload;
  }

  function records(payload) {
    if (!payload) return [];
    if (Array.isArray(payload.records)) return payload.records;
    if (Array.isArray(payload)) return payload;
    return [];
  }

  function recoveryZone(score) {
    if (score == null || isNaN(score)) return '';
    if (score >= 67) return 'g';
    if (score >= 34) return 'y';
    return 'r';
  }

  function zoneLabel(z) {
    return z === 'g' ? 'Green' : z === 'y' ? 'Yellow' : z === 'r' ? 'Red' : '';
  }

  function msToHours(ms) {
    if (ms == null || isNaN(ms)) return null;
    return ms / 3600000;
  }

  function fmtHours(h) {
    if (h == null || isNaN(h)) return '—';
    var hr = Math.floor(h);
    var min = Math.round((h - hr) * 60);
    if (min === 60) { hr += 1; min = 0; }
    return hr + 'h ' + (min < 10 ? '0' : '') + min + 'm';
  }

  function parseMetrics(recoveryList, cycleList, sleepList, workoutList) {
    var rec = firstRecord({ records: recoveryList });
    var cyc = firstRecord({ records: cycleList });
    var sleep = firstRecord({ records: sleepList });
    var score = (rec && rec.score) || {};
    var cycScore = (cyc && cyc.score) || {};
    var sleepScore = (sleep && sleep.score) || {};

    var recoveryPct = score.recovery_score;
    var z = recoveryZone(recoveryPct);
    var sleepPerf = sleepScore.sleep_performance_percentage;
    var stages = sleepScore.stage_summary || {};
    var inBed = msToHours(stages.total_in_bed_time_milli);
    var sleepNeedParts = sleepScore.sleep_needed || {};
    var needMs = (Number(sleepNeedParts.baseline_milli) || 0)
      + (Number(sleepNeedParts.need_from_sleep_debt_milli) || 0)
      + (Number(sleepNeedParts.need_from_recent_strain_milli) || 0)
      + (Number(sleepNeedParts.need_from_recent_nap_milli) || 0);
    var needH = needMs ? msToHours(needMs) : null;
    var strain = cycScore.strain;
    var kj = cycScore.kilojoule;
    var kcal = kj != null ? Math.round(Number(kj) / 4.184) : null;
    var hrv = score.hrv_rmssd_milli;
    var rhr = score.resting_heart_rate;
    var resp = sleepScore.respiratory_rate;

    var trend = recoveryList.slice(0, 7).map(function (r) {
      var s = (r && r.score && r.score.recovery_score);
      return s != null ? Number(s) : null;
    }).reverse();

    var workouts = (workoutList || []).slice(0, 5).map(function (w) {
      var ws = (w && w.score) || {};
      return {
        sport: (w && (w.sport_name || w.sport_id)) || 'Workout',
        strain: ws.strain != null ? Number(ws.strain).toFixed(1) : '—',
        start: w.start || w.created_at || ''
      };
    });

    return {
      fetchedAt: Date.now(),
      recovery: {
        value: recoveryPct != null ? Math.round(recoveryPct) + '%' : '—',
        sub: (zoneLabel(z) ? zoneLabel(z) + ' zone' : 'Recovery') + ' · live',
        zone: z,
        raw: recoveryPct
      },
      sleep: {
        value: sleepPerf != null ? Math.round(sleepPerf) + '%' : '—',
        sub: (inBed != null ? fmtHours(inBed) : 'Sleep') + (needH != null ? ' · need ' + fmtHours(needH) : ''),
        zone: sleepPerf != null ? (sleepPerf >= 85 ? 'g' : sleepPerf >= 70 ? 'y' : 'r') : '',
        duration: fmtHours(inBed),
        need: fmtHours(needH),
        raw: sleepPerf
      },
      strain: {
        value: strain != null ? Number(strain).toFixed(1) : '—',
        sub: strain == null ? 'No cycle score' : (strain < 8 ? 'Light' : strain < 14 ? 'Moderate' : 'High') + ' load',
        zone: strain == null ? '' : (strain < 8 ? 'g' : strain < 14 ? 'y' : 'r'),
        raw: strain
      },
      hrv: {
        value: hrv != null ? Math.round(hrv) + ' ms' : '—',
        sub: 'Overnight RMSSD',
        zone: 'g',
        raw: hrv
      },
      rhr: {
        value: rhr != null ? Math.round(rhr) + ' bpm' : '—',
        sub: 'Resting',
        zone: 'g',
        raw: rhr
      },
      resp: {
        value: resp != null ? Number(resp).toFixed(1) : '—',
        sub: 'breaths / min',
        zone: '',
        raw: resp
      },
      calories: {
        value: kcal != null ? String(kcal) : '—',
        sub: 'from cycle kJ · live',
        zone: ''
      },
      steps: {
        value: '—',
        sub: 'Not in WHOOP API',
        zone: ''
      },
      sleepDetail: {
        duration: fmtHours(inBed),
        need: fmtHours(needH),
        efficiency: sleepScore.sleep_efficiency_percentage != null
          ? Math.round(sleepScore.sleep_efficiency_percentage) + '%'
          : '—'
      },
      trend: trend,
      workouts: workouts,
      rate: getRateStatus()
    };
  }

  function syncMetrics(opts) {
    opts = opts || {};
    var cached = getCachedMetrics();
    var now = Date.now();
    if (!opts.force && cached && cached.fetchedAt && (now - cached.fetchedAt) < CACHE_MS) {
      return Promise.resolve({ metrics: cached, fromCache: true, rate: getRateStatus() });
    }
    if (!opts.force && cached && cached.fetchedAt && (now - cached.fetchedAt) < MIN_SYNC_GAP_MS) {
      return Promise.resolve({ metrics: cached, fromCache: true, rate: getRateStatus(), throttled: true });
    }

    // Budget 4 calls: recovery, cycle, sleep, workout lists
    var gate = canSpend(4);
    if (!gate.ok) {
      if (cached) return Promise.resolve({ metrics: cached, fromCache: true, rateLimited: true, rate: gate.status });
      return Promise.reject(Object.assign(new Error('rate_limited_' + gate.reason), { rate: gate.status }));
    }

    return Promise.all([
      whoopGet('/recovery', { limit: '7' }),
      whoopGet('/cycle', { limit: '7' }),
      whoopGet('/activity/sleep', { limit: '7' }),
      whoopGet('/activity/workout', { limit: '5' })
    ]).then(function (parts) {
      var metrics = parseMetrics(
        records(parts[0]),
        records(parts[1]),
        records(parts[2]),
        records(parts[3])
      );
      setCachedMetrics(metrics);
      return { metrics: metrics, fromCache: false, rate: getRateStatus() };
    });
  }

  global.JGWhoop = {
    TOKEN_KEY: TOKEN_KEY,
    METRICS_KEY: METRICS_KEY,
    CACHE_MS: CACHE_MS,
    clientId: clientId,
    redirectUri: redirectUri,
    isConnected: isConnected,
    startConnect: startConnect,
    disconnect: disconnect,
    captureCallbackHash: captureCallbackHash,
    ensureFreshToken: ensureFreshToken,
    syncMetrics: syncMetrics,
    getCachedMetrics: getCachedMetrics,
    getRateStatus: getRateStatus,
    canSpend: canSpend
  };
})(window);
