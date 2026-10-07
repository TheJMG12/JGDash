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
    // Always force https for Apple Calendar (http → "insecure connection" / validation failed).
    if (/^http:/i.test(site)) site = site.replace(/^http:/i, 'https:');
    if (!/^https:/i.test(site) && site.indexOf('://') === -1) site = 'https://' + site.replace(/^\/+/, '');
    var path = '/api/todos-ics?token=' + encodeURIComponent(token);
    var https = site + path;
    // webcal is fine over TLS, but iOS Settings accepts https:// more reliably.
    var webcal = https.replace(/^https:/i, 'webcal:');
    return { https: https, webcal: webcal };
  }

  function formatPickLabel(ymd) {
    if (!ymd) return 'Pick day';
    try {
      var d = parseDateString(ymd);
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    } catch (e) {
      return ymd;
    }
  }

  /**
   * Mount a compact day + time strip (2026 pill picker).
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
        '<div class="sched-block">' +
          '<span class="sched-label">When</span>' +
          '<div class="sched-pills" role="toolbar" aria-label="Day">' +
            '<button type="button" class="sched-chip" data-day="today">Today</button>' +
            '<button type="button" class="sched-chip" data-day="tomorrow">Tomorrow</button>' +
            '<button type="button" class="sched-chip sched-chip-pick" data-day="pick">' +
              '<span class="sched-pick-ico" aria-hidden="true">📅</span>' +
              '<span class="sched-pick-label">Pick day</span>' +
            '</button>' +
            '<input type="date" class="sched-date" hidden />' +
          '</div>' +
        '</div>' +
        '<div class="sched-block">' +
          '<span class="sched-label">Time</span>' +
          '<div class="sched-pills" role="toolbar" aria-label="Time">' +
            '<button type="button" class="sched-chip" data-time="">None</button>' +
            '<button type="button" class="sched-chip" data-time="09:00">9am</button>' +
            '<button type="button" class="sched-chip" data-time="12:00">Noon</button>' +
            '<button type="button" class="sched-chip" data-time="15:00">3pm</button>' +
            '<button type="button" class="sched-chip" data-time="18:00">6pm</button>' +
            '<label class="sched-time-wrap">' +
              '<span class="sched-time-hint">Custom</span>' +
              '<input type="time" class="sched-time" aria-label="Custom time" />' +
            '</label>' +
          '</div>' +
        '</div>' +
      '</div>';

    var dateInput = root.querySelector('.sched-date');
    var timeInput = root.querySelector('.sched-time');
    var pickLabel = root.querySelector('.sched-pick-label');

    function paint() {
      root.querySelectorAll('[data-day]').forEach(function (btn) {
        var d = btn.getAttribute('data-day');
        var on = (d === 'pick' && dayMode === 'pick') || (d === dayMode);
        btn.classList.toggle('is-on', on);
      });
      root.querySelectorAll('[data-time]').forEach(function (btn) {
        btn.classList.toggle('is-on', (btn.getAttribute('data-time') || '') === timeVal);
      });
      dateInput.hidden = true;
      if (dayMode === 'pick' && customYmd) {
        dateInput.value = customYmd;
        pickLabel.textContent = formatPickLabel(customYmd);
      } else {
        pickLabel.textContent = 'Pick day';
      }
      timeInput.value = timeVal || '';
      var preset = { '': 1, '09:00': 1, '12:00': 1, '15:00': 1, '18:00': 1 };
      root.querySelector('.sched-time-wrap').classList.toggle('is-on', !!timeVal && !preset[timeVal]);
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
          if (!customYmd) customYmd = addDaysYmd(active, 2);
          dateInput.value = customYmd;
          dateInput.hidden = false;
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
    '.sched-strip{display:flex;flex-direction:column;gap:12px;margin:10px 0 6px;width:100%;padding:12px 14px;border-radius:18px;border:1px solid var(--border);background:color-mix(in srgb,var(--card-bg) 80%,transparent);backdrop-filter:blur(16px)}' +
    '.sched-block{display:flex;flex-direction:column;gap:8px}' +
    '.sched-label{font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-tertiary)}' +
    '.sched-pills{display:flex;flex-wrap:wrap;align-items:center;gap:8px}' +
    '.sched-chip{appearance:none;border:1px solid var(--border);background:var(--input-bg);color:var(--text-secondary);font:inherit;font-size:12.5px;font-weight:600;padding:8px 14px;border-radius:999px;cursor:pointer;line-height:1.1;transition:background .18s ease,border-color .18s ease,color .18s ease,transform .18s ease}' +
    '.sched-chip:hover{color:var(--text-primary);border-color:var(--border-strong,rgba(255,255,255,.12));transform:translateY(-1px)}' +
    '.sched-chip.is-on{color:var(--accent);border-color:color-mix(in srgb,var(--accent) 48%,transparent);background:color-mix(in srgb,var(--accent) 16%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,var(--accent) 18%,transparent)}' +
    '.sched-chip-pick{display:inline-flex;align-items:center;gap:6px;padding-left:12px;padding-right:14px}' +
    '.sched-pick-ico{font-size:12px;opacity:.85}' +
    '.sched-date{position:absolute;opacity:0;pointer-events:none;width:0;height:0}' +
    '.sched-time-wrap{display:inline-flex;align-items:center;gap:8px;padding:4px 6px 4px 12px;border-radius:999px;border:1px solid var(--border);background:var(--input-bg);transition:border-color .18s ease,background .18s ease}' +
    '.sched-time-wrap.is-on{border-color:color-mix(in srgb,var(--accent) 48%,transparent);background:color-mix(in srgb,var(--accent) 16%,transparent)}' +
    '.sched-time-hint{font-size:11px;font-weight:600;color:var(--text-tertiary);letter-spacing:.04em;text-transform:uppercase}' +
    '.sched-time-wrap.is-on .sched-time-hint{color:var(--accent)}' +
    '.sched-time{border:0;background:transparent;color:var(--text-primary);border-radius:999px;padding:4px 8px;font:inherit;font-size:12.5px;font-weight:600;max-width:118px;color-scheme:dark}' +
    '[data-theme="light"] .sched-time{color-scheme:light}' +
    '.cal-sub-card{margin:14px 0 18px;padding:16px 18px;border-radius:18px;border:1px solid var(--border);background:var(--card-bg)}' +
    '.cal-sub-card h3{font-size:14px;font-weight:600;margin:0 0 6px;color:var(--text-primary);letter-spacing:-.02em}' +
    '.cal-sub-card p{font-size:12.5px;color:var(--text-secondary);line-height:1.45;margin:0 0 10px}' +
    '.cal-sub-actions{display:flex;flex-wrap:wrap;gap:8px}' +
    '.cal-sub-actions .btn{font-size:12px}' +
    '.cal-sub-link{font-family:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;word-break:break-all;color:var(--text-tertiary);margin-top:8px}' +
    '.todo-time-badge{display:inline-flex;align-items:center;margin-left:8px;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent);border:1px solid color-mix(in srgb,var(--accent) 28%,transparent);white-space:nowrap}';

  function injectSchedCss() {
    if (document.getElementById('jgdash-sched-css')) return;
    var style = document.createElement('style');
    style.id = 'jgdash-sched-css';
    style.textContent = SCHED_CSS + DT_PICKER_CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  var DT_PICKER_CSS =
    '.jg-dt-backdrop{position:fixed;inset:0;z-index:340;background:rgba(0,0,0,.62);backdrop-filter:blur(8px);display:flex;align-items:flex-end;justify-content:center;padding:14px;padding-bottom:max(14px,env(safe-area-inset-bottom))}' +
    '@media(min-width:720px){.jg-dt-backdrop{align-items:center}}' +
    '.jg-dt-modal{width:100%;max-width:560px;max-height:min(88vh,640px);overflow:hidden;display:flex;flex-direction:column;background:#121214;border:1px solid rgba(255,255,255,.1);border-radius:22px;box-shadow:0 28px 80px rgba(0,0,0,.55);color:#FAFAFA;font-family:inherit}' +
    '.jg-dt-body{display:grid;grid-template-columns:1.15fr .85fr;gap:0;min-height:0;flex:1;overflow:hidden}' +
    '@media(max-width:620px){.jg-dt-body{grid-template-columns:1fr;overflow:auto}}' +
    '.jg-dt-cal{padding:18px 16px 12px;border-right:1px solid rgba(255,255,255,.08);min-width:0}' +
    '@media(max-width:620px){.jg-dt-cal{border-right:0;border-bottom:1px solid rgba(255,255,255,.08)}}' +
    '.jg-dt-cal-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:14px}' +
    '.jg-dt-cal-title{font-size:15px;font-weight:700;letter-spacing:-.02em}' +
    '.jg-dt-nav{appearance:none;border:0;background:rgba(255,255,255,.06);color:#FAFAFA;width:32px;height:32px;border-radius:10px;cursor:pointer;font-size:16px;line-height:1}' +
    '.jg-dt-nav:hover{background:rgba(255,255,255,.1)}' +
    '.jg-dt-dow{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:6px}' +
    '.jg-dt-dow span{text-align:center;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#76746E;padding:4px 0}' +
    '.jg-dt-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}' +
    '.jg-dt-day{appearance:none;border:0;background:transparent;color:#FAFAFA;height:38px;border-radius:12px;cursor:pointer;font:inherit;font-size:13px;font-weight:600;position:relative}' +
    '.jg-dt-day.is-muted{color:#52525B}' +
    '.jg-dt-day.is-on{background:#F4F4F5;color:#18181B}' +
    '.jg-dt-day.is-today:not(.is-on)::after{content:"";position:absolute;left:50%;bottom:5px;width:4px;height:4px;border-radius:50%;background:#F07167;transform:translateX(-50%)}' +
    '.jg-dt-times{padding:14px 12px;overflow-y:auto;min-height:0;display:flex;flex-direction:column;gap:8px;-webkit-overflow-scrolling:touch}' +
    '@media(max-width:620px){.jg-dt-times{max-height:220px}}' +
    '.jg-dt-slot{appearance:none;border:1px solid rgba(255,255,255,.12);background:transparent;color:#FAFAFA;border-radius:999px;padding:10px 12px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;text-align:center}' +
    '.jg-dt-slot.is-on{background:#E4E4E7;color:#18181B;border-color:transparent}' +
    '.jg-dt-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-top:1px solid rgba(255,255,255,.08);flex-wrap:wrap}' +
    '.jg-dt-summary{font-size:12.5px;color:#A1A1AA;line-height:1.35;flex:1;min-width:160px}' +
    '.jg-dt-summary strong{color:#FAFAFA;font-weight:650}' +
    '.jg-dt-continue{appearance:none;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.04);color:#FAFAFA;border-radius:999px;padding:10px 18px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}' +
    '.jg-dt-continue:hover{background:rgba(255,255,255,.08)}' +
    '.jg-sched-field{display:flex;align-items:center;gap:8px;width:100%;margin-top:8px}' +
    '.jg-sched-chip{appearance:none;flex:1;min-width:0;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#FAFAFA;border-radius:14px;padding:12px 14px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;text-align:left;display:flex;align-items:center;gap:8px}' +
    '.jg-sched-chip:hover{border-color:rgba(255,255,255,.18)}' +
    '.jg-sched-chip span{opacity:.72;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}';

  function formatLongDay(ymd) {
    var d = parseDateString(ymd);
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function openDateTimePicker(opts) {
    opts = opts || {};
    injectSchedCss();
    var ymd = opts.ymd || getActiveDateString();
    var timeVal = normalizeTime(opts.time) || '';
    var view = parseDateString(ymd);
    view = new Date(view.getFullYear(), view.getMonth(), 1);
    var todayYmd = getActiveDateString();

    var backdrop = document.createElement('div');
    backdrop.className = 'jg-dt-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', 'Pick date and time');
    backdrop.innerHTML =
      '<div class="jg-dt-modal">' +
        '<div class="jg-dt-body">' +
          '<div class="jg-dt-cal">' +
            '<div class="jg-dt-cal-head">' +
              '<button type="button" class="jg-dt-nav" data-nav="-1" aria-label="Previous month">‹</button>' +
              '<div class="jg-dt-cal-title"></div>' +
              '<button type="button" class="jg-dt-nav" data-nav="1" aria-label="Next month">›</button>' +
            '</div>' +
            '<div class="jg-dt-dow">' +
              '<span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>' +
            '</div>' +
            '<div class="jg-dt-grid"></div>' +
          '</div>' +
          '<div class="jg-dt-times"></div>' +
        '</div>' +
        '<div class="jg-dt-foot">' +
          '<div class="jg-dt-summary"></div>' +
          '<button type="button" class="jg-dt-continue">Continue</button>' +
        '</div>' +
      '</div>';

    var titleEl = backdrop.querySelector('.jg-dt-cal-title');
    var gridEl = backdrop.querySelector('.jg-dt-grid');
    var timesEl = backdrop.querySelector('.jg-dt-times');
    var summaryEl = backdrop.querySelector('.jg-dt-summary');

    function paintSummary() {
      var label = formatLongDay(ymd);
      var t = timeVal ? formatTimeLabel(timeVal) : 'no time';
      summaryEl.innerHTML = 'Scheduled for <strong>' + label + '</strong> · <strong>' + t + '</strong>';
    }

    function paintTimes() {
      timesEl.innerHTML = '';
      var none = document.createElement('button');
      none.type = 'button';
      none.className = 'jg-dt-slot' + (!timeVal ? ' is-on' : '');
      none.textContent = 'None';
      none.addEventListener('click', function () {
        timeVal = '';
        paintTimes();
        paintSummary();
      });
      timesEl.appendChild(none);
      for (var h = 6; h <= 22; h++) {
        for (var m = 0; m < 60; m += 15) {
          var hhmm = pad2(h) + ':' + pad2(m);
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'jg-dt-slot' + (timeVal === hhmm ? ' is-on' : '');
          btn.textContent = hhmm;
          btn.setAttribute('data-time', hhmm);
          btn.addEventListener('click', function (ev) {
            timeVal = ev.currentTarget.getAttribute('data-time') || '';
            paintTimes();
            paintSummary();
          });
          timesEl.appendChild(btn);
        }
      }
      var on = timesEl.querySelector('.jg-dt-slot.is-on');
      if (on && on.scrollIntoView) {
        try { on.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ }
      }
    }

    function paintCal() {
      titleEl.textContent = view.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      gridEl.innerHTML = '';
      var firstDow = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
      var daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      var prevDays = new Date(view.getFullYear(), view.getMonth(), 0).getDate();
      var cells = [];
      var i;
      for (i = 0; i < firstDow; i++) {
        cells.push({ day: prevDays - firstDow + 1 + i, muted: true, monthOffset: -1 });
      }
      for (i = 1; i <= daysInMonth; i++) cells.push({ day: i, muted: false, monthOffset: 0 });
      while (cells.length % 7 !== 0) {
        cells.push({ day: cells.length - (firstDow + daysInMonth) + 1, muted: true, monthOffset: 1 });
      }
      cells.forEach(function (cell) {
        var d = new Date(view.getFullYear(), view.getMonth() + cell.monthOffset, cell.day);
        var cellYmd = toDateString(d);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'jg-dt-day' +
          (cell.muted ? ' is-muted' : '') +
          (cellYmd === ymd ? ' is-on' : '') +
          (cellYmd === todayYmd ? ' is-today' : '');
        btn.textContent = String(cell.day);
        btn.setAttribute('data-ymd', cellYmd);
        btn.addEventListener('click', function () {
          ymd = cellYmd;
          if (cell.monthOffset !== 0) {
            view = new Date(d.getFullYear(), d.getMonth(), 1);
          }
          paintCal();
          paintSummary();
        });
        gridEl.appendChild(btn);
      });
    }

    function close() {
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      document.removeEventListener('keydown', onKey);
    }

    function onKey(e) {
      if (e.key === 'Escape') close();
    }

    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) close();
      var nav = e.target.closest('[data-nav]');
      if (nav) {
        view = new Date(view.getFullYear(), view.getMonth() + Number(nav.getAttribute('data-nav')), 1);
        paintCal();
      }
    });
    backdrop.querySelector('.jg-dt-continue').addEventListener('click', function () {
      if (typeof opts.onConfirm === 'function') opts.onConfirm({ ymd: ymd, time: timeVal });
      close();
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(backdrop);
    paintCal();
    paintTimes();
    paintSummary();
    return { close: close };
  }

  /**
   * Compact schedule field that opens the date/time popout.
   * Returns { getDayYmd, getTime, reset, set }
   */
  function mountScheduleField(opts) {
    opts = opts || {};
    var root = opts.root;
    if (!root) return null;
    injectSchedCss();
    var active = getActiveDateString();
    var ymd = opts.ymd || active;
    var timeVal = normalizeTime(opts.time) || '';

    root.innerHTML =
      '<div class="jg-sched-field">' +
        '<button type="button" class="jg-sched-chip" id="jgSchedChip">' +
          '<span aria-hidden="true">📅</span><span class="jg-sched-label"></span>' +
        '</button>' +
      '</div>';
    var label = root.querySelector('.jg-sched-label');
    var chip = root.querySelector('.jg-sched-chip');

    function paint() {
      var day = formatLongDay(ymd);
      var t = timeVal ? formatTimeLabel(timeVal) : 'Any time';
      label.textContent = day + ' · ' + t;
    }

    function emit() {
      if (typeof opts.onChange === 'function') {
        opts.onChange({ dayYmd: ymd, time: timeVal });
      }
    }

    chip.addEventListener('click', function () {
      openDateTimePicker({
        ymd: ymd,
        time: timeVal,
        onConfirm: function (res) {
          ymd = res.ymd || active;
          timeVal = normalizeTime(res.time) || '';
          paint();
          emit();
        }
      });
    });

    paint();
    return {
      getDayYmd: function () { return ymd || active; },
      getTime: function () { return timeVal; },
      set: function (next) {
        next = next || {};
        if (next.ymd) ymd = next.ymd;
        if (next.time != null) timeVal = normalizeTime(next.time) || '';
        paint();
      },
      reset: function () {
        active = getActiveDateString();
        ymd = active;
        timeVal = '';
        paint();
      }
    };
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
    mountScheduleField: mountScheduleField,
    openDateTimePicker: openDateTimePicker,
    injectSchedCss: injectSchedCss
  };
})(typeof window !== 'undefined' ? window : global);
