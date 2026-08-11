/* JGDash Media — shared store for hub, visual bookmarks, watchlist, reading list */
(function (global) {
  'use strict';

  var DATA_KEY = 'jg_media_data_v1';
  var IDB_NAME = 'jg_media_images_v1';

  function uid() {
    return 'm_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function daysAgo(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  function defaultFeeds() {
    return [
      { id: uid(), name: 'Hacker News', type: 'news', url: 'https://hnrss.org/frontpage', enabled: true },
      { id: uid(), name: 'BBC World', type: 'news', url: 'http://feeds.bbci.co.uk/news/world/rss.xml', enabled: true },
      { id: uid(), name: 'The Verge', type: 'news', url: 'https://www.theverge.com/rss/index.xml', enabled: false },
      { id: uid(), name: 'TED Talks (YouTube)', type: 'youtube', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCAuUUnT6oDeKwE6v1NGQxug', enabled: true },
      { id: uid(), name: 'r/netsec', type: 'reddit', url: 'https://www.reddit.com/r/netsec/.rss', enabled: true },
      { id: uid(), name: 'r/soccer', type: 'reddit', url: 'https://www.reddit.com/r/soccer/.rss', enabled: true },
      { id: uid(), name: 'r/personalfinance', type: 'reddit', url: 'https://www.reddit.com/r/personalfinance/.rss', enabled: false }
    ];
  }

  /** Known filler titles shipped in older builds — purged from local + cloud so only real user saves remain. */
  var SEED_ITEM_TITLES = {
    'how elite midfielders scan before receiving': 1,
    'zero trust architecture explained': 1,
    'index funds vs stock picking': 1,
    'interesting cve discussion in r/netsec': 1,
    'the ottoman siege logistics essay': 1,
    'dashboard density patterns': 1
  };
  var SEED_VISUAL_TITLES = {
    'dense ops dashboard mock': 1,
    'stadium night lights': 1,
    'minimal desk setup': 1,
    'mountain travel frame': 1,
    'ui card spacing study': 1,
    'plated recipe inspo': 1,
    'archive fashion look': 1,
    'history map texture': 1
  };

  function isSeedItem(it) {
    if (!it) return false;
    var t = String(it.title || '').trim().toLowerCase();
    if (SEED_ITEM_TITLES[t]) return true;
    var url = String(it.url || '');
    if (/example\.com\/dashboard-density/i.test(url)) return true;
    if (/images\.unsplash\.com/i.test(String(it.image || '')) && SEED_ITEM_TITLES[t]) return true;
    return false;
  }

  function isSeedVisual(v) {
    if (!v) return false;
    var t = String(v.title || '').trim().toLowerCase();
    if (SEED_VISUAL_TITLES[t]) return true;
    if (/images\.unsplash\.com/i.test(String(v.src || '')) && SEED_VISUAL_TITLES[t]) return true;
    if (String(v.sourceLabel || '') === 'Unsplash' && SEED_VISUAL_TITLES[t]) return true;
    return false;
  }

  /** Empty Media blob — no stock bookmarks / MyMind filler. */
  function defaultData() {
    return {
      items: [],
      visuals: [],
      watchlist: [],
      books: [],
      collections: [],
      readingGoal: { year: new Date().getFullYear(), target: 24, completed: 0 },
      feeds: defaultFeeds(),
      pinnedTags: [],
      tagMeta: {},
      // Sync delete ledger: { [id]: ISO timestamp }. Merge keeps tombstones so removals stick across devices.
      tombstones: {}
    };
  }

  /** Tombstone + drop stock filler from items/visuals. Returns number removed. */
  function purgeSeedContent(store) {
    if (!store) return 0;
    if (!store.tombstones || typeof store.tombstones !== 'object') store.tombstones = {};
    var n = 0;
    var now = new Date().toISOString();
    function purge(field, pred) {
      if (!Array.isArray(store[field])) return;
      var keep = [];
      store[field].forEach(function (row) {
        if (pred(row)) {
          if (row && row.id != null) store.tombstones[String(row.id)] = now;
          n += 1;
        } else {
          keep.push(row);
        }
      });
      store[field] = keep;
    }
    purge('items', isSeedItem);
    purge('visuals', isSeedVisual);
    return n;
  }

  function load() {
    try {
      var raw = localStorage.getItem(DATA_KEY);
      if (!raw) return defaultData();
      var parsed = JSON.parse(raw);
      var base = defaultData();
      Object.keys(parsed).forEach(function (k) { base[k] = parsed[k]; });
      if (!Array.isArray(base.feeds)) base.feeds = [];
      // Empty feeds is a valid user state — do not re-seed defaults after delete-all.
      if (!base.feeds.length && parsed.feeds == null) base.feeds = defaultFeeds();
      if (!Array.isArray(base.items)) base.items = [];
      if (!Array.isArray(base.visuals)) base.visuals = [];
      if (!Array.isArray(base.watchlist)) base.watchlist = [];
      if (!Array.isArray(base.books)) base.books = [];
      if (!Array.isArray(base.collections)) base.collections = [];
      if (!base.tombstones || typeof base.tombstones !== 'object') base.tombstones = {};
      if (!Array.isArray(base.pinnedTags)) base.pinnedTags = [];
      if (!base.tagMeta || typeof base.tagMeta !== 'object') base.tagMeta = {};
      base.items.forEach(function (it) {
        if (it.inbox == null) it.inbox = it.status === 'inbox';
        if (!it.status) it.status = it.inbox ? 'inbox' : 'library';
        if (it.description == null) it.description = '';
        if (it.image == null) it.image = '';
        if (it.notes == null) it.notes = '';
      });
      // Drop any locally lingering rows that are already tombstoned
      ['items', 'visuals', 'watchlist', 'books', 'feeds'].forEach(function (field) {
        if (!Array.isArray(base[field])) return;
        base[field] = base[field].filter(function (it) {
          return !(it && it.id != null && base.tombstones[String(it.id)]);
        });
      });
      var purged = purgeSeedContent(base);
      try { localStorage.setItem(DATA_KEY, JSON.stringify(base)); } catch (e) { /* quota */ }
      if (purged) base._purgedSeed = purged;
      return base;
    } catch (e) {
      return defaultData();
    }
  }

  function save(store) {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(store));
      return true;
    } catch (e) {
      // Quota: drop large data: URLs (cloud/IDB still hold bytes) and retry.
      try {
        var lean = JSON.parse(JSON.stringify(store));
        (lean.visuals || []).forEach(function (v) {
          if (!v) return;
          if (String(v.src || '').indexOf('data:') === 0 && String(v.src).length > 12000) {
            v.src = '';
            v.srcOmitted = true;
          }
        });
        localStorage.setItem(DATA_KEY, JSON.stringify(lean));
        if (store && Array.isArray(store.visuals)) {
          store.visuals.forEach(function (v, i) {
            if (lean.visuals[i] && lean.visuals[i].srcOmitted) {
              v.src = '';
              v.srcOmitted = true;
            }
          });
        }
        return true;
      } catch (e2) {
        return false;
      }
    }
  }

  /** Record a cross-device delete and remove the row from the given collection(s). */
  function removeById(store, id, fields) {
    if (!store || id == null || id === '') return store;
    if (!store.tombstones || typeof store.tombstones !== 'object') store.tombstones = {};
    store.tombstones[String(id)] = new Date().toISOString();
    var list = Array.isArray(fields) ? fields : [fields || 'items'];
    list.forEach(function (field) {
      if (!Array.isArray(store[field])) return;
      store[field] = store[field].filter(function (x) { return !x || String(x.id) !== String(id); });
    });
    return store;
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('images')) db.createObjectStore('images');
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function idbPut(id, blob) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('images', 'readwrite');
        tx.objectStore('images').put(blob, id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function idbGet(id) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('images', 'readonly');
        var req = tx.objectStore('images').get(id);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function idbDel(id) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('images', 'readwrite');
        tx.objectStore('images').delete(id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  /** Resize / compress an image File into a durable data URL (survives reload + sync). */
  function resizeImageFile(file, maxDim, quality) {
    maxDim = maxDim || 1400;
    quality = quality == null ? 0.82 : quality;
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error('No file'));
        return;
      }
      var isImage = file.type && file.type.indexOf('image/') === 0;
      if (!isImage) {
        var reader = new FileReader();
        reader.onload = function () { resolve(reader.result); };
        reader.onerror = function () { reject(reader.error); };
        reader.readAsDataURL(file);
        return;
      }
      var objUrl = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          var scale = Math.min(1, maxDim / Math.max(w, h || 1));
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement('canvas');
          canvas.width = cw;
          canvas.height = ch;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, cw, ch);
          URL.revokeObjectURL(objUrl);
          var mime = /png/i.test(file.type) ? 'image/png' : 'image/jpeg';
          resolve(canvas.toDataURL(mime, quality));
        } catch (err) {
          URL.revokeObjectURL(objUrl);
          reject(err);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(objUrl);
        var reader = new FileReader();
        reader.onload = function () { resolve(reader.result); };
        reader.onerror = function () { reject(reader.error); };
        reader.readAsDataURL(file);
      };
      img.src = objUrl;
    });
  }

  /**
   * Ingest an uploaded image: IndexedDB + durable data URL (+ cloud upload when signed in).
   * Returns { blobId, src, sourceLabel, cloud, file }.
   */
  function ingestImageFile(file) {
    var blobId = uid();
    return idbPut(blobId, file).catch(function () { /* IDB optional */ }).then(function () {
      return resizeImageFile(file, 1400, 0.82).then(function (dataUrl) {
        var result = { blobId: blobId, src: dataUrl, sourceLabel: 'Upload', cloud: false, file: file };
        if (!global.JGMediaBlobs || typeof global.JGMediaBlobs.upload !== 'function') {
          return result;
        }
        // Prefer uploading the compressed preview so other devices get a fast durable image.
        return dataUrlToBlob(dataUrl).then(function (compressed) {
          var blob = compressed || file;
          return global.JGMediaBlobs.upload(blobId, blob).then(function (up) {
            if (up && up.ok) result.cloud = true;
            return result;
          }).catch(function () { return result; });
        }).catch(function () { return result; });
      });
    });
  }

  function dataUrlToBlob(dataUrl) {
    return new Promise(function (resolve) {
      try {
        if (!dataUrl || String(dataUrl).indexOf('data:') !== 0) {
          resolve(null);
          return;
        }
        fetch(dataUrl).then(function (r) { return r.blob(); }).then(resolve).catch(function () { resolve(null); });
      } catch (e) {
        resolve(null);
      }
    });
  }

  function blobIdFromNote(note) {
    var m = String(note || '').match(/IndexedDB blob id\s+(m_[a-z0-9]+)/i);
    return m ? m[1] : '';
  }

  /**
   * Resolve a visual's displayable src.
   * Order: durable http/data URL → IndexedDB → Supabase Storage (when signed in).
   */
  function resolveVisualSrc(visual) {
    if (!visual) return Promise.resolve('');
    var src = String(visual.src || '');
    var blobId = visual.blobId || blobIdFromNote(visual.note);
    var needsHydrate = !src || src.indexOf('blob:') === 0 || visual.srcOmitted;
    if (!needsHydrate) return Promise.resolve(src);

    function fromIdb() {
      if (!blobId) return Promise.resolve('');
      return idbGet(blobId).then(function (blob) {
        if (!blob) return '';
        return URL.createObjectURL(blob);
      }).catch(function () { return ''; });
    }

    function fromCloud() {
      if (!blobId || !global.JGMediaBlobs || typeof global.JGMediaBlobs.download !== 'function') {
        return Promise.resolve('');
      }
      return global.JGMediaBlobs.download(blobId).then(function (blob) {
        if (!blob) return '';
        return idbPut(blobId, blob).catch(function () {}).then(function () {
          return resizeImageFile(blob, 1400, 0.82).then(function (dataUrl) {
            visual.src = dataUrl;
            visual.srcOmitted = false;
            visual.cloud = true;
            return dataUrl;
          }).catch(function () {
            return URL.createObjectURL(blob);
          });
        });
      }).catch(function () { return ''; });
    }

    return fromIdb().then(function (local) {
      if (local) return local;
      return fromCloud();
    });
  }

  /**
   * Repair visuals that still have dead blob: src / missing preview via IDB or cloud.
   * Persists repaired src + blobId. Returns Promise<number> of repaired count.
   */
  function repairVisualBlobs(store) {
    if (!store || !Array.isArray(store.visuals)) return Promise.resolve(0);
    var jobs = store.visuals.map(function (v) {
      if (!v) return Promise.resolve(false);
      var src = String(v.src || '');
      var blobId = v.blobId || blobIdFromNote(v.note);
      if (src && src.indexOf('blob:') !== 0 && !v.srcOmitted) {
        if (blobId && !v.blobId) { v.blobId = blobId; return Promise.resolve(true); }
        return Promise.resolve(false);
      }
      if (!blobId) {
        if (src.indexOf('blob:') === 0) {
          v.src = '';
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      }
      v.blobId = blobId;
      return idbGet(blobId).then(function (blob) {
        if (blob) {
          return resizeImageFile(blob, 1400, 0.82).then(function (dataUrl) {
            v.src = dataUrl;
            v.srcOmitted = false;
            return true;
          }).catch(function () {
            v.src = URL.createObjectURL(blob);
            return true;
          });
        }
        if (!global.JGMediaBlobs || typeof global.JGMediaBlobs.download !== 'function') {
          if (src.indexOf('blob:') === 0) { v.src = ''; return true; }
          return false;
        }
        return global.JGMediaBlobs.download(blobId).then(function (cloudBlob) {
          if (!cloudBlob) {
            if (src.indexOf('blob:') === 0) { v.src = ''; return true; }
            return false;
          }
          return idbPut(blobId, cloudBlob).catch(function () {}).then(function () {
            return resizeImageFile(cloudBlob, 1400, 0.82).then(function (dataUrl) {
              v.src = dataUrl;
              v.srcOmitted = false;
              v.cloud = true;
              return true;
            });
          });
        }).catch(function () {
          if (src.indexOf('blob:') === 0) { v.src = ''; return true; }
          return false;
        });
      }).catch(function () {
        if (src.indexOf('blob:') === 0) { v.src = ''; return true; }
        return false;
      });
    });
    return Promise.all(jobs).then(function (flags) {
      var n = flags.filter(Boolean).length;
      if (n) save(store);
      return n;
    });
  }

  /** Upload local visuals that have blobId but are not yet marked cloud. */
  function backfillCloudImages(store) {
    if (!store || !Array.isArray(store.visuals)) return Promise.resolve(0);
    if (!global.JGMediaBlobs || typeof global.JGMediaBlobs.upload !== 'function') {
      return Promise.resolve(0);
    }
    var pending = store.visuals.filter(function (v) {
      return v && v.blobId && !v.cloud && (v.sourceLabel === 'Upload' || String(v.src || '').indexOf('data:') === 0 || v.srcOmitted);
    });
    if (!pending.length) return Promise.resolve(0);
    var n = 0;
    var chain = Promise.resolve();
    pending.forEach(function (v) {
      chain = chain.then(function () {
        return idbGet(v.blobId).then(function (blob) {
          if (!blob && String(v.src || '').indexOf('data:') === 0) {
            return dataUrlToBlob(v.src);
          }
          return blob;
        }).then(function (blob) {
          if (!blob) return;
          return global.JGMediaBlobs.upload(v.blobId, blob).then(function (up) {
            if (up && up.ok) {
              v.cloud = true;
              n += 1;
            }
          });
        }).catch(function () {});
      });
    });
    return chain.then(function () {
      if (n) save(store);
      return n;
    });
  }

  /** After ingest, mark visual.cloud and persist. */
  function markVisualCloud(store, visualId, cloud) {
    if (!store || !Array.isArray(store.visuals)) return;
    var v = store.visuals.find(function (x) { return x && x.id === visualId; });
    if (!v) return;
    v.cloud = !!cloud;
    if (cloud) v.updatedAt = new Date().toISOString();
    save(store);
  }

  function hostnameOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  function detectType(url) {
    var u = String(url || '').toLowerCase();
    if (/youtube\.com|youtu\.be/.test(u)) return 'video';
    if (/reddit\.com|redd\.it/.test(u)) return 'reddit';
    if (/\.(pdf)(\?|$)/.test(u)) return 'link';
    return 'article';
  }

  function titleFromUrl(url) {
    try {
      var u = new URL(url);
      var parts = u.pathname.split('/').filter(Boolean);
      if (!parts.length) return hostnameOf(url) || 'Untitled';
      var last = decodeURIComponent(parts[parts.length - 1]).replace(/[-_]+/g, ' ').replace(/\.\w+$/, '');
      if (/^[a-z0-9]{6,}$/i.test(last) && parts.length > 1) {
        last = decodeURIComponent(parts[parts.length - 2]).replace(/[-_]+/g, ' ');
      }
      return last.replace(/\b\w/g, function (c) { return c.toUpperCase(); }).slice(0, 120) || hostnameOf(url);
    } catch (e) {
      return 'Untitled';
    }
  }

  function youtubeId(url) {
    try {
      var u = new URL(url);
      if (u.hostname.indexOf('youtu.be') !== -1) return u.pathname.slice(1).split('/')[0];
      return u.searchParams.get('v') || '';
    } catch (e) { return ''; }
  }

  function guessMeta(url) {
    var type = detectType(url);
    var host = hostnameOf(url);
    var source = host;
    var author = '';
    var image = '';
    var title = titleFromUrl(url);
    if (type === 'video') {
      source = 'YouTube';
      var vid = youtubeId(url);
      if (vid) image = 'https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg';
    } else if (type === 'reddit') {
      source = 'Reddit';
      var m = String(url).match(/reddit\.com\/r\/([^/]+)/i);
      if (m) { author = 'r/' + m[1]; title = title || ('Post in r/' + m[1]); }
    }
    return {
      url: url,
      title: title,
      type: type,
      source: source,
      author: author,
      description: '',
      image: image,
      tags: type === 'video' ? 'youtube' : type === 'reddit' ? 'reddit' : ''
    };
  }

  function fetchJson(url, timeoutMs) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeoutMs || 8000);
    return fetch(url, { signal: ctrl ? ctrl.signal : undefined, credentials: 'omit' })
      .then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .catch(function (err) {
        clearTimeout(timer);
        throw err;
      });
  }

  function enrichMeta(url) {
    var base = guessMeta(url);
    var tasks = [];

    if (base.type === 'video') {
      tasks.push(
        fetchJson('https://www.youtube.com/oembed?url=' + encodeURIComponent(url) + '&format=json', 6000)
          .then(function (j) {
            if (j.title) base.title = j.title;
            if (j.author_name) base.author = j.author_name;
            if (j.thumbnail_url) base.image = j.thumbnail_url;
            base.source = 'YouTube';
            base.type = 'video';
          })
          .catch(function () {
            return fetchJson('https://noembed.com/embed?url=' + encodeURIComponent(url), 6000).then(function (j) {
              if (j && !j.error) {
                if (j.title) base.title = j.title;
                if (j.author_name) base.author = j.author_name;
                if (j.thumbnail_url) base.image = j.thumbnail_url;
                base.source = 'YouTube';
                base.type = 'video';
              }
            }).catch(function () {});
          })
      );
    }

    if (base.type === 'reddit') {
      var jsonUrl = url.replace(/\/?(\?.*)?$/, '') + '.json';
      tasks.push(
        fetchJson('https://api.allorigins.win/raw?url=' + encodeURIComponent(jsonUrl), 7000)
          .then(function (j) {
            var post = j && j[0] && j[0].data && j[0].data.children && j[0].data.children[0] && j[0].data.children[0].data;
            if (!post) return;
            if (post.title) base.title = post.title;
            if (post.author) base.author = 'u/' + post.author;
            if (post.subreddit) { base.source = 'r/' + post.subreddit; base.tags = 'reddit, ' + post.subreddit; }
            if (post.thumbnail && String(post.thumbnail).indexOf('http') === 0) base.image = post.thumbnail;
            if (post.selftext) base.description = String(post.selftext).slice(0, 280);
            base.type = 'reddit';
          })
          .catch(function () {})
      );
    }

    tasks.push(
      fetchJson('https://api.microlink.io?url=' + encodeURIComponent(url), 8000)
        .then(function (j) {
          if (!j || j.status !== 'success' || !j.data) return;
          var d = j.data;
          if (d.title) base.title = d.title;
          if (d.description) base.description = String(d.description).slice(0, 320);
          if (d.author) base.author = typeof d.author === 'string' ? d.author : (d.author.name || base.author);
          if (d.publisher) base.source = d.publisher;
          else if (!base.source) base.source = hostnameOf(url);
          if (d.image && d.image.url) base.image = d.image.url;
          if (!base.type || base.type === 'article' || base.type === 'link') {
            if (d.logo || d.image) base.type = base.type === 'video' ? 'video' : 'article';
          }
        })
        .catch(function () {})
    );

    return Promise.all(tasks).then(function () { return base; });
  }

  function fetchRss(feedUrl) {
    var endpoints = [
      'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(feedUrl),
      'https://api.allorigins.win/raw?url=' + encodeURIComponent(feedUrl)
    ];
    return fetchJson(endpoints[0], 10000)
      .then(function (j) {
        if (j && j.items && j.items.length) {
          return {
            title: (j.feed && j.feed.title) || '',
            items: j.items.map(function (it) {
              return {
                title: it.title || 'Untitled',
                url: it.link || it.url || '',
                description: (it.description || it.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220),
                image: (it.thumbnail || (it.enclosure && it.enclosure.link) || ''),
                author: it.author || '',
                pubDate: it.pubDate || ''
              };
            })
          };
        }
        throw new Error('Empty feed');
      })
      .catch(function () {
        return fetch(endpoints[1], { credentials: 'omit' }).then(function (r) { return r.text(); }).then(function (xml) {
          var doc = new DOMParser().parseFromString(xml, 'text/xml');
          var nodes = Array.prototype.slice.call(doc.querySelectorAll('item, entry')).slice(0, 20);
          return {
            title: (doc.querySelector('channel > title, feed > title') || {}).textContent || '',
            items: nodes.map(function (n) {
              var linkEl = n.querySelector('link');
              var link = '';
              if (linkEl) link = linkEl.getAttribute('href') || linkEl.textContent || '';
              var thumb = n.querySelector('media\\:thumbnail, thumbnail, enclosure');
              var image = '';
              if (thumb) image = thumb.getAttribute('url') || thumb.getAttribute('href') || '';
              return {
                title: (n.querySelector('title') || {}).textContent || 'Untitled',
                url: link.trim(),
                description: ((n.querySelector('description, summary, content') || {}).textContent || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220),
                image: image,
                author: ((n.querySelector('author, dc\\:creator') || {}).textContent || ''),
                pubDate: ((n.querySelector('pubDate, published, updated') || {}).textContent || '')
              };
            })
          };
        });
      });
  }

  global.JGMedia = {
    DATA_KEY: DATA_KEY,
    uid: uid,
    today: today,
    daysAgo: daysAgo,
    defaultData: defaultData,
    defaultFeeds: defaultFeeds,
    load: load,
    save: save,
    removeById: removeById,
    purgeSeedContent: purgeSeedContent,
    isSeedItem: isSeedItem,
    isSeedVisual: isSeedVisual,
    idbPut: idbPut,
    idbGet: idbGet,
    idbDel: idbDel,
    resizeImageFile: resizeImageFile,
    ingestImageFile: ingestImageFile,
    resolveVisualSrc: resolveVisualSrc,
    repairVisualBlobs: repairVisualBlobs,
    backfillCloudImages: backfillCloudImages,
    markVisualCloud: markVisualCloud,
    detectType: detectType,
    guessMeta: guessMeta,
    enrichMeta: enrichMeta,
    fetchRss: fetchRss,
    hostnameOf: hostnameOf
  };
})(window);
