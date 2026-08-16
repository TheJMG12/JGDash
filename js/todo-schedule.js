/**
 * Shared helpers for To Do day/time + Apple Calendar fields.
 * Goal fields: time ("HH:MM" 24h, optional), cal (boolean, default true for open tasks on feed).
 */
(function (global) {
  'use strict';

  function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function toDateString(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function parseDateString(s) {
    var parts = String(s || '').split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function getActiveDateString(now) {
    now = now || new Date();
    var d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (now.getHours() < 6) d.setDate(d.getDate() - 1);
    return toDateString(d);
  }

  function addDaysYmd(ymd, n) {
    var d = parseDateString(ymd);
    d.setDate(d.getDate() + n);
    return toDateString(d);
  }

  /** Normalize "9:00", "09:00", "9am", "3:30 PM" → "HH:MM" or "". */
  function normalizeTime(raw) {
    if (raw == null || raw === '') return '';
    var s = String(raw).trim().toLowerCase();
    if (!s || s === 'off' || s === 'none' || s === '—') return '';
    var m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (!m) return '';
    var h = parseInt(m[1], 10);
    var min = m[2] != null ? parseInt(m[2], 10) : 0;
    var ap = (m[3] || '').toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    if (h < 0 || h > 23 || min < 0 || min > 59) return '';
    return pad2(h) + ':' + pad2(min);
  }

  function formatTimeLabel(hhmm) {
    var t = normalizeTime(hhmm);
    if (!t) return '';
    var parts = t.split(':').map(Number);
    var h = parts[0];
    var min = parts[1];
    var ap = h >= 12 ? 'pm' : 'am';
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return min ? h12 + ':' + pad2(min) + ap : h12 + ap;
  }

  function buildGoal(text, opts) {
    opts = opts || {};
    var time = normalizeTime(opts.time);
    var goal = {
      id: opts.id || ('g_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)),
      text: String(text || '').trim(),
      done: !!opts.done,
      queued: !!opts.queued,
      cal: opts.cal !== false
    };
    if (time) goal.time = time;
    if (opts.rolledFrom) goal.rolledFrom = opts.rolledFrom;
    return goal;
  }

  /** Copy calendar-relevant fields when merging / rolling. */
  function pickCalFields(from, onto) {
    onto = onto || {};
    if (!from || typeof from !== 'object') return onto;
    if (from.time) onto.time = normalizeTime(from.time) || from.time;
    else if (onto.time && from.time === '') delete onto.time;
    if (typeof from.cal === 'boolean') onto.cal = from.cal;
    if (from.doneAt != null) onto.doneAt = from.doneAt;
    if (from.rolledFrom) onto.rolledFrom = from.rolledFrom;
    return onto;
  }

  var FEED_KEY = 'jg_calendar_feed_v1';

  function readFeedMeta() {
    try {
      var raw = localStorage.getItem(FEED_KEY);
      if (!raw) return { token: null, createdAt: null };
      var parsed = JSON.parse(raw);
      return {
        token: parsed && parsed.token ? String(parsed.token) : null,
        createdAt: parsed && parsed.createdAt ? parsed.createdAt : null
      };
    } catch (e) {
      return { token: null, createdAt: null };
    }
  }

  function writeFeedMeta(meta) {
    localStorage.setItem(FEED_KEY, JSON.stringify({
      token: meta.token || null,
      createdAt: meta.createdAt || new Date().toISOString()
    }));
    try {
      window.dispatchEvent(new CustomEvent('jg-calendar-feed-changed'));
    } catch (e) { /* ignore */ }
  }

  function randomToken() {
    var bytes = new Uint8Array(24);
    if (global.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    var s = '';
    for (var j = 0; j < bytes.length; j++) s += pad2(bytes[j].toString(16)).slice(-2);
    return s;
  }

  function ensureFeedToken() {
    var meta = readFeedMeta();
    if (meta.token && meta.token.length >= 24) return meta;
    meta = { token: randomToken(), createdAt: new Date().toISOString() };
    writeFeedMeta(meta);
    return meta;
  }

  function rotateFeedToken() {
    var meta = { token: randomToken(), createdAt: new Date().toISOString() };
    writeFeedMeta(meta);
    return meta;
  }

  function feedUrls(token, origin) {
    var base = (origin || (global.location && location.origin) || '').replace(/\/$/, '');
    var site = (global.JGDASH_CONFIG && JGDASH_CONFIG.SITE_URL) || base;
    site = String(site).replace(/\/$/, '');
    var path = '/api/todos-ics?token=' + encodeURIComponent(token);
    var https = site + path;
    var webcal = https.replace(/^https:/i, 'webcal:').replace(/^http:/i, 'webcal:');
    return { https: https, webcal: webcal };
  }

  /**
   * Mount a compact day + time strip.
   * opts: { root, defaultDay: 'today'|'tomorrow'|ymd, onChange }
   * Returns { getDayYmd, getTime, reset }
   */
  function mountScheduleStrip(opts) {
    opts = opts || {};
    var root = opts.root;
    if (!root) return null;
    var active = getActiveDateString();
    var dayMode = opts.defaultDay === 'tomorrow' ? 'tomorrow' : 'today';
    var customYmd = '';
    var timeVal = '';

    root.innerHTML =
      '<div class="sched-strip" role="group" aria-label="Schedule">' +
        '<div class="sched-row">' +
          '<span class="sched-label">Day</span>' +
          '<button type="button" class="sched-chip" data-day="today">Today</button>' +
          '<button type="button" class="sched-chip" data-day="tomorrow">Tomorrow</button>' +
          '<button type="button" class="sched-chip" data-day="pick">Pick…</button>' +
          '<input type="date" class="sched-date" hidden />' +
        '</div>' +
        '<div class="sched-row">' +
          '<span class="sched-label">Time</span>' +
          '<button type="button" class="sched-chip" data-time="">None</button>' +
          '<button type="button" class="sched-chip" data-time="09:00">9am</button>' +
          '<button type="button" class="sched-chip" data-time="12:00">Noon</button>' +
          '<button type="button" class="sched-chip" data-time="15:00">3pm</button>' +
          '<button type="button" class="sched-chip" data-time="18:00">6pm</button>' +
          '<input type="time" class="sched-time" aria-label="Custom time" />' +
        '</div>' +
      '</div>';

    var dateInput = root.querySelector('.sched-date');
    var timeInput = root.querySelector('.sched-time');

    function paint() {
      root.querySelectorAll('[data-day]').forEach(function (btn) {
        var d = btn.getAttribute('data-day');
        var on = (d === 'pick' && dayMode === 'pick') || (d === dayMode);
        btn.classList.toggle('is-on', on);
      });
      root.querySelectorAll('[data-time]').forEach(function (btn) {
        btn.classList.toggle('is-on', (btn.getAttribute('data-time') || '') === timeVal);
      });
      dateInput.hidden = dayMode !== 'pick';
      if (dayMode === 'pick' && customYmd) dateInput.value = customYmd;
      timeInput.value = timeVal || '';
    }

    function emit() {
      if (typeof opts.onChange === 'function') {
        opts.onChange({ dayYmd: api.getDayYmd(), time: api.getTime() });
      }
    }

    root.addEventListener('click', function (e) {
      var dayBtn = e.target.closest('[data-day]');
      if (dayBtn) {
        var d = dayBtn.getAttribute('data-day');
        if (d === 'pick') {
          dayMode = 'pick';
          dateInput.hidden = false;
          if (!customYmd) customYmd = addDaysYmd(active, 2);
          dateInput.value = customYmd;
          try { dateInput.showPicker(); } catch (err) { dateInput.focus(); }
        } else {
          dayMode = d;
        }
        paint();
        emit();
        return;
      }
      var timeBtn = e.target.closest('[data-time]');
      if (timeBtn) {
        timeVal = timeBtn.getAttribute('data-time') || '';
        paint();
        emit();
      }
    });

    dateInput.addEventListener('change', function () {
      customYmd = dateInput.value || customYmd;
      dayMode = 'pick';
      paint();
      emit();
    });

    timeInput.addEventListener('change', function () {
      timeVal = normalizeTime(timeInput.value);
      paint();
      emit();
    });

    if (opts.defaultDay === 'tomorrow') dayMode = 'tomorrow';
    paint();

    var api = {
      getDayYmd: function () {
        if (dayMode === 'tomorrow') return addDaysYmd(active, 1);
        if (dayMode === 'pick') return customYmd || active;
        return active;
      },
      getTime: function () { return timeVal; },
      reset: function () {
        active = getActiveDateString();
        dayMode = opts.defaultDay === 'tomorrow' ? 'tomorrow' : 'today';
        customYmd = '';
        timeVal = '';
        paint();
      }
    };
    return api;
  }

  var SCHED_CSS =
    '.sched-strip{display:flex;flex-direction:column;gap:8px;margin:8px 0 4px;width:100%}' +
    '.sched-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px}' +
    '.sched-label{font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--text-tertiary);min-width:36px}' +
    '.sched-chip{appearance:none;border:1px solid var(--border);background:var(--input-bg);color:var(--text-secondary);font-size:12px;font-weight:600;padding:6px 10px;border-radius:999px;cursor:pointer;line-height:1}' +
    '.sched-chip.is-on{color:var(--accent);border-color:color-mix(in srgb,var(--accent) 45%,transparent);background:color-mix(in srgb,var(--accent) 14%,transparent)}' +
    '.sched-date,.sched-time{border:1px solid var(--border);background:var(--input-bg);color:var(--text-primary);border-radius:10px;padding:5px 8px;font-size:12px}' +
    '.sched-time{max-width:118px}' +
    '.cal-sub-card{margin:14px 0 18px;padding:14px 16px;border-radius:14px;border:1px solid var(--border);background:var(--card-bg)}' +
    '.cal-sub-card h3{font-size:14px;font-weight:700;margin:0 0 6px;color:var(--text-primary)}' +
    '.cal-sub-card p{font-size:12px;color:var(--text-secondary);line-height:1.45;margin:0 0 10px}' +
    '.cal-sub-actions{display:flex;flex-wrap:wrap;gap:8px}' +
    '.cal-sub-actions .btn{font-size:12px}' +
    '.cal-sub-link{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;word-break:break-all;color:var(--text-tertiary);margin-top:8px}' +
    '.todo-time-badge{margin-left:6px;font-size:11px;font-weight:650;color:var(--accent);white-space:nowrap}';

  function injectSchedCss() {
    if (document.getElementById('jgdash-sched-css')) return;
    var style = document.createElement('style');
    style.id = 'jgdash-sched-css';
    style.textContent = SCHED_CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  global.JGDash = global.JGDash || {};
  global.JGDash.todoSchedule = {
    pad2: pad2,
    toDateString: toDateString,
    parseDateString: parseDateString,
    getActiveDateString: getActiveDateString,
    addDaysYmd: addDaysYmd,
    normalizeTime: normalizeTime,
    formatTimeLabel: formatTimeLabel,
    buildGoal: buildGoal,
    pickCalFields: pickCalFields,
    FEED_KEY: FEED_KEY,
    readFeedMeta: readFeedMeta,
    ensureFeedToken: ensureFeedToken,
    rotateFeedToken: rotateFeedToken,
    feedUrls: feedUrls,
    mountScheduleStrip: mountScheduleStrip,
    injectSchedCss: injectSchedCss
  };
})(typeof window !== 'undefined' ? window : global);
