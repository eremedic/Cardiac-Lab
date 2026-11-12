// Database connections.
//   - DATABASE_URL set: Supabase Postgres via node-postgres (production, Netlify)
//   - otherwise (local dev and tests only): an in-memory PGlite database
//
// Both expose: query(sql, params) -> rows, exec(sql)

export function postgresConfig(url, env = process.env) {
  const parsed = new URL(url);
  const sslmode = parsed.searchParams.get('sslmode');
  parsed.searchParams.delete('sslmode');
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname);
  let ssl = false;
  if (!local && sslmode !== 'disable') {
    // Supabase connections are always encrypted. Set DATABASE_CA_CERT (Supabase →
    // Project Settings → Database → SSL certificate) to also verify the server.
    ssl = env.DATABASE_CA_CERT
      ? { ca: env.DATABASE_CA_CERT.replace(/\\n/g, '\n'), rejectUnauthorized: true }
      : { rejectUnauthorized: false };
  }
  return { connectionString: parsed.toString(), ssl };
}

const STALE = new Set(['ECONNRESET', 'EPIPE', '57P01', '08003', '08006']);
const isStale = (err) => STALE.has(err?.code) || /Connection terminated|connection error/i.test(err?.message || '');

export async function connectPostgres(url) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    ...postgresConfig(url),
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 7_000, // fail clearly before Netlify's 10 s function limit
    query_timeout: 9_000,
  });
  pool.on('error', (err) => console.error('Postgres pool error:', err.message));
  // Serverless hosts drop idle connections while the function sleeps; retry on a fresh one.
  const run = async (sql, params) => {
    for (let i = 1; ; i++) {
      try { return await pool.query(sql, params); } catch (err) { if (!isStale(err) || i >= 4) throw err; }
    }
  };
  return {
    query: async (sql, params = []) => (await run(sql, params)).rows,
    exec: async (sql) => { await run(sql); },
    close: () => pool.end(),
  };
}

export async function connectMemory() {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  return {
    query: async (sql, params = []) => (await db.query(sql, params)).rows,
    exec: async (sql) => { await db.exec(sql); },
    close: () => db.close(),
  };
}

// One connection per warm function instance.
let shared = null;
export function getDb(env = process.env) {
  if (!shared) {
    shared = (env.DATABASE_URL ? connectPostgres(env.DATABASE_URL) : connectMemory())
      .catch((e) => { shared = null; throw e; });
  }
  return shared;
}
