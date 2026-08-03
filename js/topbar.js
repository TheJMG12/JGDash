(function (global) {
  'use strict';

  var HUB_LINKS = [
    { label: 'Index', href: 'index.html' },
    { label: 'Main', href: 'main.html' },
    { label: 'Projects', href: 'projects.html' },
    { label: 'Training', href: 'training.html' },
    { label: 'Health', href: 'health.html' },
    { label: 'Water', href: 'po-water.html' },
    { label: 'Finance', href: 'finance.html' }
  ];

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function themeLabel() {
    var light = false;
    try {
      light = (global.JGDash && global.JGDash.theme)
        ? global.JGDash.theme.get() === 'light'
        : localStorage.getItem('jg_theme') === 'light';
    } catch (e) { /* ignore */ }
    return light ? 'Dark mode' : 'Light mode';
  }

  function mountTopbar(opts) {
    opts = opts || {};
    var title = opts.title || 'JGDash';
    if (!document.body) return;

    var fab = document.getElementById('jgdashThemeFab');
    if (fab && fab.parentNode) fab.parentNode.removeChild(fab);

    var el = document.getElementById('jgdash-topbar');
    if (!el) {
      el = document.createElement('header');
      el.id = 'jgdash-topbar';
      document.body.insertBefore(el, document.body.firstChild);
    }

    var menuItems = HUB_LINKS.map(function (link) {
      var current = link.label === title || (title === 'Hub' && link.label === 'Index');
      return (
        '<a class="tb-hub-item' + (current ? ' is-current' : '') + '" href="' + link.href + '">' +
          escapeHtml(link.label) +
        '</a>'
      );
    }).join('');

    el.innerHTML =
      '<div class="tb-inner">' +
        '<a class="tb-brand" href="index.html">JGDash</a>' +
        '<span class="tb-title">' + escapeHtml(title) + '</span>' +
        '<div class="tb-hubs" id="tbHubs">' +
          '<button type="button" class="tb-hubs-btn" id="tbHubsBtn" aria-expanded="false" aria-haspopup="true">' +
            'Hubs <span class="tb-hubs-caret" aria-hidden="true">▾</span>' +
          '</button>' +
          '<div class="tb-hubs-menu" id="tbHubsMenu" hidden>' + menuItems + '</div>' +
        '</div>' +
        '<div class="tb-spacer"></div>' +
        '<div class="tb-actions">' +
          '<button type="button" class="tb-btn tb-theme" id="tbTheme">' + escapeHtml(themeLabel()) + '</button>' +
          '<button type="button" class="tb-btn" id="tbSignOut">Sign out</button>' +
        '</div>' +
      '</div>';

    if (!document.getElementById('jgdash-topbar-style')) {
      var style = document.createElement('style');
      style.id = 'jgdash-topbar-style';
      style.textContent =
        '#jgdash-topbar{position:sticky;top:0;z-index:200;padding:10px 20px;' +
          'background:rgba(5,5,6,0.88);backdrop-filter:blur(14px);' +
          'border-bottom:1px solid rgba(255,255,255,0.06);}' +
        '[data-theme="light"] #jgdash-topbar{background:rgba(244,243,240,0.92);border-bottom-color:rgba(0,0,0,0.08);}' +
        '#jgdash-topbar .tb-inner{max-width:1100px;margin:0 auto;display:flex;align-items:center;gap:12px;}' +
        '#jgdash-topbar .tb-brand{font-weight:700;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#B8B6B0;text-decoration:none;}' +
        '#jgdash-topbar .tb-brand:hover{color:#FAFAFA;}' +
        '#jgdash-topbar .tb-title{font-size:13px;color:#FAFAFA;font-weight:600;}' +
        '#jgdash-topbar .tb-spacer{flex:1;min-width:8px;}' +
        '#jgdash-topbar .tb-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;}' +
        '#jgdash-topbar .tb-hubs{position:relative;}' +
        '#jgdash-topbar .tb-hubs-btn{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#FAFAFA;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;}' +
        '#jgdash-topbar .tb-hubs-btn:hover,#jgdash-topbar .tb-hubs.is-open .tb-hubs-btn{background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.18);}' +
        '#jgdash-topbar .tb-hubs-caret{font-size:10px;opacity:0.7;}' +
        '#jgdash-topbar .tb-hubs-menu{position:absolute;top:calc(100% + 8px);left:0;min-width:160px;padding:6px;border-radius:12px;background:rgba(12,12,14,0.96);border:1px solid rgba(255,255,255,0.1);backdrop-filter:blur(20px);box-shadow:0 16px 40px rgba(0,0,0,0.55);display:flex;flex-direction:column;gap:2px;z-index:30;}' +
        '#jgdash-topbar .tb-hubs-menu[hidden]{display:none;}' +
        '#jgdash-topbar .tb-hub-item{display:block;padding:9px 12px;border-radius:8px;color:#B8B6B0;text-decoration:none;font-size:13px;}' +
        '#jgdash-topbar .tb-hub-item:hover{background:rgba(255,255,255,0.06);color:#FAFAFA;}' +
        '#jgdash-topbar .tb-hub-item.is-current{color:#6BE3A4;background:rgba(107,227,164,0.08);}' +
        '#jgdash-topbar .tb-btn{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#FAFAFA;border-radius:999px;padding:6px 12px;font-size:12px;cursor:pointer;font-family:inherit;font-weight:600;}' +
        '#jgdash-topbar .tb-btn:hover{background:rgba(255,255,255,0.08);}' +
        '#jgdash-topbar .tb-btn:focus-visible{outline:2px solid #6BE3A4;outline-offset:2px;}' +
        '[data-theme="light"] #jgdash-topbar .tb-brand{color:#5C5A54;}' +
        '[data-theme="light"] #jgdash-topbar .tb-brand:hover{color:#1A1917;}' +
        '[data-theme="light"] #jgdash-topbar .tb-title{color:#1A1917;}' +
        '[data-theme="light"] #jgdash-topbar .tb-hubs-btn,' +
        '[data-theme="light"] #jgdash-topbar .tb-btn{background:rgba(0,0,0,0.04);border-color:rgba(0,0,0,0.12);color:#1A1917;}' +
        '[data-theme="light"] #jgdash-topbar .tb-hubs-menu{background:#fff;border-color:rgba(0,0,0,0.1);}' +
        '[data-theme="light"] #jgdash-topbar .tb-hub-item{color:#5C5A54;}' +
        '[data-theme="light"] #jgdash-topbar .tb-hub-item:hover{background:rgba(0,0,0,0.05);color:#1A1917;}' +
        '[data-theme="light"] #jgdash-topbar .tb-hub-item.is-current{color:#1F9D62;background:rgba(31,157,98,0.1);}';
      document.head.appendChild(style);
    }

    var hubs = document.getElementById('tbHubs');
    var hubsBtn = document.getElementById('tbHubsBtn');
    var hubsMenu = document.getElementById('tbHubsMenu');

    function closeHubs() {
      if (!hubs || !hubsBtn || !hubsMenu) return;
      hubs.classList.remove('is-open');
      hubsBtn.setAttribute('aria-expanded', 'false');
      hubsMenu.hidden = true;
    }

    if (hubsBtn && hubsMenu && hubs) {
      hubsBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = hubsMenu.hidden;
        if (open) {
          hubs.classList.add('is-open');
          hubsBtn.setAttribute('aria-expanded', 'true');
          hubsMenu.hidden = false;
        } else {
          closeHubs();
        }
      });
      document.addEventListener('click', function (e) {
        if (!hubs.contains(e.target)) closeHubs();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeHubs();
      });
    }

    var themeBtn = document.getElementById('tbTheme');
    if (themeBtn) {
      themeBtn.addEventListener('click', function () {
        if (global.JGDash && global.JGDash.theme) {
          global.JGDash.theme.toggle();
          themeBtn.textContent = themeLabel();
        } else {
          // Fallback if theme.js failed to load
          var html = document.documentElement;
          var next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
          if (next === 'light') html.setAttribute('data-theme', 'light');
          else html.removeAttribute('data-theme');
          try { localStorage.setItem('jg_theme', next); } catch (err) { /* ignore */ }
          themeBtn.textContent = next === 'light' ? 'Dark mode' : 'Light mode';
        }
      });
    }

    var btn = document.getElementById('tbSignOut');
    if (btn) {
      btn.hidden = false;
      var api = global.JGDash && global.JGDash.supabase;
      var hasSession = false;
      function setAuthLabel(signedIn) {
        hasSession = !!signedIn;
        btn.textContent = signedIn ? 'Sign out' : 'Sign in';
      }
      setAuthLabel(false);
      if (api && api.isConfigured()) {
        api.getClient().auth.getSession().then(function (res) {
          setAuthLabel(!!(res.data && res.data.session));
        }).catch(function () { setAuthLabel(false); });
      }
      btn.addEventListener('click', async function () {
        if (hasSession && api && api.isConfigured()) {
          try { await api.getClient().auth.signOut(); } catch (e) { /* ignore */ }
        }
        location.href = 'signin.html';
      });
    }
  }

  global.JGDash = global.JGDash || {};
  global.JGDash.topbar = { mount: mountTopbar };

  function autoMount() {
    if (!document.body) return;
    var page = document.body.getAttribute('data-page-title');
    if (page !== null) mountTopbar({ title: page || 'JGDash' });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }
})(window);
