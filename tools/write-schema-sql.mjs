// Writes supabase/schema.sql from lib/schema.mjs, so the SQL Editor file always matches
// what the API creates automatically.  npm run db:schema
import { writeFileSync } from 'node:fs';
import { SCHEMA_SQL } from '../lib/schema.mjs';

const header = `-- Cardiac Lab database objects (generated from lib/schema.mjs by \`npm run db:schema\`).
-- Optional: the API creates these automatically on first use. To create them yourself,
-- paste this file into Supabase → SQL Editor and run it. Safe to run more than once.
`;
writeFileSync(new URL('../supabase/schema.sql', import.meta.url), header + SCHEMA_SQL.trimStart());
console.log('Wrote supabase/schema.sql');
