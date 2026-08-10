(function (global) {
  'use strict';

  var HUB_LINKS = [
    { label: 'Index', href: 'index.html' },
    { label: 'Main', href: 'main.html' },
    { label: 'Projects', href: 'projects.html' },
    { label: 'Training', href: 'training.html' },
    { label: 'Health', href: 'health.html' },
    { label: 'Media', href: 'media.html' },
    { label: 'Finance', href: 'finance.html' }
  ];

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function isLightTheme() {
    try {
      if (global.JGDash && global.JGDash.theme) return global.JGDash.theme.get() === 'light';
      return localStorage.getItem('jg_theme') === 'light';
    } catch (e) {
      return false;
    }
  }

  function themeLabel() {
    return isLightTheme() ? 'Dark mode' : 'Light mode';
  }

  function paintThemeButton(btn) {
    if (!btn) return;
    var light = isLightTheme();
    var full = light ? 'Dark mode' : 'Light mode';
    var short = light ? 'Dark' : 'Light';
    btn.setAttribute('aria-label', full);
    btn.innerHTML =
      '<span class="tb-label-full">' + escapeHtml(full) + '</span>' +
      '<span class="tb-label-short">' + escapeHtml(short) + '</span>';
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
          '<button type="button" class="tb-btn tb-sync" id="tbSync" title="Sync dashboard data to the cloud">Sync</button>' +
          '<button type="button" class="tb-btn tb-theme" id="tbTheme"></button>' +
          '<button type="button" class="tb-btn tb-signout" id="tbSignOut">Sign out</button>' +
        '</div>' +
      '</div>';

    paintThemeButton(document.getElementById('tbTheme'));

    if (!document.getElementById('jgdash-topbar-style')) {
      var style = document.createElement('style');
      style.id = 'jgdash-topbar-style';
      style.textContent =
        '#jgdash-topbar{position:sticky;top:0;z-index:200;padding:10px 20px;' +
          'background:rgba(5,5,6,0.88);backdrop-filter:blur(14px);' +
          'border-bottom:1px solid rgba(255,255,255,0.06);' +
          'box-sizing:border-box;width:100%;max-width:100vw;}' +
        '#jgdash-topbar *,#jgdash-topbar *::before,#jgdash-topbar *::after{box-sizing:border-box;}' +
        '[data-theme="light"] #jgdash-topbar{background:rgba(244,243,240,0.92);border-bottom-color:rgba(0,0,0,0.08);}' +
        '#jgdash-topbar .tb-inner{max-width:1100px;margin:0 auto;display:flex;align-items:center;gap:12px;flex-wrap:wrap;min-width:0;}' +
        '#jgdash-topbar .tb-brand{font-weight:700;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#B8B6B0;text-decoration:none;flex-shrink:0;}' +
        '#jgdash-topbar .tb-brand:hover{color:#FAFAFA;}' +
        '#jgdash-topbar .tb-title{font-size:13px;color:#FAFAFA;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
        '#jgdash-topbar .tb-spacer{flex:1;min-width:8px;}' +
        '#jgdash-topbar .tb-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end;}' +
        '#jgdash-topbar .tb-hubs{position:relative;flex-shrink:0;}' +
        '#jgdash-topbar .tb-hubs-btn{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#FAFAFA;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;}' +
        '#jgdash-topbar .tb-hubs-btn:hover,#jgdash-topbar .tb-hubs.is-open .tb-hubs-btn{background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.18);}' +
        '#jgdash-topbar .tb-hubs-caret{font-size:10px;opacity:0.7;}' +
        '#jgdash-topbar .tb-hubs-menu{position:absolute;top:calc(100% + 8px);left:0;min-width:160px;padding:6px;border-radius:12px;background:rgba(12,12,14,0.96);border:1px solid rgba(255,255,255,0.1);backdrop-filter:blur(20px);box-shadow:0 16px 40px rgba(0,0,0,0.55);display:flex;flex-direction:column;gap:2px;z-index:30;}' +
        '#jgdash-topbar .tb-hubs-menu[hidden]{display:none;}' +
        '#jgdash-topbar .tb-hub-item{display:block;padding:9px 12px;border-radius:8px;color:#B8B6B0;text-decoration:none;font-size:13px;}' +
        '#jgdash-topbar .tb-hub-item:hover{background:rgba(255,255,255,0.06);color:#FAFAFA;}' +
        '#jgdash-topbar .tb-hub-item.is-current{color:#6BE3A4;background:rgba(107,227,164,0.08);}' +
        '#jgdash-topbar .tb-btn{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#FAFAFA;border-radius:999px;padding:6px 12px;font-size:12px;cursor:pointer;font-family:inherit;font-weight:600;white-space:nowrap;}' +
        '#jgdash-topbar .tb-btn:hover{background:rgba(255,255,255,0.08);}' +
        '#jgdash-topbar .tb-btn:focus-visible{outline:2px solid #6BE3A4;outline-offset:2px;}' +
        '#jgdash-topbar .tb-label-short{display:none;}' +
        '#jgdash-topbar .tb-sync.is-syncing{opacity:0.75;}' +
        '#jgdash-topbar .tb-sync.is-ok{border-color:rgba(107,227,164,0.45);color:#6BE3A4;}' +
        '#jgdash-topbar .tb-sync.is-error{border-color:rgba(255,107,107,0.45);color:#FF6B6B;}' +
        '#jgdash-topbar .tb-sync.is-skipped{opacity:0.85;}' +
        '[data-theme="light"] #jgdash-topbar .tb-brand{color:#5C5A54;}' +
        '[data-theme="light"] #jgdash-topbar .tb-brand:hover{color:#1A1917;}' +
        '[data-theme="light"] #jgdash-topbar .tb-title{color:#1A1917;}' +
        '[data-theme="light"] #jgdash-topbar .tb-hubs-btn,' +
        '[data-theme="light"] #jgdash-topbar .tb-btn{background:rgba(0,0,0,0.04);border-color:rgba(0,0,0,0.12);color:#1A1917;}' +
        '[data-theme="light"] #jgdash-topbar .tb-hubs-menu{background:#fff;border-color:rgba(0,0,0,0.1);}' +
        '[data-theme="light"] #jgdash-topbar .tb-hub-item{color:#5C5A54;}' +
        '[data-theme="light"] #jgdash-topbar .tb-hub-item:hover{background:rgba(0,0,0,0.05);color:#1A1917;}' +
        '[data-theme="light"] #jgdash-topbar .tb-hub-item.is-current{color:#1F9D62;background:rgba(31,157,98,0.1);}' +
        '@media (max-width:720px){' +
          '#jgdash-topbar{padding:8px 12px;}' +
          '#jgdash-topbar .tb-inner{gap:8px;row-gap:8px;}' +
          '#jgdash-topbar .tb-title{display:none;}' +
          '#jgdash-topbar .tb-spacer{display:none;}' +
          '#jgdash-topbar .tb-actions{flex:0 0 100%;width:100%;max-width:100%;justify-content:flex-end;gap:6px;}' +
          '#jgdash-topbar .tb-btn,#jgdash-topbar .tb-hubs-btn{padding:6px 10px;}' +
          '#jgdash-topbar .tb-label-full{display:none;}' +
          '#jgdash-topbar .tb-label-short{display:inline;}' +
        '}' +
        '@media (max-width:380px){' +
          '#jgdash-topbar .tb-btn,#jgdash-topbar .tb-hubs-btn{padding:6px 8px;font-size:11px;}' +
        '}' +
        /* Keep the left hamburger bar stuck under the sticky topbar while scrolling.
           position:fixed — sticky fails when .main has overflow:hidden (Projects/Health/etc). */
        '@media (max-width:860px){' +
          '.mobile-bar{position:fixed!important;left:0;right:0;' +
            'top:var(--jgdash-topbar-height,0px)!important;z-index:150!important;' +
            'background:rgba(5,5,6,0.92)!important;backdrop-filter:blur(14px);' +
            'display:flex!important;}' +
          '[data-theme="light"] .mobile-bar{background:rgba(244,243,240,0.94)!important;}' +
          'body.jgdash-mobile-bar-pad .main{' +
            'padding-top:var(--jgdash-mobile-bar-height,57px)!important;}' +
          /* Sidebar starts below topbar + hamburger so Overview is not covered. */
          '.sidebar{top:calc(var(--jgdash-topbar-height,0px) + var(--jgdash-mobile-bar-height,57px))!important;' +
            'height:calc(100dvh - var(--jgdash-topbar-height,0px) - var(--jgdash-mobile-bar-height,57px))!important;' +
            'bottom:auto!important;z-index:140!important;}' +
          '.sidebar-overlay{top:calc(var(--jgdash-topbar-height,0px) + var(--jgdash-mobile-bar-height,57px))!important;' +
            'z-index:130!important;}' +
        '}';
      document.head.appendChild(style);
    }

    function syncTopbarHeightVar() {
      var h = el.offsetHeight || 0;
      document.documentElement.style.setProperty('--jgdash-topbar-height', h + 'px');
      syncMobileBarLayout();
    }

    function syncMobileBarLayout() {
      var bar = document.querySelector('.mobile-bar');
      var show = false;
      if (bar) {
        // match pages that reveal the bar at ≤860px
        show = window.matchMedia && window.matchMedia('(max-width: 860px)').matches;
      }
      document.body.classList.toggle('jgdash-mobile-bar-pad', !!show);
      if (show && bar) {
        // Temporarily ensure measurable height even before page CSS display:flex applies.
        var h = bar.offsetHeight || 57;
        document.documentElement.style.setProperty('--jgdash-mobile-bar-height', h + 'px');
      }
    }

    syncTopbarHeightVar();
    if (typeof ResizeObserver !== 'undefined') {
      try {
        var ro = new ResizeObserver(function () { syncTopbarHeightVar(); });
        ro.observe(el);
      } catch (err) { /* ignore */ }
    }
    window.addEventListener('resize', syncTopbarHeightVar);
    // Topbar can wrap to two rows after fonts/layout settle.
    setTimeout(syncTopbarHeightVar, 0);
    setTimeout(syncTopbarHeightVar, 250);

    // Hamburger toggles open/close (pages historically only called openSidebar).
    if (!document.documentElement.getAttribute('data-jg-hamburger-toggle')) {
      document.documentElement.setAttribute('data-jg-hamburger-toggle', '1');
      document.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest && e.target.closest('#hamburger');
        if (!btn) return;
        var sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        var overlay = document.getElementById('sidebarOverlay');
        var willOpen = !sidebar.classList.contains('open');
        sidebar.classList.toggle('open', willOpen);
        if (overlay) overlay.classList.toggle('open', willOpen);
      }, true);
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
        } else {
          // Fallback if theme.js failed to load
          var html = document.documentElement;
          var next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
          if (next === 'light') html.setAttribute('data-theme', 'light');
          else html.removeAttribute('data-theme');
          try { localStorage.setItem('jg_theme', next); } catch (err) { /* ignore */ }
        }
        paintThemeButton(themeBtn);
      });
    }

    var syncBtn = document.getElementById('tbSync');
    if (syncBtn) {
      function paintSync(status) {
        status = status || (global.JGDash && global.JGDash.sync && global.JGDash.sync.getStatus && global.JGDash.sync.getStatus());
        syncBtn.classList.remove('is-syncing', 'is-ok', 'is-error', 'is-skipped');
        if (!status) {
          syncBtn.textContent = 'Sync';
          return;
        }
        if (status.state === 'syncing') {
          syncBtn.classList.add('is-syncing');
          syncBtn.textContent = 'Syncing…';
        } else if (status.state === 'ok') {
          syncBtn.classList.add('is-ok');
          syncBtn.textContent = 'Synced';
        } else if (status.state === 'error') {
          syncBtn.classList.add('is-error');
          syncBtn.textContent = 'Sync error';
          syncBtn.title = status.message || 'Sync failed';
        } else if (status.state === 'skipped') {
          syncBtn.classList.add('is-skipped');
          syncBtn.textContent = 'Sync';
          syncBtn.title = status.message || 'Sign in to sync';
        } else {
          syncBtn.textContent = 'Sync';
        }
      }
      paintSync();
      if (global.JGDash && global.JGDash.sync && global.JGDash.sync.onStatus) {
        global.JGDash.sync.onStatus(paintSync);
      }
      global.addEventListener('jg-sync-status', function (e) {
        paintSync(e.detail);
      });
      syncBtn.title = 'Sync now (also runs automatically every minute while signed in)';
      syncBtn.addEventListener('click', function () {
        if (!global.JGDash || !global.JGDash.sync) return;
        syncBtn.textContent = 'Syncing…';
        syncBtn.classList.add('is-syncing');
        global.JGDash.sync.syncNow({ skipReload: true }).then(function (res) {
          var status = global.JGDash.sync.getStatus();
          paintSync(status);
          if (res && res.skipped && res.reason === 'signed_out') {
            syncBtn.title = 'Sign in once — sync then runs automatically every minute';
            if (confirm('Sign in once to enable automatic cloud sync. Go to sign-in?')) {
              location.href = 'signin.html?next=' + encodeURIComponent(location.pathname.split('/').pop() || 'index.html');
            }
            return;
          }
          if (res && res.missingTable) {
            syncBtn.title = 'Run supabase/migrations/001_user_kv.sql in the Supabase SQL editor';
            alert('Sync table missing. In Supabase SQL editor, run supabase/migrations/001_user_kv.sql');
            return;
          }
          if (res && res.error) {
            var errMsg = (res.error && res.error.message) || status.message || 'Sync failed';
            syncBtn.title = errMsg;
            alert('Sync failed: ' + errMsg);
            return;
          }
          if (res && res.ok && !res.skipped) {
            var detail = status.message || 'Synced';
            syncBtn.title = detail + ' · auto every minute';
            // No alert when healthy — auto sync should feel quiet.
          }
        }).catch(function (err) {
          paintSync({ state: 'error', message: (err && err.message) || 'Sync failed' });
          alert('Sync failed: ' + ((err && err.message) || 'unknown error'));
        });
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
