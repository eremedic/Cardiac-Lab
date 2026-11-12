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
  assert.deepEqual(await r.json(), { scoring: true, requireCode: true, instructor: false });
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

test('validateDoc strips unexpected keys and control characters', () => {
  const v = validateDoc({ ...doc(), extra: 'x', p: { 5: 'Sinus\u0000 rhythm', bad: 'y' } });
  assert.equal(v.extra, undefined);
  assert.deepEqual(v.p, { 5: 'Sinus rhythm' });
});
