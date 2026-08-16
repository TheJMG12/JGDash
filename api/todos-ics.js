/**
 * Public Apple Calendar / ICS subscription for JGDash To Dos.
 * GET|HEAD /api/todos-ics?token=...
 *
 * Vercel env (required):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Token is stored in user_kv key jg_calendar_feed_v1 → { token }.
 * Apple Calendar probes with HEAD and requires a valid text/calendar body on GET.
 * Prefer sharing the https:// URL (not http:// / bare webcal over http).
 */
function icsEscape(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function foldLine(line) {
  var s = String(line);
  if (s.length <= 75) return s;
  var out = '';
  while (s.length > 75) {
    out += s.slice(0, 75) + '\r\n ';
    s = s.slice(75);
  }
  return out + s;
}

function ymdCompact(ymd) {
  return String(ymd || '').replace(/-/g, '');
}

function stampUtc(d) {
  d = d || new Date();
  function p(n) { return n < 10 ? '0' + n : '' + n; }
  return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) +
    'T' + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + 'Z';
}

function normalizeTime(raw) {
  if (!raw) return '';
  var m = String(raw).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '';
  var h = parseInt(m[1], 10);
  var min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return '';
  return (h < 10 ? '0' : '') + h + ':' + (min < 10 ? '0' : '') + min;
}

function addMinutes(hhmm, mins) {
  var parts = hhmm.split(':').map(Number);
  var total = parts[0] * 60 + parts[1] + mins;
  total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
  var h = Math.floor(total / 60);
  var m = total % 60;
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}

function buildIcs(events) {
  var lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//JGDash//To Dos//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:JGDash To Dos',
    'X-WR-CALDESC:Open tasks from JGDash (subscribed feed)'
  ];
  var now = stampUtc();
  events.forEach(function (ev) {
    lines.push('BEGIN:VEVENT');
    lines.push('UID:' + ev.uid);
    lines.push('DTSTAMP:' + now);
    if (ev.allDay) {
      lines.push('DTSTART;VALUE=DATE:' + ev.start);
      lines.push('DTEND;VALUE=DATE:' + ev.end);
    } else {
      // Explicit UTC so Apple Calendar validation accepts the stamps.
      lines.push('DTSTART:' + ev.start + 'Z');
      lines.push('DTEND:' + ev.end + 'Z');
    }
    lines.push(foldLine('SUMMARY:' + icsEscape(ev.summary)));
    if (ev.description) lines.push(foldLine('DESCRIPTION:' + icsEscape(ev.description)));
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:OPAQUE');
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

function nextDayYmd(ymd) {
  var p = String(ymd).split('-').map(Number);
  var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  d.setUTCDate(d.getUTCDate() + 1);
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}

function readQueryToken(req) {
  if (req.query && req.query.token != null) return String(req.query.token).trim();
  try {
    var host = req.headers && (req.headers['x-forwarded-host'] || req.headers.host) || 'localhost';
    var proto = (req.headers && req.headers['x-forwarded-proto']) || 'https';
    var url = new URL(req.url || '/', proto + '://' + host);
    return String(url.searchParams.get('token') || '').trim();
  } catch (e) {
    return '';
  }
}

async function supabaseRest(path, serviceKey, urlBase) {
  const r = await fetch(urlBase.replace(/\/$/, '') + '/rest/v1/' + path, {
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
      Accept: 'application/json'
    }
  });
  const text = await r.text();
  if (!r.ok) throw new Error('supabase ' + r.status + ': ' + text.slice(0, 200));
  try { return JSON.parse(text); } catch { return []; }
}

function sendIcs(res, body, method) {
  const len = Buffer.byteLength(body, 'utf8');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="jgdash-todos.ics"');
  res.setHeader('Cache-Control', 'no-cache, max-age=60');
  res.setHeader('Content-Length', String(len));
  // Apple / some clients probe with HEAD before GET.
  if (method === 'HEAD') return res.end();
  return res.end(body);
}

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(obj));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { error: 'method not allowed' });
  }

  const token = readQueryToken(req);
  if (!token || token.length < 16) {
    return sendJson(res, 401, { error: 'token required' });
  }

  const urlBase = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!urlBase || !serviceKey) {
    return sendJson(res, 500, {
      error: 'server not configured',
      hint: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel → Settings → Environment Variables, then Redeploy.'
    });
  }

  try {
    const feeds = await supabaseRest(
      'user_kv?key=eq.jg_calendar_feed_v1&select=user_id,value',
      serviceKey,
      urlBase
    );
    let userId = null;
    (feeds || []).forEach(function (row) {
      var val = row && row.value;
      if (!val) return;
      if (typeof val === 'string') {
        try { val = JSON.parse(val); } catch { return; }
      }
      if (val && String(val.token) === token) userId = row.user_id;
    });
    if (!userId) {
      return sendJson(res, 404, {
        error: 'unknown feed token',
        hint: 'Open To Do List while signed in, tap Copy subscription link (that syncs the token), then try again.'
      });
    }

    const rows = await supabaseRest(
      'user_kv?user_id=eq.' + encodeURIComponent(userId) +
        '&key=like.goals:*&select=key,value',
      serviceKey,
      urlBase
    );

    const events = [];
    (rows || []).forEach(function (row) {
      const key = row && row.key;
      if (!key || key.indexOf('goals:') !== 0) return;
      const ymd = key.slice(6);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return;
      let val = row.value;
      if (typeof val === 'string') {
        try { val = JSON.parse(val); } catch { return; }
      }
      const items = Array.isArray(val) ? val : (val && Array.isArray(val.items) ? val.items : []);
      const tombs = (val && val.tombstones && typeof val.tombstones === 'object') ? val.tombstones : {};
      items.forEach(function (g) {
        if (!g || typeof g !== 'object') return;
        if (g.id != null && tombs[String(g.id)]) return;
        if (g.done) return;
        if (g.cal === false) return;
        const text = String(g.text || '').trim();
        if (!text) return;
        const uid = String(g.id || (text + '@' + ymd)).replace(/[^A-Za-z0-9_.@-]/g, '_') + '@jgdash.todos';
        const time = normalizeTime(g.time);
        if (time) {
          const end = addMinutes(time, 30);
          // Treat wall-clock times as UTC for a stable ICS stamp (personal feed).
          const startStamp = ymdCompact(ymd) + 'T' + time.replace(':', '') + '00';
          const endStamp = ymdCompact(ymd) + 'T' + end.replace(':', '') + '00';
          events.push({
            uid: uid,
            allDay: false,
            start: startStamp,
            end: endStamp,
            summary: text,
            description: 'JGDash To Do · ' + ymd
          });
        } else {
          events.push({
            uid: uid,
            allDay: true,
            start: ymdCompact(ymd),
            end: ymdCompact(nextDayYmd(ymd)),
            summary: text,
            description: 'JGDash To Do · ' + ymd
          });
        }
      });
    });

    events.sort(function (a, b) {
      return String(a.start).localeCompare(String(b.start)) || String(a.summary).localeCompare(String(b.summary));
    });

    return sendIcs(res, buildIcs(events), req.method);
  } catch (e) {
    return sendJson(res, 500, { error: 'feed failed: ' + (e.message || String(e)) });
  }
}
