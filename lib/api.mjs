// Cardiac Lab score API. Framework-free: takes a web Request, returns a web Response.
// Used by the Netlify Function (netlify/functions/api.mjs) and the local dev server.
//
//   GET    /api/config          public: is score sharing on, is a class code required
//   GET    /api/health          public: can the server reach the database
//   PUT    /api/scores/:id      student: save this browser's results (id is a random UUID)
//   GET    /api/scores          instructor: every student's results (Authorization: Bearer <INSTRUCTOR_PASSWORD>)
//   DELETE /api/scores/:id      instructor: remove one student's results
//   GET    /api/survey          public: the end-of-course survey questions (lib/survey.mjs)
//   PUT    /api/scores/:id/survey  student: submit the survey (once 10% of strips + megacode is answered)
//   GET    /api/settings        instructor: feature switches, e.g. { twelveLead: false }
//   PUT    /api/settings        instructor: change a switch, e.g. { twelveLead: true } or { defibLab: true }
//   GET    /api/areas/twelve    the 12-lead practice area (only when open, or for the instructor)
//   GET    /api/areas/field     the field strips (real-world artifact) practice area, same rule
//   PUT    /api/class-code      owner: { code } sets the class code from the scoreboard ("" = no code)
//   PUT    /api/cohorts         owner: { add } or { remove } a saved cohort name (offered to students and in dropdowns)
//   GET    /api/me              any instructor: who am I (owner or instructor), my cohorts and permissions
//   GET    /api/instructors     owner: instructor accounts;  POST to add one (returns its generated password once)
//   PUT    /api/instructors/:id owner: change name, cohorts, permissions, or { resetPassword: true }
//   DELETE /api/instructors/:id owner: remove an instructor
// Feature switches can also be set per cohort ({ cohort, twelveLead: true }); students send their cohort to
// /api/config?cohort= and /api/areas/<key>?cohort= and get that cohort's switches.
import { createHash, timingSafeEqual, randomBytes, randomUUID } from 'node:crypto';
import { SCHEMA_SQL } from './schema.mjs';
import { describeDatabaseUrl, explainDatabaseError, scrub } from './diagnose.mjs';
import { SURVEY, SURVEY_VERSION, LIKERT, CONFIDENCE, validateSurvey } from './survey.mjs';
import TWELVE from './twelve-data.mjs';
import FIELD from './field-data.mjs';

// Instructor switches and their defaults. New areas start closed.
const SETTINGS = { twelveLead: false, defibLab: false, fieldStrips: false, codeLab: false };

// What the owner can let an instructor do. The three feature keys match SETTINGS (per cohort, for their cohorts).
export const PERMS = { twelveLead: '12-lead area', fieldStrips: 'Field strips', defibLab: 'Defib lab', codeLab: 'Code lab', print: 'Print reports', csv: 'Download CSV', survey: 'See survey results', delete: 'Remove students' };
const norm = (c) => String(c || '').trim().toLowerCase();
const sha = (s) => createHash('sha256').update(String(s)).digest('hex');
function newPassword() {
  const abc = '23456789abcdefghjkmnpqrstuvwxyz';
  const b = randomBytes(15);
  let out = '';
  for (let i = 0; i < 15; i++) out += abc[b[i] % abc.length] + (i % 5 === 4 && i < 14 ? '-' : '');
  return out;
}
function cleanInstructor(body, partial) {
  const out = {};
  if (!partial || body.name !== undefined) { out.name = cleanText(body.name, 60); if (!out.name) return { error: 'name_required' }; }
  if (!partial || body.cohorts !== undefined) {
    if (!Array.isArray(body.cohorts)) return { error: 'cohorts_required' };
    const seen = new Set(); out.cohorts = [];
    for (const c of body.cohorts.slice(0, 30)) { const t = cleanText(c, 40); if (t && !seen.has(norm(t))) { seen.add(norm(t)); out.cohorts.push(t); } }
    if (!out.cohorts.length) return { error: 'cohorts_required' };
  }
  if (!partial || body.perms !== undefined) {
    out.perms = {};
    for (const k of Object.keys(PERMS)) if (body.perms && body.perms[k] === true) out.perms[k] = true;
  }
  return out;
}
const instOut = (r) => ({ id: r.id, name: r.name, cohorts: typeof r.cohorts === 'string' ? JSON.parse(r.cohorts) : r.cohorts, perms: typeof r.perms === 'string' ? JSON.parse(r.perms) : r.perms,
  createdAt: new Date(r.created_at).getTime(), lastSeen: r.last_seen ? new Date(r.last_seen).getTime() : null });

// Practice areas held back until the instructor opens them: url key -> [setting, data, name]
const GATED = { twelve: ['twelveLead', TWELVE, '12-lead practice area'], field: ['fieldStrips', FIELD, 'field strips practice area'] };

// The course survey unlocks once this share of the strips + megacode decisions is answered.
export const SURVEY_UNLOCK_PCT = 10;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY = 64 * 1024;

// Netlify can hand the function either the public address (/api/health) or its
// internal one (/.netlify/functions/api/health); both map to /api/health.
export function apiPath(pathname) {
  // Also drops punctuation pasted along with a link copied from a sentence, e.g. "/api/health."
  let p = decodeURIComponent(pathname || '/').replace(/\/{2,}/g, '/').replace(/[\s.,;:!?)\]'"`>]+$/, '').replace(/\/+$/, '');
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
  const areas = {};
  if (doc.areas && typeof doc.areas === 'object') {
    for (const [k, v] of Object.entries(doc.areas).slice(0, 12)) {
      if (/^[a-z]{2,20}$/.test(k) && triple(v) && v[0] <= v[1] && v[1] <= v[2]) areas[k] = v;
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
  // Defib lab: scenario id -> [steps correct, steps total, passed 0/1]
  const defib = {};
  if (doc.defib && typeof doc.defib === 'object' && !Array.isArray(doc.defib)) {
    for (const [k, v] of Object.entries(doc.defib).slice(0, 30)) {
      if (/^[a-z]{2,12}$/.test(k) && Array.isArray(v) && v.length === 3 && int(v[0], 0, 30) !== null && int(v[1], 1, 30) !== null && v[0] <= v[1] && (v[2] === 0 || v[2] === 1)) defib[k] = v;
    }
  }
  // Code lab: case id -> [points x2, max points x2, passed 0/1]
  const code = {};
  if (doc.code && typeof doc.code === 'object' && !Array.isArray(doc.code)) {
    for (const [k, v] of Object.entries(doc.code).slice(0, 40)) {
      if (/^[a-z0-9]{2,16}$/.test(k) && Array.isArray(v) && v.length === 3 && int(v[0], 0, 200) !== null && int(v[1], 1, 200) !== null && v[0] <= v[1] && (v[2] === 0 || v[2] === 1)) code[k] = v;
    }
  }
  return { strips, mega, overall, groups, areas, cases, p, m, defib, code };
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
  survey: r.survey ? (typeof r.survey === 'string' ? JSON.parse(r.survey) : r.survey) : null,
  surveyAt: r.survey_at ? new Date(r.survey_at).getTime() : null,
  surveyAnonymous: Boolean(r.survey_anonymous),
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
  const hasDb = () => Boolean(env.DATABASE_URL || env.ECG_LOCAL_DB);
  const readSettings = async () => {
    const out = { ...SETTINGS };
    if (!hasDb()) return out;
    const conn = await db();
    for (const row of await conn.query('select key, value from ecglab.settings')) {
      if (row.key in SETTINGS) out[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    }
    return out;
  };
  // Per-cohort switches are stored as settings rows keyed "cohort:<lower-case cohort>".
  const readCohort = async (c) => {
    if (!hasDb() || !norm(c)) return {};
    const conn = await db();
    const rows = await conn.query('select value from ecglab.settings where key = $1', ['cohort:' + norm(c)]);
    const v = rows[0] ? (typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value) : {};
    const out = {}; for (const k of Object.keys(SETTINGS)) if (typeof v[k] === 'boolean') out[k] = v[k];
    return out;
  };
  // The class code and the saved cohort list are settings rows too. A saved class code ("" = none) overrides CLASS_CODE.
  const readExtra = async () => {
    const out = { classCode: env.CLASS_CODE ? env.CLASS_CODE.trim() : '', codeSource: env.CLASS_CODE ? 'netlify' : 'none', cohortList: [] };
    if (!hasDb()) return out;
    const conn = await db();
    for (const r of await conn.query("select key, value from ecglab.settings where key in ('classCode','cohortList')")) {
      let v = r.value;
      if (typeof v === 'string') { try { v = JSON.parse(v); } catch { /* already a plain string */ } }
      if (r.key === 'classCode' && typeof v === 'string') { out.classCode = v; out.codeSource = v ? 'scoreboard' : 'none'; }
      if (r.key === 'cohortList' && Array.isArray(v)) out.cohortList = v.filter((x) => typeof x === 'string');
    }
    return out;
  };
  const codeOk = async (given) => { const { classCode } = await readExtra(); return !classCode || sameSecret(cleanText(given, 60).toLowerCase(), classCode.toLowerCase()); };
  const saveSetting = async (conn, key, value) => conn.query(`insert into ecglab.settings (key, value, updated_at) values ($1, $2::jsonb, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`, [key, JSON.stringify(value)]);
  const effective = async (c) => ({ ...(await readSettings()), ...(await readCohort(c)) });
  // Who is signing in: the owner (INSTRUCTOR_PASSWORD), an instructor account, or nobody.
  const who = async (req) => {
    if (!env.INSTRUCTOR_PASSWORD) return { role: 'not_configured' };
    const tok = bearer(req);
    if (tok && sameSecret(tok, env.INSTRUCTOR_PASSWORD)) return { role: 'owner', name: 'Owner', cohorts: null, perms: Object.fromEntries(Object.keys(PERMS).map((k) => [k, true])) };
    if (tok && hasDb()) {
      const conn = await db();
      const rows = await conn.query('select * from ecglab.instructors where pw_hash = $1', [sha(tok.trim().toLowerCase())]);
      if (rows[0]) {
        conn.query('update ecglab.instructors set last_seen = now() where id = $1', [rows[0].id]).catch(() => {});
        return { role: 'instructor', ...instOut(rows[0]) };
      }
    }
    await new Promise((r) => setTimeout(r, failDelayMs)); // slow down password guessing
    return { role: 'denied' };
  };
  const instructorOk = async (req) => { const w = await who(req); return w.role === 'owner' ? 'ok' : (w.role === 'not_configured' ? 'not_configured' : 'denied'); };
  const authFail = (w) => w.role === 'not_configured'
    ? json(503, { error: 'instructor_not_configured', detail: 'INSTRUCTOR_PASSWORD is not set in Netlify. Add it and redeploy.' })
    : json(401, { error: 'unauthorized' });
  const inScope = (w, cohort) => w.role === 'owner' || (w.cohorts || []).some((c) => norm(c) === norm(cohort));
  const meOut = (w) => ({ role: w.role, name: w.name, cohorts: w.cohorts, perms: w.perms });

  return async function handle(req) {
    const url = new URL(req.url);
    const path = apiPath(url.pathname);
    const method = req.method.toUpperCase();
    try {
      if (path === '/api/config' && method === 'GET') {
        let features = { ...SETTINGS };
        try { features = await effective(url.searchParams.get('cohort')); } catch (err) { console.error('[Cardiac Lab] settings unavailable:', scrub(err?.message, env.DATABASE_URL)); }
        let extra = { classCode: env.CLASS_CODE || '', cohortList: [] };
        try { extra = await readExtra(); } catch { /* settings unavailable: fall back to Netlify */ }
        return json(200, { scoring: hasDb(), requireCode: Boolean(extra.classCode), instructor: Boolean(env.INSTRUCTOR_PASSWORD), features, cohorts: extra.cohortList });
      }
      if (path === '/api/me' && method === 'GET') {
        const w = await who(req);
        if (w.role !== 'owner' && w.role !== 'instructor') return authFail(w);
        return json(200, { me: meOut(w) });
      }
      if (path === '/api/settings' && (method === 'GET' || method === 'PUT')) {
        const w = await who(req);
        if (w.role !== 'owner' && w.role !== 'instructor') return authFail(w);
        if (!hasDb()) return json(503, { error: 'scoring_not_configured', detail: 'DATABASE_URL is not set in Netlify, so settings can\'t be saved.' });
        const conn = await db();
        let body = null;
        if (method === 'PUT') {
          const raw = await req.text();
          if (raw.length > MAX_BODY) return json(413, { error: 'too_large' });
          try { body = JSON.parse(raw); } catch { return json(400, { error: 'bad_json' }); }
          if (!body || typeof body !== 'object') return json(400, { error: 'bad_json' });
          const cohort = body.cohort !== undefined ? cleanText(body.cohort, 40) : null;
          if (w.role === 'instructor' && (!cohort || !inScope(w, cohort))) return json(403, { error: 'forbidden', detail: 'You can only change switches for your own cohorts.' });
          const entries = Object.entries(body).filter(([k]) => k !== 'cohort');
          if (!entries.length) return json(400, { error: 'no_settings' });
          for (const [k, v] of entries) {
            if (!(k in SETTINGS) || typeof v !== typeof SETTINGS[k]) return json(400, { error: 'bad_setting', setting: k });
            if (w.role === 'instructor' && !w.perms[k]) return json(403, { error: 'forbidden', detail: 'You don\'t have access to that switch.' });
          }
          if (cohort) {
            const cur = await readCohort(cohort);
            for (const [k, v] of entries) cur[k] = v;
            await conn.query(`insert into ecglab.settings (key, value, updated_at) values ($1, $2::jsonb, now())
               on conflict (key) do update set value = excluded.value, updated_at = now()`, ['cohort:' + norm(cohort), JSON.stringify(cur)]);
          } else {
            for (const [k, v] of entries) {
              await conn.query(`insert into ecglab.settings (key, value, updated_at) values ($1, $2::jsonb, now())
                 on conflict (key) do update set value = excluded.value, updated_at = now()`, [k, JSON.stringify(v)]);
            }
          }
        }
        const out = { settings: await readSettings(), me: meOut(w) };
        const ex = await readExtra(); out.cohortList = ex.cohortList;
        if (w.role === 'owner') { out.classCode = ex.classCode; out.codeSource = ex.codeSource; }
        if (w.role === 'instructor') { out.cohorts = {}; for (const c of w.cohorts) out.cohorts[c] = await effective(c); }
        else if (url.searchParams.get('cohorts') === '1' || (body && body.cohort)) {
          out.cohorts = {};
          for (const r of await conn.query("select key, value from ecglab.settings where key like 'cohort:%'")) out.cohorts[r.key.slice(7)] = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
        }
        return json(200, out);
      }
      if ((path === '/api/class-code' || path === '/api/cohorts') && method === 'PUT') {
        const w = await who(req);
        if (w.role !== 'owner') return w.role === 'instructor' ? json(403, { error: 'forbidden' }) : authFail(w);
        if (!hasDb()) return json(503, { error: 'scoring_not_configured', detail: 'DATABASE_URL is not set in Netlify.' });
        const raw = await req.text(); let body; try { body = JSON.parse(raw); } catch { return json(400, { error: 'bad_json' }); }
        const conn = await db();
        if (path === '/api/class-code') {
          if (typeof body.code !== 'string') return json(400, { error: 'bad_code' });
          await saveSetting(conn, 'classCode', cleanText(body.code, 60));
        } else {
          const cur = (await readExtra()).cohortList;
          const add = cleanText(body.add, 40), rem = cleanText(body.remove, 40);
          let next = cur.filter((c) => !rem || norm(c) !== norm(rem));
          if (add && !next.some((c) => norm(c) === norm(add))) next.push(add);
          next = next.slice(0, 200).sort((a, b) => a.localeCompare(b));
          await saveSetting(conn, 'cohortList', next);
        }
        const x = await readExtra();
        return json(200, { classCode: x.classCode, codeSource: x.codeSource, cohortList: x.cohortList });
      }
      if (path.startsWith('/api/instructors')) {
        const w = await who(req);
        if (w.role !== 'owner') return w.role === 'instructor' ? json(403, { error: 'forbidden' }) : authFail(w);
        if (!hasDb()) return json(503, { error: 'scoring_not_configured', detail: 'DATABASE_URL is not set in Netlify.' });
        const conn = await db();
        const iid = (path.match(/^\/api\/instructors\/([^/]+)$/) || [])[1];
        const readBody = async () => { const raw = await req.text(); if (raw.length > MAX_BODY) return null; try { return JSON.parse(raw); } catch { return null; } };
        if (path === '/api/instructors' && method === 'GET') {
          return json(200, { instructors: (await conn.query('select * from ecglab.instructors order by name')).map(instOut), perms: PERMS });
        }
        if (path === '/api/instructors' && method === 'POST') {
          const body = await readBody(); if (!body) return json(400, { error: 'bad_json' });
          const v = cleanInstructor(body, false); if (v.error) return json(400, v);
          const id = randomUUID(), pw = newPassword();
          await conn.query('insert into ecglab.instructors (id, name, pw_hash, cohorts, perms) values ($1,$2,$3,$4::jsonb,$5::jsonb)', [id, v.name, sha(pw), JSON.stringify(v.cohorts), JSON.stringify(v.perms)]);
          return json(200, { instructor: instOut((await conn.query('select * from ecglab.instructors where id = $1', [id]))[0]), password: pw });
        }
        if (iid && UUID.test(iid) && method === 'PUT') {
          const body = await readBody(); if (!body) return json(400, { error: 'bad_json' });
          const v = cleanInstructor(body, true); if (v.error) return json(400, v);
          const cur = (await conn.query('select * from ecglab.instructors where id = $1', [iid]))[0];
          if (!cur) return json(404, { error: 'not_found' });
          const o = instOut(cur), pw = body.resetPassword === true ? newPassword() : null;
          await conn.query('update ecglab.instructors set name=$2, cohorts=$3::jsonb, perms=$4::jsonb' + (pw ? ', pw_hash=$5' : '') + ' where id=$1',
            [iid, v.name ?? o.name, JSON.stringify(v.cohorts ?? o.cohorts), JSON.stringify(v.perms ?? o.perms), ...(pw ? [sha(pw)] : [])]);
          return json(200, { instructor: instOut((await conn.query('select * from ecglab.instructors where id = $1', [iid]))[0]), ...(pw ? { password: pw } : {}) });
        }
        if (iid && UUID.test(iid) && method === 'DELETE') {
          await conn.query('delete from ecglab.instructors where id = $1', [iid]);
          return json(200, { ok: true });
        }
        return json(405, { error: 'method_not_allowed' });
      }
      const gated = path.match(/^\/api\/areas\/([a-z]+)$/);
      if (gated && GATED[gated[1]] && method === 'GET') {
        const [setting, data, name] = GATED[gated[1]];
        let open = false;
        try { open = (await effective(url.searchParams.get('cohort')))[setting] === true; } catch { open = false; }
        const viewer = open ? null : await who(req);
        if (!open && viewer.role !== 'owner' && viewer.role !== 'instructor') return json(403, { error: 'locked', detail: `The ${name} isn't open yet.` });
        return json(200, data);
      }
      if (path === '/api/health' && method === 'GET') {
        const settings = { instructorPassword: Boolean(env.INSTRUCTOR_PASSWORD), classCode: Boolean(env.CLASS_CODE) };  // the scoreboard can also set one
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
      if (path === '/api/survey' && method === 'GET') {
        return json(200, { version: SURVEY_VERSION, likert: LIKERT, confidence: CONFIDENCE, sections: SURVEY });
      }
      const m = path.match(/^\/api\/scores(?:\/([^/]+))?(\/survey)?$/);
      if (!m) return json(404, { error: 'not_found', path: url.pathname, hint: 'Try /api/health on this site.' });
      const id = m[1];
      if (!env.DATABASE_URL && !env.ECG_LOCAL_DB) return json(503, { error: 'scoring_not_configured', detail: 'DATABASE_URL is not set in Netlify, so scores can\'t be saved. Add it and redeploy.' });
      if (!env.ECG_LOCAL_DB) {
        const urlCheck = describeDatabaseUrl(env.DATABASE_URL);
        if (!urlCheck.ok) return json(503, { error: 'database_url', detail: urlCheck.detail });
      }

      if (m[2]) {
        if (method !== 'PUT' || !id) return json(405, { error: 'method_not_allowed' });
        if (!UUID.test(id)) return json(400, { error: 'bad_id' });
        const raw = await req.text();
        if (raw.length > MAX_BODY) return json(413, { error: 'too_large' });
        let body; try { body = JSON.parse(raw); } catch { return json(400, { error: 'bad_json' }); }
        if (!(await codeOk(body.code))) {
          return json(403, { error: 'class_code' });
        }
        const checked = validateSurvey(body.answers);
        if (checked.error) return json(400, { error: checked.error, question: checked.question });
        const conn = await db();
        // The survey opens once a student's saved results show at least 10% of the strips and megacode decisions answered.
        const done = await conn.query(
          `update ecglab.scores set survey = $2::jsonb, survey_at = now(), survey_anonymous = $3
           where id = $1 and strips_total + mega_total > 0 and (strips_answered + mega_answered) * 100 >= (strips_total + mega_total) * $4
           returning id`,
          [id.toLowerCase(), JSON.stringify({ v: SURVEY_VERSION, answers: checked.answers }), body.anonymous === true, SURVEY_UNLOCK_PCT],
        );
        if (!done.length) return json(409, { error: 'not_complete', detail: `The survey opens after ${SURVEY_UNLOCK_PCT}% of the strips and megacode decisions are answered and saved.` });
        return json(200, { ok: true });
      }

      if (method === 'PUT' && id) {
        if (!UUID.test(id)) return json(400, { error: 'bad_id' });
        const len = Number(req.headers.get('content-length') || 0);
        if (len > MAX_BODY) return json(413, { error: 'too_large' });
        const raw = await req.text();
        if (raw.length > MAX_BODY) return json(413, { error: 'too_large' });
        let body; try { body = JSON.parse(raw); } catch { return json(400, { error: 'bad_json' }); }
        if (!(await codeOk(body.code))) {
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
        const w = await who(req);
        if (w.role !== 'owner' && w.role !== 'instructor') return authFail(w);
        const conn = await db();
        const scope = w.role === 'owner' ? null : w.cohorts.map(norm);
        if (method === 'DELETE') {
          if (!UUID.test(id)) return json(400, { error: 'bad_id' });
          if (!w.perms.delete) return json(403, { error: 'forbidden', detail: 'You don\'t have permission to remove students.' });
          if (scope) await conn.query('delete from ecglab.scores where id = $1 and lower(btrim(cohort)) = any($2::text[])', [id.toLowerCase(), scope]);
          else await conn.query('delete from ecglab.scores where id = $1', [id.toLowerCase()]);
          return json(200, { ok: true });
        }
        const rows = scope
          ? await conn.query('select * from ecglab.scores where lower(btrim(cohort)) = any($1::text[]) order by updated_at desc limit 2000', [scope])
          : await conn.query('select * from ecglab.scores order by updated_at desc limit 2000');
        let out = rows.map(rowOut);
        if (!w.perms.survey) out = out.map((r) => ({ ...r, survey: null, surveyAt: null, surveyAnonymous: false, surveyHidden: true }));
        return json(200, { rows: out, me: meOut(w) });
      }
      return json(405, { error: 'method_not_allowed' });
    } catch (err) {
      console.error('[Cardiac Lab] API error:', scrub(err?.message || String(err), env.DATABASE_URL));
      return json(500, { error: 'database', detail: explainDatabaseError(err, env.DATABASE_URL) + (env.DATABASE_URL ? ` (Connecting to ${describeDatabaseUrl(env.DATABASE_URL).target || 'an invalid address'}.)` : '') });
    }
  };
}
