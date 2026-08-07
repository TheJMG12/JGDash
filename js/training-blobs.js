/* JGDash Training video blob sync — IndexedDB locally + Supabase Storage when signed in.
 *
 * Metadata (titles, hasBlob) already sync via user_kv. The .mp4 bytes do not.
 * Without this module, a phone sees "Ready" after laptop upload but play fails
 * with "Video blob missing".
 */
(function (global) {
  'use strict';

  var BUCKET = 'training-videos';

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

  /** Upload a File/Blob to private storage under the signed-in user. */
  function upload(videoId, blob) {
    var sb = getSb();
    if (!sb || !blob) return Promise.resolve({ ok: false, reason: 'not_signed_in' });
    return getUserId().then(function (uid) {
      if (!uid) return { ok: false, reason: 'not_signed_in' };
      return sb.storage.from(BUCKET).upload(objectPath(uid, videoId), blob, {
        upsert: true,
        contentType: (blob && blob.type) || 'video/mp4',
        cacheControl: '3600'
      }).then(function (res) {
        if (res.error) {
          return { ok: false, reason: res.error.message || 'upload_failed', error: res.error };
        }
        return { ok: true, path: objectPath(uid, videoId) };
      });
    });
  }

  /** Download a video blob for the signed-in user (or null if missing). */
  function download(videoId) {
    var sb = getSb();
    if (!sb) return Promise.resolve(null);
    return getUserId().then(function (uid) {
      if (!uid) return null;
      return sb.storage.from(BUCKET).download(objectPath(uid, videoId)).then(function (res) {
        if (res.error || !res.data) return null;
        return res.data;
      }).catch(function () { return null; });
    });
  }

  /** Best-effort delete from cloud (ignore missing / unsigned). */
  function remove(videoId) {
    var sb = getSb();
    if (!sb) return Promise.resolve();
    return getUserId().then(function (uid) {
      if (!uid) return;
      return sb.storage.from(BUCKET).remove([objectPath(uid, videoId)]).catch(function () {});
    });
  }

  global.JGTrainingBlobs = {
    BUCKET: BUCKET,
    upload: upload,
    download: download,
    remove: remove,
    getUserId: getUserId
  };
})(window);
