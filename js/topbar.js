(function (global) {
  'use strict';

  var HUB_LINKS = [
    { label: 'Index', href: 'index.html' },
    { label: 'Main', href: 'main.html' },
    { label: 'Projects', href: 'projects.html' },
    { label: 'Fitness', href: 'gym.html' },
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

  function mountTopbar(opts) {
    opts = opts || {};
    var title = opts.title || 'JGDash';
    var el = document.getElementById('jgdash-topbar');
    if (!el) {
      el = document.createElement('header');
      el.id = 'jgdash-topbar';
      document.body.insertBefore(el, document.body.firstChild);
    }

    // Prefer topbar theme control over floating fab
    var existingFab = document.getElementById('jgdashThemeFab');
    if (existingFab && existingFab.parentNode) existingFab.parentNode.removeChild(existingFab);

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
          '<button type="button" class="tb-btn" id="tbTheme">Light</button>' +
          '<button type="button" class="tb-btn" id="tbSignOut" hidden>Sign out</button>' +
        '</div>' +
      '</div>';

    if (!document.getElementById('jgdash-topbar-style')) {
      var style = document.createElement('style');
      style.id = 'jgdash-topbar-style';
      style.textContent =
        '#jgdash-topbar{position:relative;z-index:20;padding:12px 20px;}' +
        '#jgdash-topbar .tb-inner{max-width:1100px;margin:0 auto;display:flex;align-items:center;gap:12px;}' +
        '#jgdash-topbar .tb-brand{font-weight:700;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#B8B6B0;text-decoration:none;}' +
        '#jgdash-topbar .tb-brand:hover{color:#FAFAFA;}' +
        '#jgdash-topbar .tb-title{font-size:13px;color:#FAFAFA;font-weight:600;}' +
        '#jgdash-topbar .tb-spacer{flex:1;}' +
        '#jgdash-topbar .tb-actions{display:flex;align-items:center;gap:8px;}' +
        '#jgdash-topbar .tb-hubs{position:relative;}' +
        '#jgdash-topbar .tb-hubs-btn{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#FAFAFA;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;}' +
        '#jgdash-topbar .tb-hubs-btn:hover,#jgdash-topbar .tb-hubs.is-open .tb-hubs-btn{background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.18);}' +
        '#jgdash-topbar .tb-hubs-caret{font-size:10px;opacity:0.7;}' +
        '#jgdash-topbar .tb-hubs-menu{position:absolute;top:calc(100% + 8px);left:0;min-width:160px;padding:6px;border-radius:12px;background:rgba(12,12,14,0.96);border:1px solid rgba(255,255,255,0.1);backdrop-filter:blur(20px);box-shadow:0 16px 40px rgba(0,0,0,0.55);display:flex;flex-direction:column;gap:2px;z-index:30;}' +
        '#jgdash-topbar .tb-hubs-menu[hidden]{display:none;}' +
        '#jgdash-topbar .tb-hub-item{display:block;padding:9px 12px;border-radius:8px;color:#B8B6B0;text-decoration:none;font-size:13px;}' +
        '#jgdash-topbar .tb-hub-item:hover{background:rgba(255,255,255,0.06);color:#FAFAFA;}' +
        '#jgdash-topbar .tb-hub-item.is-current{color:#6BE3A4;background:rgba(107,227,164,0.08);}' +
        '#jgdash-topbar .tb-btn{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#FAFAFA;border-radius:999px;padding:6px 12px;font-size:12px;cursor:pointer;font-family:inherit;}' +
        '#jgdash-topbar .tb-btn:hover{background:rgba(255,255,255,0.08);}' +
        '#jgdash-topbar .tb-btn:focus-visible{outline:2px solid #6BE3A4;outline-offset:2px;}';
      document.head.appendChild(style);
    }

    var hubs = document.getElementById('tbHubs');
    var hubsBtn = document.getElementById('tbHubsBtn');
    var hubsMenu = document.getElementById('tbHubsMenu');

    function closeHubs() {
      hubs.classList.remove('is-open');
      hubsBtn.setAttribute('aria-expanded', 'false');
      hubsMenu.hidden = true;
    }

    function toggleHubs() {
      var open = hubsMenu.hidden;
      if (open) {
        hubs.classList.add('is-open');
        hubsBtn.setAttribute('aria-expanded', 'true');
        hubsMenu.hidden = false;
      } else {
        closeHubs();
      }
    }

    hubsBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleHubs();
    });
    document.addEventListener('click', function (e) {
      if (!hubs.contains(e.target)) closeHubs();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeHubs();
    });

    var themeBtn = document.getElementById('tbTheme');
    if (themeBtn) {
      themeBtn.addEventListener('click', function () {
        if (global.JGDash && global.JGDash.theme && typeof global.JGDash.theme.toggle === 'function') {
          global.JGDash.theme.toggle();
        }
      });
      if (global.JGDash && global.JGDash.theme && typeof global.JGDash.theme.syncButtons === 'function') {
        global.JGDash.theme.syncButtons();
      }
    }

    var btn = document.getElementById('tbSignOut');
    if (btn) {
      var api = global.JGDash && global.JGDash.supabase;
      if (api && api.isConfigured()) {
        api.getClient().auth.getSession().then(function (res) {
          if (res.data && res.data.session) {
            btn.hidden = false;
          }
        }).catch(function () { /* ignore */ });
        btn.addEventListener('click', async function () {
          try {
            await api.getClient().auth.signOut();
          } catch (e) { /* ignore */ }
          location.href = 'signin.html';
        });
      }
    }
  }

  global.JGDash = global.JGDash || {};
  global.JGDash.topbar = { mount: mountTopbar };

  document.addEventListener('DOMContentLoaded', function () {
    var page = document.body.getAttribute('data-page-title');
    if (page !== null) mountTopbar({ title: page });
  });
})(window);
