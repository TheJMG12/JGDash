(function (global) {
  'use strict';

  function mountTopbar(opts) {
    opts = opts || {};
    var title = opts.title || 'JGDash';
    var el = document.getElementById('jgdash-topbar');
    if (!el) {
      el = document.createElement('header');
      el.id = 'jgdash-topbar';
      document.body.insertBefore(el, document.body.firstChild);
    }
    el.innerHTML =
      '<div class="tb-inner">' +
        '<a class="tb-brand" href="index.html">JGDash</a>' +
        '<span class="tb-title">' + title + '</span>' +
        '<div class="tb-actions">' +
          '<button type="button" class="tb-btn" id="tbSignOut" hidden>Sign out</button>' +
        '</div>' +
      '</div>';

    if (!document.getElementById('jgdash-topbar-style')) {
      var style = document.createElement('style');
      style.id = 'jgdash-topbar-style';
      style.textContent =
        '#jgdash-topbar{position:relative;z-index:5;padding:12px 20px;}' +
        '#jgdash-topbar .tb-inner{max-width:1100px;margin:0 auto;display:flex;align-items:center;gap:14px;}' +
        '#jgdash-topbar .tb-brand{font-weight:700;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#B8B6B0;text-decoration:none;}' +
        '#jgdash-topbar .tb-brand:hover{color:#FAFAFA;}' +
        '#jgdash-topbar .tb-title{flex:1;font-size:13px;color:#76746E;}' +
        '#jgdash-topbar .tb-btn{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#FAFAFA;border-radius:999px;padding:6px 12px;font-size:12px;cursor:pointer;}' +
        '#jgdash-topbar .tb-btn:hover{background:rgba(255,255,255,0.08);}';
      document.head.appendChild(style);
    }

    var btn = document.getElementById('tbSignOut');
    var api = global.JGDash && global.JGDash.supabase;
    if (api && api.isConfigured()) {
      api.getClient().auth.getSession().then(function (res) {
        if (res.data && res.data.session) {
          btn.hidden = false;
        }
      });
      btn.addEventListener('click', async function () {
        await api.getClient().auth.signOut();
        location.href = 'signin.html';
      });
    }
  }

  global.JGDash = global.JGDash || {};
  global.JGDash.topbar = { mount: mountTopbar };

  document.addEventListener('DOMContentLoaded', function () {
    var page = document.body.getAttribute('data-page-title');
    if (page !== null) mountTopbar({ title: page });
  });
})(window);
