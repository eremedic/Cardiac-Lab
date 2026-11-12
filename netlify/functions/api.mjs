// Netlify Function serving Cardiac Lab's score API at /api/*.
// The pages in public/ are served directly by Netlify.
import { createApi } from '../../lib/api.mjs';
import { getDb } from '../../lib/db.mjs';

const api = createApi({ getDb: () => getDb(process.env) });

export default async (req) => api(req);

export const config = { path: '/api/*' };
