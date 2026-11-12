// Plain-language explanations for database setup problems. Never returns the password.

// Looks at DATABASE_URL without connecting.
export function describeDatabaseUrl(raw) {
  if (!raw) return { ok: false, detail: 'DATABASE_URL is not set. Add your Supabase Transaction pooler connection string in Netlify → Site configuration → Environment variables, then redeploy.' };
  const value = raw.trim();
  if (value !== raw) return { ok: false, detail: 'DATABASE_URL has spaces or a line break at the start or end. Paste it again without them, then redeploy.' };
  if (/\[?YOUR[-_ ]PASSWORD\]?/i.test(value)) return { ok: false, detail: 'DATABASE_URL still contains the [YOUR-PASSWORD] placeholder. Replace it (including the square brackets) with your database password, then redeploy.' };
  const authority = value.replace(/^[a-z]+:\/\//i, '').split('/')[0];
  if ((authority.match(/@/g) || []).length > 1) return { ok: false, detail: 'The password in DATABASE_URL contains "@". URL-encode it as %40 (and # as %23, / as %2F), then redeploy.' };
  let u;
  try { u = new URL(value); } catch { return { ok: false, detail: 'DATABASE_URL is not a valid connection string. Copy it again from Supabase → Connect → Transaction pooler.' }; }
  if (!/^postgres(ql)?:$/.test(u.protocol)) return { ok: false, detail: 'DATABASE_URL should start with postgresql://. Copy it from Supabase → Connect → Transaction pooler.' };
  if (/pooler\.supabase\.com$/i.test(u.hostname) && !/^postgres\.[a-z0-9]+$/i.test(decodeURIComponent(u.username))) {
    return { ok: false, detail: 'For the Supabase pooler, the user name must be postgres.<your-project-ref> (for example postgres.abcd1234), not just postgres. Copy the full Transaction pooler string from Supabase → Connect, then redeploy.' };
  }
  if (!u.password) return { ok: false, detail: 'DATABASE_URL has no password. Add your database password after the user name (postgres.<ref>:PASSWORD@…), then redeploy.' };
  const target = `${u.hostname}:${u.port || '5432'} as ${decodeURIComponent(u.username)}`;
  let warn = '';
  if (isSupabaseDirectHost(u.hostname)) {
    warn = u.port === '6543'
      ? ' This is Supabase\'s dedicated pooler (db.….supabase.co:6543). It only works from Netlify if your project has the IPv4 add-on; otherwise use the shared pooler string (host ending in pooler.supabase.com).'
      : ' This is Supabase\'s Direct connection (db.….supabase.co:5432). It only works from Netlify if your project has the IPv4 add-on; otherwise use the shared Transaction pooler string (host ending in pooler.supabase.com, port 6543).';
  } else if (/pooler\.supabase\.com$/i.test(u.hostname) && u.port === '5432') {
    warn = ' It uses port 5432 (Session pooler). Port 6543 (Transaction pooler) is better for Netlify.';
  }
  return { ok: true, target, warning: warn.trim() || undefined, detail: `Connecting to ${target}.${warn}` };
}

const isSupabaseDirectHost = (h) => /^db\.[a-z0-9]+\.supabase\.co$/i.test(h || '');
const hostOf = (url) => { try { return new URL(url).hostname; } catch { return ''; } };

// Turns a connection or query error into what to do about it.
export function explainDatabaseError(err, url) {
  const code = err?.code || '';
  const msg = String(err?.message || '');
  const direct = isSupabaseDirectHost(hostOf(url));
  const unreachable = ['ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'ETIMEDOUT', 'ECONNREFUSED'].includes(code) || /timeout|timed out/i.test(msg);
  if (direct && unreachable) return 'Netlify could not reach db.….supabase.co. That address only accepts IPv6 connections unless your Supabase project has the IPv4 add-on, and Netlify uses IPv4. In Supabase → Connect, choose Transaction pooler and copy the SHARED pooler string (host like aws-0-<region>.pooler.supabase.com, port 6543, user postgres.<project-ref>), paste it into DATABASE_URL in Netlify, then redeploy.';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'The database host name was not found. Check the host in DATABASE_URL (copy the Transaction pooler string from Supabase → Connect).';
  if (code === 'ENETUNREACH' || code === 'EHOSTUNREACH') return 'The database could not be reached from Netlify. Use the Transaction pooler string from Supabase → Connect (host ending in pooler.supabase.com), not the Direct connection.';
  if (code === 'ECONNREFUSED') return 'The database refused the connection. Check the port in DATABASE_URL (6543 for the Transaction pooler).';
  if (code === '28P01' || /password authentication failed/i.test(msg)) return 'Wrong database password. Reset it in Supabase → Project Settings → Database, update DATABASE_URL in Netlify, and redeploy. URL-encode symbols in the password (@ → %40, # → %23).';
  if (/tenant or user not found/i.test(msg)) return 'Supabase did not recognize the user name. For the pooler it must be postgres.<your-project-ref>. Copy the full Transaction pooler string from Supabase → Connect.';
  if (code === '3D000') return 'The database name in DATABASE_URL does not exist. It should end in /postgres.';
  if (/self[- ]signed|unable to verify|certificate/i.test(msg)) return 'The SSL certificate check failed. Remove DATABASE_CA_CERT in Netlify, or paste Supabase\'s certificate in full, then redeploy.';
  if (/timeout|timed out/i.test(msg) || code === 'ETIMEDOUT') return 'The database did not answer in time. Check that the Supabase project is not paused (Supabase dashboard → your project → Restore), and that DATABASE_URL uses the Transaction pooler.';
  if (code === '42501' || /permission denied/i.test(msg)) return 'The database user is not allowed to create the ecglab schema. Run supabase/schema.sql in Supabase → SQL Editor once, then reload.';
  if (/max.*clients|too many connections/i.test(msg)) return 'The database has too many open connections. Use the Transaction pooler string (port 6543).';
  return 'The database returned an error. Check DATABASE_URL and that the Supabase project is running.';
}

// Removes anything that looks like the connection string or its password from a message.
export function scrub(text, url) {
  let out = String(text || '');
  if (url) {
    out = out.split(url).join('[DATABASE_URL]');
    try { const p = new URL(url).password; if (p) { out = out.split(p).join('***'); out = out.split(decodeURIComponent(p)).join('***'); } } catch { /* ignore */ }
  }
  return out.replace(/postgres(ql)?:\/\/[^\s"']+/gi, '[connection string]');
}
