/* JGDash Training video blob sync — IndexedDB locally + Supabase Storage when signed in.
 *
 * Metadata (titles, hasBlob, cloud) already sync via user_kv. The .mp4 bytes do not.
 * Without this module, a phone sees "Ready" after laptop upload but play fails.
 *
 * Playback prefers createSignedUrl over storage.download(): downloading a full .mp4
 * into memory often fails on mobile for larger files ("cloud failed to load").
 */
(function (global) {
  'use strict';

  var BUCKET = 'training-videos';
  var SIGNED_TTL_SEC = 60 * 60; // 1 hour

  function getSb() {
    var api = global.JGDash && global.JGDash.supabase;
    if (!api || !api.isConfigured()) return null;
    return api.getClient();
  }

  function getUserId() {
    var sb = getSb();
    if (!sb) return Promise.resolve(null);
    return sb.auth.getSession().then(function (res) {
      var session = res && res.data && res.data.session;
      return session && session.user ? session.user.id : null;
    }).catch(function () { return null; });
  }

  function objectPath(userId, videoId) {
    return String(userId) + '/' + String(videoId) + '.mp4';
  }

  /** Some older uploads may have landed without an extension or with a different one. */
  function candidatePaths(userId, videoId) {
    var base = String(userId) + '/' + String(videoId);
    return [base + '.mp4', base, base + '.MP4', base + '.mov'];
  }

  function normalizeVideoBlob(blob) {
    if (!blob) return null;
    var type = (blob.type || '').toLowerCase();
    if (type === 'video/mp4' || type === 'application/octet-stream') return blob;
    // Storage bucket only allows video/mp4 + octet-stream — retag when the browser
    // reports empty / quicktime / x-m4v for an .mp4 file so upload is not rejected.
    try {
      return new Blob([blob], { type: 'video/mp4' });
    } catch (e) {
      return blob;
    }
  }

  /** Upload a File/Blob to private storage under the signed-in user. */
  function upload(videoId, blob) {
    var sb = getSb();
    if (!sb || !blob) return Promise.resolve({ ok: false, reason: 'not_signed_in' });
    return getUserId().then(function (uid) {
      if (!uid) return { ok: false, reason: 'not_signed_in' };
      var body = normalizeVideoBlob(blob);
      var path = objectPath(uid, videoId);
      return sb.storage.from(BUCKET).upload(path, body, {
        upsert: true,
        contentType: 'video/mp4',
        cacheControl: '3600'
      }).then(function (res) {
        if (res.error) {
          return { ok: false, reason: res.error.message || 'upload_failed', error: res.error };
        }
        return { ok: true, path: path };
      }).catch(function (err) {
        return { ok: false, reason: (err && err.message) || 'upload_failed', error: err };
      });
    });
  }

  /**
   * Create a short-lived signed URL for streaming playback (preferred over download).
   * Returns { ok, url, path, reason }.
   */
  function getPlayUrl(videoId) {
    var sb = getSb();
    if (!sb) return Promise.resolve({ ok: false, reason: 'not_configured' });
    return getUserId().then(function (uid) {
      if (!uid) return { ok: false, reason: 'not_signed_in' };
      var paths = candidatePaths(uid, videoId);
      var i = 0;
      function next() {
        if (i >= paths.length) {
          return Promise.resolve({ ok: false, reason: 'not_found' });
        }
        var path = paths[i++];
        return sb.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL_SEC).then(function (res) {
          if (res.error || !res.data || !res.data.signedUrl) return next();
          return { ok: true, url: res.data.signedUrl, path: path };
        }).catch(function () { return next(); });
      }
      return next();
    });
  }

  /**
   * Download a video blob for local IndexedDB cache.
   * Prefer getPlayUrl for playback — this can OOM / fail on large mobile files.
   * Returns { ok, blob, reason }.
   */
  function download(videoId) {
    var sb = getSb();
    if (!sb) return Promise.resolve({ ok: false, reason: 'not_configured', blob: null });
    return getUserId().then(function (uid) {
      if (!uid) return { ok: false, reason: 'not_signed_in', blob: null };
      var paths = candidatePaths(uid, videoId);
      var i = 0;
      function next() {
        if (i >= paths.length) {
          return Promise.resolve({ ok: false, reason: 'not_found', blob: null });
        }
        var path = paths[i++];
        return sb.storage.from(BUCKET).download(path).then(function (res) {
          if (res.error || !res.data) return next();
          return { ok: true, blob: res.data, path: path };
        }).catch(function (err) {
          if (i >= paths.length) {
            return { ok: false, reason: (err && err.message) || 'download_failed', blob: null };
          }
          return next();
        });
      }
      return next();
    });
  }

  /** Best-effort delete from cloud (ignore missing / unsigned). */
  function remove(videoId) {
    var sb = getSb();
    if (!sb) return Promise.resolve();
    return getUserId().then(function (uid) {
      if (!uid) return;
      return sb.storage.from(BUCKET).remove(candidatePaths(uid, videoId)).catch(function () {});
    });
  }

  global.JGTrainingBlobs = {
    BUCKET: BUCKET,
    upload: upload,
    download: download,
    getPlayUrl: getPlayUrl,
    remove: remove,
    getUserId: getUserId
  };
})(window);
