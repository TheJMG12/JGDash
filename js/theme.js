(function (global) {
  'use strict';

  var STORAGE_KEY = 'jg_theme';

  function getTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
    } catch (e) {
      return 'dark';
    }
  }

  function applyTheme(theme) {
    var next = theme === 'light' ? 'light' : 'dark';
    if (next === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* ignore */ }
    syncButtons(next);
    return next;
  }

  function toggleTheme() {
    return applyTheme(getTheme() === 'light' ? 'dark' : 'light');
  }

  function syncButtons(theme) {
    theme = theme || getTheme();
    var label = theme === 'light' ? 'Dark' : 'Light';
    var title = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
    ['tbTheme', 'jgdashThemeFab'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.textContent = label;
      el.setAttribute('aria-label', title);
      el.title = title;
    });
  }

  function ensureGlobalLightStyles() {
    if (document.getElementById('jgdash-theme-style')) return;
    var style = document.createElement('style');
    style.id = 'jgdash-theme-style';
    style.textContent =
      '[data-theme="light"]{' +
        '--text-primary:#1A1917;' +
        '--text-secondary:#5C5A54;' +
        '--text-tertiary:#8A8780;' +
        '--bg:#F4F3F0;' +
        '--card-bg:rgba(255,255,255,0.78);' +
        '--success:#1F9D62;' +
        '--warning:#C4841A;' +
        '--danger:#D64545;' +
        '--accent:#1F9D62;' +
        '--border:rgba(0,0,0,0.1);' +
        '--input-bg:rgba(255,255,255,0.92);' +
      '}' +
      '[data-theme="light"] body{background:var(--bg);color:var(--text-primary);}' +
      '[data-theme="light"] body::before{' +
        'background:' +
          'radial-gradient(ellipse 50% 40% at 82% 14%,rgba(224,118,88,0.14),transparent 60%),' +
          'radial-gradient(ellipse 45% 35% at 18% 90%,rgba(100,110,140,0.08),transparent 55%);' +
      '}' +
      '[data-theme="light"] body::after{' +
        'background-image:radial-gradient(rgba(0,0,0,0.035) 0.6px,transparent 0.6px);' +
      '}' +
      '[data-theme="light"] .dash-title{' +
        'background:linear-gradient(180deg,#1A1917 0%,#5C5A54 120%);' +
        '-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;' +
      '}' +
      '[data-theme="light"] .card,' +
      '[data-theme="light"] .gm-card,' +
      '[data-theme="light"] .ht-card,' +
      '[data-theme="light"] .tile{' +
        'background:var(--card-bg);border-color:rgba(0,0,0,0.08);box-shadow:0 10px 28px rgba(0,0,0,0.08);' +
      '}' +
      '[data-theme="light"] #jgdash-topbar .tb-brand{color:#5C5A54;}' +
      '[data-theme="light"] #jgdash-topbar .tb-brand:hover{color:#1A1917;}' +
      '[data-theme="light"] #jgdash-topbar .tb-title{color:#1A1917;}' +
      '[data-theme="light"] #jgdash-topbar .tb-hubs-btn,' +
      '[data-theme="light"] #jgdash-topbar .tb-btn{' +
        'background:rgba(0,0,0,0.04);border-color:rgba(0,0,0,0.12);color:#1A1917;' +
      '}' +
      '[data-theme="light"] #jgdash-topbar .tb-hubs-btn:hover,' +
      '[data-theme="light"] #jgdash-topbar .tb-hubs.is-open .tb-hubs-btn,' +
      '[data-theme="light"] #jgdash-topbar .tb-btn:hover{' +
        'background:rgba(0,0,0,0.07);border-color:rgba(0,0,0,0.18);' +
      '}' +
      '[data-theme="light"] #jgdash-topbar .tb-hubs-menu{' +
        'background:rgba(255,255,255,0.96);border-color:rgba(0,0,0,0.1);box-shadow:0 16px 40px rgba(0,0,0,0.12);' +
      '}' +
      '[data-theme="light"] #jgdash-topbar .tb-hub-item{color:#5C5A54;}' +
      '[data-theme="light"] #jgdash-topbar .tb-hub-item:hover{background:rgba(0,0,0,0.05);color:#1A1917;}' +
      '[data-theme="light"] #jgdash-topbar .tb-hub-item.is-current{color:#1F9D62;background:rgba(31,157,98,0.1);}' +
      '#jgdash-theme-fab{' +
        'position:fixed;top:14px;right:14px;z-index:50;' +
        'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);' +
        'color:var(--text-primary);border-radius:999px;padding:7px 12px;font-size:12px;' +
        'font-weight:600;cursor:pointer;font-family:inherit;backdrop-filter:blur(12px);' +
      '}' +
      '[data-theme="light"] #jgdash-theme-fab{' +
        'background:rgba(0,0,0,0.04);border-color:rgba(0,0,0,0.12);' +
      '}';
    document.head.appendChild(style);
  }

  function ensureFabIfNoTopbar() {
    if (document.getElementById('jgdash-topbar') || document.getElementById('jgdashThemeFab')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'jgdashThemeFab';
    btn.className = 'jgdash-theme-fab';
    btn.addEventListener('click', toggleTheme);
    document.body.appendChild(btn);
    syncButtons();
  }

  // Apply ASAP to reduce flash
  applyTheme(getTheme());

  function boot() {
    ensureGlobalLightStyles();
    syncButtons();
    // Sign-in and any page without topbar still get a control
    ensureFabIfNoTopbar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // If topbar mounts later, drop the fab
  var _obs;
  try {
    _obs = new MutationObserver(function () {
      if (document.getElementById('jgdash-topbar')) {
        var fab = document.getElementById('jgdashThemeFab');
        if (fab) fab.remove();
        syncButtons();
      }
    });
    _obs.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) { /* ignore */ }

  global.JGDash = global.JGDash || {};
  global.JGDash.theme = {
    get: getTheme,
    set: applyTheme,
    toggle: toggleTheme,
    syncButtons: syncButtons
  };
})(window);
