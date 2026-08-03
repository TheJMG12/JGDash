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

  function defaultData() {
    return {
      items: [
        {
          id: uid(), title: 'How elite midfielders scan before receiving', type: 'article',
          source: 'The Athletic', url: 'https://example.com/soccer-scan', status: 'inbox', priority: 'high',
          tags: 'soccer, analysis', collection: 'Soccer', estimatedMinutes: 12, savedAt: daysAgo(1),
          author: 'Tactical Desk', notes: [{ id: uid(), kind: 'why', text: 'Apply to half-space receives', pinned: true }],
          inQueue: false, archived: false, completed: false
        },
        {
          id: uid(), title: 'Zero Trust architecture explained', type: 'article',
          source: 'Cloudflare Blog', url: 'https://example.com/zero-trust', status: 'queue', priority: 'medium',
          tags: 'cybersecurity', collection: 'Security', estimatedMinutes: 18, savedAt: daysAgo(3),
          author: 'Security Team', notes: [{ id: uid(), kind: 'takeaway', text: 'Identity is the perimeter', pinned: false }],
          inQueue: true, queueOrder: 1, archived: false, completed: false
        },
        {
          id: uid(), title: 'Index funds vs stock picking (long form)', type: 'video',
          source: 'YouTube', url: 'https://youtube.com/watch?v=demo1', status: 'queue', priority: 'medium',
          tags: 'finance, investing', collection: 'Finance', estimatedMinutes: 24, savedAt: daysAgo(2),
          author: 'Investing Channel', notes: [], inQueue: true, queueOrder: 2, archived: false, completed: false
        },
        {
          id: uid(), title: 'r/netsec — interesting CVE write-up thread', type: 'reddit',
          source: 'Reddit', url: 'https://reddit.com/r/netsec/demo', status: 'inbox', priority: 'low',
          tags: 'cybersecurity, CVE', collection: 'Security', estimatedMinutes: 8, savedAt: daysAgo(0),
          author: 'u/researcher', notes: [{ id: uid(), kind: 'follow-up', text: 'Check if stack matches home lab', pinned: false }],
          inQueue: false, archived: false, completed: false
        },
        {
          id: uid(), title: 'The Ottoman siege logistics essay', type: 'article',
          source: 'History Today', url: 'https://example.com/ottoman-siege', status: 'library', priority: 'low',
          tags: 'history', collection: 'History', estimatedMinutes: 22, savedAt: daysAgo(20),
          author: 'H. Reed', notes: [], inQueue: false, archived: false, completed: false
        },
        {
          id: uid(), title: 'Dashboard density patterns — reference', type: 'link',
          source: 'Personal site', url: 'https://example.com/dashboard-density', status: 'library', priority: 'high',
          tags: 'design, dashboard', collection: 'Dashboard Inspiration', estimatedMinutes: 6, savedAt: daysAgo(5),
          author: '', notes: [{ id: uid(), kind: 'why', text: 'Reference for JGDash cards', pinned: true }],
          inQueue: false, archived: false, completed: false
        },
        {
          id: uid(), title: 'High-protein meal prep basics', type: 'video',
          source: 'YouTube', url: 'https://youtube.com/watch?v=demo2', status: 'completed', priority: 'low',
          tags: 'recipes', collection: 'Recipes', estimatedMinutes: 15, savedAt: daysAgo(12),
          author: 'Kitchen Lab', notes: [{ id: uid(), kind: 'takeaway', text: 'Batch chicken + oats Sunday', pinned: false }],
          inQueue: false, archived: false, completed: true
        },
        {
          id: uid(), title: 'Stale bookmark — unread crypto thread', type: 'reddit',
          source: 'Reddit', url: 'https://reddit.com/r/investing/old', status: 'inbox', priority: 'low',
          tags: 'finance', collection: 'Finance', estimatedMinutes: 10, savedAt: daysAgo(45),
          author: 'u/markets', notes: [], inQueue: false, archived: false, completed: false
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
      readingGoal: { year: 2026, target: 24, completed: 1 }
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(DATA_KEY);
      if (!raw) return defaultData();
      var parsed = JSON.parse(raw);
      var base = defaultData();
      Object.keys(parsed).forEach(function (k) { base[k] = parsed[k]; });
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

  global.JGMedia = {
    DATA_KEY: DATA_KEY,
    uid: uid,
    today: today,
    daysAgo: daysAgo,
    defaultData: defaultData,
    load: load,
    save: save,
    idbPut: idbPut,
    idbGet: idbGet
  };
})(window);
