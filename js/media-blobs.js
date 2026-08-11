/* JGDash Media / MyMind image blob sync — IndexedDB locally + Supabase Storage when signed in.
 *
 * Metadata (titles, blobId, cloud flag) syncs via user_kv (jg_media_data_v1).
 * Image bytes also live in IndexedDB locally; without Storage, other devices
 * only see broken/missing previews for phone uploads.
 */
(function (global) {
  'use strict';

  var BUCKET = 'media-images';

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

  function extFor(blob) {
    var t = (blob && blob.type) || '';
    if (/png/i.test(t)) return 'png';
    if (/webp/i.test(t)) return 'webp';
    if (/gif/i.test(t)) return 'gif';
    return 'jpg';
  }

  function objectPath(userId, imageId, blob) {
    return String(userId) + '/' + String(imageId) + '.' + extFor(blob);
  }

  function candidatePaths(userId, imageId) {
    var base = String(userId) + '/' + String(imageId);
    return [base + '.jpg', base + '.jpeg', base + '.png', base + '.webp', base + '.gif'];
  }

  /** Upload a File/Blob to private storage under the signed-in user. */
  function upload(imageId, blob) {
    var sb = getSb();
    if (!sb || !blob) return Promise.resolve({ ok: false, reason: 'not_signed_in' });
    return getUserId().then(function (uid) {
      if (!uid) return { ok: false, reason: 'not_signed_in' };
      var path = objectPath(uid, imageId, blob);
      return sb.storage.from(BUCKET).upload(path, blob, {
        upsert: true,
        contentType: (blob && blob.type) || 'image/jpeg',
        cacheControl: '3600'
      }).then(function (res) {
        if (res.error) {
          return { ok: false, reason: res.error.message || 'upload_failed', error: res.error };
        }
        return { ok: true, path: path };
      });
    });
  }

  /** Download an image blob for the signed-in user (or null if missing). */
  function download(imageId) {
    var sb = getSb();
    if (!sb) return Promise.resolve(null);
    return getUserId().then(function (uid) {
      if (!uid) return null;
      var paths = candidatePaths(uid, imageId);
      var i = 0;
      function next() {
        if (i >= paths.length) return Promise.resolve(null);
        var path = paths[i++];
        return sb.storage.from(BUCKET).download(path).then(function (res) {
          if (res.error || !res.data) return next();
          return res.data;
        }).catch(function () { return next(); });
      }
      return next();
    });
  }

  /** Best-effort delete from cloud (ignore missing / unsigned). */
  function remove(imageId) {
    var sb = getSb();
    if (!sb) return Promise.resolve();
    return getUserId().then(function (uid) {
      if (!uid) return;
      return sb.storage.from(BUCKET).remove(candidatePaths(uid, imageId)).catch(function () {});
    });
  }

  global.JGMediaBlobs = {
    BUCKET: BUCKET,
    upload: upload,
    download: download,
    remove: remove,
    getUserId: getUserId
  };
})(window);
