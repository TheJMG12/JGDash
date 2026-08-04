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

  function defaultData() {
    return {
      items: [
        {
          id: uid(), title: 'How elite midfielders scan before receiving', type: 'article',
          source: 'The Athletic', url: 'https://theathletic.com/', status: 'library', priority: 'medium',
          tags: 'soccer, analysis', collection: 'Soccer', estimatedMinutes: 12, savedAt: daysAgo(1),
          author: 'Tactical Desk', description: 'Scanning habits before the ball arrives.',
          image: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=640&q=80',
          notes: '', archived: false, inbox: false
        },
        {
          id: uid(), title: 'Zero Trust architecture explained', type: 'article',
          source: 'Cloudflare Blog', url: 'https://blog.cloudflare.com/', status: 'library', priority: 'high',
          tags: 'cybersecurity', collection: 'Security', estimatedMinutes: 18, savedAt: daysAgo(3),
          author: 'Cloudflare', description: 'Identity-first network security model.',
          image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=640&q=80',
          notes: '', archived: false, inbox: false
        },
        {
          id: uid(), title: 'Index funds vs stock picking', type: 'video',
          source: 'YouTube', url: 'https://www.youtube.com/watch?v=VhgMzI1tC4U', status: 'library', priority: 'medium',
          tags: 'finance, investing', collection: 'Finance', estimatedMinutes: 24, savedAt: daysAgo(2),
          author: 'YouTube', description: 'Long-form investing primer.',
          image: 'https://i.ytimg.com/vi/VhgMzI1tC4U/hqdefault.jpg',
          notes: '', archived: false, inbox: false
        },
        {
          id: uid(), title: 'Interesting CVE discussion in r/netsec', type: 'reddit',
          source: 'Reddit', url: 'https://www.reddit.com/r/netsec/', status: 'inbox', priority: 'low',
          tags: 'cybersecurity', collection: 'Security', estimatedMinutes: 8, savedAt: daysAgo(0),
          author: 'r/netsec', description: 'Community thread — review later.',
          image: '',
          notes: '', archived: false, inbox: true
        },
        {
          id: uid(), title: 'The Ottoman siege logistics essay', type: 'article',
          source: 'History Today', url: 'https://www.historytoday.com/', status: 'library', priority: 'low',
          tags: 'history', collection: 'History', estimatedMinutes: 22, savedAt: daysAgo(20),
          author: 'H. Reed', description: 'Logistics behind early modern siege warfare.',
          image: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=640&q=80',
          notes: '', archived: false, inbox: false
        },
        {
          id: uid(), title: 'Dashboard density patterns', type: 'link',
          source: 'Personal reference', url: 'https://example.com/dashboard-density', status: 'library', priority: 'high',
          tags: 'design, dashboard', collection: 'Dashboard Inspiration', estimatedMinutes: 6, savedAt: daysAgo(5),
          author: '', description: 'Reference for JGDash card density.',
          image: 'https://images.unsplash.com/photo-1551281049-01b386ae3b14?w=640&q=80',
          notes: '', archived: false, inbox: false
        }
      ],
      visuals: [
        {
          id: uid(), title: 'Dense ops dashboard mock', caption: 'Calm dark surfaces',
          src: 'https://images.unsplash.com/photo-1551281049-01b386ae3b14?w=800&q=80',
          sourceUrl: 'https://unsplash.com', sourceLabel: 'Unsplash', savedAt: daysAgo(2),
          tags: 'dashboard, ui', collection: 'Dashboard Inspiration', vibe: 'dark', favorite: true,
          note: 'Like the KPI density here', archived: false
        },
        {
          id: uid(), title: 'Stadium night lights', caption: '',
          src: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800&q=80',
          sourceUrl: 'https://unsplash.com', sourceLabel: 'Unsplash', savedAt: daysAgo(4),
          tags: 'soccer', collection: 'Soccer', vibe: 'night', favorite: false,
          note: 'Mood for training page accents', archived: false
        },
        {
          id: uid(), title: 'Minimal desk setup', caption: 'Warm wood + matte black',
          src: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=800&q=80',
          sourceUrl: 'https://unsplash.com', sourceLabel: 'Unsplash', savedAt: daysAgo(6),
          tags: 'interiors, desk', collection: 'Interiors', vibe: 'warm', favorite: true,
          note: '', archived: false
        },
        {
          id: uid(), title: 'Mountain travel frame', caption: '',
          src: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
          sourceUrl: 'https://unsplash.com', sourceLabel: 'Unsplash', savedAt: daysAgo(8),
          tags: 'travel', collection: 'Travel', vibe: 'cool', favorite: false,
          note: 'Trip moodboard', archived: false
        },
        {
          id: uid(), title: 'UI card spacing study', caption: 'Soft borders',
          src: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80',
          sourceUrl: 'https://unsplash.com', sourceLabel: 'Unsplash', savedAt: daysAgo(1),
          tags: 'ui, design', collection: 'UI Ideas', vibe: 'clean', favorite: false,
          note: 'Spacing rhythm', archived: false
        },
        {
          id: uid(), title: 'Plated recipe inspo', caption: '',
          src: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
          sourceUrl: 'https://unsplash.com', sourceLabel: 'Unsplash', savedAt: daysAgo(9),
          tags: 'recipes', collection: 'Recipes', vibe: 'fresh', favorite: false,
          note: 'High protein bowl vibe', archived: false
        },
        {
          id: uid(), title: 'Archive fashion look', caption: '',
          src: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80',
          sourceUrl: 'https://unsplash.com', sourceLabel: 'Unsplash', savedAt: daysAgo(15),
          tags: 'fashion', collection: 'Fashion', vibe: 'neutral', favorite: false,
          note: '', archived: false
        },
        {
          id: uid(), title: 'History map texture', caption: '',
          src: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800&q=80',
          sourceUrl: 'https://unsplash.com', sourceLabel: 'Unsplash', savedAt: daysAgo(11),
          tags: 'history', collection: 'History', vibe: 'aged', favorite: true,
          note: 'Cover idea for reading notes', archived: false
        }
      ],
      watchlist: [
        { id: uid(), title: 'Moneyball', type: 'movie', genre: 'Drama', year: 2011, runtime: '133m', service: 'Netflix', status: 'Want to Watch', priority: 'medium', rating: 0, note: 'Process over narrative', tags: 'sports, strategy', poster: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=400&q=80', why: 'Ops mindset', addedAt: daysAgo(10), progress: '' },
        { id: uid(), title: 'The Last Dance', type: 'show', genre: 'Documentary', year: 2020, runtime: '10 ep', service: 'Netflix', status: 'Watching', priority: 'high', rating: 0, note: 'Ep 4', tags: 'sports', poster: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&q=80', why: 'Leadership under pressure', addedAt: daysAgo(20), progress: 'S1E4' },
        { id: uid(), title: 'Arrival', type: 'movie', genre: 'Sci-Fi', year: 2016, runtime: '116m', service: 'Prime', status: 'Watched', priority: 'low', rating: 5, note: 'Language shapes thought', tags: 'sci-fi', poster: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400&q=80', why: '', addedAt: daysAgo(60), progress: '' },
        { id: uid(), title: 'Slow Horses', type: 'show', genre: 'Thriller', year: 2022, runtime: 'S3', service: 'Apple TV+', status: 'Paused', priority: 'medium', rating: 0, note: 'Resume later', tags: 'spy', poster: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400&q=80', why: 'Twisty spy craft', addedAt: daysAgo(30), progress: 'S2E3' },
        { id: uid(), title: 'Dune: Part Two', type: 'movie', genre: 'Sci-Fi', year: 2024, runtime: '166m', service: 'Max', status: 'Want to Watch', priority: 'high', rating: 0, note: '', tags: 'epic', poster: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80', why: 'Visual spectacle', addedAt: daysAgo(5), progress: '' },
        { id: uid(), title: 'Chernobyl', type: 'show', genre: 'Drama', year: 2019, runtime: '5 ep', service: 'Max', status: 'Watched', priority: 'low', rating: 5, note: 'Systems failure study', tags: 'history', poster: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80', why: '', addedAt: daysAgo(90), progress: '' }
      ],
      books: [
        { id: uid(), title: 'The Psychology of Money', author: 'Morgan Housel', cover: 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=400&q=80', genre: 'Finance', pages: 256, format: 'ebook', status: 'Finished', priority: 'medium', rating: 5, notes: 'Behavior > formulas', tags: 'finance', progressPct: 100, why: 'Investing mindset', addedAt: daysAgo(100), startDate: daysAgo(80), finishDate: daysAgo(40), quotes: ['Room for error matters.'] },
        { id: uid(), title: 'Atomic Habits', author: 'James Clear', cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80', genre: 'Productivity', pages: 320, format: 'physical', status: 'Reading', priority: 'high', rating: 0, notes: 'Identity-based habits', tags: 'productivity', progressPct: 42, why: 'Habit tracker alignment', addedAt: daysAgo(25), startDate: daysAgo(20), finishDate: '', quotes: [] },
        { id: uid(), title: 'The Guns of August', author: 'Barbara Tuchman', cover: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&q=80', genre: 'History', pages: 511, format: 'physical', status: 'Want to Read', priority: 'medium', rating: 0, notes: '', tags: 'history', progressPct: 0, why: 'WWI decision cascades', addedAt: daysAgo(14), startDate: '', finishDate: '', quotes: [] },
        { id: uid(), title: 'Project Hail Mary', author: 'Andy Weir', cover: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80', genre: 'Fiction', pages: 476, format: 'audiobook', status: 'Want to Read', priority: 'high', rating: 0, notes: '', tags: 'fiction', progressPct: 0, why: 'Fun recovery read', addedAt: daysAgo(7), startDate: '', finishDate: '', quotes: [] },
        { id: uid(), title: 'Security Engineering', author: 'Ross Anderson', cover: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400&q=80', genre: 'Cybersecurity', pages: 1232, format: 'ebook', status: 'Reference', priority: 'low', rating: 5, notes: 'Keep as desk reference', tags: 'cybersecurity', progressPct: 15, why: 'Deep systems security', addedAt: daysAgo(200), startDate: daysAgo(180), finishDate: '', quotes: [] },
        { id: uid(), title: 'Deep Work', author: 'Cal Newport', cover: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80', genre: 'Productivity', pages: 296, format: 'ebook', status: 'Paused', priority: 'medium', rating: 0, notes: 'Resume after travel week', tags: 'productivity', progressPct: 55, why: 'Focus blocks', addedAt: daysAgo(50), startDate: daysAgo(45), finishDate: '', quotes: [] }
      ],
      collections: ['Soccer', 'Security', 'Finance', 'History', 'Recipes', 'Dashboard Inspiration', 'UI Ideas', 'Travel', 'Fashion', 'Interiors', 'Design', 'Memes'],
      readingGoal: { year: 2026, target: 24, completed: 1 },
      feeds: defaultFeeds(),
      // Sync delete ledger: { [id]: ISO timestamp }. Merge keeps tombstones so removals stick across devices.
      tombstones: {}
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(DATA_KEY);
      if (!raw) return defaultData();
      var parsed = JSON.parse(raw);
      var base = defaultData();
      Object.keys(parsed).forEach(function (k) { base[k] = parsed[k]; });
      if (!Array.isArray(base.feeds) || !base.feeds.length) base.feeds = defaultFeeds();
      if (!Array.isArray(base.items)) base.items = [];
      if (!base.tombstones || typeof base.tombstones !== 'object') base.tombstones = {};
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
      return base;
    } catch (e) {
      return defaultData();
    }
  }

  function save(store) {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(store));
    } catch (e) { /* ignore quota */ }
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
    idbPut: idbPut,
    idbGet: idbGet,
    detectType: detectType,
    guessMeta: guessMeta,
    enrichMeta: enrichMeta,
    fetchRss: fetchRss,
    hostnameOf: hostnameOf
  };
})(window);
