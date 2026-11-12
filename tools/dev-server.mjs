// Local preview: serves public/ and the score API on http://localhost:8888
//   npm run dev                      -> in-memory database (scores reset when you stop it)
//   DATABASE_URL="…" npm run dev     -> your Supabase database
// The instructor password defaults to "instructor" locally unless INSTRUCTOR_PASSWORD is set.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi } from '../lib/api.mjs';
import { getDb } from '../lib/db.mjs';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const port = Number(process.env.PORT) || 8888;
const env = { ...process.env };
if (!env.DATABASE_URL) env.ECG_LOCAL_DB = '1';
if (!env.INSTRUCTOR_PASSWORD) env.INSTRUCTOR_PASSWORD = 'instructor';
const api = createApi({ getDb: () => getDb(env), env });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname.startsWith('/api/')) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const r = await api(new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body }));
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
    return;
  }
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '') || 'index.html';
  const file = join(root, rel.endsWith('/') ? rel + 'index.html' : rel);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
  }
}).listen(port, () => {
  console.log(`Cardiac Lab running at http://localhost:${port}`);
  console.log(env.ECG_LOCAL_DB ? 'Database: in-memory (resets on restart)' : 'Database: DATABASE_URL');
  console.log(`Instructor password: ${process.env.INSTRUCTOR_PASSWORD ? '(from INSTRUCTOR_PASSWORD)' : 'instructor'}`);
});
