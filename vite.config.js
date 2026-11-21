import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  // pg-native is an optional add-on of the Postgres driver that isn't used; PGlite is only for local runs.
  ssr: { external: ['pg', 'pg-native', '@electric-sql/pglite'] },
  server: { port: 8899 }
});
