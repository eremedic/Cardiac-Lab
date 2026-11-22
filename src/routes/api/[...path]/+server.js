// The score API (lib/api.mjs) behind SvelteKit: /api/* on the same origin as the pages.
// Production uses DATABASE_URL (Supabase Postgres). In local dev without one, an in-memory database is used
// and the instructor password defaults to "instructor".
import { dev } from '$app/environment';
import { createApi } from '../../../../lib/api.mjs';
import { getDb } from '../../../../lib/db.mjs';

const env = { ...process.env };
if (dev && !env.DATABASE_URL) env.ECG_LOCAL_DB = '1';
if (dev && !env.INSTRUCTOR_PASSWORD) env.INSTRUCTOR_PASSWORD = 'instructor';
const api = createApi({ getDb: () => getDb(env), env });

const handle = ({ request }) => api(request);
export const GET = handle, POST = handle, PUT = handle, DELETE = handle, PATCH = handle, OPTIONS = handle;
export const prerender = false;
