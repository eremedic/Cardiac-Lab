// Reactive view of the course engine for Svelte components.
// `live.snap` is refreshed whenever the engine saves progress, changes sync status or loads settings.
import { app } from './client.js';

export const live = $state({ snap: null });

let connecting = null;
export function connect() {
  if (!connecting) {
    connecting = app().then((a) => {
      live.snap = a.snapshot();
      a.subscribe(() => { live.snap = a.snapshot(); });
      return a;
    });
    connecting.catch(() => { connecting = null; });
  }
  return connecting;
}

// Engine actions the components call (no-ops until the engine has started).
export async function setProfile(field, value) { (await connect()).setProfile(field, value); }
