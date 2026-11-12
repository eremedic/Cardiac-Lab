// Cardiac Lab score API. Framework-free: takes a web Request, returns a web Response.
// Used by the Netlify Function (netlify/functions/api.mjs) and the local dev server.
//
//   GET    /api/config          public: is score sharing on, is a class code required
//   GET    /api/health          public: can the server reach the database
//   PUT    /api/scores/:id      student: save this browser's results (id is a random UUID)
//   GET    /api/scores          instructor: every student's results (Authorization: Bearer <INSTRUCTOR_PASSWORD>)
//   DELETE /api/scores/:id      instructor: remove one student's results
import { createHash, timingSafeEqual } from 'node:crypto';
import { SCHEMA_SQL } from './schema.mjs';
import { describeDatabaseUrl, explainDatabaseError, scrub } from './diagnose.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY = 64 * 1024;

// Netlify can hand the function either the public address (/api/health) or its
// internal one (/.netlify/functions/api/health); both map to /api/health.
export function apiPath(pathname) {
  let p = decodeURIComponent(pathname || '/').replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  p = p.replace(/^\/\.netlify\/functions\/api(?=\/|$)/i, '/api');
  if (!/^\/api(\/|$)/i.test(p)) {
    const i = p.toLowerCase().lastIndexOf('/api/');
    if (i >= 0) p = p.slice(i); else if (/\/api$/i.test(p)) p = '/api';
  }
  return p.replace(/^\/api/i, '/api');
}

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

// Plain text only: no control characters, collapsed whitespace, length-capped.
function cleanText(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);

// Accepts only the shape the page sends; anything else is a 400.
export function validateDoc(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
  const part = (x) => {
    if (!x || typeof x !== 'object') return null;
    const n = int(x.n, 0, 1000), a = int(x.a, 0, 1000), c = int(x.c, 0, 1000);
    if (n === null || a === null || c === null || c > a || a > n) return null;
    return { c, a, n };
  };
  const strips = part(doc.strips), mega = part(doc.mega);
  if (!strips || !mega) return null;
  const overall = int(doc.overall, 0, 100);
  if (overall === null) return null;

  const triple = (t) => Array.isArray(t) && t.length === 3 && t.every((x) => int(x, 0, 1000) !== null) ? t : null;
  const groups = {};
  if (doc.groups && typeof doc.groups === 'object') {
    for (const [k, v] of Object.entries(doc.groups).slice(0, 12)) {
      if (/^[a-z]{2,20}$/.test(k) && triple(v)) groups[k] = v;
    }
  }
  const cases = Array.isArray(doc.cases) ? doc.cases.slice(0, 50).map((t) => triple(t) || [0, 0, 0]) : [];
  const p = {};
  if (doc.p && typeof doc.p === 'object') {
    for (const [k, v] of Object.entries(doc.p).slice(0, 400)) {
      if (/^\d{1,4}$/.test(k) && typeof v === 'string') p[k] = cleanText(v, 80);
    }
  }
  const m = {};
  if (doc.m && typeof doc.m === 'object') {
    for (const [k, v] of Object.entries(doc.m).slice(0, 400)) {
      if (/^\d{1,3}-\d{1,3}$/.test(k) && int(v, 0, 20) !== null) m[k] = v;
    }
  }
  return { strips, mega, overall, groups, cases, p, m };
}

function sameSecret(given, expected) {
  const a = createHash('sha256').update(String(given)).digest();
  const b = createHash('sha256').update(String(expected)).digest();
  return timingSafeEqual(a, b);
}

function bearer(req) {
  const h = req.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

const rowOut = (r) => ({
  id: r.id, name: r.name, cohort: r.cohort,
  strips: { c: r.strips_correct, a: r.strips_answered, n: r.strips_total },
  mega: { c: r.mega_correct, a: r.mega_answered, n: r.mega_total },
  overall: r.overall,
  ...(typeof r.details === 'string' ? JSON.parse(r.details) : r.details || {}),
  createdAt: new Date(r.created_at).getTime(),
  updatedAt: new Date(r.updated_at).getTime(),
});

/**
 * @param {{ getDb: () => Promise<{query: (sql: string, params?: any[]) => Promise<any[]>, exec: (sql: string) => Promise<void>}>, env?: Record<string,string|undefined>, failDelayMs?: number }} opts
 */
export function createApi({ getDb, env = process.env, failDelayMs = 600 }) {
  let schemaReady = null;
  const db = async () => {
    const conn = await getDb();
    if (!schemaReady) schemaReady = conn.exec(SCHEMA_SQL).catch((e) => { schemaReady = null; throw e; });
    await schemaReady;
    return conn;
  };
  const instructorOk = async (req) => {
    if (!env.INSTRUCTOR_PASSWORD) return 'not_configured';
    if (bearer(req) && sameSecret(bearer(req), env.INSTRUCTOR_PASSWORD)) return 'ok';
    await new Promise((r) => setTimeout(r, failDelayMs)); // slow down password guessing
    return 'denied';
  };

  return async function handle(req) {
    const url = new URL(req.url);
    const path = apiPath(url.pathname);
    const method = req.method.toUpperCase();
    try {
      if (path === '/api/config' && method === 'GET') {
        return json(200, { scoring: Boolean(env.DATABASE_URL || env.ECG_LOCAL_DB), requireCode: Boolean(env.CLASS_CODE), instructor: Boolean(env.INSTRUCTOR_PASSWORD) });
      }
      if (path === '/api/health' && method === 'GET') {
        const settings = { instructorPassword: Boolean(env.INSTRUCTOR_PASSWORD), classCode: Boolean(env.CLASS_CODE) };
        if (!env.ECG_LOCAL_DB) {
          const urlCheck = describeDatabaseUrl(env.DATABASE_URL);
          if (!urlCheck.ok) return json(503, { ok: false, step: 'DATABASE_URL', detail: urlCheck.detail, ...settings });
        }
        try {
          const conn = await db();
          const [{ n }] = await conn.query('select count(*)::int as n from ecglab.scores');
          const target = env.ECG_LOCAL_DB ? 'in-memory test database' : describeDatabaseUrl(env.DATABASE_URL).target;
          return json(200, { ok: true, students: n, connectedTo: target, ...settings, ...(settings.instructorPassword ? {} : { warning: 'INSTRUCTOR_PASSWORD is not set, so nobody can open the scoreboard. Add it in Netlify and redeploy.' }) });
        } catch (err) {
          console.error('[Cardiac Lab] health check failed:', scrub(err?.message, env.DATABASE_URL));
          return json(503, { ok: false, step: 'database connection', connectingTo: describeDatabaseUrl(env.DATABASE_URL).target, detail: explainDatabaseError(err, env.DATABASE_URL), error: scrub(err?.message, env.DATABASE_URL), ...settings });
        }
      }

      if (path === '/api' && method === 'GET') {
        return json(200, { ok: true, service: 'Cardiac Lab score API', endpoints: ['/api/health', '/api/config', '/api/scores'] });
      }
      const m = path.match(/^\/api\/scores(?:\/([^/]+))?$/);
      if (!m) return json(404, { error: 'not_found', path: url.pathname, hint: 'Try /api/health on this site.' });
      const id = m[1];
      if (!env.DATABASE_URL && !env.ECG_LOCAL_DB) return json(503, { error: 'scoring_not_configured', detail: 'DATABASE_URL is not set in Netlify, so scores can\'t be saved. Add it and redeploy.' });
      if (!env.ECG_LOCAL_DB) {
        const urlCheck = describeDatabaseUrl(env.DATABASE_URL);
        if (!urlCheck.ok) return json(503, { error: 'database_url', detail: urlCheck.detail });
      }

      if (method === 'PUT' && id) {
        if (!UUID.test(id)) return json(400, { error: 'bad_id' });
        const len = Number(req.headers.get('content-length') || 0);
        if (len > MAX_BODY) return json(413, { error: 'too_large' });
        const raw = await req.text();
        if (raw.length > MAX_BODY) return json(413, { error: 'too_large' });
        let body; try { body = JSON.parse(raw); } catch { return json(400, { error: 'bad_json' }); }
        if (env.CLASS_CODE && !sameSecret(cleanText(body.code, 60).toLowerCase(), env.CLASS_CODE.trim().toLowerCase())) {
          return json(403, { error: 'class_code' });
        }
        const name = cleanText(body.name, 60);
        if (!name) return json(400, { error: 'name_required' });
        const cohort = cleanText(body.cohort, 40);
        const doc = validateDoc(body.doc);
        if (!doc) return json(400, { error: 'bad_doc' });
        const { strips, mega, overall, ...details } = doc;
        const conn = await db();
        await conn.query(
          `insert into ecglab.scores (id, name, cohort, strips_correct, strips_answered, strips_total, mega_correct, mega_answered, mega_total, overall, details, updated_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb, now())
           on conflict (id) do update set name=excluded.name, cohort=excluded.cohort,
             strips_correct=excluded.strips_correct, strips_answered=excluded.strips_answered, strips_total=excluded.strips_total,
             mega_correct=excluded.mega_correct, mega_answered=excluded.mega_answered, mega_total=excluded.mega_total,
             overall=excluded.overall, details=excluded.details, updated_at=now()`,
          [id.toLowerCase(), name, cohort, strips.c, strips.a, strips.n, mega.c, mega.a, mega.n, overall, JSON.stringify(details)],
        );
        return json(200, { ok: true });
      }

      if ((method === 'GET' && !id) || (method === 'DELETE' && id)) {
        const auth = await instructorOk(req);
        if (auth === 'not_configured') return json(503, { error: 'instructor_not_configured', detail: 'INSTRUCTOR_PASSWORD is not set in Netlify. Add it and redeploy.' });
        if (auth !== 'ok') return json(401, { error: 'unauthorized' });
        const conn = await db();
        if (method === 'DELETE') {
          if (!UUID.test(id)) return json(400, { error: 'bad_id' });
          await conn.query('delete from ecglab.scores where id = $1', [id.toLowerCase()]);
          return json(200, { ok: true });
        }
        const rows = await conn.query('select * from ecglab.scores order by updated_at desc limit 2000');
        return json(200, { rows: rows.map(rowOut) });
      }
      return json(405, { error: 'method_not_allowed' });
    } catch (err) {
      console.error('[Cardiac Lab] API error:', scrub(err?.message || String(err), env.DATABASE_URL));
      return json(500, { error: 'database', detail: explainDatabaseError(err, env.DATABASE_URL) + (env.DATABASE_URL ? ` (Connecting to ${describeDatabaseUrl(env.DATABASE_URL).target || 'an invalid address'}.)` : '') });
    }
  };
}
