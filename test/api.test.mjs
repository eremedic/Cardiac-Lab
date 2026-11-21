// API tests against an in-memory Postgres (PGlite).  npm test
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createApi, validateDoc } from '../lib/api.mjs';
import { connectMemory } from '../lib/db.mjs';

const ID = '3f2b8c1e-5d4a-4e6b-9c7d-2a1b0c9d8e7f';
const ID2 = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const doc = (c = 10, a = 12) => ({
  strips: { c, a, n: 102 }, mega: { c: 5, a: 6, n: 66 }, overall: 9,
  groups: { sinus: [3, 4, 17] }, cases: [[2, 3, 3]], p: { 1: 'Atrial fibrillation' }, m: { '0-0': 1 },
});
let db;
before(async () => { db = await connectMemory(); });

const make = (env) => createApi({ getDb: async () => db, env: { ECG_LOCAL_DB: '1', ...env }, failDelayMs: 0 });
const req = (method, path, { body, auth } = {}) => new Request('http://x' + path, {
  method,
  headers: { 'content-type': 'application/json', ...(auth ? { authorization: 'Bearer ' + auth } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
});

test('config reports scoring and class-code settings', async () => {
  const r = await make({ CLASS_CODE: 'ACLS1' })(req('GET', '/api/config'));
  assert.deepEqual(await r.json(), { scoring: true, requireCode: true, instructor: false, features: { twelveLead: false, defibLab: false, fieldStrips: false } });
});

test('scores routes say so when no database is configured', async () => {
  const api = createApi({ getDb: async () => db, env: {}, failDelayMs: 0 });
  const r = await api(req('PUT', '/api/scores/' + ID, { body: { name: 'A', doc: doc() } }));
  assert.equal(r.status, 503);
});

test('student saves, instructor reads, updates replace the row', async () => {
  const api = make({ INSTRUCTOR_PASSWORD: 'secret' });
  assert.equal((await api(req('PUT', '/api/scores/' + ID, { body: { name: '  Jane   Doe ', cohort: 'PCP 2026', doc: doc() } }))).status, 200);
  assert.equal((await api(req('PUT', '/api/scores/' + ID, { body: { name: 'Jane Doe', cohort: 'PCP 2026', doc: doc(11, 13) } }))).status, 200);
  const r = await api(req('GET', '/api/scores', { auth: 'secret' }));
  assert.equal(r.status, 200);
  const { rows } = await r.json();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Jane Doe');
  assert.deepEqual(rows[0].strips, { c: 11, a: 13, n: 102 });
  assert.deepEqual(rows[0].groups, { sinus: [3, 4, 17] });
  assert.equal(rows[0].p['1'], 'Atrial fibrillation');
});

test('instructor routes need the right password', async () => {
  const api = make({ INSTRUCTOR_PASSWORD: 'secret' });
  assert.equal((await api(req('GET', '/api/scores'))).status, 401);
  assert.equal((await api(req('GET', '/api/scores', { auth: 'wrong' }))).status, 401);
  assert.equal((await make({})(req('GET', '/api/scores', { auth: 'x' }))).status, 503);
});

test('class code is enforced when set (case-insensitive)', async () => {
  const api = make({ CLASS_CODE: 'Cardio2026' });
  assert.equal((await api(req('PUT', '/api/scores/' + ID2, { body: { name: 'B', code: 'nope', doc: doc() } }))).status, 403);
  assert.equal((await api(req('PUT', '/api/scores/' + ID2, { body: { name: 'B', code: 'cardio2026', doc: doc() } }))).status, 200);
});

test('bad input is rejected', async () => {
  const api = make({});
  assert.equal((await api(req('PUT', '/api/scores/not-a-uuid', { body: { name: 'A', doc: doc() } }))).status, 400);
  assert.equal((await api(req('PUT', '/api/scores/' + ID, { body: { name: '', doc: doc() } }))).status, 400);
  assert.equal((await api(req('PUT', '/api/scores/' + ID, { body: { name: 'A', doc: { ...doc(), strips: { c: 9, a: 5, n: 102 } } } }))).status, 400);
  assert.equal((await api(req('PUT', '/api/scores/' + ID, { body: { name: 'A', doc: { ...doc(), overall: 140 } } }))).status, 400);
  assert.equal((await api(req('POST', '/api/scores'))).status, 405);
});

test('instructor can remove a student', async () => {
  const api = make({ INSTRUCTOR_PASSWORD: 'secret' });
  assert.equal((await api(req('DELETE', '/api/scores/' + ID2, { auth: 'secret' }))).status, 200);
  const { rows } = await (await api(req('GET', '/api/scores', { auth: 'secret' }))).json();
  assert.ok(!rows.some((r) => r.id === ID2));
});

test('practice-area progress is stored and returned', async () => {
  const api = make({ INSTRUCTOR_PASSWORD: 'secret' });
  const AID = '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d';
  const areas = { sinus: [40, 50, 50], block: [3, 7, 50], bad: [9, 2, 50] };
  assert.equal((await api(req('PUT', '/api/scores/' + AID, { body: { name: 'Area Tester', doc: { ...doc(), areas } } }))).status, 200);
  const { rows } = await (await api(req('GET', '/api/scores', { auth: 'secret' }))).json();
  const row = rows.find((r) => r.id === AID);
  assert.deepEqual(row.areas, { sinus: [40, 50, 50], block: [3, 7, 50] });
});

test('validateDoc strips unexpected keys and control characters', () => {
  const v = validateDoc({ ...doc(), extra: 'x', p: { 5: 'Sinus\u0000 rhythm', bad: 'y' } });
  assert.equal(v.extra, undefined);
  assert.deepEqual(v.p, { 5: 'Sinus rhythm' });
});

import { describeDatabaseUrl, explainDatabaseError } from '../lib/diagnose.mjs';

test('DATABASE_URL problems are explained', () => {
  const pool = 'postgresql://postgres.abcd1234:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres';
  assert.equal(describeDatabaseUrl(pool).ok, true);
  assert.match(describeDatabaseUrl('').detail, /not set/);
  assert.match(describeDatabaseUrl(pool.replace('pw', '[YOUR-PASSWORD]')).detail, /placeholder/);
  const direct = describeDatabaseUrl('postgresql://postgres:pw@db.abcd1234.supabase.co:5432/postgres');
  assert.equal(direct.ok, true); // allowed: works with Supabase's IPv4 add-on
  assert.match(direct.warning, /IPv4 add-on/);
  assert.equal(direct.target, 'db.abcd1234.supabase.co:5432 as postgres');
  assert.match(describeDatabaseUrl('postgresql://postgres:pw@db.abcd1234.supabase.co:6543/postgres').warning, /dedicated pooler/);
  assert.match(describeDatabaseUrl(pool.replace('postgres.abcd1234', 'postgres')).detail, /postgres\.<your-project-ref>/);
  assert.match(describeDatabaseUrl(pool.replace(':pw@', ':p@ss@')).detail, /%40/);
  assert.match(describeDatabaseUrl(pool + '\n').detail, /line break/);
  assert.match(explainDatabaseError({ code: '28P01' }), /Wrong database password/);
  assert.match(explainDatabaseError({ message: 'Tenant or user not found' }), /user name/);
});

test('an unreachable Direct-connection host is explained, with the address in use', async () => {
  const err = Object.assign(new Error('connect ENETUNREACH 2600:1f18::1:5432'), { code: 'ENETUNREACH' });
  const api = createApi({ getDb: async () => { throw err; }, env: { DATABASE_URL: 'postgresql://postgres:pw@db.x1.supabase.co:5432/postgres', INSTRUCTOR_PASSWORD: 's' }, failDelayMs: 0 });
  const h = await (await api(req('GET', '/api/health'))).json();
  assert.equal(h.ok, false);
  assert.equal(h.connectingTo, 'db.x1.supabase.co:5432 as postgres');
  assert.match(h.detail, /SHARED pooler/);
  const r = await api(req('GET', '/api/scores', { auth: 's' }));
  assert.equal(r.status, 500);
  assert.match((await r.json()).detail, /IPv6.*db\.x1\.supabase\.co:5432/s);
  assert.equal((await api(req('PUT', '/api/scores/' + ID, { body: { name: 'A', doc: doc() } }))).status, 500);
});

test('a database failure returns an explanation', async () => {
  const err = Object.assign(new Error('password authentication failed for user "postgres"'), { code: '28P01' });
  const api = createApi({ getDb: async () => { throw err; }, env: { DATABASE_URL: 'postgresql://postgres.abc:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres', INSTRUCTOR_PASSWORD: 's' }, failDelayMs: 0 });
  const r = await api(req('GET', '/api/scores', { auth: 's' }));
  assert.equal(r.status, 500);
  assert.match((await r.json()).detail, /Wrong database password/);
  const h = await api(req('GET', '/api/health'));
  assert.equal(h.status, 503);
  assert.doesNotMatch(JSON.stringify(await h.json()), /:pw@/);
});

test('the Netlify internal function address works too', async () => {
  const api = make({ INSTRUCTOR_PASSWORD: 'secret' });
  const h = await api(new Request('http://x/.netlify/functions/api/health'));
  assert.equal(h.status, 200);
  assert.equal((await api(new Request('http://x/api/health/'))).status, 200);
  assert.equal((await api(new Request('http://x/api/health.'))).status, 200);
  assert.equal((await api(new Request('http://x/api/health),'))).status, 200);
  assert.equal((await api(new Request('http://x/.netlify/functions/api/scores', { headers: { authorization: 'Bearer secret' } }))).status, 200);
  assert.equal((await api(new Request('http://x/api'))).status, 200);
  const nf = await api(new Request('http://x/api/nope'));
  assert.equal(nf.status, 404);
  assert.equal((await nf.json()).path, '/api/nope');
});

import { QUESTIONS } from '../lib/survey.mjs';

const fullAnswers = () => {
  const a = {};
  for (const q of QUESTIONS) {
    if (q.type === 'choice') a[q.id] = q.options[0];
    else if (q.type === 'multi') a[q.id] = q.options.slice(0, 2);
    else if (q.type === 'likert' || q.type === 'stars') a[q.id] = 4;
    else if (q.type === 'nps') a[q.id] = 9;
    else if (q.type === 'confidence') a[q.id] = { before: 2, now: 4 };
    else if (q.type === 'text') a[q.id] = 'Great  course\u0007';
  }
  return a;
};

test('survey questions are served', async () => {
  const r = await make({})(req('GET', '/api/survey'));
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.ok(j.sections.length >= 4);
  assert.equal(j.likert.length, 5);
});

test('survey opens after 10% of the program is answered, then the instructor sees it', async () => {
  const SID = '7c1e2d3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
  const api = make({ INSTRUCTOR_PASSWORD: 'secret' });
  const send = (body) => api(req('PUT', `/api/scores/${SID}/survey`, { body }));
  // no saved results yet
  assert.equal((await send({ answers: fullAnswers() })).status, 409);
  // 16 of 168 answered: just under 10%
  await api(req('PUT', '/api/scores/' + SID, { body: { name: 'Sam', doc: { ...doc(), strips: { c: 8, a: 10, n: 102 } } } }));
  assert.equal((await send({ answers: fullAnswers() })).status, 409);
  // 17 of 168 answered: 10%
  const finished = { ...doc(), strips: { c: 8, a: 11, n: 102 }, mega: { c: 5, a: 6, n: 66 }, overall: 8 };
  await api(req('PUT', '/api/scores/' + SID, { body: { name: 'Sam', doc: finished } }));
  const bad = fullAnswers(); delete bad.overall;
  const miss = await send({ answers: bad });
  assert.equal(miss.status, 400);
  assert.equal((await miss.json()).question, 'overall');
  assert.equal((await send({ answers: { ...fullAnswers(), recommend: 11 } })).status, 400);
  assert.equal((await send({ answers: { ...fullAnswers(), role: 'Pilot' } })).status, 400);
  assert.equal((await send({ answers: { ...fullAnswers(), worth_paying: ['Free pizza'] } })).status, 400);
  assert.equal((await send({ answers: { ...fullAnswers(), worth_paying: QUESTIONS.find((q) => q.id === 'worth_paying').options.slice(0, 4) } })).status, 400);
  const noPrice = fullAnswers(); delete noPrice.max_monthly;
  assert.equal((await (await send({ answers: noPrice })).json()).question, 'max_monthly');
  const ok = await send({ answers: { ...fullAnswers(), role: undefined, sneaky: 'x' }, anonymous: true });
  assert.equal(ok.status, 200);
  const { rows } = await (await api(req('GET', '/api/scores', { auth: 'secret' }))).json();
  const sam = rows.find((r) => r.id === SID);
  assert.equal(sam.surveyAnonymous, true);
  assert.ok(sam.surveyAt > 0);
  assert.equal(sam.survey.answers.helpful, 'Great course');
  assert.equal(sam.survey.answers.sneaky, undefined);
  assert.equal(sam.survey.answers.role, undefined);
  assert.deepEqual(sam.survey.answers.conf_blocks, { before: 2, now: 4 });
  assert.equal(sam.survey.answers.worth_paying.length, 2);
});

test('survey respects the class code', async () => {
  const api = make({ CLASS_CODE: 'abc' });
  const r = await api(req('PUT', `/api/scores/${ID}/survey`, { body: { code: 'nope', answers: fullAnswers() } }));
  assert.equal(r.status, 403);
});

test('12-lead area stays closed until the instructor opens it', async () => {
  const api = make({ INSTRUCTOR_PASSWORD: 'secret' });
  const cfg0 = await (await api(req('GET', '/api/config'))).json();
  assert.equal(cfg0.features.twelveLead, false);
  // students are refused; the instructor can preview
  assert.equal((await api(req('GET', '/api/areas/twelve'))).status, 403);
  const preview = await api(req('GET', '/api/areas/twelve', { auth: 'secret' }));
  assert.equal(preview.status, 200);
  const data = await preview.json();
  assert.equal(data.items.length, 150);
  assert.ok(data.items.every((it) => it.hints.length === 3));
  assert.ok(data.items.every((it) => it.mk && it.mk.b.length && Array.isArray(it.mk.f)));
  assert.equal(data.items.filter((it) => it.field).length, 50);
  assert.ok(data.items.every((it) => Object.keys(it.leads).length === 13));
  // only the instructor can change settings, and only known ones
  assert.equal((await api(req('PUT', '/api/settings', { body: { twelveLead: true } }))).status, 401);
  assert.equal((await api(req('PUT', '/api/settings', { auth: 'secret', body: { twelveLead: 'yes' } }))).status, 400);
  assert.equal((await api(req('PUT', '/api/settings', { auth: 'secret', body: { other: true } }))).status, 400);
  const on = await api(req('PUT', '/api/settings', { auth: 'secret', body: { twelveLead: true } }));
  assert.deepEqual((await on.json()).settings, { twelveLead: true, defibLab: false, fieldStrips: false });
  assert.equal((await (await api(req('GET', '/api/config'))).json()).features.twelveLead, true);
  assert.equal((await api(req('GET', '/api/areas/twelve'))).status, 200);
  // and close it again
  await api(req('PUT', '/api/settings', { auth: 'secret', body: { twelveLead: false } }));
  assert.equal((await api(req('GET', '/api/areas/twelve'))).status, 403);
});

test('defib lab: switch defaults off and scenario results are validated and stored', async () => {
  const api = make({ INSTRUCTOR_PASSWORD: 'secret' });
  assert.equal((await (await api(req('GET', '/api/config'))).json()).features.defibLab, false);
  const on = await api(req('PUT', '/api/settings', { auth: 'secret', body: { defibLab: true } }));
  assert.equal((await on.json()).settings.defibLab, true);
  assert.equal((await (await api(req('GET', '/api/config'))).json()).features.defibLab, true);
  await api(req('PUT', '/api/settings', { auth: 'secret', body: { defibLab: false } }));
  // only well-formed [correct, total, passed] triples survive
  const v = validateDoc({ ...doc(), defib: { vf: [6, 7, 1], chb: [3, 6, 0], bad: [9, 6, 1], x: [1, 2, 0], pea: [1, 2, 'yes'] } });
  assert.deepEqual(v.defib, { vf: [6, 7, 1], chb: [3, 6, 0] });
  assert.equal((await api(req('PUT', '/api/scores/' + ID2, { body: { name: 'Dee', doc: { ...doc(), defib: { vf: [7, 7, 1] } } } }))).status, 200);
  const rows = (await (await api(req('GET', '/api/scores', { auth: 'secret' }))).json()).rows;
  assert.deepEqual(rows.find((r) => r.id === ID2).defib, { vf: [7, 7, 1] });
});

test('field strips stay closed until the instructor opens them', async () => {
  const api = make({ INSTRUCTOR_PASSWORD: 'secret' });
  assert.equal((await (await api(req('GET', '/api/config'))).json()).features.fieldStrips, false);
  assert.equal((await api(req('GET', '/api/areas/field'))).status, 403);
  const preview = await api(req('GET', '/api/areas/field', { auth: 'secret' }));
  assert.equal(preview.status, 200);
  const data = await preview.json();
  assert.equal(data.items.length, 100);
  assert.equal(Object.keys(data.strips).length, 100);
  assert.ok(data.items.every((it) => data.strips[it.strip] && it.hints.length === 3 && it.options.length === 4 && it.options.includes(it.cat)));
  assert.ok(data.items.every((it) => it.rows.some(([k]) => k === 'Artifact')));
  assert.equal((await api(req('GET', '/api/areas/nope', { auth: 'secret' }))).status, 404);
  await api(req('PUT', '/api/settings', { auth: 'secret', body: { fieldStrips: true } }));
  assert.equal((await api(req('GET', '/api/areas/field'))).status, 200);
  await api(req('PUT', '/api/settings', { auth: 'secret', body: { fieldStrips: false } }));
  assert.equal((await api(req('GET', '/api/areas/field'))).status, 403);
});

test('instructor accounts: cohort-scoped scores, permissions and per-cohort switches', async () => {
  const api = make({ INSTRUCTOR_PASSWORD: 'secret' });
  const put = (i, name, cohort) => api(req('PUT', '/api/scores/' + i, { body: { name, cohort, doc: doc() } }));
  const A1 = 'aa000000-0000-4000-8000-000000000001', A2 = 'aa000000-0000-4000-8000-000000000002', B1 = 'bb000000-0000-4000-8000-000000000001';
  await put(A1, 'Ann', 'PCP Spring'); await put(A2, 'Abe', ' pcp spring '); await put(B1, 'Bo', 'ACP Fall');
  // only the owner manages instructors
  assert.equal((await api(req('POST', '/api/instructors', { body: { name: 'X', cohorts: ['a'] } }))).status, 401);
  assert.equal((await api(req('POST', '/api/instructors', { auth: 'secret', body: { name: 'X', cohorts: [] } }))).status, 400);
  const made = await (await api(req('POST', '/api/instructors', { auth: 'secret', body: { name: 'Dana', cohorts: ['PCP Spring'], perms: { twelveLead: true, print: true, bogus: true } } }))).json();
  assert.match(made.password, /^[a-z2-9]{5}-[a-z2-9]{5}-[a-z2-9]{5}$/);
  assert.deepEqual(made.instructor.perms, { twelveLead: true, print: true });
  const pw = made.password;
  // the instructor sees only their cohort, without survey answers, and can't manage instructors
  const me = await (await api(req('GET', '/api/me', { auth: pw.toUpperCase() }))).json();
  assert.equal(me.me.role, 'instructor');
  const mine = await (await api(req('GET', '/api/scores', { auth: pw }))).json();
  assert.deepEqual(mine.rows.map((r) => r.name).sort(), ['Abe', 'Ann']);
  assert.ok(mine.rows.every((r) => r.survey === null && r.surveyHidden));
  assert.equal((await api(req('GET', '/api/instructors', { auth: pw }))).status, 403);
  assert.equal((await api(req('DELETE', '/api/scores/' + A1, { auth: pw }))).status, 403);
  // switches: only for their cohort and only the ones they were given
  assert.equal((await api(req('PUT', '/api/settings', { auth: pw, body: { twelveLead: true } }))).status, 403);
  assert.equal((await api(req('PUT', '/api/settings', { auth: pw, body: { cohort: 'ACP Fall', twelveLead: true } }))).status, 403);
  assert.equal((await api(req('PUT', '/api/settings', { auth: pw, body: { cohort: 'PCP Spring', defibLab: true } }))).status, 403);
  const set = await (await api(req('PUT', '/api/settings', { auth: pw, body: { cohort: 'PCP Spring', twelveLead: true } }))).json();
  assert.equal(set.cohorts['PCP Spring'].twelveLead, true);
  assert.equal(set.settings.twelveLead, false);
  // students in that cohort get the 12-lead area; others don't
  assert.equal((await (await api(req('GET', '/api/config?cohort=pcp%20spring'))).json()).features.twelveLead, true);
  assert.equal((await (await api(req('GET', '/api/config?cohort=ACP%20Fall'))).json()).features.twelveLead, false);
  assert.equal((await api(req('GET', '/api/areas/twelve?cohort=PCP%20Spring'))).status, 200);
  assert.equal((await api(req('GET', '/api/areas/twelve?cohort=ACP%20Fall'))).status, 403);
  // owner: give delete, reset the password (old one stops working), then remove the account
  const upd = await (await api(req('PUT', '/api/instructors/' + made.instructor.id, { auth: 'secret', body: { perms: { delete: true }, resetPassword: true } }))).json();
  assert.ok(upd.password && upd.password !== pw);
  assert.equal((await api(req('GET', '/api/me', { auth: pw }))).status, 401);
  assert.equal((await api(req('DELETE', '/api/scores/' + B1, { auth: upd.password }))).status, 200);
  assert.equal((await (await api(req('GET', '/api/scores', { auth: 'secret' }))).json()).rows.filter((r) => r.id === B1).length, 1, 'out-of-cohort delete is a no-op');
  assert.equal((await api(req('DELETE', '/api/scores/' + A2, { auth: upd.password }))).status, 200);
  assert.equal((await (await api(req('GET', '/api/scores', { auth: 'secret' }))).json()).rows.filter((r) => r.id === A2).length, 0);
  await api(req('DELETE', '/api/instructors/' + made.instructor.id, { auth: 'secret' }));
  assert.equal((await api(req('GET', '/api/me', { auth: upd.password }))).status, 401);
  await api(req('PUT', '/api/settings', { auth: 'secret', body: { cohort: 'PCP Spring', twelveLead: false } }));
});
